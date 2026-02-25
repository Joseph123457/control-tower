/**
 * Claude 세션 REST API 라우트
 * 프로젝트/세션 탐색 및 대화 내역 조회
 */

import { Router } from 'express';
import {
  discoverProjects,
  getSessions,
  getConversation,
  getSessionStats
} from '../services/claudeSessionService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================================
// GET /api/claude-sessions/projects
// 프로젝트 목록
// ============================================================
router.get('/projects', async (req, res) => {
  try {
    const projects = await discoverProjects();

    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    logger.error('프로젝트 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// GET /api/claude-sessions/projects/:encoded/sessions
// 프로젝트별 세션 목록
// ============================================================
router.get('/projects/:encoded/sessions', async (req, res) => {
  try {
    const { encoded } = req.params;
    const sessions = await getSessions(encoded);

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

// ============================================================
// GET /api/claude-sessions/sessions/:id/conversation
// 대화 내용 (query: project, limit, offset)
// ============================================================
router.get('/sessions/:id/conversation', async (req, res) => {
  try {
    const { id } = req.params;
    const { project, limit = '100', offset = '0' } = req.query;

    if (!project) {
      return res.status(400).json({
        success: false,
        error: 'project 쿼리 파라미터가 필요합니다.'
      });
    }

    const messages = await getConversation(project, id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    res.json({
      success: true,
      data: messages,
      total: messages.length
    });
  } catch (error) {
    logger.error('대화 내역 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// GET /api/claude-sessions/stats
// 전체 세션 통계
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    const stats = await getSessionStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('세션 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
