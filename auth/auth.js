// 认证模块 - 登录注册

(function() {
  'use strict';

  const AUTH_TOKEN_KEY = 'auth_token';
  const API_BASE_URL = 'https://kyrnln.cloud/api';

  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('authStatus');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 20000);
  }

  function showError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    if (!errorDiv) return;
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  function clearError(elementId) {
    const errorDiv = document.getElementById(elementId);
    if (!errorDiv) return;
    errorDiv.style.display = 'none';
  }

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

  function switchTab(tabName) {
    const tabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    if (tabName === 'login') {
      loginForm.style.display = 'flex';
      registerForm.style.display = 'none';
    } else {
      loginForm.style.display = 'none';
      registerForm.style.display = 'flex';
    }

    clearError('loginError');
    clearError('registerError');
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearError('loginError');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showError('loginError', '请填写邮箱和密码');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('服务器响应无效:', text);
        showError('loginError', '服务器响应异常，请稍后重试');
        return;
      }

      if (!response.ok) {
        showError('loginError', data.message || '登录失败');
        return;
      }

      if (data.token) {
        setToken(data.token);
        showStatus('✅ 登录成功，正在跳转...', 'success');
        setTimeout(() => {
          window.location.href = '../web/dashboard.html';
        }, 500);
      }
    } catch (error) {
      console.error('登录错误:', error);
      showError('loginError', '网络错误，请检查服务器连接');
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearError('registerError');

    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (!username || !email || !password || !confirmPassword) {
      showError('registerError', '请填写所有字段');
      return;
    }

    if (username.length < 2 || username.length > 32) {
      showError('registerError', '用户名长度需在2-32字符之间');
      return;
    }

    if (password.length < 6) {
      showError('registerError', '密码至少6位');
      return;
    }

    if (password !== confirmPassword) {
      showError('registerError', '两次密码输入不一致');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('服务器响应无效:', text);
        showError('registerError', '服务器响应异常，请稍后重试');
        return;
      }

      if (!response.ok) {
        showError('registerError', data.message || '注册失败');
        return;
      }

      showStatus('✅ 注册成功，请登录', 'success');
      switchTab('login');
      document.getElementById('loginEmail').value = email;
      document.getElementById('loginPassword').value = '';
    } catch (error) {
      console.error('注册错误:', error);
      showError('registerError', '网络错误，请检查服务器连接');
    }
  }

  function logout() {
    removeToken();
    window.location.href = 'auth.html';
  }

  function initAuth() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authTabs = document.querySelectorAll('.auth-tab');

    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }

    authTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
      });
    });

    const registerLink = document.getElementById('registerLink');
    if (registerLink) {
      registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('register');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }

  window.Auth = {
    isLoggedIn,
    getToken,
    logout
  };
})();
