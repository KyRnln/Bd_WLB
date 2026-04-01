// API 调用封装

(function() {
  'use strict';

  const AUTH_TOKEN_KEY = 'auth_token';
  const API_BASE_URL = 'https://kyrnln.cloud/api';

  function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  function removeToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          removeToken();
          window.location.href = '../auth/auth.html';
        }
        throw new Error(data.message || '请求失败');
      }

      return data;
    } catch (error) {
      console.error('API 请求错误:', error);
      throw error;
    }
  }

  const API = {
    get: (endpoint) => request(endpoint, { method: 'GET' }),
    post: (endpoint, data) => request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint, data) => request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
    patch: (endpoint, data) => request(endpoint, { method: 'PATCH', body: JSON.stringify(data) })
  };

  window.API = API;
  window.Auth = {
    isLoggedIn,
    getToken,
    setToken,
    removeToken,
    logout: () => {
      removeToken();
      window.location.href = '../auth/auth.html';
    }
  };
})();
