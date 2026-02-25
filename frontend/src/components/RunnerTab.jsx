/**
 * 실행 탭
 * 스텝 실행 + 자동 실행 스크립트 + 자주 쓰는 명령어 + 실시간 로그
 */

import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Terminal,
  Trash2,
  Download,
  AlertCircle,
  Copy,
  Check,
  FileCode,
  Command,
  Zap,
  RefreshCw,
  Save,
  Upload,
  FolderOpen,
  Info
} from 'lucide-react';
import clsx from 'clsx';

// 자주 쓰는 명령어 목록
const COMMON_COMMANDS = [
  {
    category: '기본 실행',
    commands: [
      { label: 'Claude Code 시작', command: 'claude', description: '대화형 모드로 시작' },
      { label: '프롬프트 직접 실행', command: 'claude -p "프롬프트 내용"', description: '단일 프롬프트 실행' },
      { label: '파일 입력으로 실행', command: 'claude -p "$(cat prompt.txt)"', description: '파일에서 프롬프트 읽기' },
    ]
  },
  {
    category: '세션 관리',
    commands: [
      { label: '이어하기 (최근)', command: 'claude --continue', description: '마지막 세션 이어서' },
      { label: '세션 복구', command: 'claude --resume SESSION_ID', description: '특정 세션 복구' },
      { label: '세션 이름 지정', command: 'claude --session-name "프로젝트명"', description: '세션에 이름 부여' },
    ]
  },
  {
    category: '출력 및 내보내기',
    commands: [
      { label: 'JSON 출력', command: 'claude -p "프롬프트" --output-format json', description: 'JSON 형식 출력' },
      { label: '스트리밍 출력', command: 'claude -p "프롬프트" --output-format stream-json', description: '실시간 스트리밍' },
      { label: '대화 내보내기', command: 'claude export --session SESSION_ID', description: '세션 내보내기' },
    ]
  },
  {
    category: '권한 설정',
    commands: [
      { label: '전체 자동 허용', command: 'claude --dangerously-skip-permissions', description: '모든 권한 자동 승인' },
      { label: '자동 승인 모드', command: 'claude --allowedTools "Bash(npm:*),Read,Write"', description: '특정 도구만 허용' },
      { label: '설정 파일 사용', command: 'claude --settings ./settings.json', description: '설정 파일 지정' },
    ]
  }
];

