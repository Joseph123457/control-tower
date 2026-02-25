/**
 * Claude 세션 파일 읽기 서비스
 * ~/.claude/ 에서 세션 데이터를 읽어 프로젝트/세션 목록과 대화 내역을 제공
 */

import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import readline from 'readline';
import { logger } from '../utils/logger.js';

// ============================================================
// 헬퍼
// ============================================================

/**
 * Claude 홈 디렉토리 경로
 */
function getClaudeHome() {
  return path.join(os.homedir(), '.claude');
}

/**
 * 파일 존재 여부 확인
 */
async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// 프로젝트 탐색
// ============================================================

/**
 * ~/.claude/projects/ 하위 디렉토리를 스캔하여 프로젝트 목록 반환
 * @returns {Promise<Array<{encoded: string, path: string, sessionCount: number}>>}
 */
export async function discoverProjects() {
  const projectsDir = path.join(getClaudeHome(), 'projects');

  if (!(await exists(projectsDir))) {
    logger.warn('Claude projects 디렉토리 없음:', projectsDir);
    return [];
  }

  const entries = await fs.readdir(projectsDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = path.join(projectsDir, entry.name);

    // .jsonl 파일 수 카운트
    let sessionCount = 0;
    try {
      const files = await fs.readdir(projectPath);
      sessionCount = files.filter(f => f.endsWith('.jsonl')).length;
    } catch {
      // 읽기 실패 시 0
    }

    // 인코딩된 이름을 디코딩해서 원래 경로 추출
    const decodedPath = decodeProjectName(entry.name);

    projects.push({
      encoded: entry.name,
      path: decodedPath,
      sessionCount
    });
  }

  // 세션 수 내림차순 정렬
  projects.sort((a, b) => b.sessionCount - a.sessionCount);

  return projects;
}

/**
 * 인코딩된 프로젝트 폴더명 → 원래 경로 복원
 * Claude는 경로의 / 를 - 로, : 를 - 로 치환하는 방식
 */
function decodeProjectName(encoded) {
  // 일반적으로 경로 구분자가 -로 인코딩됨
  // 정확한 디코딩은 불가능하므로 원본 인코딩 이름 그대로 반환
  return encoded;
}

// ============================================================
// 세션 목록
// ============================================================

/**
 * 프로젝트별 세션 목록 조회
 * @param {string} encodedProject - 인코딩된 프로젝트 이름
 * @returns {Promise<Array>}
 */
export async function getSessions(encodedProject) {
  const projectDir = path.join(getClaudeHome(), 'projects', encodedProject);

  if (!(await exists(projectDir))) {
    return [];
  }

  const files = await fs.readdir(projectDir);
  const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

  const sessions = [];

  for (const file of jsonlFiles) {
    const filePath = path.join(projectDir, file);
    const sessionId = file.replace('.jsonl', '');

    try {
      const stat = await fs.stat(filePath);

      // 대응하는 stats 파일 확인
      let stats = null;
      const statsPath = path.join(projectDir, `${sessionId}.session-stats.json`);
      if (await exists(statsPath)) {
        try {
          const raw = await fs.readFile(statsPath, 'utf-8');
          stats = JSON.parse(raw);
        } catch {
          // stats 파싱 실패 시 무시
        }
      }

      // JSONL 첫/마지막 줄에서 메타데이터 추출
      const meta = await getSessionMetadata(filePath);

      sessions.push({
        id: sessionId,
        shortId: sessionId.substring(0, 8),
        file,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        createdAt: stat.birthtime.toISOString(),
        stats,
        messageCount: meta.messageCount,
        lastMessage: meta.lastMessage,
        toolUseCount: meta.toolUseCount
      });
    } catch (err) {
      logger.warn(`세션 파일 읽기 실패: ${file}`, err.message);
    }
  }

  // 수정일 내림차순 정렬
  sessions.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

  return sessions;
}

/**
 * JSONL 파일에서 메타데이터 추출 (스트리밍)
 */
