/**
 * Claude CLI 실행 서비스
 * child_process.spawn으로 claude CLI 호출 및 실시간 출력 스트리밍
 *
 * 핵심 기능:
 * - 브라우저에서 "실행" 버튼 클릭 시 claude -p 명령 실행
 * - stdout/stderr를 실시간으로 Socket.IO로 전달
 * - 대시보드에서 실시간 로그 확인 가능
 */

import { spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

// ============================================================
// 상수 정의
// ============================================================

// 위험한 명령어 패턴
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/(?!\w)/i,           // rm -rf /
  /rm\s+-rf\s+~\//i,                // rm -rf ~/
  /rm\s+-rf\s+\*/i,                 // rm -rf *
  /mkfs\./i,                         // mkfs.ext4 등
  /dd\s+if=\/dev/i,                 // dd if=/dev/...
  />\s*\/dev\/sd[a-z]/i,            // > /dev/sda
  /:$$$$:&$$;:/,                  // Fork bomb
  /chmod\s+-R\s+777\s+\//i,         // chmod -R 777 /
  /curl.*\|\s*bash/i,               // curl | bash
  /wget.*\|\s*bash/i,               // wget | bash
];

// 기본 설정
const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10분
const MAX_OUTPUT_BUFFER = 10 * 1024 * 1024; // 10MB
const STEP_DELAY = 3000; // 스텝 간 3초 딜레이

// ============================================================
// CliRunner 클래스
// ============================================================

export class CliRunner extends EventEmitter {
  /**
   * @param {Server} io - Socket.IO 서버 인스턴스
   */
  constructor(io) {
    super();
    this.io = io;
    this.currentProcess = null;
    this.isRunning = false;
    this.shouldStop = false;
    this.currentStepId = null;
    this.completedSteps = [];
    this.startTime = null;
    this.outputBuffer = '';

    // Claude CLI 존재 여부 확인
    this.claudeAvailable = this._checkClaudeInstalled();
  }

  // ──────────────────────────────────────────────────────────
  // 공개 메서드
  // ──────────────────────────────────────────────────────────

  /**
   * 단일 스텝 실행
   * @param {Object} step - 실행할 스텝
   * @param {string} step.id - 스텝 ID
   * @param {string} step.title - 스텝 제목
   * @param {string} step.prompt - 실행할 프롬프트
   * @param {Object} options - 실행 옵션
   * @param {string} options.projectPath - 작업 디렉토리
   * @param {boolean} options.sessionMode - 세션 모드 (--continue)
   * @param {boolean} options.skipPermissions - 권한 확인 스킵
   * @param {number} options.timeout - 타임아웃 (ms)
   * @returns {Promise<{success: boolean, output: string, duration: number}>}
   */
  async runStep(step, options = {}) {
    // 이미 실행 중인지 확인
    if (this.isRunning) {
      throw new Error('이미 다른 스텝이 실행 중입니다.');
    }

    // Claude CLI 확인
    if (!this.claudeAvailable) {
      throw new Error(
        'Claude CLI를 찾을 수 없습니다.\n' +
        '설치: npm install -g @anthropic-ai/claude-code\n' +
        '또는: https://claude.ai/code 참고'
      );
    }

    // 프롬프트 검증
    const prompt = step.prompt || step.title;
    if (!prompt) {
      throw new Error('실행할 프롬프트가 없습니다.');
    }

    // 위험한 명령어 검사
    const securityCheck = this._checkSecurity(prompt);
    if (!securityCheck.safe) {
      throw new Error(`보안 경고: ${securityCheck.reason}`);
    }

    const {
      projectPath = process.cwd(),
      sessionMode = false,
      skipPermissions = true,
      timeout = DEFAULT_TIMEOUT
    } = options;

    // 상태 초기화
    this.isRunning = true;
    this.shouldStop = false;
    this.currentStepId = step.id;
    this.outputBuffer = '';
    const stepStartTime = Date.now();

    // step-start 이벤트 발생
    this._emitEvent('step-start', {
      stepId: step.id,
      stepTitle: step.title,
      timestamp: new Date().toISOString()
    });

    logger.info(`스텝 실행 시작: ${step.id} - ${step.title}`);

    return new Promise((resolve, reject) => {
      // 명령어 인자 구성
      const args = this._buildArgs(prompt, { sessionMode, skipPermissions });

      logger.debug(`실행 명령: claude ${args.join(' ')}`);

      // 프로세스 spawn
      this.currentProcess = spawn('claude', args, {
        cwd: projectPath,
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: '1', // 색상 출력 유지
          TERM: 'xterm-256color'
        }
      });

      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        if (this.currentProcess) {
          logger.warn(`스텝 ${step.id} 타임아웃 (${timeout}ms)`);
          this.currentProcess.kill('SIGTERM');
          reject(new Error(`타임아웃: ${timeout / 1000}초 초과`));
        }
      }, timeout);

