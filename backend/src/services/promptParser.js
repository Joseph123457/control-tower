/**
 * 프롬프트 파서 서비스
 * .md 파일 텍스트를 스텝 목록으로 파싱
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
 * 프롬프트 텍스트를 스텝 목록으로 파싱
 * @param {string} text - 마크다운 텍스트
 * @returns {Step[]} 스텝 목록
 */
export function parsePromptFile(text) {
  if (!text || typeof text !== 'string') {
    logger.warn('파싱할 텍스트가 없습니다.');
    return [];
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
  extractCodeBlocks,
  getParseStatistics,
  findStepById,
  findNextPendingStep
};
