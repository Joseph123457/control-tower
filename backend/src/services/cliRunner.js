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
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';
import { tmpdir, homedir } from 'os';
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
      // 긴 프롬프트 여부 확인
      const MAX_INLINE_PROMPT = 1500;
      const isLongPrompt = prompt.length > MAX_INLINE_PROMPT;

      // 환경 변수 설정
      const spawnEnv = {
        ...process.env,
        FORCE_COLOR: '1',
        TERM: 'xterm-256color'
      };

      // 기본 인자
      const baseArgs = ['--dangerously-skip-permissions'];
      if (sessionMode) {
        baseArgs.push('--continue');
      }

      if (isLongPrompt) {
        // 긴 프롬프트: stream-json 입력 형식 사용
        logger.info(`긴 프롬프트 처리: ${prompt.length}자 (stream-json)`);

        const args = [
          '-p',
          ...baseArgs,
          '--input-format', 'stream-json',
          '--output-format', 'stream-json',
          '--verbose'
        ];

        const command = `claude ${args.join(' ')}`;
        logger.debug(`실행 명령: ${command} (stdin으로 JSON 전달)`);

        // shell: true로 실행하되 stdin pipe 열어두기
        this.currentProcess = spawn(command, [], {
          cwd: projectPath,
          shell: true,
          env: spawnEnv,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // stream-json 올바른 형식으로 프롬프트 전달
        // 형식: {"type":"user","message":{"role":"user","content":"..."}}
        const jsonMessage = JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: prompt
          }
        });

        // stdin에 JSON 메시지 쓰기
        this.currentProcess.stdin.write(jsonMessage + '\n');
        this.currentProcess.stdin.end();

        // stream-json 출력을 파싱하여 텍스트로 변환하는 플래그 설정
        this._isStreamJson = true;

      } else {
        // 짧은 프롬프트: 직접 인자로 전달
        const escapedPrompt = prompt
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"');

        const args = ['-p', ...baseArgs, `"${escapedPrompt}"`];
        const command = `claude ${args.join(' ')}`;

        logger.debug(`실행 명령: claude -p ... "<prompt>"`);

        this.currentProcess = spawn(command, [], {
          cwd: projectPath,
          shell: true,
          env: spawnEnv,
          stdio: ['ignore', 'pipe', 'pipe']
        });
      }

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
        this._cleanupTempFile(); // 임시 파일 정리
        this._isStreamJson = false; // 플래그 초기화

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
        this._cleanupTempFile(); // 임시 파일 정리

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
   * 프로젝트 디렉토리 생성 및 초기화
   * @param {string} projectPath - 기본 경로
   * @param {string} projectName - 프로젝트 이름
   * @returns {string} 실제 프로젝트 경로
   */
  _setupProjectDirectory(projectPath, projectName) {
    // 절대 경로로 변환
    let basePath = projectPath || '.';
    if (!isAbsolute(basePath)) {
      basePath = resolve(process.cwd(), basePath);
    }

    // '~' 처리
    if (basePath.startsWith('~')) {
      basePath = join(homedir(), basePath.slice(1));
    }

    // 프로젝트 폴더 경로
    const fullPath = projectName ? join(basePath, projectName) : basePath;

    // 디렉토리 생성
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      logger.info(`프로젝트 디렉토리 생성: ${fullPath}`);
    }

    return fullPath;
  }

  /**
   * Git 자동 커밋
   * @param {string} projectPath - 프로젝트 경로
   * @param {string} message - 커밋 메시지
   */
  async _autoCommit(projectPath, message) {
    try {
      // git init (이미 있으면 무시됨)
      execSync('git init', { cwd: projectPath, stdio: 'ignore' });

      // git add all
      execSync('git add -A', { cwd: projectPath, stdio: 'ignore' });

      // git commit
      const commitMsg = message || 'Auto-commit by Control Tower';
      execSync(`git commit -m "${commitMsg}"`, { cwd: projectPath, stdio: 'ignore' });

      logger.info(`자동 커밋 완료: ${commitMsg}`);
      return true;
    } catch (error) {
      // 변경사항이 없으면 에러 무시
      if (error.message.includes('nothing to commit')) {
        logger.info('커밋할 변경사항 없음');
        return true;
      }
      logger.warn(`자동 커밋 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 여러 스텝 순차 실행
   * @param {Array} steps - 스텝 배열
   * @param {Object} options - 실행 옵션
   * @param {boolean} options.stopOnError - 에러 시 중단 여부
   * @param {number} options.stepDelay - 스텝 간 딜레이 (ms)
   * @param {string} options.projectPath - 프로젝트 기본 경로
   * @param {string} options.projectName - 프로젝트 이름 (폴더명)
   * @param {boolean} options.autoCommit - 완료 후 자동 커밋
   */
  async runAllSteps(steps, options = {}) {
    if (this.isRunning) {
      throw new Error('이미 실행 중입니다.');
    }

    const {
      stopOnError = true,
      stepDelay = STEP_DELAY,
      projectPath = '.',
      projectName = '',
      autoCommit = true,
      ...stepOptions
    } = options;

    // 프로젝트 디렉토리 설정
    const actualProjectPath = this._setupProjectDirectory(projectPath, projectName);
    logger.info(`프로젝트 경로: ${actualProjectPath}`);

    // 스텝 옵션에 프로젝트 경로 추가
    stepOptions.projectPath = actualProjectPath;

    this.startTime = Date.now();
    this.completedSteps = [];
    this.shouldStop = false;
    this._currentProjectPath = actualProjectPath; // 자동 커밋용 저장

    const totalSteps = steps.length;
    let currentIndex = 0;

    logger.info(`전체 실행 시작: ${totalSteps}개 스텝`);

    // run-start 이벤트
    this._emitEvent('run-start', {
      totalSteps,
      projectPath: actualProjectPath,
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

    // 자동 커밋
    if (autoCommit && this.completedSteps.length > 0) {
      this._emitEvent('step-output', {
        stepId: 'system',
        line: '📦 자동 커밋 중...',
        type: 'system',
        timestamp: new Date().toISOString()
      });

      const commitSuccess = await this._autoCommit(
        actualProjectPath,
        `feat: ${projectName || 'Project'} 자동 생성 by Control Tower`
      );

      if (commitSuccess) {
        this._emitEvent('step-output', {
          stepId: 'system',
          line: '✅ Git 커밋 완료',
          type: 'system',
          timestamp: new Date().toISOString()
        });
      }
    }

    this._emitEvent('run-complete', {
      totalSteps,
      completedSteps: this.completedSteps.length,
      duration: totalDuration,
      projectPath: actualProjectPath,
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
   * 긴 프롬프트는 임시 파일로 저장하여 전달
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

    // 프롬프트 길이에 따라 처리 방식 결정
    // Windows 명령줄 제한: ~8191자, 안전하게 4000자로 제한
    const MAX_INLINE_PROMPT = 4000;

    if (prompt.length <= MAX_INLINE_PROMPT) {
      // 짧은 프롬프트: 인라인으로 전달
      const escapedPrompt = prompt
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
      args.push(`"${escapedPrompt}"`);
      this._tempPromptFile = null;
    } else {
      // 긴 프롬프트: 임시 파일 사용
      const tempDir = join(tmpdir(), 'control-tower');
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }

      const tempFile = join(tempDir, `prompt-${Date.now()}.txt`);
      writeFileSync(tempFile, prompt, 'utf8');
      this._tempPromptFile = tempFile;

      logger.info(`긴 프롬프트 임시 파일 저장: ${tempFile} (${prompt.length}자)`);

      // 파일에서 프롬프트 읽기
      // PowerShell에서 파일 내용을 읽어서 전달
      if (process.platform === 'win32') {
        // Windows: type 명령으로 파일 내용 출력 후 파이프
        args.useFileInput = true;
        args.tempFile = tempFile;
      } else {
        // Unix: 파일에서 읽기
        args.useFileInput = true;
        args.tempFile = tempFile;
      }
    }

    return args;
  }

  /**
   * 임시 파일 정리
   */
  _cleanupTempFile() {
    if (this._tempPromptFile) {
      try {
        unlinkSync(this._tempPromptFile);
        logger.debug(`임시 파일 삭제: ${this._tempPromptFile}`);
      } catch (err) {
        logger.warn(`임시 파일 삭제 실패: ${err.message}`);
      }
      this._tempPromptFile = null;
    }
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
      if (!line.trim()) continue;

      let outputLine = line;

      // stream-json 모드인 경우 JSON 파싱하여 텍스트 추출
      if (this._isStreamJson && type === 'stdout') {
        try {
          const json = JSON.parse(line);

          // assistant 메시지에서 텍스트 추출
          if (json.type === 'assistant' && json.message?.content) {
            const textContent = json.message.content
              .filter(c => c.type === 'text')
              .map(c => c.text)
              .join('');
            if (textContent) {
              outputLine = textContent;
            } else {
              continue; // 텍스트가 없으면 스킵
            }
          }
          // result 타입에서 최종 결과 추출
          else if (json.type === 'result') {
            if (json.result) {
              outputLine = `\n═══ 완료 ═══\n${json.result}`;
            } else {
              continue;
            }
          }
          // system, init 등은 스킵
          else if (json.type === 'system') {
            continue;
          }
          // 기타는 원본 출력
          else {
            continue;
          }
        } catch {
          // JSON 파싱 실패시 원본 그대로
        }
      }

      this._emitEvent('step-output', {
        stepId,
        line: outputLine,
        type,
        timestamp: new Date().toISOString()
      });
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
