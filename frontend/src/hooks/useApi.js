/**
 * API 호출 훅
 * REST API 요청 관리
 */

import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * API 호출 훅
 * @returns {Object} { get, post, put, del, loading, error }
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * HTTP 요청 실행
   * @param {string} url - API 경로
   * @param {Object} options - fetch 옵션
   * @returns {Promise<Object>} 응답 데이터
   */
  const request = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP 에러: ${response.status}`);
      }

      return data;
    } catch (err) {
      const errorMessage = err.message || '알 수 없는 에러';
      setError(errorMessage);
      console.error('API 에러:', errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * GET 요청
   * @param {string} url - API 경로
   * @returns {Promise<Object>}
   */
  const get = useCallback((url) => {
    return request(url, { method: 'GET' });
  }, [request]);

  /**
   * POST 요청
   * @param {string} url - API 경로
   * @param {Object} body - 요청 바디
   * @returns {Promise<Object>}
   */
  const post = useCallback((url, body) => {
    return request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }, [request]);

  /**
   * PUT 요청
   * @param {string} url - API 경로
   * @param {Object} body - 요청 바디
   * @returns {Promise<Object>}
   */
  const put = useCallback((url, body) => {
    return request(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }, [request]);

  /**
   * DELETE 요청
   * @param {string} url - API 경로
   * @returns {Promise<Object>}
   */
  const del = useCallback((url) => {
    return request(url, { method: 'DELETE' });
  }, [request]);

  return {
    get,
    post,
    put,
    del,
    loading,
    error
  };
}

export default useApi;
