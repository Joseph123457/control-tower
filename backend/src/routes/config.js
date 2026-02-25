/**
 * 설정 생성 API
 * Claude Code 설정 파일 생성
 */

import { Router } from 'express';
import {
  generateSettings,
  generateClaudeMd,
  generateTodoMd,
  generateMcpCommands,
  generatePluginCommands,
  generateRunScript,
  generateAll,
  CONSTANTS
} from '../services/configGenerator.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/config/generate
 * 모든 설정 파일 생성
 *
 * Body: {
 *   projectName: string,
 *   projectPath: string,
 *   projectDesc: string,
 *   techStack: string[],
 *   codeRules: string[],
 *   permissions: string[],
 *   deny: string[],
 *   mcps: string[],
 *   plugins: string[],
 *   steps: Step[],
 *   autoProgress: boolean,
 *   sessionManagement: boolean,
 *   sessionMode: boolean,
 *   autoApprove: boolean
 * }
 */
router.post('/generate', async (req, res) => {
  try {
    const result = generateAll(req.body);

    logger.info('전체 설정 생성 완료');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('설정 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/config/settings
 * settings.json 생성
 */
router.post('/settings', async (req, res) => {
  try {
    const { permissions, deny, mcps, projectPath } = req.body;
    const settings = generateSettings({ permissions, deny, mcps, projectPath });

    res.json({
      success: true,
      data: settings,
      parsed: JSON.parse(settings)
    });
  } catch (error) {
    logger.error('settings.json 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/config/claude-md
 * CLAUDE.md 생성
 */
router.post('/claude-md', async (req, res) => {
  try {
    const claudeMd = generateClaudeMd(req.body);

    res.json({
      success: true,
      data: claudeMd
    });
  } catch (error) {
    logger.error('CLAUDE.md 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/config/todo-md
 * todo.md 생성
 */
router.post('/todo-md', async (req, res) => {
  try {
    const { steps } = req.body;
    const todoMd = generateTodoMd(steps);

    res.json({
      success: true,
      data: todoMd
    });
  } catch (error) {
    logger.error('todo.md 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/config/run-script
 * 실행 스크립트 생성
 */
router.post('/run-script', async (req, res) => {
  try {
    const { steps, sessionMode, autoApprove, projectPath } = req.body;
    const script = generateRunScript(steps, { sessionMode, autoApprove, projectPath });

    res.json({
      success: true,
      data: script
    });
  } catch (error) {
    logger.error('실행 스크립트 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/config/constants
 * 권한/MCP/플러그인 상수 반환
 */
router.get('/constants', (req, res) => {
  res.json({
    success: true,
    data: CONSTANTS
  });
});

/**
 * GET /api/config/presets
 * 설정 프리셋 목록
 */
router.get('/presets', (req, res) => {
  const presets = [
    {
      id: 'beginner',
      name: '초보자',
      description: '안전한 기본 설정 (읽기 전용)',
      permissions: ['file-read', 'search', 'system'],
      mcps: [],
      plugins: []
    },
    {
      id: 'standard',
      name: '표준',
      description: '일반적인 개발 환경',
      permissions: ['file-read', 'file-write', 'git', 'package-manager', 'build-run', 'search', 'system'],
      mcps: ['filesystem'],
      plugins: ['prettier', 'eslint']
    },
    {
      id: 'advanced',
      name: '고급',
      description: '모든 기능 활성화',
      permissions: ['file-read', 'file-write', 'file-delete', 'git', 'package-manager', 'build-run', 'network', 'search', 'docker', 'system'],
      mcps: ['filesystem', 'github'],
      plugins: ['prettier', 'eslint', 'typescript', 'vitest']
    },
    {
      id: 'readonly',
      name: '읽기 전용',
      description: '코드 분석/리뷰 전용',
      permissions: ['file-read', 'search', 'system'],
      mcps: [],
      plugins: []
    }
  ];

  res.json({
    success: true,
    data: presets
  });
});

/**
 * POST /api/config/apply-preset
 * 프리셋 적용
 */
router.post('/apply-preset', (req, res) => {
  const { presetId } = req.body;

  const presets = {
    beginner: {
      permissions: ['file-read', 'search', 'system'],
      mcps: [],
      plugins: []
    },
    standard: {
      permissions: ['file-read', 'file-write', 'git', 'package-manager', 'build-run', 'search', 'system'],
      mcps: ['filesystem'],
      plugins: ['prettier', 'eslint']
    },
    advanced: {
      permissions: ['file-read', 'file-write', 'file-delete', 'git', 'package-manager', 'build-run', 'network', 'search', 'docker', 'system'],
      mcps: ['filesystem', 'github'],
      plugins: ['prettier', 'eslint', 'typescript', 'vitest']
    },
    readonly: {
      permissions: ['file-read', 'search', 'system'],
      mcps: [],
      plugins: []
    }
  };

  const preset = presets[presetId];

  if (!preset) {
    return res.status(404).json({
      success: false,
      error: '프리셋을 찾을 수 없습니다.'
    });
  }

  res.json({
    success: true,
    data: preset
  });
});

export default router;