async function getSessionMetadata(filePath) {
  let messageCount = 0;
  let toolUseCount = 0;
  let lastMessage = null;

  try {
    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line);

        if (entry.type === 'user' || entry.type === 'assistant') {
          messageCount++;
          lastMessage = entry.timestamp || null;
        }

        // 도구 사용 카운트
        if (entry.type === 'assistant' && entry.message?.content) {
          const content = entry.message.content;
          if (Array.isArray(content)) {
            toolUseCount += content.filter(b => b.type === 'tool_use').length;
          }
        }
      } catch {
        // 마지막 줄 파싱 실패 시 무시 (동시 쓰기 대응)
      }
    }
  } catch (err) {
    logger.warn('메타데이터 추출 실패:', err.message);
  }

  return { messageCount, toolUseCount, lastMessage };
}

// ============================================================
// 대화 내역
// ============================================================

/**
 * 세션 대화 내역 조회 (JSONL 파싱)
 * @param {string} encodedProject - 인코딩된 프로젝트 이름
 * @param {string} sessionId - 세션 ID
 * @param {Object} opts - { limit, offset }
 * @returns {Promise<Array>}
 */
export async function getConversation(encodedProject, sessionId, opts = {}) {
  const { limit = 100, offset = 0 } = opts;
  const filePath = path.join(
    getClaudeHome(), 'projects', encodedProject, `${sessionId}.jsonl`
  );

  if (!(await exists(filePath))) {
    return [];
  }

  const messages = [];

  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // progress 타입 무시
      if (entry.type === 'progress') continue;

      if (entry.type === 'user') {
        // 사용자 메시지
        const content = entry.message?.content;
        messages.push({
          role: 'user',
          content: typeof content === 'string' ? content : JSON.stringify(content),
          timestamp: entry.timestamp || null
        });
      } else if (entry.type === 'assistant') {
        // AI 응답 (content 배열 → text/tool_use 블록)
        const content = entry.message?.content;
        const blocks = [];

        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              blocks.push({ type: 'text', text: block.text });
            } else if (block.type === 'tool_use') {
              blocks.push({
                type: 'tool_use',
                name: block.name,
                input: block.input
              });
            } else if (block.type === 'tool_result') {
              blocks.push({
                type: 'tool_result',
                tool_use_id: block.tool_use_id,
                content: typeof block.content === 'string'
                  ? block.content
                  : JSON.stringify(block.content)?.substring(0, 500)
              });
            }
          }
        } else if (typeof content === 'string') {
          blocks.push({ type: 'text', text: content });
        }

        messages.push({
          role: 'assistant',
          blocks,
          timestamp: entry.timestamp || null
        });
      } else if (entry.type === 'result') {
        // 결과 요약
        messages.push({
          role: 'system',
          content: entry.result || '(결과)',
          cost: entry.cost_usd,
          duration: entry.duration_ms,
          timestamp: entry.timestamp || null
        });
      }
    } catch {
      // 마지막 줄 파싱 실패 시 무시
    }
  }

  // offset + limit 적용
  return messages.slice(offset, offset + limit);
}

// ============================================================
// 통계
// ============================================================

/**
 * 전체 세션 통계
 */
export async function getSessionStats() {
  const projects = await discoverProjects();

  let totalSessions = 0;
  let totalSize = 0;

  for (const project of projects) {
    totalSessions += project.sessionCount;

    const projectDir = path.join(getClaudeHome(), 'projects', project.encoded);
    try {
      const files = await fs.readdir(projectDir);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const stat = await fs.stat(path.join(projectDir, file));
          totalSize += stat.size;
        }
      }
    } catch {
      // 무시
    }
  }

  return {
    projectCount: projects.length,
    totalSessions,
    totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
  };
}

// ============================================================
// 히스토리
// ============================================================

/**
 * ~/.claude/history.jsonl 읽기
 * @param {number} limit - 최근 N개
 */
export async function getHistory(limit = 50) {
  const historyPath = path.join(getClaudeHome(), 'history.jsonl');

  if (!(await exists(historyPath))) {
    return [];
  }

  const entries = [];

  const rl = readline.createInterface({
    input: createReadStream(historyPath, { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      entries.push(JSON.parse(line));
    } catch {
      // 무시
    }
  }

  // 최근 N개 반환
  return entries.slice(-limit).reverse();
}

export default {
  discoverProjects,
  getSessions,
  getConversation,
  getSessionStats,
  getHistory
};
