/**
 * Socket.IO 연결 훅
 * 서버와 실시간 통신 관리
 */

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

/**
 * Socket.IO 연결 훅
 * @returns {Object} { socket, isConnected, error }
 */
export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // 소켓 연결
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    // 연결 성공
    socket.on('connect', () => {
      console.log('서버 연결됨:', socket.id);
      setIsConnected(true);
      setError(null);
    });

    // 연결 해제
    socket.on('disconnect', (reason) => {
      console.log('서버 연결 해제:', reason);
      setIsConnected(false);
    });

    // 연결 에러
    socket.on('connect_error', (err) => {
      console.error('연결 에러:', err.message);
      setError(err.message);
      setIsConnected(false);
    });

    // 재연결 시도
    socket.on('reconnect_attempt', (attempt) => {
      console.log(`재연결 시도 ${attempt}...`);
    });

    // 재연결 성공
    socket.on('reconnect', () => {
      console.log('재연결 성공');
      setIsConnected(true);
      setError(null);
    });

    // 클린업
    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error
  };
}

export default useSocket;
