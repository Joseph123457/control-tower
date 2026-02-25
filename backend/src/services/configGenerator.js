/**
 * 설정 파일 생성 서비스
 * 설정 마법사에서 선택한 옵션으로 각종 설정 파일 생성
 */

import { logger } from '../utils/logger.js';

// ============================================================
// 권한 정의 (연관 명령어 포함)
// ============================================================

const PERMISSION_GROUPS = {
  // 파일 읽기 관련
  fileRead: {
    id: 'file-read',
    name: '파일 읽기',
    commands: ['cat', 'head', 'tail', 'less', 'more', 'bat'],
    tools: ['Read', 'Glob']
  },
  // 파일 쓰기 관련
  fileWrite: {
    id: 'file-write',
    name: '파일 쓰기',
    commands: ['touch', 'mkdir', 'cp', 'mv'],
    tools: ['Write', 'Edit']
  },
  // 파일 삭제 관련
  fileDelete: {
    id: 'file-delete',
    name: '파일 삭제',
    commands: ['rm', 'rmdir'],
    tools: []
  },
  // Git 관련
  git: {
    id: 'git',
    name: 'Git 명령어',
    commands: ['git'],
    tools: []
  },
  // 패키지 매니저
  packageManager: {
    id: 'package-manager',
    name: '패키지 매니저',
    commands: ['npm', 'npx', 'yarn', 'pnpm', 'pip', 'pip3', 'cargo', 'go'],
    tools: []
  },
  // 빌드/실행
  buildRun: {
    id: 'build-run',
    name: '빌드/실행',
    commands: ['node', 'python', 'python3', 'deno', 'bun'],
    tools: ['Bash']
  },
  // 네트워크
  network: {
    id: 'network',
    name: '네트워크',
    commands: ['curl', 'wget', 'ssh', 'scp'],
    tools: ['WebFetch', 'WebSearch']
  },
  // 검색
  search: {
    id: 'search',
    name: '검색',
    commands: ['grep', 'rg', 'find', 'fd', 'ag'],
    tools: ['Grep', 'Glob']
  },
  // Docker
  docker: {
    id: 'docker',
    name: 'Docker',
    commands: ['docker', 'docker-compose', 'podman'],
    tools: []
  },
  // 시스템
  system: {
    id: 'system',
    name: '시스템',
    commands: ['echo', 'pwd', 'ls', 'cd', 'env', 'export', 'which', 'whereis'],
    tools: []
  }
};

// ============================================================
// MCP 서버 정의
// ============================================================

const MCP_SERVERS = {
  filesystem: {
    id: 'filesystem',
    name: '파일시스템',
    package: '@anthropic-ai/mcp-server-filesystem',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-filesystem'],
    envRequired: [],
    config: (projectPath) => ({
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-server-filesystem', projectPath || '.']
    })
  },
  github: {
    id: 'github',
    name: 'GitHub',
    package: '@anthropic-ai/mcp-server-github',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-github'],
    envRequired: ['GITHUB_TOKEN'],
    config: () => ({
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-server-github'],
      env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' }
    })
  },
  postgres: {
    id: 'postgres',
    name: 'PostgreSQL',
    package: '@anthropic-ai/mcp-server-postgres',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-postgres'],
    envRequired: ['DATABASE_URL'],
    config: () => ({
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-server-postgres'],
      env: { DATABASE_URL: '${DATABASE_URL}' }
    })
  },
  sqlite: {
    id: 'sqlite',
    name: 'SQLite',
    package: '@anthropic-ai/mcp-server-sqlite',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-sqlite'],
    envRequired: [],
    config: (dbPath) => ({
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-server-sqlite', dbPath || './data.db']
    })
  },
  puppeteer: {
    id: 'puppeteer',
    name: 'Puppeteer',
    package: '@anthropic-ai/mcp-server-puppeteer',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-puppeteer'],
    envRequired: [],
    config: () => ({
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-server-puppeteer']
    })
  },
  memory: {
    id: 'memory',
    name: 'Memory',
    package: '@anthropic-ai/mcp-server-memory',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-memory'],
    envRequired: [],
    config: () => ({
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-server-memory']
    })
  }
};

// ============================================================
// 플러그인 정의
// ============================================================

