/**
 * 대시보드 탭
 * 진행률 통계 + Phase별 스텝 목록 + 실시간 로그
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Play,
  Terminal,
  Zap,
  Clock,
  AlertTriangle,
  Download,
  Trash2,
  Settings,
  FileText
} from 'lucide-react';
import clsx from 'clsx';

// 상태별 설정
const STATUS_CONFIG = {
  pending: {
    icon: Circle,
    color: 'text-gray-400',
    bg: 'bg-dark-200',
    border: 'border-transparent',
    label: '대기'
  },
  running: {
    icon: Loader2,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/50',
    label: '진행중',
    glow: true
  },
  completed: {
    icon: CheckCircle,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    label: '완료'
  },
  failed: {
    icon: XCircle,
    color: 'text-error',
    bg: 'bg-error/10',
    border: 'border-error/30',
    label: '실패'
  }
};

export default function DashboardTab({
  steps,
  setSteps,
  isRunning,
  currentStepIndex,
  logs,
  serverStatus,
  isConnected,
  onRunAll,
  onStop,
  onRunStep,
  clearLogs
}) {
  // 확장된 스텝 ID 목록
  const [expandedSteps, setExpandedSteps] = useState(new Set());
  // 복사된 스텝 ID
  const [copiedId, setCopiedId] = useState(null);
  // 로그 패널 표시
  const [showLogs, setShowLogs] = useState(true);
  // 생성된 설정 표시
  const [showConfig, setShowConfig] = useState(false);

  const logsEndRef = useRef(null);

  // 로그 자동 스크롤
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  // ────────────────────────────────────────────────────────
  // 통계 계산
  // ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = steps.length;
    const completed = steps.filter(s => s.status === 'completed').length;
    const failed = steps.filter(s => s.status === 'failed').length;
    const running = steps.filter(s => s.status === 'running').length;
    const pending = steps.filter(s => s.status === 'pending').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, failed, running, pending, percent };
  }, [steps]);

  // Phase별 그룹화
  const phaseGroups = useMemo(() => {
    const groups = {};
    steps.forEach(step => {
      const phase = step.phase || '기타';
      if (!groups[phase]) {
        groups[phase] = {
          name: phase,
          steps: [],
          completed: 0,
          total: 0
        };
      }
      groups[phase].steps.push(step);
      groups[phase].total++;
      if (step.status === 'completed') {
        groups[phase].completed++;
      }
    });
    return Object.values(groups);
  }, [steps]);

  // ────────────────────────────────────────────────────────
  // 핸들러
  // ────────────────────────────────────────────────────────

  // 스텝 확장/축소
  const toggleExpand = (stepId) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  // 프롬프트 복사
  const handleCopy = async (step) => {
    const text = step.prompt || step.title;
    await navigator.clipboard.writeText(text);
    setCopiedId(step.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 상태 토글 (수동)
  const toggleStatus = (stepId) => {
    setSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        const newStatus = step.status === 'completed' ? 'pending' : 'completed';
        return { ...step, status: newStatus };
      }
      return step;
    }));
  };

  // CLI 명령어 생성
  const getCliCommand = (step) => {
    const prompt = step.prompt || step.title;
    const escaped = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `claude -p "${escaped}"`;
  };

  // 로그 다운로드
  const handleDownloadLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.type}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════
          헤더
          ════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-accent" />
            대시보드
          </h2>
          <p className="text-gray-400 mt-1">
            진행 상황을 실시간으로 확인하세요.
          </p>
        </div>

        {/* 컨트롤 버튼 */}
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={onRunAll}
              disabled={steps.length === 0 || !isConnected || !serverStatus?.claudeAvailable}
              className="btn-success"
            >
              <Play className="w-4 h-4" />
              전체 실행
            </button>
          ) : (
            <button onClick={onStop} className="btn-danger">
              <XCircle className="w-4 h-4" />
              중지
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          통계 카드
          ════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 진행률 */}
        <div className="card col-span-2 lg:col-span-1">
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40" cy="40" r="36"
                  className="stroke-dark-100"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="40" cy="40" r="36"
                  className="stroke-accent"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${stats.percent * 2.26} 226`}
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              </svg>
              <span className="absolute text-xl font-bold gradient-text">
                {stats.percent}%
              </span>
            </div>
            <div className="text-sm text-gray-400 mt-2">진행률</div>
          </div>
        </div>

        {/* 완료 */}
        <div className="card text-center">
          <CheckCircle className="w-8 h-8 mx-auto text-success" />
          <div className="text-2xl font-bold mt-2">{stats.completed}</div>
          <div className="text-sm text-gray-400">완료</div>
        </div>

        {/* 진행중 */}
        <div className="card text-center">
          <Loader2 className={clsx(
            'w-8 h-8 mx-auto text-orange-400',
            stats.running > 0 && 'animate-spin'
          )} />
          <div className="text-2xl font-bold mt-2">{stats.running}</div>
          <div className="text-sm text-gray-400">진행중</div>
        </div>

        {/* 대기 */}
        <div className="card text-center">
          <Clock className="w-8 h-8 mx-auto text-gray-400" />
          <div className="text-2xl font-bold mt-2">{stats.pending}</div>
          <div className="text-sm text-gray-400">대기</div>
        </div>

        {/* 실패 */}
        <div className="card text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-error" />
          <div className="text-2xl font-bold mt-2">{stats.failed}</div>
          <div className="text-sm text-gray-400">실패</div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          프로그레스 바
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">전체 진행률</span>
          <span className="text-sm font-medium">
            {stats.completed} / {stats.total} 스텝
          </span>
        </div>
        <div className="h-3 bg-dark-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${stats.percent}%`,
              background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #6366f1)'
            }}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          Phase별 스텝 목록
          ════════════════════════════════════════════════════════ */}
      {steps.length > 0 ? (
        <div className="space-y-4">
          {phaseGroups.map((group) => (
            <div key={group.name} className="card">
              {/* Phase 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  {group.name}
                </h3>
                <span className="text-sm text-gray-400">
                  {group.completed} / {group.total}
                </span>
              </div>

              {/* 스텝 목록 */}
              <div className="space-y-2">
                {group.steps.map((step, index) => {
                  const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
                  const Icon = config.icon;
                  const isExpanded = expandedSteps.has(step.id);
                  const isCurrentStep = steps.indexOf(step) === currentStepIndex;

                  return (
                    <div
                      key={step.id}
                      className={clsx(
                        'rounded-lg border-2 transition-all duration-200',
                        config.bg,
                        config.border,
                        config.glow && 'shadow-glow animate-pulse-slow',
                        isCurrentStep && 'ring-2 ring-accent ring-offset-2 ring-offset-dark'
                      )}
                    >
                      {/* 스텝 헤더 */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer"
                        onClick={() => toggleExpand(step.id)}
                      >
                        {/* 상태 아이콘 / 번호 */}
                        <div className={clsx(
                          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                          step.status === 'pending' ? 'bg-dark-100' : 'bg-transparent'
                        )}>
                          {step.status === 'pending' ? (
                            <span className="text-sm font-medium text-gray-400">
                              {steps.indexOf(step) + 1}
                            </span>
                          ) : (
                            <Icon className={clsx(
                              'w-5 h-5',
                              config.color,
                              step.status === 'running' && 'animate-spin'
                            )} />
                          )}
                        </div>

                        {/* 제목 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-500">{step.id}</span>
                            <span className={clsx(
                              'text-xs px-1.5 py-0.5 rounded',
                              step.status === 'completed' && 'bg-success/20 text-success',
                              step.status === 'failed' && 'bg-error/20 text-error',
                              step.status === 'running' && 'bg-orange-500/20 text-orange-400',
                              step.status === 'pending' && 'bg-dark-50 text-gray-500'
                            )}>
                              {config.label}
                            </span>
                          </div>
                          <div className={clsx(
                            'font-medium truncate',
                            step.status === 'running' && 'text-orange-400'
                          )}>
                            {step.title}
                          </div>
                        </div>

                        {/* 액션 버튼들 */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* 복사 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(step);
                            }}
                            className="p-1.5 rounded hover:bg-dark-50 transition-colors"
                            title="프롬프트 복사"
                          >
                            {copiedId === step.id ? (
                              <Check className="w-4 h-4 text-success" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-500" />
                            )}
                          </button>

                          {/* 상태 토글 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(step.id);
                            }}
                            className="p-1.5 rounded hover:bg-dark-50 transition-colors"
                            title="상태 변경"
                          >
                            <CheckCircle className={clsx(
                              'w-4 h-4',
                              step.status === 'completed' ? 'text-success' : 'text-gray-500'
                            )} />
                          </button>

                          {/* 개별 실행 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunStep(step);
                            }}
                            disabled={isRunning || step.status === 'running'}
                            className="p-1.5 rounded hover:bg-dark-50 transition-colors disabled:opacity-50"
                            title="이 스텝 실행"
                          >
                            <Play className="w-4 h-4 text-gray-500" />
                          </button>

                          {/* 확장 아이콘 */}
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </div>

                      {/* 확장된 내용 */}
                      {isExpanded && (
                        <div className="px-3 pb-3 animate-fade-up">
                          <div className="ml-11 space-y-3">
                            {/* 프롬프트 내용 */}
                            {step.prompt && (
                              <div>
                                <div className="text-xs text-gray-400 mb-1">프롬프트</div>
                                <pre className="p-3 bg-dark-400 rounded-lg text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto scrollbar-thin">
                                  {step.prompt}
                                </pre>
                              </div>
                            )}

                            {/* CLI 명령어 */}
                            <div>
                              <div className="text-xs text-gray-400 mb-1">CLI 명령어</div>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 bg-dark-400 rounded text-xs font-mono text-accent truncate">
                                  {getCliCommand(step)}
                                </code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(getCliCommand(step));
                                    setCopiedId(step.id + '-cli');
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}
                                  className="btn-ghost p-2"
                                >
                                  {copiedId === step.id + '-cli' ? (
                                    <Check className="w-4 h-4 text-success" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>프롬프트 탭에서 스텝을 먼저 추출하세요.</p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          실시간 로그 패널 (하단 고정)
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="font-semibold flex items-center gap-2 hover:text-accent transition-colors"
          >
            <Terminal className="w-5 h-5 text-accent" />
            실시간 로그
            {logs.length > 0 && (
              <span className="badge-accent">{logs.length}</span>
            )}
            {showLogs ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          <div className="flex gap-2">
            <button
              onClick={clearLogs}
              disabled={logs.length === 0}
              className="btn-ghost text-sm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownloadLogs}
              disabled={logs.length === 0}
              className="btn-ghost text-sm"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showLogs && (
          <div className="bg-[#0a0a0a] rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto scrollbar-thin border border-dark-50">
            {logs.length === 0 ? (
              <span className="text-gray-600">
                실행을 시작하면 로그가 여기에 표시됩니다...
              </span>
            ) : (
              <div className="space-y-0.5">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={clsx(
                      'leading-relaxed',
                      log.type === 'stdout' && 'text-green-400',
                      log.type === 'stderr' && 'text-red-400',
                      log.type === 'system' && 'text-yellow-400'
                    )}
                  >
                    <span className="text-gray-600 select-none">[{log.timestamp}] </span>
                    {log.text}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}

            {/* 실행 중 커서 */}
            {isRunning && (
              <div className="flex items-center gap-1 mt-2">
                <span className="w-2 h-4 bg-green-400 animate-pulse" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          설정 파일 표시 (선택적)
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full font-semibold flex items-center gap-2 hover:text-accent transition-colors"
        >
          <Settings className="w-5 h-5 text-accent" />
          생성된 설정 파일
          {showConfig ? (
            <ChevronDown className="w-4 h-4 ml-auto" />
          ) : (
            <ChevronRight className="w-4 h-4 ml-auto" />
          )}
        </button>

        {showConfig && (
          <div className="mt-4 space-y-4 animate-fade-up">
            <p className="text-sm text-gray-400">
              설정 마법사에서 생성된 파일들이 여기에 표시됩니다.
              마법사를 완료하면 settings.json, CLAUDE.md 등을 확인할 수 있습니다.
            </p>

            <div className="p-4 bg-dark-200 rounded-lg text-center text-gray-500">
              <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>설정 마법사를 먼저 완료하세요.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
