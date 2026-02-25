/**
 * Claude CLI 실행 API
 * CLI 명령어 실행 및 세션 관리
 */

import { Router } from 'express';
import { executeStep, stopExecution, getStatus } from '../services/cliRunner.js';
import { getSession, getAllSessions, createSession } from '../services/sessionManager.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/runner/execute
 * 단일 스텝 실행
 *
 * Body: {
 *   step: { id, title, prompt },
 *   options: { projectPath, sessionMode, skipPermissions }
 * }
 */
router.post('/execute', async (req, res) => {
  try {
    const { step, options = {} } = req.body;

    if (!step || !step.prompt) {
      return res.status(400).json({
        success: false,
        error: '실행할 스텝이 필요합니다.'
      });
    }

    logger.info(`REST API로 스텝 실행 요청: ${step.id}`);

    const result = await executeStep(null, step, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('스텝 실행 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/runner/stop
 * 실행 중지
 */
router.post('/stop', async (req, res) => {
  try {
    stopExecution();

    res.json({
      success: true,
      message: '실행이 중지되었습니다.'
    });
  } catch (error) {
    logger.error('실행 중지 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/runner/status
 * 현재 실행 상태 조회
 */
router.get('/status', (req, res) => {
  try {
    const status = getStatus();

    res.json({
      success: true,
      data: status || {
        running: false,
        currentStep: null,
        completedSteps: [],
        claudeAvailable: false
      }
    });
  } catch (error) {
    logger.error('상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/runner/sessions
 * 모든 세션 목록 조회
 */
router.get('/sessions', (req, res) => {
  try {
    const sessions = getAllSessions();

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('세션 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/runner/sessions
 * 새 세션 생성
 */
router.post('/sessions', (req, res) => {
  try {
    const { name, metadata } = req.body;
    const sessionId = createSession({ name, metadata });

    res.json({
      success: true,
      data: {
        sessionId,
        session: getSession(sessionId)
      }
    });
  } catch (error) {
    logger.error('세션 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/runner/sessions/:sessionId
 * 특정 세션 조회
 */
router.get('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: '세션을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('세션 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/runner/check-cli
 * Claude CLI 설치 여부 확인
 */
router.get('/check-cli', (req, res) => {
  try {
    const status = getStatus();

    res.json({
      success: true,
      data: {
        installed: status?.claudeAvailable ?? false,
        message: status?.claudeAvailable
          ? 'Claude CLI가 설치되어 있습니다.'
          : 'Claude CLI를 찾을 수 없습니다. npm install -g @anthropic-ai/claude-code로 설치하세요.'
      }
    });
  } catch (error) {
    res.json({
      success: true,
      data: {
        installed: false,
        message: 'Claude CLI 상태를 확인할 수 없습니다.'
      }
    });
  }
});

export default router;
