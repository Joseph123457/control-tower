/**
 * 프롬프트 파서 서비스
 * .md 파일 텍스트를 스텝 목록으로 파싱
 *
 * 두 가지 모드 지원:
 * 1. 스텝별 모드: "### 프롬프트 N-N:" 형식의 단계별 가이드
 * 2. 개발설계서 모드: 일반 CLAUDE.md 형식을 단일 프롬프트로 처리
 */

import { logger } from '../utils/logger.js';

/**
 * 스텝 객체 타입
 * @typedef {Object} Step
 * @property {string} id - 고유 ID (예: "1-1", "0-4")
 * @property {string} phase - 페이즈 이름
 * @property {string} title - 스텝 제목
 * @property {string} prompt - 실행할 프롬프트 (코드블록 내용)
 * @property {'pending'|'running'|'completed'|'failed'} status - 상태
 * @property {boolean} [isDevSpec] - 개발설계서 모드 여부
 */

/**
 * Phase 패턴 정규식
 * - "## 🔷 Phase 1: 프로젝트 초기화"
 * - "## 📌 시작하기 전에"
 * - "## Phase 2: 컴포넌트 개발"
 */
const PHASE_PATTERN = /^##\s*(?:🔷\s*)?(?:📌\s*)?(?:Phase\s*(\d+)\s*:\s*)?(.+)$/i;

/**
 * 스텝 패턴 정규식
 * - "### 프롬프트 1-1: 프로젝트 생성"
 * - "### 0-4. CLAUDE.md 파일 생성"
 * - "### 1-2. 컴포넌트 작성"
 * - "### 프롬프트 2-3: API 연동"
 */
const STEP_PATTERN = /^###\s*(?:프롬프트\s*)?(\d+)-(\d+)[.:\s]+(.+)$/i;

/**
 * 코드블록 추출 정규식
 */
const CODEBLOCK_PATTERN = /```(?:\w*)\n([\s\S]*?)```/g;

/**
 * 개발설계서에서 프로젝트 제목 추출
 * @param {string} text - 마크다운 텍스트
 * @returns {string} 프로젝트 제목
 */
function extractProjectTitle(text) {
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/^#\s+(.+?)(?:\s*[—\-–]|$)/);
    if (match) {
      return match[1].trim();
    }
  }
  return '개발설계서';
}

/**
 * 개발설계서 형식인지 확인
 * @param {string} text - 마크다운 텍스트
 * @returns {boolean}
 */
export function isDevSpec(text) {
  if (!text) return false;

  const devSpecPatterns = [
    /개발지침서/i,
    /개발설계서/i,
    /기술\s*스택/i,
    /파일\s*구조/i,
    /기능\s*명세/i,
    /Claude\s*Code/i,
    /프로젝트\s*개요/i,
    /핵심\s*목표/i
  ];

  return devSpecPatterns.some(pattern => pattern.test(text));
}

/**
 * 개발설계서를 여러 단계로 분리하여 변환
 * @param {string} text - 마크다운 텍스트
 * @returns {Step[]} 스텝 배열
 */
