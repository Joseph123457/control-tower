/**
 * 설정 마법사 탭 (5단계)
 * Step 0: 프로젝트 정보 + 프롬프트 불러오기
 * Step 1: 권한 설정
 * Step 2: MCP 서버 선택
 * Step 3: 플러그인 선택
 * Step 4: 완료 & 생성 & 바로 실행
 */

import { useState, useMemo, useRef, useCallback } from 'react';
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
  Sparkles,
  Upload,
  FileText,
  Play,
  Rocket,
  X
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
import { parsePromptFile, isDevSpec } from '../lib/promptParser';

// 단계 정의
const STEPS = [
  { id: 0, title: '프로젝트 & 프롬프트', icon: FolderOpen },
  { id: 1, title: '권한 설정', icon: Shield },
  { id: 2, title: 'MCP 서버', icon: Database },
  { id: 3, title: '플러그인', icon: Plug },
  { id: 4, title: '완료 & 실행', icon: Rocket }
];

export default function WizardTab({
  isConnected,
  steps,
  setSteps,
  onRunAll,
  onTabChange,
  showNotification,
  serverStatus,
  projectSettings,
  setProjectSettings
}) {
  // 현재 단계
  const [currentStep, setCurrentStep] = useState(0);

  // Step 0: 프로젝트 정보
  const [projectName, setProjectName] = useState('my-project');
  const [projectPath, setProjectPath] = useState('.');
  const [projectDesc, setProjectDesc] = useState('');

  // Step 0: 프롬프트 불러오기
  const [promptText, setPromptText] = useState('');
  const [promptFileName, setPromptFileName] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [promptParsed, setPromptParsed] = useState(false);
  const [parseMode, setParseMode] = useState('auto'); // 'auto', 'steps', 'devspec'
  const fileInputRef = useRef(null);

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

  // 폴더 브라우저 모달
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState('');
  const [browserFolders, setBrowserFolders] = useState([]);
  const [browserDrives, setBrowserDrives] = useState([]);
  const [browserLoading, setBrowserLoading] = useState(false);

  // 프로젝트 설정 업데이트
  const updateProjectName = (name) => {
    setProjectName(name);
    if (setProjectSettings) {
      setProjectSettings(prev => ({ ...prev, projectName: name }));
    }
  };

  const updateProjectPath = (path) => {
    setProjectPath(path);
    if (setProjectSettings) {
      setProjectSettings(prev => ({ ...prev, projectPath: path }));
    }
  };

  // 폴더 브라우저 열기
  const handleSelectFolder = async () => {
    setShowFolderBrowser(true);
    setBrowserLoading(true);

    try {
      // 드라이브 목록 가져오기
      const drivesRes = await fetch('/api/config/drives');
      const drivesData = await drivesRes.json();
      if (drivesData.success) {
        setBrowserDrives(drivesData.data);
      }

      // 초기 경로 (현재 설정된 경로 또는 C:\)
      const initialPath = projectPath || 'C:\\';
      await loadFolders(initialPath);
    } catch (err) {
      console.error('폴더 브라우저 초기화 오류:', err);
    } finally {
      setBrowserLoading(false);
    }
  };

  // 폴더 목록 로드
  const loadFolders = async (path) => {
    setBrowserLoading(true);
    try {
      const res = await fetch(`/api/config/browse-folders?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.success) {
        setBrowserPath(data.data.currentPath);
        setBrowserFolders(data.data.items);
      }
    } catch (err) {
      console.error('폴더 로드 오류:', err);
    } finally {
      setBrowserLoading(false);
    }
  };

  // 폴더 선택 확정
  const confirmFolderSelection = () => {
    updateProjectPath(browserPath);
    setShowFolderBrowser(false);
  };

  // 상위 폴더로 이동
  const goToParentFolder = () => {
    const parentPath = browserPath.split(/[/\\]/).slice(0, -1).join('\\') || 'C:\\';
    loadFolders(parentPath);
  };

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

  // ────────────────────────────────────────────────────────
  // 프롬프트 파일 처리
  // ────────────────────────────────────────────────────────

  const handlePromptFile = useCallback(async (file) => {
    if (!file) return;

    const validExts = ['.md', '.txt', '.markdown'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validExts.includes(ext)) {
      setError('지원하지 않는 파일 형식입니다. (.md, .txt 파일만 허용)');
      return;
    }

    try {
      const text = await file.text();
      setPromptText(text);
      setPromptFileName(file.name);
      setError(null);

      // 파일명에서 프로젝트명 추출
      const baseName = file.name.replace(/\.(md|txt|markdown)$/i, '');
      if (baseName.toLowerCase() !== 'claude' && baseName.toLowerCase() !== 'readme') {
        setProjectName(baseName);
      }

      // 자동 파싱 모드 감지
      if (isDevSpec(text)) {
        setParseMode('devspec');
      } else {
        setParseMode('auto');
      }
    } catch (err) {
      setError('파일을 읽는 중 오류가 발생했습니다.');
    }
  }, []);

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    handlePromptFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handlePromptFile(file);
  };

  const handleParsePrompt = () => {
    if (!promptText.trim()) {
      setError('프롬프트 내용을 입력하세요.');
      return;
    }

    const options = parseMode === 'devspec' ? { forceDevSpec: true } : {};
    const parsed = parsePromptFile(promptText, options);

    if (parsed.length === 0) {
      setError('스텝을 찾을 수 없습니다.');
      return;
    }

    setSteps(parsed);
    setPromptParsed(true);
    setError(null);

    if (showNotification) {
      showNotification('success', `${parsed.length}개 스텝이 파싱되었습니다.`);
    }
  };

  const handleClearPrompt = () => {
    setPromptText('');
    setPromptFileName(null);
    setPromptParsed(false);
    setSteps([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 바로 실행 (설정 생성 + 즉시 실행)
  const handleGenerateAndRun = async () => {
    setLoading(true);
    setError(null);

    try {
      // 설정 생성
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

        // 프롬프트가 파싱되어 있고 스텝이 있으면 바로 실행
        if (steps.length > 0 && onRunAll) {
          if (showNotification) {
            showNotification('success', '설정 생성 완료! 실행을 시작합니다.');
          }

          // 대시보드로 이동 후 실행
          if (onTabChange) {
            onTabChange('dashboard');
          }

          // 약간의 딜레이 후 실행 시작
          setTimeout(() => {
            onRunAll();
          }, 500);
        }
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
          Step 0: 프로젝트 정보 + 프롬프트 불러오기
          ════════════════════════════════════════════════════════ */}
      {currentStep === 0 && (
        <div className="space-y-6 animate-fade-up">
          {/* 프로젝트 정보 */}
          <div className="card space-y-4">
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
                  onChange={(e) => updateProjectName(e.target.value)}
                  className="input"
                  placeholder="my-awesome-project"
                />
                <p className="text-xs text-gray-500 mt-1">이 이름으로 폴더가 생성됩니다</p>
              </div>

              <div>
                <label className="label">프로젝트 경로</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={projectPath}
                    onChange={(e) => updateProjectPath(e.target.value)}
                    className="input-mono flex-1"
                    placeholder="C:\Projects"
                  />
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="px-3 py-2 bg-dark-200 hover:bg-dark-100 rounded-lg transition-colors flex items-center gap-1"
                    title="폴더 선택"
                  >
                    <FolderOpen className="w-4 h-4" />
                    찾기
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  이 경로 안에 "{projectName || 'project'}" 폴더가 생성됩니다
                </p>
              </div>
            </div>

            <div>
              <label className="label">프로젝트 설명</label>
              <textarea
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                className="input h-20 resize-none"
                placeholder="프로젝트에 대한 간단한 설명을 입력하세요..."
              />
            </div>
          </div>

          {/* 프롬프트 불러오기 */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                프롬프트 가이드 / 개발설계서 불러오기
              </h3>
              {promptFileName && (
                <button onClick={handleClearPrompt} className="btn-ghost text-sm text-error">
                  <X className="w-4 h-4" />
                  초기화
                </button>
              )}
            </div>

            {/* 파일 업로드 영역 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'cursor-pointer transition-all duration-200 rounded-lg p-6',
                isDragging
                  ? 'border-accent bg-accent/10 border-2 border-dashed'
                  : promptFileName
                    ? 'border-success/50 bg-success/5 border-2'
                    : 'border-border border-2 border-dashed hover:border-border-light'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,.markdown"
                onChange={handleFileInput}
                className="hidden"
              />

              <div className="text-center">
                {promptFileName ? (
                  <>
                    <CheckCircle className="w-10 h-10 mx-auto text-success mb-2" />
                    <p className="text-success font-medium">{promptFileName}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {parseMode === 'devspec' ? '개발설계서 형식 감지됨' : '프롬프트 가이드 형식'}
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className={clsx(
                      'w-10 h-10 mx-auto mb-2',
                      isDragging ? 'text-accent' : 'text-gray-500'
                    )} />
                    <p className={clsx(
                      'font-medium',
                      isDragging ? 'text-accent' : 'text-gray-300'
                    )}>
                      CLAUDE.md 또는 프롬프트 가이드 파일을 업로드하세요
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      클릭하거나 드래그 앤 드롭 (.md, .txt)
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* 파싱 모드 선택 */}
            {promptText && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="label mb-0">파싱 모드:</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setParseMode('auto')}
                      className={clsx(
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        parseMode === 'auto'
                          ? 'bg-accent text-white'
                          : 'bg-dark-200 hover:bg-dark-100'
                      )}
                    >
                      자동 감지
                    </button>
                    <button
                      onClick={() => setParseMode('steps')}
                      className={clsx(
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        parseMode === 'steps'
                          ? 'bg-accent text-white'
                          : 'bg-dark-200 hover:bg-dark-100'
                      )}
                    >
                      스텝별 가이드
                    </button>
                    <button
                      onClick={() => setParseMode('devspec')}
                      className={clsx(
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        parseMode === 'devspec'
                          ? 'bg-accent text-white'
                          : 'bg-dark-200 hover:bg-dark-100'
                      )}
                    >
                      개발설계서 (단일 실행)
                    </button>
                  </div>
                </div>

                {/* 파싱 버튼 */}
                <div className="flex gap-3">
                  <button
                    onClick={handleParsePrompt}
                    disabled={promptParsed}
                    className={clsx(
                      'flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                      promptParsed
                        ? 'bg-success/20 text-success cursor-default'
                        : 'bg-accent hover:bg-accent/80 text-white'
                    )}
                  >
                    {promptParsed ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {steps.length}개 스텝 준비됨
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        스텝 파싱하기
                      </>
                    )}
                  </button>
                </div>

                {/* 파싱된 스텝 미리보기 */}
                {promptParsed && steps.length > 0 && (
                  <div className="mt-3 p-3 bg-dark-200 rounded-lg max-h-40 overflow-y-auto scrollbar-thin">
                    {steps.map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-2 py-1 text-sm">
                        <span className="text-accent font-mono">{step.id}</span>
                        <span className="text-gray-300 truncate">{step.title}</span>
                        {step.isDevSpec && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                            전체 설계서
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 에러 표시 */}
            {error && (
              <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* 안내 메시지 */}
            {!promptText && (
              <div className="text-sm text-gray-500 space-y-1">
                <p>💡 <strong>개발설계서(CLAUDE.md)</strong>를 업로드하면 전체 프로젝트를 한 번에 생성합니다.</p>
                <p>💡 <strong>스텝별 프롬프트 가이드</strong>를 업로드하면 단계별로 실행합니다.</p>
              </div>
            )}
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
          Step 4: 완료 & 생성 & 바로 실행
          ════════════════════════════════════════════════════════ */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-fade-up">
          {/* 요약 */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent" />
              설정 요약
            </h3>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-3 bg-dark-200 rounded-lg">
                <div className="text-sm text-gray-400">프로젝트</div>
                <div className="font-medium">{projectName}</div>
                <div className="text-xs text-gray-500 truncate" title={`${projectPath}/${projectName}`}>
                  📁 {projectPath}/{projectName}
                </div>
              </div>
              <div className="p-3 bg-dark-200 rounded-lg">
                <div className="text-sm text-gray-400">프롬프트</div>
                <div className={clsx(
                  'font-medium',
                  steps.length > 0 ? 'text-success' : 'text-warning'
                )}>
                  {steps.length > 0 ? `${steps.length}개 스텝` : '미설정'}
                </div>
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

            {/* 액션 버튼들 */}
            {!generatedConfig && (
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
                {/* 설정 생성만 */}
                <button
                  onClick={handleGenerate}
                  disabled={loading || !isConnected}
                  className="btn-secondary px-6 py-3"
                >
                  {loading ? (
                    <>생성 중...</>
                  ) : (
                    <>
                      <Settings className="w-5 h-5" />
                      설정만 생성
                    </>
                  )}
                </button>

                {/* 바로 실행 (메인 CTA) */}
                <button
                  onClick={handleGenerateAndRun}
                  disabled={loading || !isConnected || steps.length === 0 || !serverStatus?.claudeAvailable}
                  className={clsx(
                    'px-8 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2',
                    steps.length > 0 && serverStatus?.claudeAvailable
                      ? 'bg-gradient-to-r from-accent to-green-500 hover:from-accent/90 hover:to-green-500/90 text-white shadow-lg shadow-accent/25'
                      : 'bg-dark-200 text-gray-500 cursor-not-allowed'
                  )}
                >
                  <Rocket className="w-5 h-5" />
                  {loading ? '준비 중...' : '설정 생성 & 바로 실행'}
                </button>
              </div>
            )}

            {/* 프롬프트 미설정 경고 */}
            {steps.length === 0 && (
              <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                프롬프트가 설정되지 않았습니다. Step 1에서 프롬프트 파일을 불러오세요.
              </div>
            )}

            {/* Claude CLI 미설치 경고 */}
            {!serverStatus?.claudeAvailable && (
              <div className="mt-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Claude CLI가 설치되어 있지 않습니다.
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

              {/* 액션 버튼들 */}
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={() => {
                    setCurrentStep(0);
                    setGeneratedConfig(null);
                  }}
                  className="btn-secondary"
                >
                  처음부터 다시
                </button>

                {steps.length > 0 && (
                  <button
                    onClick={() => {
                      if (onTabChange) onTabChange('dashboard');
                    }}
                    className="btn-primary px-6"
                  >
                    <Play className="w-5 h-5" />
                    대시보드에서 실행하기
                  </button>
                )}
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

      {/* ════════════════════════════════════════════════════════
          폴더 브라우저 모달
          ════════════════════════════════════════════════════════ */}
      {showFolderBrowser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-dark-300 rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-accent" />
                프로젝트 경로 선택
              </h3>
              <button
                onClick={() => setShowFolderBrowser(false)}
                className="p-1 hover:bg-dark-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 현재 경로 */}
            <div className="px-4 py-2 bg-dark-200 flex items-center gap-2">
              <span className="text-sm text-gray-400">경로:</span>
              <code className="text-sm text-accent flex-1 truncate">{browserPath}</code>
              <button
                onClick={goToParentFolder}
                className="px-2 py-1 text-xs bg-dark-300 hover:bg-dark-100 rounded"
              >
                상위 폴더
              </button>
            </div>

            {/* 드라이브 선택 (Windows) */}
            {browserDrives.length > 1 && (
              <div className="px-4 py-2 flex gap-2 border-b border-border">
                {browserDrives.map(drive => (
                  <button
                    key={drive.path}
                    onClick={() => loadFolders(drive.path)}
                    className={clsx(
                      'px-3 py-1 text-sm rounded transition-colors',
                      browserPath.startsWith(drive.path)
                        ? 'bg-accent text-white'
                        : 'bg-dark-200 hover:bg-dark-100'
                    )}
                  >
                    {drive.name}
                  </button>
                ))}
              </div>
            )}

            {/* 폴더 목록 */}
            <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
              {browserLoading ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  로딩 중...
                </div>
              ) : browserFolders.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  폴더가 없습니다
                </div>
              ) : (
                <div className="space-y-1">
                  {browserFolders.map(folder => (
                    <button
                      key={folder.path}
                      onClick={() => loadFolders(folder.path)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-200 rounded-lg text-left transition-colors"
                    >
                      <FolderOpen className="w-4 h-4 text-yellow-500" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 선택 미리보기 */}
            <div className="px-4 py-3 bg-dark-200 border-t border-border">
              <div className="text-sm text-gray-400 mb-1">생성될 프로젝트 폴더:</div>
              <code className="text-sm text-success">
                {browserPath}\{projectName || 'project-name'}
              </code>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3 p-4 border-t border-border">
              <button
                onClick={() => setShowFolderBrowser(false)}
                className="btn-secondary"
              >
                취소
              </button>
              <button
                onClick={confirmFolderSelection}
                className="btn-primary"
              >
                <Check className="w-4 h-4" />
                이 폴더 선택
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
