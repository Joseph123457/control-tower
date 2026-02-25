/**
 * promptParser 테스트
 * 실행: node --test backend/src/services/promptParser.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parsePromptFile,
  extractCodeBlocks,
  getParseStatistics,
  findStepById,
  findNextPendingStep
} from './promptParser.js';

// 테스트용 샘플 마크다운
const SAMPLE_MARKDOWN = `
# 프로젝트 가이드

## 📌 시작하기 전에

### 0-1. 환경 설정

환경을 설정합니다.

\`\`\`
npm init -y
\`\`\`

### 0-2. Git 초기화

\`\`\`bash
git init
git add .
\`\`\`

## 🔷 Phase 1: 프로젝트 초기화

### 프롬프트 1-1: 프로젝트 생성

React 프로젝트를 생성합니다.

\`\`\`
npm create vite@latest my-app -- --template react
cd my-app
npm install
\`\`\`

### 프롬프트 1-2: 의존성 설치

\`\`\`
npm install axios react-router-dom
\`\`\`

## 🔷 Phase 2: 컴포넌트 개발

### 2-1. Header 컴포넌트

Header를 만듭니다.

\`\`\`jsx
// src/components/Header.jsx
export default function Header() {
  return <header>Header</header>;
}
\`\`\`

### 2-2. Footer 컴포넌트

\`\`\`jsx
// src/components/Footer.jsx
export default function Footer() {
  return <footer>Footer</footer>;
}
\`\`\`
`;

describe('parsePromptFile', () => {
  it('마크다운 텍스트를 스텝 목록으로 파싱한다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    assert.ok(Array.isArray(steps), '결과는 배열이어야 함');
    assert.ok(steps.length > 0, '스텝이 파싱되어야 함');
  });

  it('스텝 ID가 올바르게 파싱된다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    const ids = steps.map(s => s.id);
    assert.ok(ids.includes('0-1'), '0-1 스텝이 있어야 함');
    assert.ok(ids.includes('0-2'), '0-2 스텝이 있어야 함');
    assert.ok(ids.includes('1-1'), '1-1 스텝이 있어야 함');
    assert.ok(ids.includes('1-2'), '1-2 스텝이 있어야 함');
    assert.ok(ids.includes('2-1'), '2-1 스텝이 있어야 함');
    assert.ok(ids.includes('2-2'), '2-2 스텝이 있어야 함');
  });

  it('Phase가 올바르게 파싱된다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    const step01 = steps.find(s => s.id === '0-1');
    assert.strictEqual(step01.phase, '시작하기 전에');

    const step11 = steps.find(s => s.id === '1-1');
    assert.strictEqual(step11.phase, '프로젝트 초기화');

    const step21 = steps.find(s => s.id === '2-1');
    assert.strictEqual(step21.phase, '컴포넌트 개발');
  });

  it('스텝 제목이 올바르게 파싱된다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    const step01 = steps.find(s => s.id === '0-1');
    assert.strictEqual(step01.title, '환경 설정');

    const step11 = steps.find(s => s.id === '1-1');
    assert.strictEqual(step11.title, '프로젝트 생성');
  });

  it('코드블록에서 프롬프트가 추출된다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    const step01 = steps.find(s => s.id === '0-1');
    assert.ok(step01.prompt.includes('npm init -y'), '프롬프트에 명령어가 포함되어야 함');

    const step21 = steps.find(s => s.id === '2-1');
    assert.ok(step21.prompt.includes('Header'), '프롬프트에 컴포넌트 코드가 포함되어야 함');
  });

  it('스텝이 ID 순서대로 정렬된다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const curr = steps[i];

      const prevOrder = prev.phaseNum * 100 + prev.stepNum;
      const currOrder = curr.phaseNum * 100 + curr.stepNum;

      assert.ok(prevOrder <= currOrder, `${prev.id}가 ${curr.id}보다 앞에 와야 함`);
    }
  });

  it('모든 스텝의 status가 pending이다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    steps.forEach(step => {
      assert.strictEqual(step.status, 'pending', `${step.id}의 status가 pending이어야 함`);
    });
  });

  it('빈 텍스트는 빈 배열을 반환한다', () => {
    assert.deepStrictEqual(parsePromptFile(''), []);
    assert.deepStrictEqual(parsePromptFile(null), []);
    assert.deepStrictEqual(parsePromptFile(undefined), []);
  });
});

describe('extractCodeBlocks', () => {
  it('코드블록 내용을 추출한다', () => {
    const text = `
Some text

\`\`\`js
const x = 1;
\`\`\`

More text

\`\`\`
npm install
\`\`\`
    `;

    const blocks = extractCodeBlocks(text);

    assert.strictEqual(blocks.length, 2);
    assert.ok(blocks[0].includes('const x = 1'));
    assert.ok(blocks[1].includes('npm install'));
  });

  it('코드블록이 없으면 빈 배열을 반환한다', () => {
    const blocks = extractCodeBlocks('no code blocks here');
    assert.deepStrictEqual(blocks, []);
  });
});

describe('getParseStatistics', () => {
  it('파싱 통계를 올바르게 계산한다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);
    const stats = getParseStatistics(steps);

    assert.strictEqual(stats.totalSteps, 6);
    assert.strictEqual(stats.totalPhases, 3);
    assert.ok(stats.hasPrompts > 0);
  });
});

describe('findStepById', () => {
  it('ID로 스텝을 찾는다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    const step = findStepById(steps, '1-1');
    assert.ok(step);
    assert.strictEqual(step.id, '1-1');
    assert.strictEqual(step.title, '프로젝트 생성');
  });

  it('존재하지 않는 ID는 null을 반환한다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    const step = findStepById(steps, '99-99');
    assert.strictEqual(step, null);
  });
});

describe('findNextPendingStep', () => {
  it('첫 번째 pending 스텝을 찾는다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);

    const next = findNextPendingStep(steps);
    assert.ok(next);
    assert.strictEqual(next.status, 'pending');
  });

  it('pending 스텝이 없으면 null을 반환한다', () => {
    const steps = parsePromptFile(SAMPLE_MARKDOWN);
    steps.forEach(s => s.status = 'completed');

    const next = findNextPendingStep(steps);
    assert.strictEqual(next, null);
  });
});

// 다양한 형식 테스트
describe('다양한 스텝 형식 파싱', () => {
  it('"### 프롬프트 N-N:" 형식을 파싱한다', () => {
    const text = `
## 🔷 Phase 1: 테스트

### 프롬프트 1-1: 첫 번째

\`\`\`
command1
\`\`\`
    `;

    const steps = parsePromptFile(text);
    assert.strictEqual(steps.length, 1);
    assert.strictEqual(steps[0].id, '1-1');
  });

  it('"### N-N. 제목" 형식을 파싱한다', () => {
    const text = `
## Phase 1

### 1-1. 첫 번째 스텝

\`\`\`
command1
\`\`\`

### 1-2. 두 번째 스텝

\`\`\`
command2
\`\`\`
    `;

    const steps = parsePromptFile(text);
    assert.strictEqual(steps.length, 2);
    assert.strictEqual(steps[0].id, '1-1');
    assert.strictEqual(steps[1].id, '1-2');
  });

  it('이모지가 있는 Phase를 파싱한다', () => {
    const text = `
## 📌 시작하기 전에

### 0-1. 준비

\`\`\`
prep
\`\`\`

## 🔷 Phase 1: 개발

### 1-1. 개발 시작

\`\`\`
dev
\`\`\`
    `;

    const steps = parsePromptFile(text);
    assert.strictEqual(steps.length, 2);
    assert.strictEqual(steps[0].phase, '시작하기 전에');
    assert.strictEqual(steps[1].phase, '개발');
  });

  it('여러 코드블록을 하나의 프롬프트로 합친다', () => {
    const text = `
## Phase 1

### 1-1. 멀티 코드블록

\`\`\`
first command
\`\`\`

중간 설명

\`\`\`
second command
\`\`\`
    `;

    const steps = parsePromptFile(text);
    assert.ok(steps[0].prompt.includes('first command'));
    assert.ok(steps[0].prompt.includes('second command'));
    assert.ok(steps[0].prompt.includes('---')); // 구분자
  });
});

console.log('테스트 파일 로드 완료. node --test 로 실행하세요.');
