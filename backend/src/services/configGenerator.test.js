/**
 * configGenerator 테스트
 * 실행: node --test backend/src/services/configGenerator.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateSettings,
  generateClaudeMd,
  generateTodoMd,
  generateMcpCommands,
  generatePluginCommands,
  generateRunScript,
  generateAll,
  CONSTANTS
} from './configGenerator.js';

describe('generateSettings', () => {
  it('기본 설정을 생성한다', () => {
    const settings = generateSettings();
    const parsed = JSON.parse(settings);

    assert.ok(parsed.permissions, 'permissions 객체가 있어야 함');
    assert.ok(Array.isArray(parsed.permissions.allow), 'allow가 배열이어야 함');
  });

  it('선택된 권한에 따라 명령어를 포함한다', () => {
    const settings = generateSettings({
      permissions: ['file-read', 'git']
    });
    const parsed = JSON.parse(settings);

    assert.ok(parsed.permissions.allow.includes('cat'), 'cat 명령어 포함');
    assert.ok(parsed.permissions.allow.includes('git'), 'git 명령어 포함');
  });

  it('deny 배열을 설정에 포함한다', () => {
    const settings = generateSettings({
      permissions: ['file-read'],
      deny: ['rm -rf']
    });
    const parsed = JSON.parse(settings);

    assert.ok(parsed.permissions.deny.includes('rm -rf'), 'deny 목록에 포함');
  });

  it('MCP 서버 설정을 포함한다', () => {
    const settings = generateSettings({
      permissions: [],
      mcps: ['filesystem', 'github']
    });
    const parsed = JSON.parse(settings);

    assert.ok(parsed.mcpServers, 'mcpServers 객체가 있어야 함');
    assert.ok(parsed.mcpServers.filesystem, 'filesystem MCP 포함');
    assert.ok(parsed.mcpServers.github, 'github MCP 포함');
  });

  it('유효한 JSON을 반환한다', () => {
    const settings = generateSettings({
      permissions: ['file-read', 'file-write', 'git'],
      mcps: ['filesystem']
    });

    assert.doesNotThrow(() => JSON.parse(settings));
  });
});

describe('generateClaudeMd', () => {
  it('프로젝트 이름을 포함한다', () => {
    const md = generateClaudeMd({
      projectName: '테스트 프로젝트'
    });

    assert.ok(md.includes('# 테스트 프로젝트'), '제목에 프로젝트 이름 포함');
  });

  it('기술 스택을 리스트로 포함한다', () => {
    const md = generateClaudeMd({
      projectName: 'Test',
      techStack: ['React', 'Node.js', 'PostgreSQL']
    });

    assert.ok(md.includes('- React'));
    assert.ok(md.includes('- Node.js'));
    assert.ok(md.includes('- PostgreSQL'));
  });

  it('코드 규칙을 리스트로 포함한다', () => {
    const md = generateClaudeMd({
      projectName: 'Test',
      codeRules: ['한국어 주석', 'ESM 모듈']
    });

    assert.ok(md.includes('- 한국어 주석'));
    assert.ok(md.includes('- ESM 모듈'));
  });

  it('자동 진행 규칙을 포함한다', () => {
    const md = generateClaudeMd({
      projectName: 'Test',
      autoProgress: true
    });

    assert.ok(md.includes('자동 진행 규칙'));
  });

  it('세션 관리 섹션을 포함한다', () => {
    const md = generateClaudeMd({
      projectName: 'Test',
      sessionManagement: true
    });

    assert.ok(md.includes('세션 관리'));
    assert.ok(md.includes('--resume'));
  });
});

describe('generateTodoMd', () => {
  it('빈 스텝 배열에 대해 기본 메시지를 반환한다', () => {
    const md = generateTodoMd([]);

    assert.ok(md.includes('할 일이 없습니다'));
  });

  it('스텝을 체크리스트 형식으로 변환한다', () => {
    const steps = [
      { id: '1-1', phase: 'Phase 1', title: '첫 번째 스텝', status: 'pending' },
      { id: '1-2', phase: 'Phase 1', title: '두 번째 스텝', status: 'completed' }
    ];

    const md = generateTodoMd(steps);

    assert.ok(md.includes('[ ] **1-1** 첫 번째 스텝'), '미완료 스텝은 빈 체크박스');
    assert.ok(md.includes('[x] **1-2** 두 번째 스텝'), '완료 스텝은 체크된 체크박스');
  });

  it('Phase별로 그룹화한다', () => {
    const steps = [
      { id: '1-1', phase: 'Phase 1', title: '스텝 1', status: 'pending' },
      { id: '2-1', phase: 'Phase 2', title: '스텝 2', status: 'pending' }
    ];

    const md = generateTodoMd(steps);

    assert.ok(md.includes('## Phase 1'));
    assert.ok(md.includes('## Phase 2'));
  });
});

describe('generateMcpCommands', () => {
  it('선택된 MCP 설치 명령어를 반환한다', () => {
    const commands = generateMcpCommands(['filesystem', 'github']);

    assert.ok(commands.length > 0);
    assert.ok(commands.some(c => c.includes('npm install')));
  });

  it('환경변수 안내를 포함한다', () => {
    const commands = generateMcpCommands(['github']);

    assert.ok(commands.some(c => c.includes('GITHUB_TOKEN')));
  });

  it('빈 배열에 대해 빈 배열을 반환한다', () => {
    const commands = generateMcpCommands([]);

    assert.deepStrictEqual(commands, []);
  });
});

describe('generatePluginCommands', () => {
  it('선택된 플러그인 설치 명령어를 반환한다', () => {
    const commands = generatePluginCommands(['prettier', 'eslint']);

    assert.ok(commands.length > 0);
    assert.ok(commands.some(c => c.includes('prettier')));
    assert.ok(commands.some(c => c.includes('eslint')));
  });

  it('빈 배열에 대해 빈 배열을 반환한다', () => {
    const commands = generatePluginCommands([]);

    assert.deepStrictEqual(commands, []);
  });
});

describe('generateRunScript', () => {
  const sampleSteps = [
    { id: '1-1', title: '프로젝트 생성', prompt: 'npm init -y' },
    { id: '1-2', title: '의존성 설치', prompt: 'npm install express' }
  ];

  it('bash 스크립트를 생성한다', () => {
    const script = generateRunScript(sampleSteps);

    assert.ok(script.startsWith('#!/bin/bash'));
  });

  it('모든 스텝을 포함한다', () => {
    const script = generateRunScript(sampleSteps);

    assert.ok(script.includes('1-1: 프로젝트 생성'));
    assert.ok(script.includes('1-2: 의존성 설치'));
  });

  it('sessionMode 옵션을 적용한다', () => {
    const script = generateRunScript(sampleSteps, { sessionMode: true });

    assert.ok(script.includes('--continue'));
  });

  it('autoApprove 옵션을 적용한다', () => {
    const script = generateRunScript(sampleSteps, { autoApprove: true });

    assert.ok(script.includes('--dangerously-skip-permissions'));
  });

  it('완료 요약을 포함한다', () => {
    const script = generateRunScript(sampleSteps);

    assert.ok(script.includes('실행 완료'));
    assert.ok(script.includes('TOTAL_STEPS'));
  });
});

describe('generateAll', () => {
  it('모든 설정을 한번에 생성한다', () => {
    const result = generateAll({
      projectName: '테스트 프로젝트',
      projectPath: '/test/path',
      permissions: ['file-read', 'git'],
      mcps: ['filesystem'],
      plugins: ['prettier'],
      steps: [
        { id: '1-1', phase: 'Phase 1', title: '테스트', prompt: 'echo test', status: 'pending' }
      ]
    });

    assert.ok(result.settings, 'settings가 있어야 함');
    assert.ok(result.claudeMd, 'claudeMd가 있어야 함');
    assert.ok(result.todoMd, 'todoMd가 있어야 함');
    assert.ok(result.mcpCommands, 'mcpCommands가 있어야 함');
    assert.ok(result.pluginCommands, 'pluginCommands가 있어야 함');
    assert.ok(result.runScript, 'runScript가 있어야 함');
  });
});

describe('CONSTANTS', () => {
  it('PERMISSION_GROUPS가 정의되어 있다', () => {
    assert.ok(CONSTANTS.PERMISSION_GROUPS);
    assert.ok(Object.keys(CONSTANTS.PERMISSION_GROUPS).length > 0);
  });

  it('MCP_SERVERS가 정의되어 있다', () => {
    assert.ok(CONSTANTS.MCP_SERVERS);
    assert.ok(CONSTANTS.MCP_SERVERS.filesystem);
    assert.ok(CONSTANTS.MCP_SERVERS.github);
  });

  it('PLUGINS가 정의되어 있다', () => {
    assert.ok(CONSTANTS.PLUGINS);
    assert.ok(CONSTANTS.PLUGINS.prettier);
    assert.ok(CONSTANTS.PLUGINS.eslint);
  });
});

console.log('configGenerator 테스트 파일 로드 완료');
