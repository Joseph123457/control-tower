/**
 * 세션 관리 서비스
 * Claude Code 세션 상태 추적 및 복구
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

// 메모리 기반 세션 저장소 (향후 SQLite 확장 가능)
const sessions = new Map();

/**
 * 새 세션 생성
 * @param {Object} options - 세션 옵션
 * @returns {string} 세션 ID
 */
export function createSession(options = {}) {
  const sessionId = randomUUID();

  const session = {
    id: sessionId,
    name: options.name || `세션-${sessionId.slice(0, 8)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active', // active, paused, completed, failed
    steps: [],
    currentStep: 0,
    totalSteps: 0,
    executionHistory: [],
    metadata: options.metadata || {}
  };

  sessions.set(sessionId, session);
  logger.info(`세션 생성: ${sessionId}`);

  return sessionId;
}

/**
 * 세션 조회
 * @param {string} sessionId - 세션 ID
 * @returns {Object|null} 세션 정보
 */
export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * 모든 세션 조회
 * @returns {Array} 세션 리스트
 */
export function getAllSessions() {
  return Array.from(sessions.values()).map(session => ({
    id: session.id,
    name: session.name,
    status: session.status,
    currentStep: session.currentStep,
    totalSteps: session.totalSteps,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  }));
}

/**
 * 세션 업데이트
 * @param {string} sessionId - 세션 ID
 * @param {Object} updates - 업데이트 내용
 */
export function updateSession(sessionId, updates) {
  const session = sessions.get(sessionId);

  if (!session) {
    throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
  }

  Object.assign(session, updates, { updatedAt: new Date() });
  logger.info(`세션 업데이트: ${sessionId}`);

  return session;
}

/**
 * 세션에 실행 기록 추가
 * @param {string} sessionId - 세션 ID
 * @param {Object} execution - 실행 기록
 */
export function addExecutionToSession(sessionId, execution) {
  const session = sessions.get(sessionId);

  if (session) {
    session.executionHistory.push({
      ...execution,
      timestamp: new Date()
    });
    session.updatedAt = new Date();
  }
}

/**
 * 세션 스텝 진행
 * @param {string} sessionId - 세션 ID
 */
export function advanceStep(sessionId) {
  const session = sessions.get(sessionId);

  if (session && session.currentStep < session.totalSteps) {
    session.currentStep += 1;
    session.updatedAt = new Date();

    if (session.currentStep >= session.totalSteps) {
      session.status = 'completed';
    }
  }

  return session;
}

/**
 * 세션 삭제
 * @param {string} sessionId - 세션 ID
 */
export function deleteSession(sessionId) {
  const deleted = sessions.delete(sessionId);

  if (deleted) {
    logger.info(`세션 삭제: ${sessionId}`);
  }

  return deleted;
}

/**
 * 세션 복구 명령어 생성
 * @param {string} sessionId - 세션 ID
 * @returns {string} 복구 명령어
 */
export function getRecoveryCommand(sessionId) {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Claude Code 세션 복구 명령어
  return `claude --resume ${session.metadata.claudeSessionId || sessionId}`;
}

export default {
  createSession,
  getSession,
  getAllSessions,
  updateSession,
  addExecutionToSession,
  advanceStep,
  deleteSession,
  getRecoveryCommand
};