export default function RunnerTab({
  steps,
  isRunning,
  currentStepIndex,
  logs,
  serverStatus,
  isConnected,
  onRunAll,
  onStop,
  onRunStep,
  clearLogs,
  resetSteps
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set(['기본 실행']));
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);

  // 로그 자동 스크롤
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

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

  // 로그 다운로드
  const handleDownloadLogs = () => {
    const logText = logs.map(l => `[${l.timestamp}] [${l.type}] ${l.text}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `control-tower-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 카테고리 토글
  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // 진행률 계산
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  // 자동 실행 스크립트 생성
  const generateAutoRunScript = () => {
    if (steps.length === 0) return '# 먼저 프롬프트 탭에서 스텝을 로드하세요';

    const prompts = steps.map((step, i) => {
      const prompt = (step.prompt || step.title).replace(/"/g, '\\"').replace(/\n/g, '\\n');
      return `
# 스텝 ${step.id}: ${step.title}
echo "▶ [${i + 1}/${steps.length}] ${step.title}"
claude -p "${prompt}" --allowedTools "Bash(npm:*),Read,Write,Edit"
if [ $? -ne 0 ]; then
  echo "✗ 스텝 ${step.id} 실패"
  exit 1
fi
echo "✓ 스텝 ${step.id} 완료"
`;
    }).join('\n');

    return `#!/bin/bash
# Control Tower 자동 실행 스크립트
# 생성일: ${new Date().toLocaleString('ko-KR')}

set -e  # 에러 시 중단

echo "═══════════════════════════════════════"
echo "  Control Tower 자동 실행"
echo "  총 ${steps.length}개 스텝"
echo "═══════════════════════════════════════"
${prompts}
echo ""
echo "═══════════════════════════════════════"
echo "  ✓ 모든 스텝 완료!"
echo "═══════════════════════════════════════"
`;
  };

  // 세션 유지 스크립트
  const sessionScript = `#!/bin/bash
# 세션 유지 스크립트
# 작업 중단 시 자동으로 세션을 저장하고 복구합니다.

SESSION_NAME="control-tower-$(date +%Y%m%d-%H%M%S)"

echo "세션 시작: $SESSION_NAME"
claude --session-name "$SESSION_NAME" \\
  --allowedTools "Bash(npm:*),Read,Write,Edit" \\
  -p "이전 작업을 이어서 진행합니다."

# 세션 ID 저장
echo "$SESSION_NAME" >> ~/.claude/session-history.txt
echo "세션 저장됨: $SESSION_NAME"
`;

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════
          헤더
          ════════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Play className="w-7 h-7 text-accent" />
          실행 도우미
        </h2>
        <p className="text-gray-400 mt-1">
          버튼 하나로 모든 스텝을 순차 실행하거나, 스크립트를 생성합니다.
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════
          경고: Claude CLI 없음
          ════════════════════════════════════════════════════════ */}
      {!serverStatus?.claudeAvailable && (
        <div className="card border-warning bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-warning">Claude CLI가 설치되지 않았습니다</h4>
              <p className="text-sm text-gray-400 mt-1">
                실행하려면 Claude CLI를 먼저 설치하세요:
              </p>
              <code className="block mt-2 p-2 bg-dark-300 rounded text-sm font-mono">
                npm install -g @anthropic-ai/claude-code
              </code>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          컨트롤 패널
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          {/* 실행/중지 버튼 */}
          {!isRunning ? (
            <button
              onClick={onRunAll}
              disabled={steps.length === 0 || !isConnected || !serverStatus?.claudeAvailable}
              className="btn-success"
            >
              <Play className="w-5 h-5" />
              전체 실행
            </button>
          ) : (
            <button onClick={onStop} className="btn-danger">
              <Square className="w-5 h-5" />
              중지
            </button>
          )}

          {/* 초기화 버튼 */}
          <button
            onClick={() => {
              resetSteps();
              clearLogs();
            }}
            disabled={isRunning}
            className="btn-secondary"
          >
            <Trash2 className="w-4 h-4" />
            초기화
          </button>

          {/* 상태 표시 */}
          <div className="flex-1 text-right text-sm text-gray-400">
            {steps.length > 0 ? (
              <span>
                {isRunning && currentStepIndex >= 0 ? (
                  <>실행 중: 스텝 {currentStepIndex + 1} / {steps.length}</>
                ) : (
                  <>{completedCount} / {steps.length} 완료 ({progressPercent}%)</>
                )}
              </span>
            ) : (
              <span className="text-warning">실행할 스텝이 없습니다</span>
            )}
          </div>
        </div>

        {/* 진행률 바 */}
        {steps.length > 0 && (
          <div className="mt-4">
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          스텝 목록 (빠른 실행용)
          ════════════════════════════════════════════════════════ */}
      {steps.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            개별 스텝 실행
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto scrollbar-thin">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => onRunStep(step)}
                disabled={isRunning || step.status === 'running'}
                className={clsx(
                  'p-3 rounded-lg text-left transition-all',
                  step.status === 'completed' && 'bg-success/10 border border-success/30',
                  step.status === 'failed' && 'bg-error/10 border border-error/30',
                  step.status === 'running' && 'bg-accent/10 border border-accent animate-pulse',
                  step.status === 'pending' && 'bg-dark-200 border border-border hover:border-accent',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500">{step.id}</span>
                  <span className={clsx(
                    'text-xs',
                    step.status === 'completed' && 'text-success',
                    step.status === 'failed' && 'text-error',
                    step.status === 'running' && 'text-accent'
                  )}>
                    {step.status === 'completed' && '✓'}
                    {step.status === 'failed' && '✗'}
                    {step.status === 'running' && '▶'}
                  </span>
                </div>
                <div className="text-sm font-medium truncate mt-1">
                  {step.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          자동 실행 스크립트 생성
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileCode className="w-5 h-5 text-accent" />
          자동 실행 스크립트
        </h3>

        <div className="space-y-4">
          {/* 전체 자동 실행 스크립트 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">전체 자동 실행 스크립트</span>
              <button
                onClick={() => handleCopy(generateAutoRunScript(), 'auto-script')}
                className="btn-ghost text-sm"
              >
                {copiedId === 'auto-script' ? (
                  <><Check className="w-4 h-4 text-success" /> 복사됨</>
                ) : (
                  <><Copy className="w-4 h-4" /> 복사</>
                )}
              </button>
            </div>
            <pre className="p-4 bg-dark-400 rounded-lg text-xs font-mono text-gray-300 overflow-x-auto scrollbar-thin max-h-48">
              {generateAutoRunScript()}
            </pre>
          </div>

          {/* 세션 유지 스크립트 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">세션 유지 스크립트</span>
              <button
                onClick={() => handleCopy(sessionScript, 'session-script')}
                className="btn-ghost text-sm"
              >
                {copiedId === 'session-script' ? (
                  <><Check className="w-4 h-4 text-success" /> 복사됨</>
                ) : (
                  <><Copy className="w-4 h-4" /> 복사</>
                )}
              </button>
            </div>
            <pre className="p-4 bg-dark-400 rounded-lg text-xs font-mono text-gray-300 overflow-x-auto scrollbar-thin max-h-32">
              {sessionScript}
            </pre>
          </div>

          {/* 사용법 안내 */}
          <div className="p-3 bg-dark-200 rounded-lg">
            <div className="flex items-start gap-2 text-sm">
              <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-gray-400">
                <p className="font-medium text-gray-300 mb-1">사용법:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>위 스크립트를 복사합니다</li>
                  <li><code className="text-accent">nano run.sh</code> 로 파일 생성</li>
                  <li>붙여넣기 후 저장 (Ctrl+O, Ctrl+X)</li>
                  <li><code className="text-accent">chmod +x run.sh && bash run.sh</code> 실행</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          자주 쓰는 명령어 모음
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Command className="w-5 h-5 text-accent" />
          자주 쓰는 명령어
        </h3>

        <div className="space-y-3">
          {COMMON_COMMANDS.map((category) => (
            <div key={category.category} className="border border-border rounded-lg overflow-hidden">
              {/* 카테고리 헤더 */}
              <button
                onClick={() => toggleCategory(category.category)}
                className="w-full flex items-center justify-between p-3 bg-dark-200 hover:bg-dark-100 transition-colors"
              >
                <span className="font-medium text-sm">{category.category}</span>
                <span className="text-gray-500 text-xs">
                  {expandedCategories.has(category.category) ? '접기' : '펼치기'}
                </span>
              </button>

              {/* 명령어 목록 */}
              {expandedCategories.has(category.category) && (
                <div className="divide-y divide-border">
                  {category.commands.map((cmd, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-dark-300 hover:bg-dark-200 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cmd.label}</span>
                        <button
                          onClick={() => handleCopy(cmd.command, `cmd-${category.category}-${idx}`)}
                          className="btn-ghost p-1.5"
                        >
                          {copiedId === `cmd-${category.category}-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <code className="block text-xs font-mono text-accent bg-dark-400 p-2 rounded">
                        {cmd.command}
                      </code>
                      <p className="text-xs text-gray-500 mt-1">{cmd.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          실시간 로그
          ════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent" />
            실시간 로그
            {logs.length > 0 && (
              <span className="badge-accent">{logs.length}</span>
            )}
          </h3>

          <div className="flex gap-2">
            <button
              onClick={clearLogs}
              disabled={logs.length === 0}
              className="btn-ghost text-sm"
            >
              <Trash2 className="w-4 h-4" />
              지우기
            </button>
            <button
              onClick={handleDownloadLogs}
              disabled={logs.length === 0}
              className="btn-ghost text-sm"
            >
              <Download className="w-4 h-4" />
              다운로드
            </button>
          </div>
        </div>

        <div
          ref={logsContainerRef}
          className="bg-[#0a0a0a] rounded-lg p-4 font-mono text-sm h-80 overflow-y-auto scrollbar-thin border border-dark-50"
        >
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
      </div>
    </div>
  );
}
