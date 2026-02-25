/**
 * 프롬프트 탭
 * 파일 업로드 / 텍스트 붙여넣기 → 파싱 → 스텝 목록 미리보기
 */

import { useState, useRef, useCallback } from 'react';
import {
  FileText,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Trash2,
  FileUp,
  ClipboardPaste,
  ArrowRight,
  Eye
} from 'lucide-react';
import clsx from 'clsx';
import { parsePromptFile, validatePrompt, getParseStatistics } from '../lib/promptParser';

export default function PromptsTab({ steps, setSteps, isConnected, onTabChange }) {
  // 상태
  const [promptText, setPromptText] = useState('');
  const [fileName, setFileName] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validation, setValidation] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // ────────────────────────────────────────────────────────
  // 파일 처리
  // ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file) => {
    if (!file) return;

    // 파일 형식 검사
    const validExts = ['.md', '.txt', '.markdown'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validExts.includes(ext)) {
      setError('지원하지 않는 파일 형식입니다. (.md, .txt 파일만 허용)');
      return;
    }

    try {
      const text = await file.text();
      setPromptText(text);
      setFileName(file.name);
      setError(null);

      // 자동 검증
      const result = validatePrompt(text);
      setValidation(result);
    } catch (err) {
      setError('파일을 읽는 중 오류가 발생했습니다.');
    }
  }, []);

  // 파일 입력 변경
  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  // 드래그 앤 드롭
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
    handleFile(file);
  };

  // ────────────────────────────────────────────────────────
  // 텍스트 처리
  // ────────────────────────────────────────────────────────

  const handleTextChange = (text) => {
    setPromptText(text);
    setFileName(null);

    if (text.trim()) {
      const result = validatePrompt(text);
      setValidation(result);
    } else {
      setValidation(null);
    }
  };

  // 클립보드에서 붙여넣기
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleTextChange(text);
      textareaRef.current?.focus();
    } catch (err) {
      setError('클립보드 접근 권한이 필요합니다.');
    }
  };

  // ────────────────────────────────────────────────────────
  // 파싱
  // ────────────────────────────────────────────────────────

  const handleParse = async () => {
    if (!promptText.trim()) {
      setError('프롬프트 내용을 입력하세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 클라이언트 측 파싱
      const parsed = parsePromptFile(promptText);

      if (parsed.length === 0) {
        setError('스텝을 찾을 수 없습니다. 형식을 확인하세요.\n예: ### 프롬프트 1-1: 제목');
        return;
      }

      setSteps(parsed);
      setPreviewMode(true);
    } catch (err) {
      setError('파싱 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 초기화
  const handleClear = () => {
    setPromptText('');
    setFileName(null);
    setValidation(null);
    setError(null);
    setPreviewMode(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 스텝 초기화
  const handleClearSteps = () => {
    setSteps([]);
    setPreviewMode(false);
  };

  // 통계
  const stats = validation?.statistics || (steps.length > 0 ? getParseStatistics(steps) : null);

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════
          헤더
          ════════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <FileText className="w-7 h-7 text-accent" />
          프롬프트 불러오기
        </h2>
        <p className="text-gray-400 mt-1">
          프롬프트 가이드(.md)를 업로드하거나 붙여넣기 하세요.
        </p>
      </div>

      {!previewMode ? (
        /* ════════════════════════════════════════════════════════
           입력 모드
           ════════════════════════════════════════════════════════ */
        <div className="grid lg:grid-cols-2 gap-6">
          {/* 좌측: 입력 영역 */}
          <div className="space-y-4">
            {/* 파일 업로드 영역 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'card cursor-pointer transition-all duration-200',
                isDragging
                  ? 'border-accent bg-accent/10 scale-[1.02]'
                  : 'hover:border-border-light',
                'border-2 border-dashed'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,.markdown"
                onChange={handleFileInput}
                className="hidden"
              />

              <div className="text-center py-8">
                {fileName ? (
                  <>
                    <FileUp className="w-12 h-12 mx-auto text-success mb-3" />
                    <p className="text-success font-medium">{fileName}</p>
                    <p className="text-sm text-gray-400 mt-1">파일 로드 완료</p>
                  </>
                ) : (
                  <>
                    <Upload className={clsx(
                      'w-12 h-12 mx-auto mb-3 transition-colors',
                      isDragging ? 'text-accent' : 'text-gray-500'
                    )} />
                    <p className={clsx(
                      'font-medium',
                      isDragging ? 'text-accent' : 'text-gray-300'
                    )}>
                      {isDragging ? '여기에 놓으세요!' : '클릭하거나 드래그 앤 드롭'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">.md, .txt 파일</p>
                  </>
                )}
              </div>
            </div>

            {/* 구분선 */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-gray-500">또는</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* 텍스트 입력 영역 */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4 text-accent" />
                  직접 입력
                </h3>
                <button onClick={handlePaste} className="btn-ghost text-sm">
                  <ClipboardPaste className="w-4 h-4" />
                  붙여넣기
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={promptText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={`## 🔷 Phase 1: 프로젝트 초기화

### 프롬프트 1-1: 프로젝트 생성

프로젝트를 생성합니다.

\`\`\`
npm create vite@latest my-app -- --template react
\`\`\`

### 프롬프트 1-2: 의존성 설치

\`\`\`
cd my-app && npm install
\`\`\``}
                className="input-mono h-64 resize-none text-sm"
              />

              {/* 글자 수 */}
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{promptText.length.toLocaleString()} 자</span>
                {promptText.trim() && (
                  <button onClick={handleClear} className="text-error hover:underline">
                    지우기
                  </button>
                )}
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="p-3 bg-error/10 border border-error/30 rounded-lg">
                <div className="flex items-start gap-2 text-error text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{error}</span>
                </div>
              </div>
            )}

            {/* 파싱 버튼 */}
            <button
              onClick={handleParse}
              disabled={loading || !promptText.trim()}
              className="btn-primary w-full py-3"
            >
              {loading ? (
                '파싱 중...'
              ) : (
                <>
                  <Eye className="w-5 h-5" />
                  스텝 파싱하기
                </>
              )}
            </button>
          </div>

          {/* 우측: 검증 결과 + 미리보기 */}
          <div className="space-y-4">
            {/* 검증 결과 */}
            {validation && (
              <div className={clsx(
                'card',
                validation.valid
                  ? 'border-success/50 bg-success/5'
                  : 'border-warning/50 bg-warning/5'
              )}>
                <div className="flex items-center gap-2 mb-3">
                  {validation.valid ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-warning" />
                  )}
                  <span className={clsx(
                    'font-medium',
                    validation.valid ? 'text-success' : 'text-warning'
                  )}>
                    {validation.valid ? '형식이 올바릅니다' : '확인이 필요합니다'}
                  </span>
                </div>

                {/* 통계 */}
                {stats && (
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-2 bg-dark-300 rounded">
                      <div className="text-lg font-bold text-accent">{stats.totalSteps}</div>
                      <div className="text-xs text-gray-400">스텝</div>
                    </div>
                    <div className="text-center p-2 bg-dark-300 rounded">
                      <div className="text-lg font-bold text-blue-400">{stats.totalPhases}</div>
                      <div className="text-xs text-gray-400">Phase</div>
                    </div>
                    <div className="text-center p-2 bg-dark-300 rounded">
                      <div className="text-lg font-bold text-green-400">{stats.hasPrompts}</div>
                      <div className="text-xs text-gray-400">프롬프트</div>
                    </div>
                  </div>
                )}

                {/* 이슈 목록 */}
                {validation.issues.length > 0 && (
                  <ul className="text-sm text-gray-400 space-y-1">
                    {validation.issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-warning">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 형식 가이드 */}
            <div className="card bg-dark-200">
              <h4 className="font-medium mb-3 text-gray-300">📖 지원 형식</h4>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-dark-300 rounded font-mono text-xs">
                  <span className="text-accent">## 🔷 Phase 1:</span> 제목
                </div>
                <div className="p-2 bg-dark-300 rounded font-mono text-xs">
                  <span className="text-green-400">### 프롬프트 1-1:</span> 스텝 제목
                </div>
                <div className="p-2 bg-dark-300 rounded font-mono text-xs">
                  <span className="text-green-400">### 1-2.</span> 다른 형식도 OK
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  코드블록(```)안의 내용이 프롬프트로 추출됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════
           미리보기 모드
           ════════════════════════════════════════════════════════ */
        <div className="space-y-4 animate-fade-up">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-success" />
              <div>
                <h3 className="font-semibold">파싱 완료</h3>
                <p className="text-sm text-gray-400">
                  {steps.length}개 스텝이 추출되었습니다
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPreviewMode(false)}
                className="btn-secondary"
              >
                다시 입력
              </button>
              <button
                onClick={handleClearSteps}
                className="btn-ghost text-error"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 스텝 목록 */}
          <div className="card">
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg hover:bg-dark-100 transition-colors"
                >
                  <span className="flex-shrink-0 w-8 h-8 bg-accent/20 text-accent rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">{step.id}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-dark-50 rounded text-gray-400">
                        {step.phase}
                      </span>
                    </div>
                    <div className="font-medium truncate">{step.title}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {step.prompt && (
                      <span className="text-xs text-success">✓ 프롬프트</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 대시보드로 이동 */}
          <div className="flex justify-center">
            <button
              onClick={() => onTabChange?.('dashboard')}
              className="btn-primary px-8 py-3"
            >
              <ArrowRight className="w-5 h-5" />
              대시보드에서 실행하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
