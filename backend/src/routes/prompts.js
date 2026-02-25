/**
 * 프롬프트 파싱 API
 * .md 파일 또는 텍스트를 스텝 리스트로 변환
 */

import { Router } from 'express';
import multer from 'multer';
import { readFile } from 'fs/promises';
import { parsePromptFile, getParseStatistics } from '../services/promptParser.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================================
// Multer 설정 (파일 업로드)
// ============================================================

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // .md, .txt 파일만 허용
    const allowedMimes = ['text/markdown', 'text/plain', 'application/octet-stream'];
    const allowedExts = ['.md', '.txt', '.markdown'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다. (.md, .txt 파일만 허용)'));
    }
  }
});

// ============================================================
// API 엔드포인트
// ============================================================

/**
 * POST /api/prompts/parse
 * 프롬프트 텍스트 파싱
 *
 * Body: { text: string }
 * 응답: { success, steps, count, statistics }
 */
router.post('/parse', async (req, res) => {
  try {
    const text = req.body.text || req.body.content || '';

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: '파싱할 텍스트가 필요합니다.',
        steps: [],
        count: 0
      });
    }

    const steps = parsePromptFile(text);
    const statistics = getParseStatistics(steps);

    logger.info(`프롬프트 파싱 완료: ${steps.length}개 스텝`);

    res.json({
      success: true,
      steps,
      count: steps.length,
      statistics
    });
  } catch (error) {
    logger.error('프롬프트 파싱 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      steps: [],
      count: 0
    });
  }
});

/**
 * POST /api/prompts/upload
 * .md 파일 업로드 + 파싱
 *
 * Form: multipart/form-data, 필드명 "file"
 * 응답: { success, steps, count, statistics, filename }
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    const text = req.file.buffer.toString('utf-8');
    const filename = req.file.originalname;

    logger.info(`파일 업로드: ${filename} (${req.file.size} bytes)`);

    const steps = parsePromptFile(text);
    const statistics = getParseStatistics(steps);

    res.json({
      success: true,
      steps,
      count: steps.length,
      statistics,
      filename
    });
  } catch (error) {
    logger.error('파일 업로드 파싱 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/prompts/parse-file
 * 서버 로컬 파일 경로로 파싱
 *
 * Body: { filePath: string }
 */
router.post('/parse-file', async (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: '파일 경로가 필요합니다.'
      });
    }

    const text = await readFile(filePath, 'utf-8');
    const steps = parsePromptFile(text);
    const statistics = getParseStatistics(steps);

    res.json({
      success: true,
      steps,
      count: steps.length,
      statistics,
      filePath
    });
  } catch (error) {
    logger.error('파일 파싱 실패:', error);

    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        error: '파일을 찾을 수 없습니다.'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/prompts/validate
 * 프롬프트 형식 검증
 *
 * Body: { text: string }
 */
router.post('/validate', (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: '텍스트가 필요합니다.'
      });
    }

    const steps = parsePromptFile(text);
    const statistics = getParseStatistics(steps);

    const issues = [];

    // 검증 규칙
    if (steps.length === 0) {
      issues.push('스텝을 찾을 수 없습니다. "### 프롬프트 N-N:" 또는 "### N-N." 형식을 확인하세요.');
    }

    if (statistics.emptyPrompts > 0) {
      issues.push(`${statistics.emptyPrompts}개의 스텝에 프롬프트(코드블록)가 없습니다.`);
    }

    // 중복 ID 검사
    const ids = steps.map(s => s.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      issues.push(`중복된 스텝 ID가 있습니다: ${[...new Set(duplicates)].join(', ')}`);
    }

    res.json({
      success: true,
      valid: issues.length === 0,
      issues,
      statistics,
      steps: steps.map(s => ({ id: s.id, title: s.title, hasPrompt: !!s.prompt }))
    });
  } catch (error) {
    logger.error('검증 실패:', error);
    res.status(500).json({
      success: false,
      valid: false,
      error: error.message
    });
  }
});

/**
 * GET /api/prompts/templates
 * 기본 프롬프트 템플릿 목록
 */
router.get('/templates', (req, res) => {
  const templates = [
    {
      id: 'react-vite',
      name: 'React + Vite 앱',
      description: 'React 18 + Vite + Tailwind CSS 기본 구조',
      steps: 5
    },
    {
      id: 'express-api',
      name: 'Express API 서버',
      description: 'Express + Socket.IO REST API 서버',
      steps: 4
    },
    {
      id: 'fullstack',
      name: '풀스택 모노레포',
      description: '프론트엔드 + 백엔드 통합 프로젝트',
      steps: 8
    },
    {
      id: 'cli-tool',
      name: 'CLI 도구',
      description: 'Node.js CLI 애플리케이션',
      steps: 3
    }
  ];

  res.json({
    success: true,
    data: templates
  });
});

/**
 * GET /api/prompts/templates/:id
 * 특정 템플릿 내용 반환
 */
router.get('/templates/:id', (req, res) => {
  const { id } = req.params;

  // 템플릿 예시 (실제로는 파일에서 로드)
  const templates = {
    'react-vite': `# React + Vite 프로젝트

## 📌 시작하기 전에

### 0-1. 프로젝트 폴더 생성

\`\`\`
mkdir my-react-app
cd my-react-app
\`\`\`

## 🔷 Phase 1: 프로젝트 초기화

### 프롬프트 1-1: Vite 프로젝트 생성

\`\`\`
npm create vite@latest . -- --template react
npm install
\`\`\`

### 프롬프트 1-2: Tailwind CSS 설정

\`\`\`
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
\`\`\`
`,
    'express-api': `# Express API 서버

## 🔷 Phase 1: 프로젝트 설정

### 프롬프트 1-1: 프로젝트 초기화

\`\`\`
npm init -y
npm install express cors dotenv
\`\`\`

### 프롬프트 1-2: 기본 서버 생성

\`\`\`
// src/index.js 파일을 생성하고 Express 서버 기본 구조를 작성해주세요.
// - 포트 3000
// - CORS 활성화
// - JSON 파싱
// - /api/health 엔드포인트
\`\`\`
`
  };

  const template = templates[id];

  if (!template) {
    return res.status(404).json({
      success: false,
      error: '템플릿을 찾을 수 없습니다.'
    });
  }

  // 템플릿을 파싱해서 반환
  const steps = parsePromptFile(template);
  const statistics = getParseStatistics(steps);

  res.json({
    success: true,
    data: {
      id,
      content: template,
      steps,
      statistics
    }
  });
});

// Multer 에러 핸들링
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: '파일 크기가 너무 큽니다. (최대 10MB)'
      });
    }
    return res.status(400).json({
      success: false,
      error: `파일 업로드 오류: ${err.message}`
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  next();
});

export default router;