const PLUGINS = {
  prettier: {
    id: 'prettier',
    name: 'Prettier',
    description: '코드 포맷팅',
    installCmd: 'npm install -D prettier',
    configFile: '.prettierrc',
    configContent: {
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5'
    }
  },
  eslint: {
    id: 'eslint',
    name: 'ESLint',
    description: '코드 린팅',
    installCmd: 'npm install -D eslint @eslint/js',
    configFile: 'eslint.config.js',
    configContent: null // 별도 생성 필요
  },
  typescript: {
    id: 'typescript',
    name: 'TypeScript',
    description: '타입 체크',
    installCmd: 'npm install -D typescript @types/node',
    configFile: 'tsconfig.json',
    configContent: {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true
      }
    }
  },
  vitest: {
    id: 'vitest',
    name: 'Vitest',
    description: '테스트 프레임워크',
    installCmd: 'npm install -D vitest',
    configFile: 'vitest.config.js',
    configContent: null
  },
  husky: {
    id: 'husky',
    name: 'Husky',
    description: 'Git 훅 관리',
    installCmd: 'npm install -D husky && npx husky init',
    configFile: null,
    configContent: null
  }
};

// ============================================================
// 생성 함수들
// ============================================================

/**
 * settings.json 생성
 * @param {Object} options
 * @param {string[]} options.permissions - 선택된 권한 그룹 ID 배열
 * @param {string[]} options.deny - 차단할 명령어/패턴 배열
 * @param {string[]} options.mcps - 선택된 MCP ID 배열
 * @param {string} options.projectPath - 프로젝트 경로
 * @returns {string} settings.json 내용 (JSON 문자열)
 */
export function generateSettings(options = {}) {
  const {
    permissions = [],
    deny = [],
    mcps = [],
    projectPath = '.'
  } = options;

  // 선택된 권한에서 명령어 수집
  const allowedCommands = new Set();
  const allowedTools = new Set();

  permissions.forEach(permId => {
    const group = Object.values(PERMISSION_GROUPS).find(g => g.id === permId);
    if (group) {
      group.commands.forEach(cmd => allowedCommands.add(cmd));
      group.tools.forEach(tool => allowedTools.add(tool));
    }
  });

  // 기본 도구 추가
  allowedTools.add('Read');
  allowedTools.add('Glob');
  allowedTools.add('Grep');
  allowedTools.add('Task');

  // MCP 서버 설정
  const mcpServers = {};
  mcps.forEach(mcpId => {
    const mcp = MCP_SERVERS[mcpId];
    if (mcp) {
      mcpServers[mcpId] = mcp.config(projectPath);
    }
  });

  // settings.json 구조
  const settings = {
    permissions: {
      allow: Array.from(allowedCommands).sort(),
      deny: deny.length > 0 ? deny : undefined
    },
    env: {
      CLAUDE_CODE_ENTRYPOINT: 'cli'
    }
  };

  // MCP 서버가 있으면 추가
  if (Object.keys(mcpServers).length > 0) {
    settings.mcpServers = mcpServers;
  }

  logger.info(`settings.json 생성: ${Array.from(allowedCommands).length}개 명령어 허용`);
  return JSON.stringify(settings, null, 2);
}

/**
 * CLAUDE.md 파일 생성
 * @param {Object} options
 * @param {string} options.projectName - 프로젝트 이름
 * @param {string} options.projectDesc - 프로젝트 설명
 * @param {string[]} options.techStack - 기술 스택
 * @param {string[]} options.codeRules - 코드 규칙
 * @param {boolean} options.autoProgress - 자동 진행 여부
 * @param {boolean} options.sessionManagement - 세션 관리 여부
 * @returns {string} CLAUDE.md 내용
 */
