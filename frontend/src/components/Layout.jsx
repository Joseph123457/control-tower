/**
 * 레이아웃 컴포넌트
 * 상단 헤더 + 탭 네비게이션 + 콘텐츠 영역 + 알림
 */

import { useState, useEffect } from 'react';
import {
  Terminal,
  Settings,
  FileText,
  LayoutDashboard,
  Play,
  History,
  Wifi,
  WifiOff,
  Menu,
  X,
  Circle,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Search
} from 'lucide-react';
import clsx from 'clsx';

// 아이콘 매핑
const ICONS = {
  Settings,
  FileText,
  LayoutDashboard,
  Play,
  History,
  Search
};

// 알림 타입별 스타일
const NOTIFICATION_STYLES = {
  success: {
    icon: CheckCircle,
    bg: 'bg-success/20',
    border: 'border-success/50',
    text: 'text-success'
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-error/20',
    border: 'border-error/50',
    text: 'text-error'
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning/20',
    border: 'border-warning/50',
    text: 'text-warning'
  },
  info: {
    icon: Info,
    bg: 'bg-accent/20',
    border: 'border-accent/50',
    text: 'text-accent'
  }
};

/**
 * @param {Object} props
 * @param {Array} props.tabs - 탭 목록
 * @param {string} props.activeTab - 현재 활성 탭 ID
 * @param {Function} props.onTabChange - 탭 변경 핸들러
 * @param {boolean} props.isConnected - 서버 연결 상태
 * @param {string} props.connectionError - 연결 에러 메시지
 * @param {Object} props.serverStatus - 서버 상태
 * @param {boolean} props.isRunning - 실행 중 여부
 * @param {Function} props.onReconnect - 재연결 핸들러
 * @param {Object} props.notification - 알림 객체 { type, message }
 * @param {Function} props.onCloseNotification - 알림 닫기 핸들러
 * @param {React.ReactNode} props.children - 자식 컴포넌트
 */
export default function Layout({
  tabs,
  activeTab,
  onTabChange,
  isConnected,
  connectionError,
  serverStatus,
  isRunning,
  onReconnect,
  notification,
  onCloseNotification,
  children
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  // 알림 표시 애니메이션
  useEffect(() => {
    if (notification) {
      setShowNotification(true);
    } else {
      setShowNotification(false);
    }
  }, [notification]);

  return (
    <div className="min-h-screen flex flex-col bg-dark">
      {/* ════════════════════════════════════════════════════════
          헤더
          ════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-dark-300/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* 로고 + 앱 이름 */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Terminal className="w-8 h-8 text-accent" />
                {/* 실행 중 애니메이션 */}
                {isRunning && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse" />
                )}
              </div>

              <div className="flex flex-col">
                <h1 className="text-lg font-bold gradient-text">
                  Control Tower
                </h1>
                <span className="text-xs text-gray-500 hide-mobile">
                  Claude Code 대시보드
                </span>
              </div>
            </div>

            {/* 데스크톱 탭 네비게이션 */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = ICONS[tab.icon] || Settings;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={clsx(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'bg-accent/20 text-accent'
                        : 'text-gray-400 hover:text-white hover:bg-dark-50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* 상태 표시 + 모바일 메뉴 버튼 */}
            <div className="flex items-center gap-4">
              {/* 연결 상태 */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-success" />
                    <span className="text-xs text-success hide-mobile">연결됨</span>
                  </>
                ) : (
                  <button
                    onClick={onReconnect}
                    className="flex items-center gap-2 text-error hover:text-error/80 transition-colors"
                  >
                    <WifiOff className="w-4 h-4" />
                    <span className="text-xs hide-mobile">재연결</span>
                  </button>
                )}
              </div>

              {/* Claude CLI 상태 */}
              {serverStatus?.claudeAvailable !== undefined && (
                <div className="flex items-center gap-2 hide-mobile">
                  <Circle
                    className={clsx(
                      'w-3 h-3',
                      serverStatus.claudeAvailable ? 'text-success fill-success' : 'text-error fill-error'
                    )}
                  />
                  <span className="text-xs text-gray-400">
                    {serverStatus.claudeAvailable ? 'CLI 준비됨' : 'CLI 없음'}
                  </span>
                </div>
              )}

              {/* 실행 중 표시 */}
              {isRunning && (
                <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 rounded-full">
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                  <span className="text-xs text-accent hide-mobile">실행 중</span>
                </div>
              )}

              {/* 모바일 메뉴 버튼 */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-400 hover:text-white"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-dark-300 animate-fade-in">
            <nav className="px-4 py-2 space-y-1">
              {tabs.map((tab) => {
                const Icon = ICONS[tab.icon] || Settings;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={clsx(
                      'flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-all',
                      isActive
                        ? 'bg-accent/20 text-accent'
                        : 'text-gray-400 hover:text-white hover:bg-dark-50'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* 연결 에러 배너 */}
        {connectionError && (
          <div className="bg-error/20 border-t border-error/30 px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <p className="text-sm text-error">
                {connectionError}
              </p>
              {!isConnected && (
                <button
                  onClick={onReconnect}
                  className="flex items-center gap-1 text-sm text-error hover:text-error/80 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  재연결
                </button>
              )}
            </div>
          </div>
        )}

        {/* Claude CLI 미설치 경고 */}
        {isConnected && serverStatus?.claudeAvailable === false && (
          <div className="bg-warning/20 border-t border-warning/30 px-4 py-2">
            <div className="max-w-7xl mx-auto">
              <p className="text-sm text-warning">
                Claude CLI가 설치되어 있지 않습니다.
                <code className="mx-2 px-2 py-0.5 bg-dark-300 rounded text-xs">
                  npm install -g @anthropic-ai/claude-code
                </code>
                명령으로 설치하세요.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════════════════════════
          메인 콘텐츠
          ════════════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <div className="animate-fade-up">
          {children}
        </div>
      </main>

      {/* ════════════════════════════════════════════════════════
          알림 토스트
          ════════════════════════════════════════════════════════ */}
      {notification && (
        <div
          className={clsx(
            'fixed bottom-4 right-4 z-50 max-w-sm transition-all duration-300',
            showNotification ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          )}
        >
          <div
            className={clsx(
              'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
              NOTIFICATION_STYLES[notification.type]?.bg || 'bg-dark-300',
              NOTIFICATION_STYLES[notification.type]?.border || 'border-border'
            )}
          >
            {(() => {
              const style = NOTIFICATION_STYLES[notification.type];
              const Icon = style?.icon || Info;
              return (
                <Icon className={clsx('w-5 h-5 flex-shrink-0', style?.text || 'text-gray-400')} />
              );
            })()}
            <p className={clsx(
              'text-sm flex-1',
              NOTIFICATION_STYLES[notification.type]?.text || 'text-gray-300'
            )}>
              {notification.message}
            </p>
            <button
              onClick={onCloseNotification}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          푸터
          ════════════════════════════════════════════════════════ */}
      <footer className="border-t border-border bg-dark-300/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <span>
              Control Tower - Claude Code CLI 제어 대시보드
            </span>
            <div className="flex items-center gap-4">
              <span>v1.0.0</span>
              <a
                href="https://github.com/anthropics/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors"
              >
                Claude Code 문서
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