      // stdout 처리
      this.currentProcess.stdout.on('data', (data) => {
        this._handleOutput(step.id, data.toString(), 'stdout');
      });

      // stderr 처리
      this.currentProcess.stderr.on('data', (data) => {
        this._handleOutput(step.id, data.toString(), 'stderr');
      });

      // 프로세스 종료 처리
      this.currentProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - stepStartTime;
        const success = code === 0;

        this.isRunning = false;
        this.currentProcess = null;
        this.currentStepId = null;

        if (success) {
          this.completedSteps.push(step.id);
        }

        // step-complete 이벤트
        this._emitEvent('step-complete', {
          stepId: step.id,
          success,
          exitCode: code,
          duration,
          timestamp: new Date().toISOString()
        });

        logger.info(`스텝 ${step.id} 완료: ${success ? '성공' : '실패'} (${duration}ms)`);

        resolve({
          success,
          output: this.outputBuffer,
          duration,
          exitCode: code
        });
      });

      // 에러 처리
      this.currentProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        this.isRunning = false;
        this.currentProcess = null;
        this.currentStepId = null;

        // step-error 이벤트
        this._emitEvent('step-error', {
          stepId: step.id,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        logger.error(`스텝 ${step.id} 에러:`, error);
        reject(error);
      });
    });
  }

  /**
   * 여러 스텝 순차 실행
   * @param {Array} steps - 스텝 배열
   * @param {Object} options - 실행 옵션
   * @param {boolean} options.stopOnError - 에러 시 중단 여부
   * @param {number} options.stepDelay - 스텝 간 딜레이 (ms)
   */
  async runAllSteps(steps, options = {}) {
    if (this.isRunning) {
      throw new Error('이미 실행 중입니다.');
    }

    const {
      stopOnError = true,
      stepDelay = STEP_DELAY,
      ...stepOptions
    } = options;

    this.startTime = Date.now();
    this.completedSteps = [];
    this.shouldStop = false;

    const totalSteps = steps.length;
    let currentIndex = 0;

    logger.info(`전체 실행 시작: ${totalSteps}개 스텝`);

    // run-start 이벤트
    this._emitEvent('run-start', {
      totalSteps,
      timestamp: new Date().toISOString()
    });

    for (const step of steps) {
      // 중지 요청 확인
      if (this.shouldStop) {
        logger.info('사용자에 의해 실행 중지됨');
        this._emitEvent('run-stopped', {
          reason: 'user_requested',
          completedSteps: this.completedSteps.length,
          totalSteps
        });
        return;
      }

      currentIndex++;

      // step-start 이벤트 (인덱스 포함)
      this._emitEvent('step-start', {
        stepId: step.id,
        stepTitle: step.title,
        index: currentIndex,
        total: totalSteps,
        timestamp: new Date().toISOString()
      });

      try {
        const result = await this.runStep(step, stepOptions);

        if (!result.success && stopOnError) {
          logger.warn(`스텝 ${step.id} 실패로 실행 중단`);
          this._emitEvent('run-stopped', {
            reason: 'step_failed',
            failedStep: step.id,
            completedSteps: this.completedSteps.length,
            totalSteps
          });
          return;
        }
      } catch (error) {
        logger.error(`스텝 ${step.id} 실행 오류:`, error);

        this._emitEvent('step-error', {
          stepId: step.id,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        if (stopOnError) {
          this._emitEvent('run-stopped', {
            reason: 'error',
            error: error.message,
            failedStep: step.id,
            completedSteps: this.completedSteps.length,
            totalSteps
          });
          return;
        }
      }

      // 다음 스텝 전 딜레이 (마지막 스텝 제외)
      if (currentIndex < totalSteps && stepDelay > 0) {
        await this._delay(stepDelay);
      }
    }

    // 전체 완료
    const totalDuration = Date.now() - this.startTime;

    this._emitEvent('run-complete', {
      totalSteps,
      completedSteps: this.completedSteps.length,
      duration: totalDuration,
      timestamp: new Date().toISOString()
    });

    logger.info(`전체 실행 완료: ${this.completedSteps.length}/${totalSteps} 성공 (${totalDuration}ms)`);
  }

  /**
   * 실행 중지
   */
  stop() {
    this.shouldStop = true;

    if (this.currentProcess) {
      logger.info('프로세스 종료 요청');

      // 먼저 SIGTERM 시도
      this.currentProcess.kill('SIGTERM');

      // 5초 후에도 안 죽으면 SIGKILL
      setTimeout(() => {
        if (this.currentProcess) {
          this.currentProcess.kill('SIGKILL');
        }
      }, 5000);
    }

    this._emitEvent('run-stopped', {
      reason: 'user_requested',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 현재 상태 조회
   * @returns {Object} 상태 정보
   */
  getStatus() {
    return {
      running: this.isRunning,
      currentStep: this.currentStepId,
      completedSteps: [...this.completedSteps],
      claudeAvailable: this.claudeAvailable,
      uptime: this.startTime ? Date.now() - this.startTime : 0
    };
  }

  // ──────────────────────────────────────────────────────────
  // 비공개 메서드
  // ──────────────────────────────────────────────────────────

  /**
   * Claude CLI 설치 확인
   */
  _checkClaudeInstalled() {
    try {
      // Windows와 Unix 호환
      const command = process.platform === 'win32' ? 'where claude' : 'which claude';
      execSync(command, { stdio: 'ignore' });
      logger.info('Claude CLI 확인됨');
      return true;
    } catch {
      logger.warn('Claude CLI를 찾을 수 없음');
      return false;
    }
  }

  /**
   * 보안 검사
   * @param {string} prompt - 검사할 프롬프트
   * @returns {{safe: boolean, reason?: string}}
   */
  _checkSecurity(prompt) {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(prompt)) {
        return {
          safe: false,
          reason: `위험한 패턴 감지: ${pattern.toString()}`
        };
      }
    }
    return { safe: true };
  }

  /**
   * CLI 인자 구성
   */
  _buildArgs(prompt, options) {
    const args = [];

    // 프롬프트 모드
    args.push('-p');

    // 권한 스킵
    if (options.skipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    // 세션 모드 (resume 우선)
    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    } else if (options.sessionMode) {
      args.push('--continue');
    }

    // 프롬프트 내용 (쌍따옴표로 감싸기)
    // Windows와 Unix에서 다르게 처리
    const escapedPrompt = prompt
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    args.push(`"${escapedPrompt}"`);

    return args;
  }

  /**
   * 출력 처리 및 이벤트 발생
   */
  _handleOutput(stepId, data, type) {
    // 버퍼 크기 제한
    if (this.outputBuffer.length < MAX_OUTPUT_BUFFER) {
      this.outputBuffer += data;
    }

    // 줄 단위로 분리하여 이벤트 발생
    const lines = data.split('\n');

    for (const line of lines) {
      if (line.trim()) {
        this._emitEvent('step-output', {
          stepId,
          line: line,
          type, // stdout 또는 stderr
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Socket.IO 이벤트 발생
   */
  _emitEvent(eventName, data) {
    // Socket.IO로 브로드캐스트
    if (this.io) {
      this.io.emit(eventName, data);
    }

    // EventEmitter로도 발생 (내부 사용)
    this.emit(eventName, data);

    logger.debug(`이벤트 발생: ${eventName}`, data);
  }

  /**
   * 딜레이 유틸리티
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// Socket.IO 핸들러 설정
// ============================================================

let runnerInstance = null;

/**
 * Socket.IO 핸들러 설정
 * @param {Server} io - Socket.IO 서버
 * @param {Socket} socket - 클라이언트 소켓
 */
export function setupSocketHandlers(io, socket) {
  // 싱글톤 Runner 인스턴스
  if (!runnerInstance) {
    runnerInstance = new CliRunner(io);
  }

  // 단일 스텝 실행 요청
  socket.on('execute:step', async (data) => {
    const { step, options } = data;

    try {
      const result = await runnerInstance.runStep(step, options);
      socket.emit('execute:result', {
        success: true,
        ...result
      });
    } catch (error) {
      socket.emit('execute:error', {
        error: error.message
      });
    }
  });

  // 전체 스텝 실행 요청
  socket.on('execute:all', async (data) => {
    const { steps, options } = data;

    try {
      await runnerInstance.runAllSteps(steps, options);
    } catch (error) {
      socket.emit('execute:error', {
        error: error.message
      });
    }
  });

  // 실행 중지 요청
  socket.on('execute:stop', () => {
    runnerInstance.stop();
  });

  // 상태 조회
  socket.on('execute:status', () => {
    const status = runnerInstance.getStatus();
    socket.emit('execute:status', status);
  });
}

/**
 * REST API용 함수들
 */

/**
 * 스텝 실행 (REST API용)
 */
export async function executeStep(sessionId, step, options = {}) {
  if (!runnerInstance) {
    throw new Error('Runner가 초기화되지 않았습니다. Socket.IO 연결이 필요합니다.');
  }

  return runnerInstance.runStep(step, options);
}

/**
 * 실행 중지
 */
export function stopExecution() {
  if (runnerInstance) {
    runnerInstance.stop();
  }
}

/**
 * 상태 조회
 */
export function getStatus(executionId) {
  if (runnerInstance) {
    return runnerInstance.getStatus();
  }
  return null;
}

export default {
  CliRunner,
  setupSocketHandlers,
  executeStep,
  stopExecution,
  getStatus
};
