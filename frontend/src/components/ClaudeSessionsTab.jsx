/**
 * Claude 세션 탐색기 탭
 * ~/.claude/projects/ 의 실제 세션을 탐색하고 대화를 미리보기하며
 * 선택한 세션에 프롬프트를 보내 이어서 작업할 수 있는 UI
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  FolderOpen,
  MessageSquare,
  Clock,
  Wrench,
  ChevronRight,
  Send,
  Loader2,
  AlertCircle,
  User,
  Bot,
  Terminal,
  FileText,
  Database,
  ArrowLeft
} from 'lucide-react';
import clsx from 'clsx';

// API 베이스 URL
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

export default function ClaudeSessionsTab({ socket, isConnected, addLog, showNotification }) {
  // ──────────────────────────────────────────────────────────
  // 상태
  // ──────────────────────────────────────────────────────────
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [isResuming, setIsResuming] = useState(false);
  const [resumeOutput, setResumeOutput] = useState([]);
  const [loading, setLoading] = useState({ projects: false, sessions: false, conversation: false });
  const [stats, setStats] = useState(null);

  const outputRef = useRef(null);
  const conversationRef = useRef(null);

  // ──────────────────────────────────────────────────────────
  // 데이터 로드
  // ──────────────────────────────────────────────────────────

  // 프로젝트 목록 로드
  const fetchProjects = useCallback(async () => {
    setLoading(prev => ({ ...prev, projects: true }));
    try {
      const res = await fetch(`${API_BASE}/api/claude-sessions/projects`);
      const json = await res.json();
      if (json.success) {
        setProjects(json.data);
      }
    } catch (err) {
      console.error('프로젝트 로드 실패:', err);
    } finally {
      setLoading(prev => ({ ...prev, projects: false }));
    }
  }, []);

  // 통계 로드
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/claude-sessions/stats`);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('통계 로드 실패:', err);
    }
  }, []);

  // 세션 목록 로드
  const fetchSessions = useCallback(async (encodedProject) => {
    setLoading(prev => ({ ...prev, sessions: true }));
    try {
      const res = await fetch(`${API_BASE}/api/claude-sessions/projects/${encodeURIComponent(encodedProject)}/sessions`);
      const json = await res.json();
      if (json.success) {
        setSessions(json.data);
      }
    } catch (err) {
      console.error('세션 로드 실패:', err);
    } finally {
      setLoading(prev => ({ ...prev, sessions: false }));
    }
  }, []);

  // 대화 내역 로드
  const fetchConversation = useCallback(async (encodedProject, sessionId) => {
    setLoading(prev => ({ ...prev, conversation: true }));
    try {
      const res = await fetch(
        `${API_BASE}/api/claude-sessions/sessions/${sessionId}/conversation?project=${encodeURIComponent(encodedProject)}&limit=200`
      );
      const json = await res.json();
      if (json.success) {
        setConversation(json.data);
      }
    } catch (err) {
      console.error('대화 로드 실패:', err);
    } finally {
      setLoading(prev => ({ ...prev, conversation: false }));
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchProjects();
    fetchStats();
  }, [fetchProjects, fetchStats]);

  // 프로젝트 선택 시 세션 로드
  useEffect(() => {
    if (selectedProject) {
      fetchSessions(selectedProject.encoded);
      setSelectedSession(null);
      setConversation([]);
    }
  }, [selectedProject, fetchSessions]);

  // 대화 스크롤 하단 유지
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversation]);

  // 실시간 출력 스크롤
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [resumeOutput]);

  // ──────────────────────────────────────────────────────────
  // Socket.IO 이벤트 수신 (resume 실행 중)
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleOutput = (data) => {
      if (isResuming) {
        setResumeOutput(prev => [...prev.slice(-500), {
          type: data.type,
          line: data.line,
          timestamp: data.timestamp
        }]);
      }
    };

    const handleComplete = (data) => {
      if (isResuming) {
        setIsResuming(false);
        const msg = data.success ? '세션 실행 완료' : '세션 실행 실패';
        showNotification?.(data.success ? 'success' : 'error', msg);
        if (addLog) {
          addLog('system', `${data.success ? '✓' : '✗'} Resume 완료 (${data.duration}ms)`);
        }
      }
    };

    socket.on('step-output', handleOutput);
    socket.on('step-complete', handleComplete);

    return () => {
      socket.off('step-output', handleOutput);
      socket.off('step-complete', handleComplete);
    };
  }, [socket, isResuming, addLog, showNotification]);

  // ──────────────────────────────────────────────────────────
  // 세션 연결 (resume) 실행
  // ──────────────────────────────────────────────────────────
  const handleResume = useCallback(() => {
    if (!socket || !isConnected || !selectedSession || !prompt.trim()) {
      showNotification?.('warning', '세션과 프롬프트를 먼저 선택/입력하세요.');
      return;
    }

    setIsResuming(true);
    setResumeOutput([]);

    socket.emit('resume-session', {
      sessionId: selectedSession.id,
      prompt: prompt.trim()
    });

    if (addLog) {
      addLog('system', `▶ 세션 ${selectedSession.shortId} 에 연결 실행 중...`);
    }

    setPrompt('');
  }, [socket, isConnected, selectedSession, prompt, addLog, showNotification]);

  // ──────────────────────────────────────────────────────────
  // 대화 보기 핸들러
  // ──────────────────────────────────────────────────────────
  const handleViewConversation = useCallback((session) => {
    setSelectedSession(session);
    if (selectedProject) {
      fetchConversation(selectedProject.encoded, session.id);
    }
  }, [selectedProject, fetchConversation]);

  // ──────────────────────────────────────────────────────────
  // 시간 포맷
  // ──────────────────────────────────────────────────────────
  const formatTime = (isoStr) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleString('ko-KR', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // ──────────────────────────────────────────────────────────
  // 렌더링
  // ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Search className="w-7 h-7 text-accent" />
            세션 탐색기
          </h2>
          <p className="text-gray-400 mt-1">
            Claude Code 세션을 탐색하고 이어서 작업합니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 통계 */}
          {stats && (
            <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
              <span>{stats.projectCount}개 프로젝트</span>
              <span>{stats.totalSessions}개 세션</span>
              <span>{stats.totalSizeMB}MB</span>
            </div>
          )}
          <button
            onClick={() => { fetchProjects(); fetchStats(); }}
            disabled={loading.projects}
            className="btn-secondary"
          >
            <RefreshCw className={clsx('w-4 h-4', loading.projects && 'animate-spin')} />
            새로고침
          </button>
        </div>
      </div>

      {/* 메인 레이아웃: 2컬럼 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ════════════════════════════════════════════
            좌측: 프로젝트 목록
            ════════════════════════════════════════════ */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <FolderOpen className="w-4 h-4 text-accent" />
              프로젝트 목록
            </h3>

            {loading.projects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>프로젝트 없음</p>
                <p className="text-xs mt-1">~/.claude/projects/를 확인하세요</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-thin">
                {projects.map((project) => (
                  <button
                    key={project.encoded}
                    onClick={() => setSelectedProject(project)}
                    className={clsx(
                      'w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm',
                      selectedProject?.encoded === project.encoded
                        ? 'bg-accent/15 text-accent border border-accent/30'
                        : 'hover:bg-dark-200 border border-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate flex-1" title={project.path}>
                        {project.path.length > 30
                          ? '...' + project.path.slice(-27)
                          : project.path}
                      </span>
                      <ChevronRight className="w-3 h-3 flex-shrink-0 ml-1 text-gray-500" />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {project.sessionCount}개 세션
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            우측: 세션 목록 + 대화 미리보기
            ════════════════════════════════════════════ */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">

          {/* 세션 목록 */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <MessageSquare className="w-4 h-4 text-accent" />
              {selectedProject
                ? `세션 목록 — ${selectedProject.path.length > 40 ? '...' + selectedProject.path.slice(-37) : selectedProject.path}`
                : '프로젝트를 선택하세요'}
            </h3>

            {!selectedProject ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                좌측에서 프로젝트를 선택하면 세션 목록이 표시됩니다.
              </div>
            ) : loading.sessions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                이 프로젝트에 세션이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={clsx(
                      'p-3 rounded-lg border transition-all',
                      selectedSession?.id === session.id
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-dark-200 hover:border-border-light'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-medium">
                            {session.shortId}...
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(session.modifiedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {session.messageCount || 0}개 메시지
                            </span>
                            <span className="flex items-center gap-1">
                              <Wrench className="w-3 h-3" />
                              {session.toolUseCount || 0}회 도구
                            </span>
                            <span>{formatSize(session.size)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleViewConversation(session)}
                          className="btn-ghost text-xs px-2 py-1"
                        >
                          대화보기
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSession(session);
                            showNotification?.('success', `세션 ${session.shortId} 선택됨`);
                          }}
                          className="btn-secondary text-xs px-2 py-1"
                        >
                          연결하기
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 대화 내역 */}
          {selectedSession && conversation.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-accent" />
                  대화 내역 — {selectedSession.shortId}
                </h3>
                <button
                  onClick={() => { setConversation([]); setSelectedSession(null); }}
                  className="btn-ghost text-xs"
                >
                  <ArrowLeft className="w-3 h-3" />
                  닫기
                </button>
              </div>

              <div
                ref={conversationRef}
                className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin p-2 bg-dark-400 rounded-lg"
              >
                {conversation.map((msg, idx) => (
                  <div key={idx} className={clsx(
                    'p-3 rounded-lg text-sm',
                    msg.role === 'user' && 'bg-dark-200 border-l-2 border-blue-500',
                    msg.role === 'assistant' && 'bg-dark-300 border-l-2 border-accent',
                    msg.role === 'system' && 'bg-dark-200/50 border-l-2 border-gray-600 text-xs'
                  )}>
                    {/* 메시지 헤더 */}
                    <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-500">
                      {msg.role === 'user' && <><User className="w-3 h-3 text-blue-400" /> 사용자</>}
                      {msg.role === 'assistant' && <><Bot className="w-3 h-3 text-accent" /> Claude</>}
                      {msg.role === 'system' && <><Terminal className="w-3 h-3" /> 시스템</>}
                      {msg.timestamp && <span className="ml-auto">{formatTime(msg.timestamp)}</span>}
                    </div>

                    {/* 메시지 본문 */}
                    {msg.role === 'user' && (
                      <div className="text-gray-200 whitespace-pre-wrap break-words">
                        {typeof msg.content === 'string' ? msg.content.substring(0, 1000) : ''}
                        {msg.content?.length > 1000 && <span className="text-gray-500">... (생략)</span>}
                      </div>
                    )}

                    {msg.role === 'assistant' && msg.blocks && (
                      <div className="space-y-2">
                        {msg.blocks.map((block, bi) => (
                          <div key={bi}>
                            {block.type === 'text' && (
                              <div className="text-gray-200 whitespace-pre-wrap break-words">
                                {block.text?.substring(0, 1000)}
                                {block.text?.length > 1000 && <span className="text-gray-500">... (생략)</span>}
                              </div>
                            )}
                            {block.type === 'tool_use' && (
                              <div className="flex items-center gap-2 p-2 bg-dark-400 rounded text-xs">
                                <Wrench className="w-3 h-3 text-yellow-500" />
                                <span className="text-yellow-400 font-mono">{block.name}</span>
                                {block.input?.pattern && (
                                  <span className="text-gray-500 truncate">
                                    pattern="{block.input.pattern}"
                                  </span>
                                )}
                                {block.input?.command && (
                                  <span className="text-gray-500 truncate">
                                    {block.input.command.substring(0, 60)}
                                  </span>
                                )}
                              </div>
                            )}
                            {block.type === 'tool_result' && (
                              <div className="p-2 bg-dark-400/50 rounded text-xs text-gray-500 truncate">
                                결과: {typeof block.content === 'string' ? block.content.substring(0, 200) : '(데이터)'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.role === 'system' && (
                      <div className="text-gray-400">
                        {msg.content}
                        {msg.cost != null && (
                          <span className="ml-2 text-gray-600">(${msg.cost?.toFixed(4)})</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 프롬프트 입력 + 연결 실행 */}
          {selectedSession && (
            <div className="card border-accent/30">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Send className="w-4 h-4 text-accent" />
                세션에 프롬프트 보내기 — {selectedSession.shortId}
              </h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleResume();
                    }
                  }}
                  placeholder="이어서 작업할 프롬프트를 입력하세요..."
                  className="input flex-1"
                  disabled={isResuming || !isConnected}
                />
                <button
                  onClick={handleResume}
                  disabled={isResuming || !isConnected || !prompt.trim()}
                  className="btn-primary flex items-center gap-2"
                >
                  {isResuming ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> 실행 중...</>
                  ) : (
                    <><Send className="w-4 h-4" /> 연결 실행</>
                  )}
                </button>
              </div>

              {!isConnected && (
                <div className="flex items-center gap-2 mt-2 text-xs text-yellow-500">
                  <AlertCircle className="w-3 h-3" />
                  서버에 연결되지 않았습니다.
                </div>
              )}
            </div>
          )}

          {/* 실시간 출력 */}
          {(isResuming || resumeOutput.length > 0) && (
            <div className="card">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Terminal className="w-4 h-4 text-accent" />
                실시간 출력
                {isResuming && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
              </h3>

              <div
                ref={outputRef}
                className="bg-dark-400 rounded-lg p-3 font-mono text-xs max-h-64 overflow-y-auto scrollbar-thin space-y-0.5"
              >
                {resumeOutput.length === 0 ? (
                  <div className="text-gray-500">실행 로그가 여기에 표시됩니다...</div>
                ) : (
                  resumeOutput.map((entry, idx) => (
                    <div
                      key={idx}
                      className={clsx(
                        entry.type === 'stderr' ? 'text-red-400' : 'text-gray-300'
                      )}
                    >
                      {entry.line}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
