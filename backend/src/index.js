/**
 * Control Tower 백엔드 서버
 * Express + Socket.IO 기반 실시간 통신 서버
 *
 * 기능:
 * - Claude Code CLI 원격 실행
 * - 프롬프트 파싱 및 설정 생성
 * - 실시간 로그 스트리밍
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// 라우트 임포트
import configRoutes from './routes/config.js';
import promptsRoutes from './routes/prompts.js';
import runnerRoutes from './routes/runner.js';
import claudeSessionsRoutes from './routes/claudeSessions.js';

// 서비스 임포트
import { CliRunner, setupSocketHandlers } from './services/cliRunner.js';
import { logger } from './utils/logger.js';

// 환경변수 로드
dotenv.config();

// __dirname 대체 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// 서버 설정
// ============================================================

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================================
// Socket.IO 설정
// ============================================================

const io = new Server(server, {
  cors: {
    origin: IS_PRODUCTION ? false : [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  // 연결 안정성 설정
  pingTimeout: 60000,
  pingInterval: 25000
});

// CliRunner 인스턴스 생성 (Socket.IO와 연결)
const cliRunner = new CliRunner(io);

// Socket.IO를 app에 저장 (라우트에서 접근용)
app.set('io', io);
app.set('cliRunner', cliRunner);

// ============================================================
// 미들웨어 설정
// ============================================================

// CORS 설정
app.use(cors({
  origin: IS_PRODUCTION ? false : [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// JSON 파싱 (10MB 제한)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// ============================================================
// API 라우트
// ============================================================

// 헬스 체크
app.get('/api/health', (req, res) => {
  const status = cliRunner.getStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    claudeAvailable: status.claudeAvailable,
    isRunning: status.running
  });
});

// 라우트 등록
app.use('/api/config', configRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api/runner', runnerRoutes);
app.use('/api/claude-sessions', claudeSessionsRoutes);

// ============================================================
// 추가 API 엔드포인트 (runner 확장)
// ============================================================

/**
 * POST /api/runner/start
 * 전체 스텝 실행 시작
 */