export function generateClaudeMd(options = {}) {
  const {
    projectName = '프로젝트',
    projectDesc = '',
    techStack = [],
    codeRules = [],
    autoProgress = true,
    sessionManagement = true
  } = options;

  let content = `# ${projectName}

## 프로젝트 개요
${projectDesc || '프로젝트 설명을 입력하세요.'}

`;

  // 기술 스택
  if (techStack.length > 0) {
    content += `## 기술 스택
${techStack.map(t => `- ${t}`).join('\n')}

`;
  }

  // 코드 규칙
  if (codeRules.length > 0) {
    content += `## 코드 규칙
${codeRules.map(r => `- ${r}`).join('\n')}

`;
  }

  // 자동 진행 규칙
  if (autoProgress) {
    content += `## 자동 진행 규칙
- 각 스텝 완료 후 자동으로 다음 스텝 진행
- 에러 발생 시 즉시 중단하고 사용자에게 보고
- 파일 생성/수정 전 기존 파일 백업 권장
- 테스트 실패 시 수정 후 재실행

`;
  }

  // 세션 관리
  if (sessionManagement) {
    content += `## 세션 관리
- 작업 중단 시 현재 진행 상황 저장
- \`claude --resume\` 명령어로 세션 복구 가능
- 중요 마일스톤마다 커밋 생성

`;
  }

  content += `---
*이 파일은 Control Tower에 의해 자동 생성되었습니다.*
*생성일: ${new Date().toLocaleDateString('ko-KR')}*
`;

  logger.info('CLAUDE.md 생성 완료');
  return content;
}

/**
 * todo.md 파일 생성
 * @param {Array} steps - 스텝 배열
 * @returns {string} todo.md 내용
 */
export function generateTodoMd(steps = []) {
  if (steps.length === 0) {
    return '# TODO\n\n할 일이 없습니다.\n';
  }

  let content = '# TODO\n\n';

  // Phase별로 그룹화
  const phaseGroups = {};
  steps.forEach(step => {
    const phase = step.phase || '기타';
    if (!phaseGroups[phase]) {
      phaseGroups[phase] = [];
    }
    phaseGroups[phase].push(step);
  });

  // 각 Phase 출력
  Object.entries(phaseGroups).forEach(([phase, phaseSteps]) => {
    content += `## ${phase}\n\n`;

    phaseSteps.forEach(step => {
      const checkbox = step.status === 'completed' ? '[x]' : '[ ]';
      content += `- ${checkbox} **${step.id}** ${step.title}\n`;
    });

    content += '\n';
  });

  content += `---\n*자동 생성: ${new Date().toLocaleString('ko-KR')}*\n`;

  logger.info(`todo.md 생성: ${steps.length}개 항목`);
  return content;
}

/**
 * MCP 서버 설치 명령어 생성
 * @param {string[]} selectedMcps - 선택된 MCP ID 배열
 * @returns {string[]} 설치 명령어 배열
 */
export function generateMcpCommands(selectedMcps = []) {
  const commands = [];

  selectedMcps.forEach(mcpId => {
    const mcp = MCP_SERVERS[mcpId];
    if (mcp) {
      // 패키지 설치 명령어
      commands.push(`# ${mcp.name} MCP 서버`);
      commands.push(`npm install -g ${mcp.package}`);

      // 환경변수 안내
      if (mcp.envRequired.length > 0) {
        commands.push(`# 필요한 환경변수: ${mcp.envRequired.join(', ')}`);
      }
    }
  });

  logger.info(`MCP 명령어 생성: ${commands.length}개`);
  return commands;
}

/**
 * 플러그인 설치 명령어 생성
 * @param {string[]} selectedPlugins - 선택된 플러그인 ID 배열
 * @returns {string[]} 설치 명령어 배열
 */
export function generatePluginCommands(selectedPlugins = []) {
  const commands = [];

  selectedPlugins.forEach(pluginId => {
    const plugin = PLUGINS[pluginId];
    if (plugin) {
      commands.push(`# ${plugin.name} - ${plugin.description}`);
      commands.push(plugin.installCmd);
    }
  });

  logger.info(`플러그인 명령어 생성: ${commands.length}개`);
  return commands;
}

/**
 * 자동 실행 스크립트 생성
 * @param {Array} steps - 스텝 배열
 * @param {Object} options
 * @param {boolean} options.sessionMode - 세션 모드 (--continue 사용)
 * @param {boolean} options.autoApprove - 자동 승인 (--dangerously-skip-permissions)
 * @param {string} options.projectPath - 프로젝트 경로
 * @param {number} options.delayBetweenSteps - 스텝 간 대기 시간 (초)
 * @returns {string} bash 스크립트 내용
 */
