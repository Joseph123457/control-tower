/**
 * 설정 마법사 탭 (5단계)
 * Step 0: 프로젝트 정보
 * Step 1: 권한 설정
 * Step 2: MCP 서버 선택
 * Step 3: 플러그인 선택
 * Step 4: 완료 & 생성
 */

import { useState, useMemo } from 'react';
import {
  Settings,
  FolderOpen,
  Shield,
  Database,
  Plug,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import {
  ALLOW_COMMANDS,
  COMMAND_CATEGORIES,
  DENY_PATTERNS,
  AUTO_APPROVE_MODES,
  MCP_SERVERS,
  PLUGINS,
  PLUGIN_CATEGORIES,
  PRESETS,
  getRecommendedCommands,
  getRecommendedDenyPatterns,
  getRecommendedMcps,
  getRecommendedPlugins
} from '../lib/constants';

// 단계 정의
const STEPS = [
  { id: 0, title: '프로젝트 정보', icon: FolderOpen },
  { id: 1, title: '권한 설정', icon: Shield },
  { id: 2, title: 'MCP 서버', icon: Database },
  { id: 3, title: '플러그인', icon: Plug },
  { id: 4, title: '완료', icon: CheckCircle }
];

export default function WizardTab({ isConnected }) {
  // 현재 단계
  const [currentStep, setCurrentStep] = useState(0);

  // Step 0: 프로젝트 정보
  const [projectName, setProjectName] = useState('my-project');
  const [projectPath, setProjectPath] = useState('.');
  const [projectDesc, setProjectDesc] = useState('');

  // Step 1: 권한 설정
  const [selectedCommands, setSelectedCommands] = useState(getRecommendedCommands());
  const [selectedDenyPatterns, setSelectedDenyPatterns] = useState(getRecommendedDenyPatterns());
  const [autoApproveMode, setAutoApproveMode] = useState('settings');

  // Step 2: MCP 서버
  const [selectedMcps, setSelectedMcps] = useState(getRecommendedMcps());

  // Step 3: 플러그인
  const [selectedPlugins, setSelectedPlugins] = useState(getRecommendedPlugins());

  // Step 4: 생성 결과
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  // 토글 함수
  const toggleItem = (item, list, setList) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  // 추천만 선택
  const selectRecommendedOnly = (type) => {
    switch (type) {
      case 'commands':
        setSelectedCommands(getRecommendedCommands());
        break;
      case 'deny':
        setSelectedDenyPatterns(getRecommendedDenyPatterns());
        break;
      case 'mcps':
        setSelectedMcps(getRecommendedMcps());
        break;
      case 'plugins':
        setSelectedPlugins(getRecommendedPlugins());
        break;
    }
  };

  // 전체 선택/해제
  const selectAll = (type, all) => {
    switch (type) {
      case 'commands':
        setSelectedCommands(all ? ALLOW_COMMANDS.map(c => c.id) : []);
        break;
      case 'deny':
        setSelectedDenyPatterns(all ? DENY_PATTERNS.map(p => p.id) : []);
        break;
      case 'mcps':
        setSelectedMcps(all ? MCP_SERVERS.map(m => m.id) : []);
        break;
      case 'plugins':
        setSelectedPlugins(all ? PLUGINS.map(p => p.id) : []);
        break;
    }
  };

  // 프리셋 적용
  const applyPreset = (presetId) => {
    const preset = PRESETS[presetId];
    if (preset) {
      setSelectedCommands(preset.allowCommands);
      setSelectedDenyPatterns(preset.denyPatterns);
      setAutoApproveMode(preset.autoApprove);
      setSelectedMcps(preset.mcps);
      setSelectedPlugins(preset.plugins);
    }
  };

  // 설정 생성
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/config/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          projectPath,
          projectDesc,
          permissions: selectedCommands,
          deny: selectedDenyPatterns.map(id => DENY_PATTERNS.find(p => p.id === id)?.pattern),
          mcps: selectedMcps,
          plugins: selectedPlugins,
          autoApproveMode
        })
      });

      const result = await response.json();

      if (result.success) {
        setGeneratedConfig(result.data);
      } else {
        setError(result.error || '설정 생성 실패');
      }
    } catch (err) {
      setError('서버 연결 오류');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 복사
  const handleCopy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // 다운로드
  const handleDownload = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 카테고리별로 명령어 그룹화
  const commandsByCategory = useMemo(() => {
    const groups = {};
    ALLOW_COMMANDS.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, []);

  // 다음 단계로
  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 이전 단계로
  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════
          헤더 + 스텝 인디케이터
          ════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="w-7 h-7 text-accent" />
            설정 마법사
          </h2>
          <p className="text-gray-400 mt-1">
            Claude Code 실행 환경을 설정합니다.
          </p>
        </div>

        {/* 프리셋 버튼 */}
        <div className="flex gap-2">
          {Object.values(PRESETS).map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className="px-3 py-1.5 text-sm rounded-lg bg-dark-200 hover:bg-dark-100 transition-colors"
              title={preset.description}
            >
              {preset.icon} {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === index;
          const isCompleted = currentStep > index;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(index)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                  isActive && 'bg-accent text-white',
                  isCompleted && 'bg-success/20 text-success',
                  !isActive && !isCompleted && 'bg-dark-200 text-gray-500 hover:bg-dark-100'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
                <span className="sm:hidden text-sm font-medium">{index}</span>
              </button>

              {index < STEPS.length - 1 && (
                <ChevronRight className={clsx(
                  'w-4 h-4 mx-1',
                  currentStep > index ? 'text-success' : 'text-gray-600'
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════
          Step 0: 프로젝트 정보
          ════════════════════════════════════════════════════════ */}
      {currentStep === 0 && (
        <div className="card space-y-6 animate-fade-up">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-accent" />
            프로젝트 정보
          </h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">프로젝트 이름 *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="input"
                placeholder="my-awesome-project"
              />
            </div>

            <div>
              <label className="label">프로젝트 경로</label>
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                className="input-mono"
                placeholder="."
              />
            </div>
          </div>

          <div>
            <label className="label">프로젝트 설명</label>
            <textarea
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              className="input h-24 resize-none"
              placeholder="프로젝트에 대한 간단한 설명을 입력하세요..."
            />
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Step 1: 권한 설정
          ════════════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-fade-up">
          {/* 허용 명령어 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                허용 명령어
                <span className="badge-accent">{selectedCommands.length}개</span>
              </h3>

              <div className="flex gap-2">
                <button
                  onClick={() => selectRecommendedOnly('commands')}
                  className="btn-ghost text-xs"
                >
                  <Sparkles className="w-3 h-3" />
                  추천만
                </button>
                <button
                  onClick={() => selectAll('commands', true)}
                  className="btn-ghost text-xs"
                >
                  전체 선택
                </button>
                <button
                  onClick={() => selectAll('commands', false)}
                  className="btn-ghost text-xs"
                >
                  전체 해제
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-64 overflow-y-auto scrollbar-thin pr-2">
              {Object.entries(commandsByCategory).map(([category, commands]) => (
                <div key={category}>
                  <div className="text-sm text-gray-400 mb-2">
                    {COMMAND_CATEGORIES[category]}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {commands.map((cmd) => (
                      <label
                        key={cmd.id}
                        className={clsx(
                          'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all',
                          selectedCommands.includes(cmd.id)
                            ? 'bg-accent/20 border border-accent/50'
                            : 'bg-dark-200 border border-transparent hover:border-border-light'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCommands.includes(cmd.id)}
                          onChange={() => toggleItem(cmd.id, selectedCommands, setSelectedCommands)}
                          className="checkbox"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <code className="text-sm font-mono">{cmd.name}</code>
                            {cmd.recommended && (
                              <span className="text-[10px] px-1 py-0.5 bg-accent/30 text-accent rounded">추천</span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 차단 패턴 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-error" />
                차단 패턴
                <span className="badge-error">{selectedDenyPatterns.length}개</span>
              </h3>

              <div className="flex gap-2">
                <button
                  onClick={() => selectRecommendedOnly('deny')}
                  className="btn-ghost text-xs"
                >
                  <Sparkles className="w-3 h-3" />
                  추천만
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {DENY_PATTERNS.map((pattern) => (
                <label
                  key={pattern.id}
                  className={clsx(
                    'flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-all',
                    selectedDenyPatterns.includes(pattern.id)
                      ? 'bg-error/10 border border-error/30'
                      : 'bg-dark-200 border border-transparent hover:border-border-light'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedDenyPatterns.includes(pattern.id)}
                    onChange={() => toggleItem(pattern.id, selectedDenyPatterns, setSelectedDenyPatterns)}
                    className="checkbox mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-error">{pattern.pattern}</code>
                      {pattern.recommended && (
                        <span className="text-[10px] px-1 py-0.5 bg-error/30 text-error rounded">추천</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{pattern.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 자동 승인 모드 */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">자동 승인 모드</h3>

            <div className="grid sm:grid-cols-3 gap-3">
              {AUTO_APPROVE_MODES.map((mode) => (
                <label
                  key={mode.id}
                  className={clsx(
                    'flex flex-col p-4 rounded-lg cursor-pointer transition-all',
                    autoApproveMode === mode.id
                      ? mode.warning
                        ? 'bg-warning/10 border-2 border-warning'
                        : 'bg-accent/10 border-2 border-accent'
                      : 'bg-dark-200 border-2 border-transparent hover:border-border-light'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      name="autoApprove"
                      checked={autoApproveMode === mode.id}
                      onChange={() => setAutoApproveMode(mode.id)}
                      className="checkbox"
                    />
                    <span className="font-medium">{mode.name}</span>
                    {mode.recommended && (
                      <span className="text-[10px] px-1 py-0.5 bg-accent/30 text-accent rounded">추천</span>
                    )}
                    {mode.warning && (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{mode.description}</p>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Step 2: MCP 서버
          ════════════════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div className="card animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="w-5 h-5 text-accent" />
              MCP 서버 선택
              <span className="badge-accent">{selectedMcps.length}개</span>
            </h3>

            <div className="flex gap-2">
              <button
                onClick={() => selectRecommendedOnly('mcps')}
                className="btn-ghost text-xs"
              >
                <Sparkles className="w-3 h-3" />
                추천만
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MCP_SERVERS.map((mcp) => (
              <label
                key={mcp.id}
                className={clsx(
                  'flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all',
                  selectedMcps.includes(mcp.id)
                    ? 'bg-accent/10 border-2 border-accent'
                    : 'bg-dark-200 border-2 border-transparent hover:border-border-light'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedMcps.includes(mcp.id)}
                  onChange={() => toggleItem(mcp.id, selectedMcps, setSelectedMcps)}
                  className="checkbox mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{mcp.icon}</span>
                    <span className="font-medium">{mcp.name}</span>
                    {mcp.recommended && (
                      <span className="text-[10px] px-1 py-0.5 bg-accent/30 text-accent rounded">추천</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{mcp.description}</p>
                  {mcp.envRequired.length > 0 && (
                    <p className="text-xs text-warning mt-2">
                      필요: {mcp.envRequired.join(', ')}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Step 3: 플러그인
          ════════════════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="card animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Plug className="w-5 h-5 text-accent" />
              플러그인 선택
              <span className="badge-accent">{selectedPlugins.length}개</span>
            </h3>

            <div className="flex gap-2">
              <button
                onClick={() => selectRecommendedOnly('plugins')}
                className="btn-ghost text-xs"
              >
                <Sparkles className="w-3 h-3" />
                추천만
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PLUGINS.map((plugin) => {
              const category = PLUGIN_CATEGORIES[plugin.category];

              return (
                <label
                  key={plugin.id}
                  className={clsx(
                    'flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all',
                    selectedPlugins.includes(plugin.id)
                      ? 'bg-accent/10 border-2 border-accent'
                      : 'bg-dark-200 border-2 border-transparent hover:border-border-light'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedPlugins.includes(plugin.id)}
                    onChange={() => toggleItem(plugin.id, selectedPlugins, setSelectedPlugins)}
                    className="checkbox mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{plugin.icon}</span>
                      <span className="font-medium">{plugin.name}</span>
                      {plugin.recommended && (
                        <span className="text-[10px] px-1 py-0.5 bg-accent/30 text-accent rounded">추천</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{plugin.description}</p>
                    <span className={clsx('text-xs px-2 py-0.5 rounded', category?.color)}>
                      {category?.name}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Step 4: 완료 & 생성
          ════════════════════════════════════════════════════════ */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-fade-up">
          {/* 요약 */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent" />
              선택 요약
            </h3>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-dark-200 rounded-lg">
                <div className="text-sm text-gray-400">프로젝트</div>
                <div className="font-medium">{projectName}</div>
                <div className="text-xs text-gray-500">{projectPath}</div>
              </div>
              <div className="p-3 bg-dark-200 rounded-lg">
                <div className="text-sm text-gray-400">허용 명령어</div>
                <div className="font-medium text-green-400">{selectedCommands.length}개</div>
              </div>
              <div className="p-3 bg-dark-200 rounded-lg">
                <div className="text-sm text-gray-400">MCP 서버</div>
                <div className="font-medium text-blue-400">{selectedMcps.length}개</div>
              </div>
              <div className="p-3 bg-dark-200 rounded-lg">
                <div className="text-sm text-gray-400">플러그인</div>
                <div className="font-medium text-purple-400">{selectedPlugins.length}개</div>
              </div>
            </div>

            {!generatedConfig && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !isConnected}
                  className="btn-primary px-8 py-3"
                >
                  {loading ? (
                    <>생성 중...</>
                  ) : (
                    <>
                      <Settings className="w-5 h-5" />
                      설정 생성하기
                    </>
                  )}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {error}
              </div>
            )}
          </div>

          {/* 생성된 파일들 */}
          {generatedConfig && (
            <>
              {/* settings.json */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">📄 settings.json</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(generatedConfig.settings, 'settings')}
                      className="btn-ghost text-sm"
                    >
                      {copied === 'settings' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      복사
                    </button>
                    <button
                      onClick={() => handleDownload(generatedConfig.settings, 'settings.json')}
                      className="btn-ghost text-sm"
                    >
                      <Download className="w-4 h-4" />
                      다운로드
                    </button>
                  </div>
                </div>
                <pre className="code-block text-xs max-h-48 overflow-auto scrollbar-thin">
                  {generatedConfig.settings}
                </pre>
              </div>

              {/* CLAUDE.md */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">📝 CLAUDE.md</h4>
                  <button
                    onClick={() => handleDownload(generatedConfig.claudeMd, 'CLAUDE.md')}
                    className="btn-ghost text-sm"
                  >
                    <Download className="w-4 h-4" />
                    다운로드
                  </button>
                </div>
                <pre className="code-block text-xs max-h-48 overflow-auto scrollbar-thin whitespace-pre-wrap">
                  {generatedConfig.claudeMd}
                </pre>
              </div>

              {/* 실행 스크립트 */}
              {generatedConfig.runScript && (
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">🚀 run.sh</h4>
                    <button
                      onClick={() => handleDownload(generatedConfig.runScript, 'run.sh')}
                      className="btn-ghost text-sm"
                    >
                      <Download className="w-4 h-4" />
                      다운로드
                    </button>
                  </div>
                  <pre className="code-block text-xs max-h-32 overflow-auto scrollbar-thin">
                    {generatedConfig.runScript.slice(0, 500)}...
                  </pre>
                </div>
              )}

              {/* 다시 시작 버튼 */}
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setCurrentStep(0);
                    setGeneratedConfig(null);
                  }}
                  className="btn-secondary"
                >
                  처음부터 다시
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          이전/다음 버튼
          ════════════════════════════════════════════════════════ */}
      <div className="flex justify-between pt-4">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className={clsx(
            'btn-secondary',
            currentStep === 0 && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          이전
        </button>

        <button
          onClick={goNext}
          disabled={currentStep === STEPS.length - 1}
          className={clsx(
            'btn-primary',
            currentStep === STEPS.length - 1 && 'opacity-50 cursor-not-allowed'
          )}
        >
          다음
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
