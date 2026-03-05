/**
 * Control Tower 메인 앱
 * 탭 상태 관리 + Socket.IO 연결 + 에러 처리
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

// 레이아웃
import Layout from './components/Layout';

// 탭 컴포넌트
import WizardTab from './components/WizardTab';
import PromptsTab from './components/PromptsTab';
import DashboardTab from './components/DashboardTab';
import RunnerTab from './components/RunnerTab';
import SessionsTab from './components/SessionsTab';
import ClaudeSessionsTab from './components/ClaudeSessionsTab';

// ============================================================
// 상수 정의
// ============================================================

const TABS = [
  { id: 'wizard', label: '설정 마법사', icon: 'Settings' },
  { id: 'prompts', label: '프롬프트', icon: 'FileText' },
  { id: 'dashboard', label: '대시보드', icon: 'LayoutDashboard' },
  { id: 'runner', label: '실행', icon: 'Play' },
  { id: 'sessions', label: '세션', icon: 'History' },
  { id: 'claude-sessions', label: '세션 탐색기', icon: 'Search' }
];

// Socket.IO 서버 URL
const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : 'http://localhost:3001';

// 재연결 설정
const RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 2000;
const RECONNECT_DELAY_MAX = 10000;

// ============================================================
// App 컴포넌트
// ============================================================

function App() {
  // 탭 상태
  const [activeTab, setActiveTab] = useState('wizard');

  // Socket.IO 상태
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // 서버 상태
  const [serverStatus, setServerStatus] = useState({
    claudeAvailable: false,
    isRunning: false
  });

  // 스텝 데이터 (탭 간 공유)
  const [steps, setSteps] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  // 실행 상태
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [logs, setLogs] = useState([]);

  // 생성된 설정 (마법사에서 공유)
  const [generatedConfig, setGeneratedConfig] = useState(null);

  // 프로젝트 설정 (마법사에서 공유)
  const [projectSettings, setProjectSettings] = useState({
    projectName: '',
    projectPath: '.',
    autoCommit: true
  });

  // 알림 상태
  const [notification, setNotification] = useState(null);

  // 참조
  const socketRef = useRef(null);

  // ──────────────────────────────────────────────────────────
  // 알림 표시
  // ──────────────────────────────────────────────────────────

  const showNotification = useCallback((type, message, duration = 3000) => {
    setNotification({ type, message });
    if (duration > 0) {
      setTimeout(() => setNotification(null), duration);
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // Socket.IO 연결 관리
  // ──────────────────────────────────────────────────────────

  useEffect(() => {
    // 소켓 연결
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionDelayMax: RECONNECT_DELAY_MAX,
      timeout: 20000
    });

    socketRef.current = newSocket;

    // 연결 성공
    newSocket.on('connect', () => {
      console.log('[Socket] 연결됨:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempt(0);

      // 재연결 성공 알림
      if (reconnectAttempt > 0) {
        showNotification('success', '서버에 다시 연결되었습니다.');
      }
    });

    // 연결 해제
    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] 연결 해제:', reason);
      setIsConnected(false);

      if (reason === 'io server disconnect') {
        // 서버에서 연결을 끊은 경우 수동 재연결
        newSocket.connect();
      }
    });

    // 재연결 시도
    newSocket.on('reconnect_attempt', (attempt) => {
      console.log('[Socket] 재연결 시도:', attempt);
      setReconnectAttempt(attempt);
      setConnectionError(`재연결 시도 중... (${attempt}/${RECONNECT_ATTEMPTS})`);
    });

    // 재연결 실패
    newSocket.on('reconnect_failed', () => {
      console.error('[Socket] 재연결 실패');
      setConnectionError('서버 연결 실패. 페이지를 새로고침하거나 서버 상태를 확인하세요.');
    });

    // 연결 에러
    newSocket.on('connect_error', (error) => {
      console.error('[Socket] 연결 에러:', error.message);

      // 첫 연결 실패 시에만 에러 메시지 표시
      if (reconnectAttempt === 0) {
        setConnectionError('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.');
      }
      setIsConnected(false);
    });

    // 서버 상태 수신
    newSocket.on('status', (status) => {
      setServerStatus(status);
      setIsRunning(status.running);
    });

    // 스텝 시작 이벤트
    newSocket.on('step-start', (data) => {
      console.log('[Socket] 스텝 시작:', data);
      setCurrentStepIndex(data.index - 1);
      updateStepStatus(data.stepId, 'running');
      addLog('system', `▶ 스텝 ${data.stepId} 시작: ${data.stepTitle}`);
    });

    // 스텝 출력 이벤트
    newSocket.on('step-output', (data) => {
      addLog(data.type, data.line);
    });

    // 스텝 완료 이벤트
    newSocket.on('step-complete', (data) => {
      console.log('[Socket] 스텝 완료:', data);
      updateStepStatus(data.stepId, data.success ? 'completed' : 'failed');
      addLog('system', `${data.success ? '✓' : '✗'} 스텝 ${data.stepId} ${data.success ? '완료' : '실패'} (${data.duration}ms)`);

      if (!data.success) {
        showNotification('error', `스텝 ${data.stepId} 실행 실패`);
      }
    });

    // 스텝 에러 이벤트
    newSocket.on('step-error', (data) => {
      console.error('[Socket] 스텝 에러:', data);
      updateStepStatus(data.stepId, 'failed');
      addLog('stderr', `에러: ${data.error}`);
      showNotification('error', data.error);
    });

    // 전체 실행 완료
    newSocket.on('run-complete', (data) => {
      console.log('[Socket] 전체 완료:', data);
      setIsRunning(false);
      addLog('system', `═══ 전체 완료: ${data.completedSteps}/${data.totalSteps} 성공 (${Math.round(data.duration / 1000)}초) ═══`);

      if (data.completedSteps === data.totalSteps) {
        showNotification('success', '모든 스텝이 성공적으로 완료되었습니다!');
      } else {
        showNotification('warning', `${data.totalSteps - data.completedSteps}개 스텝이 실패했습니다.`);
      }
    });

    // 실행 중지
    newSocket.on('run-stopped', (data) => {
      console.log('[Socket] 실행 중지:', data);
      setIsRunning(false);
      addLog('system', `⏹ 실행 중지됨: ${data.reason}`);
      showNotification('warning', '실행이 중지되었습니다.');
    });

    // 실행 에러
    newSocket.on('run-error', (data) => {
      console.error('[Socket] 실행 에러:', data);
      setIsRunning(false);
      addLog('stderr', `실행 에러: ${data.error}`);
      showNotification('error', data.error);
    });

    setSocket(newSocket);

    // 클린업
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // ──────────────────────────────────────────────────────────
  // 헬퍼 함수
  // ──────────────────────────────────────────────────────────

  // 스텝 상태 업데이트
  const updateStepStatus = useCallback((stepId, status) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status } : step
    ));
  }, []);

  // 로그 추가
  const addLog = useCallback((type, text) => {
    setLogs(prev => {
      // 최대 1000개 로그 유지
      const newLogs = [...prev, {
        id: Date.now() + Math.random(),
        type,
        text,
        timestamp: new Date().toLocaleTimeString('ko-KR')
      }];
      return newLogs.slice(-1000);
    });
  }, []);

  // 로그 초기화
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // 스텝 상태 초기화
  const resetSteps = useCallback(() => {
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
    setCurrentStepIndex(-1);
  }, []);

  // 수동 재연결
  const handleReconnect = useCallback(() => {
    if (socketRef.current) {
      setConnectionError('재연결 시도 중...');
      socketRef.current.connect();
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // 실행 제어 함수
  // ──────────────────────────────────────────────────────────

  // 전체 실행
  const handleRunAll = useCallback(() => {
    if (!socket || !isConnected) {
      showNotification('error', '서버에 연결되어 있지 않습니다.');
      return;
    }

    if (steps.length === 0) {
      showNotification('warning', '실행할 스텝이 없습니다. 먼저 프롬프트를 불러오세요.');
      return;
    }

    if (!serverStatus.claudeAvailable) {
      showNotification('error', 'Claude CLI가 설치되어 있지 않습니다.');
      return;
    }

    resetSteps();
    clearLogs();
    setIsRunning(true);

    socket.emit('run-all', {
      steps,
      options: {
        projectPath: projectSettings.projectPath || '.',
        projectName: projectSettings.projectName || '',
        sessionMode: true,
        autoCommit: projectSettings.autoCommit !== false
      }
    });

    const pathInfo = projectSettings.projectName
      ? `${projectSettings.projectPath}/${projectSettings.projectName}`
      : projectSettings.projectPath || '.';
    addLog('system', `═══ 전체 실행 시작 (${steps.length}개 스텝) ═══`);
    addLog('system', `📁 프로젝트 경로: ${pathInfo}`);
  }, [socket, isConnected, steps, serverStatus, projectSettings, resetSteps, clearLogs, addLog, showNotification]);

  // 실행 중지
  const handleStop = useCallback(() => {
    if (!socket) return;
    socket.emit('stop');
    addLog('system', '⏹ 실행 중지 요청됨...');
  }, [socket, addLog]);

  // 개별 스텝 실행
  const handleRunStep = useCallback((step) => {
    if (!socket || !isConnected) {
      showNotification('error', '서버에 연결되어 있지 않습니다.');
      return;
    }

    if (!serverStatus.claudeAvailable) {
      showNotification('error', 'Claude CLI가 설치되어 있지 않습니다.');
      return;
    }

    updateStepStatus(step.id, 'running');
    addLog('system', `▶ 스텝 ${step.id} 실행 중...`);

    socket.emit('run-step', {
      step,
      options: {
        projectPath: '.',
        sessionMode: true
      }
    });
  }, [socket, isConnected, serverStatus, updateStepStatus, addLog, showNotification]);

  // ──────────────────────────────────────────────────────────
  // 렌더링
  // ──────────────────────────────────────────────────────────

  // 현재 탭 렌더링
  const renderTab = () => {
    const commonProps = {
      socket,
      isConnected,
      steps,
      setSteps,
      currentSession,
      setCurrentSession,
      isRunning,
      currentStepIndex,
      logs,
      serverStatus,
      generatedConfig,
      setGeneratedConfig,
      projectSettings,
      setProjectSettings,
      onRunAll: handleRunAll,
      onStop: handleStop,
      onRunStep: handleRunStep,
      addLog,
      clearLogs,
      resetSteps,
      onTabChange: setActiveTab,
      showNotification
    };

    switch (activeTab) {
      case 'wizard':
        return <WizardTab {...commonProps} />;
      case 'prompts':
        return <PromptsTab {...commonProps} />;
      case 'dashboard':
        return <DashboardTab {...commonProps} />;
      case 'runner':
        return <RunnerTab {...commonProps} />;
      case 'sessions':
        return <SessionsTab {...commonProps} />;
      case 'claude-sessions':
        return <ClaudeSessionsTab {...commonProps} />;
      default:
        return <WizardTab {...commonProps} />;
    }
  };

  return (
    <Layout
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      isConnected={isConnected}
      connectionError={connectionError}
      serverStatus={serverStatus}
      isRunning={isRunning}
      onReconnect={handleReconnect}
      notification={notification}
      onCloseNotification={() => setNotification(null)}
    >
      {renderTab()}
    </Layout>
  );
}

export default App;
