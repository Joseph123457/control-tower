/**
 * 상수 정의
 * 권한, MCP 서버, 플러그인 데이터
 */

// ============================================================
// 허용 명령어 그룹
// ============================================================

export const ALLOW_COMMANDS = [
  // 파일 관련
  { id: 'cat', name: 'cat', description: '파일 내용 출력', category: 'file', recommended: true },
  { id: 'head', name: 'head', description: '파일 앞부분 출력', category: 'file', recommended: true },
  { id: 'tail', name: 'tail', description: '파일 뒷부분 출력', category: 'file', recommended: true },
  { id: 'ls', name: 'ls', description: '디렉토리 목록', category: 'file', recommended: true },
  { id: 'find', name: 'find', description: '파일 검색', category: 'file', recommended: true },
  { id: 'wc', name: 'wc', description: '줄/단어/문자 수 세기', category: 'file', recommended: false },
  { id: 'touch', name: 'touch', description: '빈 파일 생성', category: 'file', recommended: false },
  { id: 'mkdir', name: 'mkdir', description: '디렉토리 생성', category: 'file', recommended: true },
  { id: 'cp', name: 'cp', description: '파일 복사', category: 'file', recommended: false },
  { id: 'mv', name: 'mv', description: '파일 이동/이름변경', category: 'file', recommended: false },
  { id: 'rm', name: 'rm', description: '파일 삭제', category: 'file', recommended: false },

  // 검색 관련
  { id: 'grep', name: 'grep', description: '텍스트 검색', category: 'search', recommended: true },
  { id: 'rg', name: 'rg', description: 'ripgrep 검색', category: 'search', recommended: true },
  { id: 'ag', name: 'ag', description: 'silver searcher', category: 'search', recommended: false },
  { id: 'fd', name: 'fd', description: '빠른 파일 검색', category: 'search', recommended: false },

  // Git 관련
  { id: 'git', name: 'git', description: 'Git 버전 관리', category: 'git', recommended: true },
  { id: 'gh', name: 'gh', description: 'GitHub CLI', category: 'git', recommended: true },

  // 패키지 매니저
  { id: 'npm', name: 'npm', description: 'Node.js 패키지 매니저', category: 'package', recommended: true },
  { id: 'npx', name: 'npx', description: 'npm 패키지 실행', category: 'package', recommended: true },
  { id: 'yarn', name: 'yarn', description: 'Yarn 패키지 매니저', category: 'package', recommended: false },
  { id: 'pnpm', name: 'pnpm', description: 'pnpm 패키지 매니저', category: 'package', recommended: false },
  { id: 'pip', name: 'pip', description: 'Python 패키지 매니저', category: 'package', recommended: false },
  { id: 'cargo', name: 'cargo', description: 'Rust 패키지 매니저', category: 'package', recommended: false },

  // 빌드/실행
  { id: 'node', name: 'node', description: 'Node.js 실행', category: 'runtime', recommended: true },
  { id: 'python', name: 'python', description: 'Python 실행', category: 'runtime', recommended: false },
  { id: 'deno', name: 'deno', description: 'Deno 실행', category: 'runtime', recommended: false },
  { id: 'bun', name: 'bun', description: 'Bun 실행', category: 'runtime', recommended: false },

  // 네트워크
  { id: 'curl', name: 'curl', description: 'URL 데이터 전송', category: 'network', recommended: false },
  { id: 'wget', name: 'wget', description: '파일 다운로드', category: 'network', recommended: false },

  // 시스템
  { id: 'echo', name: 'echo', description: '텍스트 출력', category: 'system', recommended: true },
  { id: 'pwd', name: 'pwd', description: '현재 디렉토리', category: 'system', recommended: true },
  { id: 'which', name: 'which', description: '명령어 경로', category: 'system', recommended: true },
  { id: 'env', name: 'env', description: '환경변수', category: 'system', recommended: false },
  { id: 'date', name: 'date', description: '날짜/시간', category: 'system', recommended: false },
];

// 카테고리 이름
export const COMMAND_CATEGORIES = {
  file: '📁 파일',
  search: '🔍 검색',
  git: '📦 Git',
  package: '📦 패키지',
  runtime: '▶️ 런타임',
  network: '🌐 네트워크',
  system: '💻 시스템'
};

// ============================================================
// 차단 명령어/패턴
// ============================================================

export const DENY_PATTERNS = [
  { id: 'rm-rf-root', pattern: 'rm -rf /', description: '루트 삭제 방지', recommended: true },
  { id: 'rm-rf-home', pattern: 'rm -rf ~', description: '홈 디렉토리 삭제 방지', recommended: true },
  { id: 'rm-rf-star', pattern: 'rm -rf *', description: '와일드카드 삭제 방지', recommended: true },
  { id: 'sudo', pattern: 'sudo', description: '관리자 권한 차단', recommended: false },
  { id: 'curl-bash', pattern: 'curl|bash', description: '원격 스크립트 실행 차단', recommended: true },
  { id: 'chmod-777', pattern: 'chmod 777', description: '위험한 권한 변경', recommended: false },
  { id: 'dd', pattern: 'dd if=', description: '디스크 덤프 차단', recommended: true },
  { id: 'mkfs', pattern: 'mkfs', description: '파일시스템 포맷 차단', recommended: true },
  { id: 'env-secret', pattern: '.env', description: '환경변수 파일 접근 제한', recommended: false },
];