export function generateRunScript(steps = [], options = {}) {
  const {
    sessionMode = true,
    autoApprove = false,
    projectPath = '.',
    delayBetweenSteps = 2
  } = options;

  let script = `#!/bin/bash
# Control Tower 자동 실행 스크립트
# 생성일: ${new Date().toLocaleString('ko-KR')}

set -e  # 에러 발생 시 중단

# 색상 정의
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# 로그 함수
log_info() { echo -e "\${BLUE}[INFO]\${NC} $1"; }
log_success() { echo -e "\${GREEN}[SUCCESS]\${NC} $1"; }
log_warning() { echo -e "\${YELLOW}[WARNING]\${NC} $1"; }
log_error() { echo -e "\${RED}[ERROR]\${NC} $1"; }

# 프로젝트 디렉토리로 이동
cd "${projectPath}"
log_info "프로젝트 경로: $(pwd)"

# Claude CLI 옵션
CLAUDE_OPTS=""
`;

  if (sessionMode) {
    script += `CLAUDE_OPTS="$CLAUDE_OPTS --continue"\n`;
  }

  if (autoApprove) {
    script += `CLAUDE_OPTS="$CLAUDE_OPTS --dangerously-skip-permissions"\n`;
  }

  script += `
# 진행 상황 추적
TOTAL_STEPS=${steps.length}
CURRENT_STEP=0
FAILED_STEPS=0

log_info "총 \${TOTAL_STEPS}개 스텝 실행 시작"
echo ""

`;

  // 각 스텝 실행 코드 생성
  steps.forEach((step, index) => {
    const stepNum = index + 1;
    const escapedPrompt = (step.prompt || step.title || '')
      .replace(/'/g, "'\\''")  // 작은따옴표 이스케이프
      .replace(/\n/g, '\\n');  // 줄바꿈 이스케이프

    script += `# ─────────────────────────────────────────────────
# 스텝 ${step.id}: ${step.title}
# ─────────────────────────────────────────────────
CURRENT_STEP=${stepNum}
log_info "[\${CURRENT_STEP}/\${TOTAL_STEPS}] ${step.id}: ${step.title}"

PROMPT_${stepNum}='${escapedPrompt}'

if claude $CLAUDE_OPTS -p "$PROMPT_${stepNum}"; then
  log_success "스텝 ${step.id} 완료"
else
  log_error "스텝 ${step.id} 실패"
  FAILED_STEPS=$((FAILED_STEPS + 1))
  # 실패해도 계속 진행하려면 아래 주석 해제
  # exit 1
fi

`;

    if (delayBetweenSteps > 0 && index < steps.length - 1) {
      script += `sleep ${delayBetweenSteps}\n`;
    }

    script += `echo ""\n\n`;
  });

  // 완료 요약
  script += `# ─────────────────────────────────────────────────
# 실행 완료
# ─────────────────────────────────────────────────
echo ""
echo "=========================================="
if [ $FAILED_STEPS -eq 0 ]; then
  log_success "모든 스텝 완료! (\${TOTAL_STEPS}개)"
else
  log_warning "완료: \$((TOTAL_STEPS - FAILED_STEPS))/\${TOTAL_STEPS}, 실패: \${FAILED_STEPS}개"
fi
echo "=========================================="
`;

  logger.info(`실행 스크립트 생성: ${steps.length}개 스텝`);
  return script;
}

/**
 * 모든 설정 한번에 생성
 * @param {Object} options - 전체 옵션
 * @returns {Object} 생성된 모든 설정
 */
export function generateAll(options = {}) {
  const {
    projectName,
    projectPath,
    projectDesc,
    techStack,
    codeRules,
    permissions,
    deny,
    mcps,
    plugins,
    steps,
    autoProgress,
    sessionManagement,
    sessionMode,
    autoApprove
  } = options;

  return {
    settings: generateSettings({ permissions, deny, mcps, projectPath }),
    claudeMd: generateClaudeMd({
      projectName,
      projectDesc,
      techStack,
      codeRules,
      autoProgress,
      sessionManagement
    }),
    todoMd: generateTodoMd(steps),
    mcpCommands: generateMcpCommands(mcps),
    pluginCommands: generatePluginCommands(plugins),
    runScript: generateRunScript(steps, { sessionMode, autoApprove, projectPath })
  };
}

// 상수 내보내기 (프론트엔드와 공유)
export const CONSTANTS = {
  PERMISSION_GROUPS,
  MCP_SERVERS,
  PLUGINS
};

export default {
  generateSettings,
  generateClaudeMd,
  generateTodoMd,
  generateMcpCommands,
  generatePluginCommands,
  generateRunScript,
  generateAll,
  CONSTANTS
};
