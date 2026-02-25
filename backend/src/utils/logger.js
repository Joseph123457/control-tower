/**
 * 로깅 유틸리티
 * 콘솔 기반 로거 (향후 파일 로깅 확장 가능)
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * 타임스탬프 생성
 * @returns {string} ISO 형식 타임스탬프
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 로그 포맷팅
 * @param {string} level - 로그 레벨
 * @param {string} message - 메시지
 * @param {any[]} args - 추가 인자
 * @returns {string} 포맷된 로그 문자열
 */
function formatLog(level, message, args) {
  const timestamp = getTimestamp();
  const argsStr = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
  return `[${timestamp}] [${level}] ${message}${argsStr}`;
}

export const logger = {
  /**
   * 디버그 로그
   */
  debug(message, ...args) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.debug(formatLog('DEBUG', message, args));
    }
  },

  /**
   * 정보 로그
   */
  info(message, ...args) {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.info(formatLog('INFO', message, args));
    }
  },

  /**
   * 경고 로그
   */
  warn(message, ...args) {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(formatLog('WARN', message, args));
    }
  },

  /**
   * 에러 로그
   */
  error(message, ...args) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(formatLog('ERROR', message, args));
    }
  }
};

export default logger;
