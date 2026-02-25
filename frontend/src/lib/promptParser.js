/**
 * 클라이언트 측 프롬프트 파서
 * 오프라인에서도 .md 파일 파싱 가능
 * 백엔드와 동일한 로직
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
 */
const STEP_PATTERN = /^###\s*(?:프롬프트\s*)?(\d+)-(\d+)[.:\s]+(.+)$/i;

/**
 * 프롬프트 텍스트를 스텝 목록으로 파싱
 * @param {string} text - 마크다운 텍스트
 * @returns {Array} 스텝 목록
 */
export function parsePromptFile(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const lines = text.split('\n');
  const steps = [];

  let currentPhase = '시작하기 전에';
  let currentPhaseNum = 0;
  let currentStep = null;
  let currentContent = [];
  let inCodeBlock = false;

  // 현재 스텝 저장 함수
  const saveCurrentStep = () => {
    if (currentStep) {
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

    // Phase 패턴 매칭
    const phaseMatch = line.match(PHASE_PATTERN);
    if (phaseMatch && line.startsWith('##') && !line.startsWith('###')) {
      saveCurrentStep();

      currentPhaseNum = phaseMatch[1] ? parseInt(phaseMatch[1], 10) : currentPhaseNum;
      currentPhase = phaseMatch[2].trim();
      continue;
    }

    // Step 패턴 매칭
    const stepMatch = line.match(STEP_PATTERN);
    if (stepMatch) {
      saveCurrentStep();

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

  return steps;
}

/**
 * 텍스트에서 코드블록 내용 추출
 * @param {string} text - 마크다운 텍스트
 * @returns {string[]} 코드블록 내용 배열
 */
export function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```(?:\w*)\n([\s\S]*?)```/g;
  let match;

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
 * @param {Array} steps - 스텝 목록
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
 * @param {Array} steps - 스텝 목록
 * @param {string} id - 스텝 ID
 * @returns {Object|null}
 */
export function findStepById(steps, id) {
  return steps.find(s => s.id === id) || null;
}

/**
 * 다음 실행할 스텝 찾기
 * @param {Array} steps - 스텝 목록
 * @returns {Object|null}
 */
export function findNextPendingStep(steps) {
  return steps.find(s => s.status === 'pending') || null;
}

/**
 * 프롬프트 형식 검증
 * @param {string} text - 마크다운 텍스트
 * @returns {Object} { valid, issues, statistics }
 */
export function validatePrompt(text) {
  const steps = parsePromptFile(text);
  const statistics = getParseStatistics(steps);
  const issues = [];

  if (steps.length === 0) {
    issues.push('스텝을 찾을 수 없습니다. "### 프롬프트 N-N:" 또는 "### N-N." 형식을 확인하세요.');
  }

  if (statistics.emptyPrompts > 0) {
    issues.push(`${statistics.emptyPrompts}개의 스텝에 프롬프트(코드블록)가 없습니다.`);
  }

  return {
    valid: issues.length === 0,
    issues,
    statistics,
    steps
  };
}

// 하위 호환성을 위한 alias
export const parsePromptClient = parsePromptFile;

export default {
  parsePromptFile,
  parsePromptClient,
  extractCodeBlocks,
  getParseStatistics,
  findStepById,
  findNextPendingStep,
  validatePrompt
};
