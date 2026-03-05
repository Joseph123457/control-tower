/**
 * 설정 생성 API
 * Claude Code 설정 파일 생성
 */

import { Router } from 'express';
import { readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
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

/**
 * GET /api/config/browse-folders
 * 폴더 목록 조회 (폴더 탐색기용)
 */
router.get('/browse-folders', (req, res) => {
  try {
    let { path: currentPath } = req.query;

    // 기본 경로
    if (!currentPath || currentPath === '~') {
      currentPath = homedir();
    } else if (currentPath.startsWith('~')) {
      currentPath = join(homedir(), currentPath.slice(1));
    }

    // 경로 정규화
    currentPath = resolve(currentPath);

    // 경로 존재 확인
    if (!existsSync(currentPath)) {
      return res.status(404).json({
        success: false,
        error: '경로를 찾을 수 없습니다.'
      });
    }

    // 폴더 목록 조회
    const items = readdirSync(currentPath, { withFileTypes: true })
      .filter(item => item.isDirectory())
      .filter(item => !item.name.startsWith('.') && item.name !== 'node_modules')
      .map(item => ({
        name: item.name,
        path: join(currentPath, item.name),
        isDirectory: true
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 상위 폴더 정보
    const parentPath = resolve(currentPath, '..');
    const hasParent = parentPath !== currentPath;

    res.json({
      success: true,
      data: {
        currentPath,
        parentPath: hasParent ? parentPath : null,
        items
      }
    });
  } catch (error) {
    logger.error('폴더 탐색 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/config/drives
 * Windows 드라이브 목록 (Windows 전용)
 */
router.get('/drives', (req, res) => {
  try {
    if (process.platform !== 'win32') {
      return res.json({
        success: true,
        data: [{ name: '/', path: '/' }]
      });
    }

    // Windows 드라이브 목록
    const drives = [];
    for (let i = 65; i <= 90; i++) { // A-Z
      const driveLetter = String.fromCharCode(i);
      const drivePath = `${driveLetter}:\\`;
      if (existsSync(drivePath)) {
        drives.push({
          name: `${driveLetter}:`,
          path: drivePath
        });
      }
    }

    res.json({
      success: true,
      data: drives
    });
  } catch (error) {
    logger.error('드라이브 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/config/validate-path
 * 경로 유효성 검사
 */
router.post('/validate-path', (req, res) => {
  try {
    let { path: inputPath } = req.body;

    if (!inputPath) {
      return res.json({
        success: true,
        data: { valid: false, message: '경로를 입력하세요.' }
      });
    }

    // ~ 처리
    if (inputPath.startsWith('~')) {
      inputPath = join(homedir(), inputPath.slice(1));
    }

    const fullPath = resolve(inputPath);
    const exists = existsSync(fullPath);

    res.json({
      success: true,
      data: {
        valid: true,
        exists,
        resolvedPath: fullPath,
        message: exists ? '유효한 경로입니다.' : '폴더가 생성됩니다.'
      }
    });
  } catch (error) {
    res.json({
      success: true,
      data: { valid: false, message: error.message }
    });
  }
});

export default router;
