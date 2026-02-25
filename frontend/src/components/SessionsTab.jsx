/**
 * 세션 관리 탭
 * 세션 복구, 자동 저장, 대화 추출 도구 안내
 */

import { useState, useEffect } from 'react';
import {
  History,
  RefreshCw,
  Copy,
  Check,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Save,
  Terminal,
  FileText,
  Download,
  Info,
  AlertCircle,
  BookOpen,
  Package
} from 'lucide-react';
import clsx from 'clsx';

// 세션 복구 명령어 모음
const SESSION_COMMANDS = [
  {
    label: '마지막 세션 이어하기',
    command: 'claude --continue',
    description: '가장 최근 세션을 이어서 진행'
  },
  {
    label: '특정 세션 복구',
    command: 'claude --resume SESSION_ID',
    description: '세션 ID로 특정 세션 복구'
  },
  {
    label: '세션 목록 보기',
    command: 'ls -la ~/.claude/projects/',
    description: '저장된 프로젝트 세션 확인'
  },
  {
    label: '세션 이름 지정 시작',
    command: 'claude --session-name "my-session"',
    description: '이름을 지정하여 새 세션 시작'
  },
  {
    label: '대화 내보내기',
    command: 'claude export --session SESSION_ID --output chat.json',
    description: '세션 대화를 JSON으로 내보내기'
  },
  {
    label: '대화 마크다운 내보내기',
    command: 'claude export --session SESSION_ID --format markdown',
    description: '세션 대화를 마크다운으로 내보내기'
  }
];

// CLAUDE.md 세션 관리 규칙
const CLAUDE_MD_SESSION_RULES = `## 세션 관리 규칙

### 작업 시작 시
- 항상 현재 작업 상태를 요약하고 시작
- 이전 세션에서 중단된 작업이 있다면 확인 후 이어서 진행

### 작업 중단 시
- 현재까지의 진행 상황을 정리
- 다음에 이어서 해야 할 작업 목록 작성
- 중요한 결정사항이나 맥락 기록

### 세션 복구 시
\`\`\`bash
# 마지막 세션 이어하기
claude --continue

# 특정 세션 복구
claude --resume SESSION_ID
\`\`\`

### 자동 저장 위치
- 프로젝트별: \`~/.claude/projects/{project-hash}/\`
- 세션 로그: \`~/.claude/projects/{project-hash}/{session-id}.jsonl\`
- 세션 메모리: \`~/.claude/projects/{project-hash}/session-memory/\`
`;

// claude-conversation-extractor 설치 안내
const EXTRACTOR_INSTALL = `# npm으로 설치
npm install -g claude-conversation-extractor

# 또는 npx로 바로 실행
npx claude-conversation-extractor`;

const EXTRACTOR_USAGE = `# 대화 추출 (기본)
claude-conversation-extractor ~/.claude/projects/

# 특정 프로젝트만
claude-conversation-extractor ~/.claude/projects/my-project/

# 마크다운으로 출력
claude-conversation-extractor --format markdown --output ./conversations/

# 날짜 범위 지정
claude-conversation-extractor --since "2024-01-01" --until "2024-12-31"

# JSON 형식으로 출력
claude-conversation-extractor --format json --output ./export.json`;