// ============================================================
// 자동 승인 모드
// ============================================================

export const AUTO_APPROVE_MODES = [
  {
    id: 'settings',
    name: '설정 파일 기반',
    description: 'settings.json에 정의된 명령어만 자동 승인',
    flag: '',
    recommended: true
  },
  {
    id: 'shift-tab',
    name: 'Shift+Tab 모드',
    description: '실행 시 Shift+Tab으로 수동 승인',
    flag: '',
    recommended: false
  },
  {
    id: 'full-auto',
    name: '완전 자동',
    description: '모든 명령을 자동 승인 (주의 필요)',
    flag: '--dangerously-skip-permissions',
    recommended: false,
    warning: true
  }
];

// ============================================================
// MCP 서버
// ============================================================

export const MCP_SERVERS = [
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    description: 'GitHub 저장소, 이슈, PR 관리',
    package: '@anthropic-ai/mcp-server-github',
    envRequired: ['GITHUB_TOKEN'],
    recommended: true
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: '🦊',
    description: 'GitLab 저장소 연동',
    package: '@anthropic-ai/mcp-server-gitlab',
    envRequired: ['GITLAB_TOKEN'],
    recommended: false
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    icon: '📁',
    description: '로컬 파일 시스템 접근',
    package: '@anthropic-ai/mcp-server-filesystem',
    envRequired: [],
    recommended: true
  },
  {
    id: 'context7',
    name: 'Context7',
    icon: '📚',
    description: '최신 라이브러리 문서 접근',
    package: '@anthropic-ai/mcp-server-context7',
    envRequired: [],
    recommended: true
  },
  {
    id: 'playwright',
    name: 'Playwright',
    icon: '🎭',
    description: '브라우저 자동화 및 테스트',
    package: '@anthropic-ai/mcp-server-playwright',
    envRequired: [],
    recommended: false
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    icon: '🐘',
    description: 'PostgreSQL 데이터베이스 연동',
    package: '@anthropic-ai/mcp-server-postgres',
    envRequired: ['DATABASE_URL'],
    recommended: false
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    icon: '📊',
    description: 'SQLite 데이터베이스 연동',
    package: '@anthropic-ai/mcp-server-sqlite',
    envRequired: [],
    recommended: false
  },
  {
    id: 'memory',
    name: 'Memory',
    icon: '🧠',
    description: '지식 그래프 기반 장기 기억',
    package: '@anthropic-ai/mcp-server-memory',
    envRequired: [],
    recommended: false
  }
];

// ============================================================
// 플러그인 (슬래시 명령어)
// ============================================================

export const PLUGINS = [
  {
    id: 'superpowers',
    name: 'Superpowers',
    icon: '⚡',
    description: '자동 반복 실행 및 고급 자동화 기능',
    category: 'automation',
    recommended: true
  },
  {
    id: 'frontend-design',
    name: 'Frontend Design',
    icon: '🎨',
    description: '프론트엔드 UI/UX 디자인 도우미',
    category: 'development',
    recommended: true
  },
  {
    id: 'code-review',
    name: 'Code Review',
    icon: '🔍',
    description: '코드 리뷰 및 품질 분석',
    category: 'quality',
    recommended: true
  },
  {
    id: 'feature-dev',
    name: 'Feature Dev',
    icon: '🚀',
    description: '기능 개발 가이드 및 자동화',
    category: 'development',
    recommended: false
  },
  {
    id: 'hookify',
    name: 'Hookify',
    icon: '🪝',
    description: 'Git 훅 자동 설정',
    category: 'git',
    recommended: false
  },
  {
    id: 'test-runner',
    name: 'Test Runner',
    icon: '🧪',
    description: '테스트 실행 및 커버리지 분석',
    category: 'testing',
    recommended: false
  },
  {
    id: 'doc-gen',
    name: 'Doc Generator',
    icon: '📝',
    description: '문서 자동 생성',
    category: 'documentation',
    recommended: false
  }
];

// 플러그인 카테고리
export const PLUGIN_CATEGORIES = {
  automation: { name: '자동화', color: 'bg-purple-500/20 text-purple-400' },
  development: { name: '개발', color: 'bg-blue-500/20 text-blue-400' },
  quality: { name: '품질', color: 'bg-green-500/20 text-green-400' },
  git: { name: 'Git', color: 'bg-orange-500/20 text-orange-400' },
  testing: { name: '테스트', color: 'bg-yellow-500/20 text-yellow-400' },
  documentation: { name: '문서', color: 'bg-cyan-500/20 text-cyan-400' }
};