app.post('/api/runner/start', async (req, res) => {
  try {
    const { steps, options = {} } = req.body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({
        success: false,
        error: '실행할 스텝 배열이 필요합니다.'
      });
    }

    // 이미 실행 중인지 확인
    const status = cliRunner.getStatus();
    if (status.running) {
      return res.status(409).json({
        success: false,
        error: '이미 실행 중입니다. 먼저 중지하세요.'
      });
    }

    // 비동기로 실행 시작 (응답은 즉시 반환)
    cliRunner.runAllSteps(steps, options).catch(err => {
      logger.error('전체 실행 오류:', err);
    });

    res.json({
      success: true,
      message: `${steps.length}개 스텝 실행 시작`,
      totalSteps: steps.length
    });
  } catch (error) {
    logger.error('실행 시작 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/runner/step/:id
 * 개별 스텝 실행
 */
app.post('/api/runner/step/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { step, options = {} } = req.body;

    if (!step) {
      return res.status(400).json({
        success: false,
        error: '스텝 정보가 필요합니다.'
      });
    }

    // 스텝 ID 확인
    if (step.id !== id) {
      step.id = id;
    }

    const result = await cliRunner.runStep(step, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`스텝 ${req.params.id} 실행 실패:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/runner/stop
 * 실행 중단
 */
app.post('/api/runner/stop', (req, res) => {
  try {
    cliRunner.stop();

    res.json({
      success: true,
      message: '실행 중단 요청됨'
    });
  } catch (error) {
    logger.error('실행 중단 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/runner/status
 * 현재 상태 조회
 */
app.get('/api/runner/status', (req, res) => {
  try {
    const status = cliRunner.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// 정적 파일 서빙 (Production)
// ============================================================

if (IS_PRODUCTION) {
  const frontendPath = join(__dirname, '../../frontend/dist');

  app.use(express.static(frontendPath));

  // SPA 라우팅 지원
  app.get('*', (req, res, next) => {
    // API 요청은 제외
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(join(frontendPath, 'index.html'));
  });

  logger.info(`정적 파일 서빙: ${frontendPath}`);
}

// ============================================================
// 에러 핸들링 미들웨어
// ============================================================

// 404 핸들러
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: `API 엔드포인트를 찾을 수 없습니다: ${req.method} ${req.path}`
    });
  } else {
    next();
  }
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  logger.error('서버 에러:', err);

  // Multer 에러 처리
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: '파일 크기가 너무 큽니다. (최대 10MB)'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: '잘못된 파일 필드입니다.'
    });
  }

  // 일반 에러
  res.status(err.status || 500).json({
    success: false,
    error: IS_PRODUCTION ? '서버 오류가 발생했습니다.' : err.message,
    ...(IS_PRODUCTION ? {} : { stack: err.stack })
  });
});

// ============================================================
// Socket.IO 연결 처리
// ============================================================

io.on('connection', (socket) => {
  logger.info(`클라이언트 연결: ${socket.id}`);

  // 연결 시 현재 상태 전송
  socket.emit('status', cliRunner.getStatus());

  // cliRunner 소켓 핸들러 설정
  setupSocketHandlers(io, socket);

  // 클라이언트 이벤트 핸들러
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // 상태 요청
  socket.on('get-status', () => {
    socket.emit('status', cliRunner.getStatus());
  });

  // 스텝 실행 요청
  socket.on('run-step', async (data) => {
    try {
      const { step, options } = data;
      const result = await cliRunner.runStep(step, options);
      socket.emit('step-result', { stepId: step.id, ...result });
    } catch (error) {
      socket.emit('step-error', {
        stepId: data.step?.id,
        error: error.message
      });
    }
  });

  // 전체 실행 요청
  socket.on('run-all', async (data) => {
    try {
      const { steps, options } = data;
      await cliRunner.runAllSteps(steps, options);
    } catch (error) {
      socket.emit('run-error', { error: error.message });
    }
  });

  // 세션 연결 (resume) 실행 요청
  socket.on('resume-session', async (data) => {
    try {
      const { sessionId, prompt } = data;
      if (!sessionId || !prompt) {
        socket.emit('step-error', { stepId: 'resume', error: '세션 ID와 프롬프트가 필요합니다.' });
        return;
      }

      const step = {
        id: `resume-${sessionId.substring(0, 8)}`,
        title: `세션 ${sessionId.substring(0, 8)} 연결`,
        prompt
      };

      await cliRunner.runStep(step, {
        resumeSessionId: sessionId,
        skipPermissions: true
      });
    } catch (error) {
      socket.emit('step-error', {
        stepId: 'resume',
        error: error.message
      });
    }
  });

  // 실행 중지 요청
  socket.on('stop', () => {
    cliRunner.stop();
  });

  // 연결 해제
  socket.on('disconnect', (reason) => {
    logger.info(`클라이언트 연결 해제: ${socket.id} (${reason})`);
  });

  // 에러 처리
  socket.on('error', (error) => {
    logger.error(`소켓 에러 (${socket.id}):`, error);
  });
});

// ============================================================
// 서버 시작
// ============================================================

server.listen(PORT, () => {
  logger.info('═══════════════════════════════════════════');
  logger.info('  Control Tower 서버 시작');
  logger.info('═══════════════════════════════════════════');
  logger.info(`  URL: http://localhost:${PORT}`);
  logger.info(`  환경: ${IS_PRODUCTION ? 'production' : 'development'}`);
  logger.info(`  Claude CLI: ${cliRunner.getStatus().claudeAvailable ? '✓ 설치됨' : '✗ 미설치'}`);
  logger.info('═══════════════════════════════════════════');
});

// 프로세스 종료 처리
process.on('SIGTERM', () => {
  logger.info('SIGTERM 수신, 서버 종료 중...');
  cliRunner.stop();
  server.close(() => {
    logger.info('서버 종료 완료');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT 수신, 서버 종료 중...');
  cliRunner.stop();
  server.close(() => {
    logger.info('서버 종료 완료');
    process.exit(0);
  });
});

// 미처리 예외 처리
process.on('uncaughtException', (error) => {
  logger.error('미처리 예외:', error);
  cliRunner.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('미처리 Promise 거부:', reason);
});

export { app, server, io, cliRunner };