export function parseAsDevSpec(text) {
  const projectTitle = extractProjectTitle(text);
  const steps = [];

  // ## 섹션 기준으로 분리
  const sections = text.split(/(?=^## )/m).filter(s => s.trim());

  // 첫 번째 섹션 (# 제목 + 개요)
  let introSection = '';
  let mainSections = sections;

  if (sections[0] && !sections[0].startsWith('## ')) {
    introSection = sections[0];
    mainSections = sections.slice(1);
  }

  // 스텝 1: 프로젝트 초기화
  steps.push({
    id: '1-1',
    phase: '프로젝트 초기화',
    phaseNum: 1,
    stepNum: 1,
    title: '프로젝트 폴더 및 기본 구조 생성',
    prompt: `다음 개발설계서를 읽고 프로젝트의 기본 구조를 생성하세요.\n\n${introSection}\n\n---\n프로젝트 개요와 파일 구조를 파악하고 기본 폴더/파일을 생성하세요.`,
    rawContent: introSection,
    status: 'pending',
    isDevSpec: true
  });

  // 주요 섹션별로 스텝 생성
  let stepNum = 2;
  const importantSections = mainSections.filter(section => {
    const firstLine = section.split('\n')[0].toLowerCase();
    return firstLine.includes('기능') ||
           firstLine.includes('구현') ||
           firstLine.includes('컴포넌트') ||
           firstLine.includes('ui') ||
           firstLine.includes('html') ||
           firstLine.includes('css') ||
           firstLine.includes('javascript') ||
           firstLine.includes('로직') ||
           firstLine.includes('레이아웃') ||
           firstLine.includes('디자인');
  });

  const sectionsToProcess = importantSections.length > 0 ? importantSections : mainSections.slice(0, 5);

  sectionsToProcess.forEach((section, index) => {
    const sectionTitle = section.split('\n')[0].replace(/^##\s*/, '').replace(/\d+\.\s*/, '').trim();

    steps.push({
      id: `1-${stepNum}`,
      phase: '기능 구현',
      phaseNum: 1,
      stepNum: stepNum,
      title: sectionTitle || `섹션 ${index + 1} 구현`,
      prompt: `다음 섹션의 내용을 구현하세요:\n\n${section}\n\n---\n위 명세에 따라 코드를 작성하세요.`,
      rawContent: section,
      status: 'pending',
      isDevSpec: true
    });
    stepNum++;
  });

  // 마지막 스텝: 통합 및 테스트
  steps.push({
    id: `1-${stepNum}`,
    phase: '완료',
    phaseNum: 1,
    stepNum: stepNum,
    title: '통합 테스트 및 마무리',
    prompt: `지금까지 구현한 ${projectTitle} 프로젝트를 검토하고 완료하세요.`,
    rawContent: '',
    status: 'pending',
    isDevSpec: true
  });

  logger.info(`개발설계서 파싱: ${steps.length}개 스텝 생성`);
  return steps;
}

/**
 * 프롬프트 텍스트를 스텝 목록으로 파싱
 * @param {string} text - 마크다운 텍스트
 * @param {Object} options - 옵션 { forceDevSpec: boolean }
 * @returns {Step[]} 스텝 목록
 */
export function parsePromptFile(text, options = {}) {
  if (!text || typeof text !== 'string') {
    logger.warn('파싱할 텍스트가 없습니다.');
    return [];
  }

  // 강제 개발설계서 모드
  if (options.forceDevSpec) {
    return parseAsDevSpec(text);
  }

  const lines = text.split('\n');
  const steps = [];

  let currentPhase = '시작하기 전에'; // 기본 페이즈
  let currentPhaseNum = 0;
  let currentStep = null;
  let currentContent = [];
  let inCodeBlock = false;
  let codeBlockContent = [];

  // 현재 스텝 저장 함수
  const saveCurrentStep = () => {
    if (currentStep) {
      // 코드블록에서 프롬프트 추출
      const fullContent = currentContent.join('\n');
      const prompts = extractCodeBlocks(fullContent);

      currentStep.prompt = prompts.join('\n\n---\n\n').trim();
      currentStep.rawContent = fullContent;

      if (currentStep.prompt || currentStep.title) {
        steps.push(currentStep);
      }
    }
    currentStep = null;
    currentContent = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 코드블록 시작/끝 감지
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      currentContent.push(line);
      continue;
    }

    // 코드블록 내부면 그냥 추가
    if (inCodeBlock) {
      currentContent.push(line);
      continue;
    }

    // Phase 패턴 매칭 (## 로 시작)
    const phaseMatch = line.match(PHASE_PATTERN);
    if (phaseMatch && line.startsWith('##') && !line.startsWith('###')) {
      saveCurrentStep(); // 이전 스텝 저장

      currentPhaseNum = phaseMatch[1] ? parseInt(phaseMatch[1], 10) : currentPhaseNum;
      currentPhase = phaseMatch[2].trim();
      logger.debug(`Phase 발견: ${currentPhaseNum} - ${currentPhase}`);
      continue;
    }

    // Step 패턴 매칭 (### 로 시작)
    const stepMatch = line.match(STEP_PATTERN);
    if (stepMatch) {
      saveCurrentStep(); // 이전 스텝 저장

      const phaseNum = stepMatch[1];
      const stepNum = stepMatch[2];
      const title = stepMatch[3].trim();

      currentStep = {
        id: `${phaseNum}-${stepNum}`,
        phase: currentPhase,
        phaseNum: parseInt(phaseNum, 10),
        stepNum: parseInt(stepNum, 10),
        title,
        prompt: '',
        status: 'pending'
      };

      logger.debug(`Step 발견: ${currentStep.id} - ${title}`);
      continue;
    }

    // 현재 스텝이 있으면 내용 추가
    if (currentStep) {
      currentContent.push(line);
    }
  }

  // 마지막 스텝 저장
  saveCurrentStep();

  // 스텝을 찾지 못하고 개발설계서 형식이면 단일 스텝으로 변환
  if (steps.length === 0 && isDevSpec(text)) {
    return parseAsDevSpec(text);
  }

  // ID 순으로 정렬
  steps.sort((a, b) => {
    if (a.phaseNum !== b.phaseNum) {
      return a.phaseNum - b.phaseNum;
    }
    return a.stepNum - b.stepNum;
  });

  logger.info(`총 ${steps.length}개의 스텝 파싱 완료`);
  return steps;
}

/**
 * 텍스트에서 코드블록 내용 추출
 * @param {string} text - 마크다운 텍스트
 * @returns {string[]} 코드블록 내용 배열
 */
export function extractCodeBlocks(text) {
  const blocks = [];
  let match;

  // 정규식 lastIndex 초기화를 위해 새로 생성
  const regex = /```(?:\w*)\n([\s\S]*?)```/g;

  while ((match = regex.exec(text)) !== null) {
    const content = match[1].trim();
    if (content) {
      blocks.push(content);
    }
  }

  return blocks;
}

/**
 * 파싱 결과 요약 정보 생성
 * @param {Step[]} steps - 스텝 목록
 * @returns {Object} 요약 정보
 */
export function getParseStatistics(steps) {
  const phases = [...new Set(steps.map(s => s.phase))];
  const phaseGroups = {};

  steps.forEach(step => {
    if (!phaseGroups[step.phase]) {
      phaseGroups[step.phase] = [];
    }
    phaseGroups[step.phase].push(step);
  });

  return {
    totalSteps: steps.length,
    totalPhases: phases.length,
    phases: phases.map(phase => ({
      name: phase,
      stepCount: phaseGroups[phase].length
    })),
    hasPrompts: steps.filter(s => s.prompt).length,
    emptyPrompts: steps.filter(s => !s.prompt).length
  };
}

/**
 * 스텝 ID로 특정 스텝 찾기
 * @param {Step[]} steps - 스텝 목록
 * @param {string} id - 스텝 ID
 * @returns {Step|null}
 */
export function findStepById(steps, id) {
  return steps.find(s => s.id === id) || null;
}

/**
 * 다음 실행할 스텝 찾기
 * @param {Step[]} steps - 스텝 목록
 * @returns {Step|null}
 */
export function findNextPendingStep(steps) {
  return steps.find(s => s.status === 'pending') || null;
}

export default {
  parsePromptFile,
  parseAsDevSpec,
  isDevSpec,
  extractCodeBlocks,
  getParseStatistics,
  findStepById,
  findNextPendingStep
};