// ============================================================
// 기술 스택 옵션
// ============================================================

export const TECH_STACK_OPTIONS = [
  // Frontend
  { id: 'react', name: 'React', category: 'frontend' },
  { id: 'vue', name: 'Vue.js', category: 'frontend' },
  { id: 'svelte', name: 'Svelte', category: 'frontend' },
  { id: 'nextjs', name: 'Next.js', category: 'frontend' },
  { id: 'vite', name: 'Vite', category: 'frontend' },
  { id: 'tailwind', name: 'Tailwind CSS', category: 'frontend' },

  // Backend
  { id: 'nodejs', name: 'Node.js', category: 'backend' },
  { id: 'express', name: 'Express', category: 'backend' },
  { id: 'fastify', name: 'Fastify', category: 'backend' },
  { id: 'python', name: 'Python', category: 'backend' },
  { id: 'fastapi', name: 'FastAPI', category: 'backend' },

  // Database
  { id: 'postgresql', name: 'PostgreSQL', category: 'database' },
  { id: 'mongodb', name: 'MongoDB', category: 'database' },
  { id: 'sqlite', name: 'SQLite', category: 'database' },
  { id: 'redis', name: 'Redis', category: 'database' },

  // Tools
  { id: 'typescript', name: 'TypeScript', category: 'tools' },
  { id: 'docker', name: 'Docker', category: 'tools' },
];

// ============================================================
// 코드 규칙 옵션
// ============================================================

export const CODE_RULE_OPTIONS = [
  { id: 'korean-comments', name: '한국어 주석', description: '주석은 한국어로 작성' },
  { id: 'esm', name: 'ESM 모듈', description: 'import/export 사용' },
  { id: 'error-handling', name: '에러 핸들링 필수', description: 'try-catch 필수' },
  { id: 'type-safety', name: '타입 안전성', description: 'any 타입 금지' },
  { id: 'korean-ui', name: 'UI 텍스트 한국어', description: '인터페이스 한국어' },
  { id: 'jsdoc', name: 'JSDoc 주석', description: '함수 문서화' },
];

// ============================================================
// 프리셋
// ============================================================

export const PRESETS = {
  beginner: {
    id: 'beginner',
    name: '초보자',
    description: '안전한 읽기 전용 설정',
    icon: '🔰',
    allowCommands: ['cat', 'head', 'tail', 'ls', 'find', 'grep', 'echo', 'pwd'],
    denyPatterns: ['rm-rf-root', 'rm-rf-home', 'rm-rf-star', 'curl-bash', 'dd', 'mkfs'],
    autoApprove: 'settings',
    mcps: [],
    plugins: []
  },
  standard: {
    id: 'standard',
    name: '표준',
    description: '일반적인 개발 환경',
    icon: '⚙️',
    allowCommands: ['cat', 'head', 'tail', 'ls', 'find', 'grep', 'rg', 'git', 'gh', 'npm', 'npx', 'node', 'echo', 'pwd', 'which', 'mkdir'],
    denyPatterns: ['rm-rf-root', 'rm-rf-home', 'rm-rf-star', 'curl-bash', 'dd', 'mkfs'],
    autoApprove: 'settings',
    mcps: ['filesystem', 'github'],
    plugins: ['superpowers', 'code-review']
  },
  advanced: {
    id: 'advanced',
    name: '고급',
    description: '모든 기능 활성화',
    icon: '🚀',
    allowCommands: ALLOW_COMMANDS.map(c => c.id),
    denyPatterns: ['rm-rf-root', 'rm-rf-home', 'dd', 'mkfs'],
    autoApprove: 'settings',
    mcps: ['filesystem', 'github', 'context7'],
    plugins: ['superpowers', 'frontend-design', 'code-review', 'feature-dev']
  }
};

// ============================================================
// 헬퍼 함수
// ============================================================

export function getRecommendedCommands() {
  return ALLOW_COMMANDS.filter(c => c.recommended).map(c => c.id);
}

export function getRecommendedDenyPatterns() {
  return DENY_PATTERNS.filter(p => p.recommended).map(p => p.id);
}

export function getRecommendedMcps() {
  return MCP_SERVERS.filter(m => m.recommended).map(m => m.id);
}

export function getRecommendedPlugins() {
  return PLUGINS.filter(p => p.recommended).map(p => p.id);
}

export function applyPreset(presetId) {
  return PRESETS[presetId] || PRESETS.standard;
}

export default {
  ALLOW_COMMANDS,
  COMMAND_CATEGORIES,
  DENY_PATTERNS,
  AUTO_APPROVE_MODES,
  MCP_SERVERS,
  PLUGINS,
  PLUGIN_CATEGORIES,
  TECH_STACK_OPTIONS,
  CODE_RULE_OPTIONS,
  PRESETS,
  getRecommendedCommands,
  getRecommendedDenyPatterns,
  getRecommendedMcps,
  getRecommendedPlugins,
  applyPreset
};