export default function SessionsTab({ currentSession, setCurrentSession, isConnected }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // 세션 목록 로드
  const fetchSessions = async () => {
    if (!isConnected) return;

    setLoading(true);
    try {
      const response = await fetch('/api/runner/sessions');
      const result = await response.json();
      if (result.success) {
        setSessions(result.data || []);
      }
    } catch (error) {
      console.error('세션 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [isConnected]);

  // 복사 핸들러
  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('복사 실패:', error);
    }
  };

  // 세션 선택
  const handleSelectSession = (session) => {
    setCurrentSession(session);
  };

  // 상태별 스타일
  const getStatusStyle = (status) => {
    switch (status) {
      case 'active':
        return { icon: Play, color: 'text-accent', bg: 'bg-accent/10', label: '진행 중' };
      case 'completed':
        return { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: '완료' };
      case 'failed':
        return { icon: XCircle, color: 'text-error', bg: 'bg-error/10', label: '실패' };
      default:
        return { icon: Clock, color: 'text-gray-400', bg: 'bg-dark-200', label: status };
    }
  };

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════
          헤더
          ════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <History className="w-7 h-7 text-accent" />
            세션 관리
          </h2>
          <p className="text-gray-400 mt-1">
            세션을 복구하고 대화를 관리합니다.
          </p>
        </div>

        <button
          onClick={fetchSessions}
          disabled={loading || !isConnected}
          className="btn-secondary"
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          새로고침
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════
          자동 저장 안내
          ════════════════════════════════════════════════════════ */}
      <div className="card border-accent/50 bg-accent/5">
        <div className="flex items-start gap-3">
          <Save className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-accent mb-2">자동 저장 기능</h3>
            <div className="text-sm text-gray-400 space-y-2">
              <p>
                Claude Code는 모든 대화를 자동으로 저장합니다.
                작업이 중단되어도 언제든 이어서 진행할 수 있습니다.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                <div className="p-2 bg-dark-300 rounded">
                  <div className="text-xs text-gray-500">저장 위치</div>
                  <code className="text-xs text-accent">~/.claude/projects/</code>
                </div>
                <div className="p-2 bg-dark-300 rounded">
                  <div className="text-xs text-gray-500">세션 파일</div>
                  <code className="text-xs text-accent">*.jsonl</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          세션 복구 명령어 모음
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-accent" />
          세션 복구 명령어
        </h3>

        <div className="grid sm:grid-cols-2 gap-3">
          {SESSION_COMMANDS.map((cmd, idx) => (
            <div
              key={idx}
              className="p-3 bg-dark-200 rounded-lg hover:bg-dark-100 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{cmd.label}</span>
                <button
                  onClick={() => handleCopy(cmd.command, `session-cmd-${idx}`)}
                  className="btn-ghost p-1.5"
                >
                  {copiedId === `session-cmd-${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <code className="block text-xs font-mono text-accent bg-dark-400 p-2 rounded mb-1">
                {cmd.command}
              </code>
              <p className="text-xs text-gray-500">{cmd.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          현재 세션
          ════════════════════════════════════════════════════════ */}
      {currentSession && (
        <div className="card border-accent bg-accent/5">
          <h3 className="font-semibold text-accent mb-3">현재 세션</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{currentSession.name || currentSession.id}</div>
              <div className="text-sm text-gray-400">
                진행: {currentSession.currentStep || 0} / {currentSession.totalSteps || 0} 스텝
              </div>
            </div>
            {currentSession.status && (
              <span className={clsx(
                'px-3 py-1 rounded-full text-sm',
                getStatusStyle(currentSession.status).bg,
                getStatusStyle(currentSession.status).color
              )}>
                {getStatusStyle(currentSession.status).label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          세션 목록
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent" />
          세션 목록
        </h3>

        {!isConnected ? (
          <div className="text-center py-8 text-gray-500">
            서버에 연결되지 않았습니다.
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>저장된 세션이 없습니다.</p>
            <p className="text-sm mt-1">Claude Code 실행 후 세션이 자동 저장됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const statusStyle = getStatusStyle(session.status);
              const StatusIcon = statusStyle.icon;

              return (
                <div
                  key={session.id}
                  className={clsx(
                    'p-4 rounded-lg border transition-all cursor-pointer',
                    currentSession?.id === session.id
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-dark-200 hover:border-border-light'
                  )}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={clsx('w-5 h-5', statusStyle.color)} />
                      <div>
                        <div className="font-medium">{session.name || session.id}</div>
                        <div className="text-xs text-gray-500">
                          {session.createdAt && new Date(session.createdAt).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    </div>

                    <span className={clsx(
                      'px-2 py-1 rounded text-xs',
                      statusStyle.bg,
                      statusStyle.color
                    )}>
                      {statusStyle.label}
                    </span>
                  </div>

                  {/* 진행률 */}
                  {session.totalSteps > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>진행률</span>
                        <span>{session.currentStep || 0} / {session.totalSteps}</span>
                      </div>
                      <div className="progress-bar h-1">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${((session.currentStep || 0) / session.totalSteps) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 복구 명령어 */}
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-dark-400 rounded font-mono text-xs text-gray-400">
                      claude --resume {session.id}
                    </code>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(`claude --resume ${session.id}`, session.id);
                      }}
                      className="btn-ghost p-2"
                      title="복사"
                    >
                      {copiedId === session.id ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          CLAUDE.md 세션 관리 규칙
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            CLAUDE.md 세션 관리 규칙
          </h3>
          <button
            onClick={() => handleCopy(CLAUDE_MD_SESSION_RULES, 'claude-md-rules')}
            className="btn-ghost text-sm"
          >
            {copiedId === 'claude-md-rules' ? (
              <><Check className="w-4 h-4 text-success" /> 복사됨</>
            ) : (
              <><Copy className="w-4 h-4" /> 복사</>
            )}
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-3">
          아래 내용을 CLAUDE.md에 추가하면 Claude Code가 세션 관리 규칙을 따릅니다.
        </p>

        <pre className="p-4 bg-dark-400 rounded-lg text-xs font-mono text-gray-300 overflow-x-auto scrollbar-thin max-h-64">
          {CLAUDE_MD_SESSION_RULES}
        </pre>
      </div>

      {/* ════════════════════════════════════════════════════════
          claude-conversation-extractor 안내
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-accent" />
          대화 추출 도구 (claude-conversation-extractor)
        </h3>

        <div className="space-y-4">
          {/* 설명 */}
          <div className="p-3 bg-dark-200 rounded-lg">
            <div className="flex items-start gap-2 text-sm">
              <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <p className="text-gray-400">
                Claude Code의 대화 기록(.jsonl)을 읽기 쉬운 형식으로 추출하는 도구입니다.
                마크다운, JSON 등 다양한 형식으로 내보낼 수 있습니다.
              </p>
            </div>
          </div>

          {/* 설치 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">설치</span>
              <button
                onClick={() => handleCopy(EXTRACTOR_INSTALL, 'extractor-install')}
                className="btn-ghost text-sm"
              >
                {copiedId === 'extractor-install' ? (
                  <><Check className="w-4 h-4 text-success" /> 복사됨</>
                ) : (
                  <><Copy className="w-4 h-4" /> 복사</>
                )}
              </button>
            </div>
            <pre className="p-3 bg-dark-400 rounded-lg text-xs font-mono text-gray-300">
              {EXTRACTOR_INSTALL}
            </pre>
          </div>

          {/* 사용법 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">사용법</span>
              <button
                onClick={() => handleCopy(EXTRACTOR_USAGE, 'extractor-usage')}
                className="btn-ghost text-sm"
              >
                {copiedId === 'extractor-usage' ? (
                  <><Check className="w-4 h-4 text-success" /> 복사됨</>
                ) : (
                  <><Copy className="w-4 h-4" /> 복사</>
                )}
              </button>
            </div>
            <pre className="p-4 bg-dark-400 rounded-lg text-xs font-mono text-gray-300 overflow-x-auto scrollbar-thin">
              {EXTRACTOR_USAGE}
            </pre>
          </div>

          {/* GitHub 링크 */}
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="w-4 h-4 text-gray-500" />
            <a
              href="https://github.com/anthropics/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              공식 문서 보기
            </a>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          도움말
          ════════════════════════════════════════════════════════ */}
      <div className="card bg-dark-200">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-accent" />
          세션 관리 팁
        </h3>

        <ul className="text-sm text-gray-400 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>세션은 프로젝트 폴더 기준으로 자동 분류됩니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span><code className="text-accent">--continue</code>는 마지막 세션을, <code className="text-accent">--resume</code>는 특정 세션을 복구합니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>세션 이름을 지정하면 나중에 찾기 쉽습니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>중요한 대화는 주기적으로 내보내기하여 백업하세요.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
