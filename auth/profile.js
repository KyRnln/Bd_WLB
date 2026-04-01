// 用户资料模块

(function() {
  'use strict';

  const API_BASE_URL = 'https://kyrnln.cloud/api';

  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('profileSuccess');
    const errorDiv = document.getElementById('profileError');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = 'success-message';
      statusDiv.style.display = 'block';
    }
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
    setTimeout(() => {
      if (statusDiv) statusDiv.style.display = 'none';
    }, 3000);
  }

  function showError(message) {
    const errorDiv = document.getElementById('profileError');
    const statusDiv = document.getElementById('profileSuccess');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
    if (statusDiv) {
      statusDiv.style.display = 'none';
    }
  }

  function clearError() {
    const errorDiv = document.getElementById('profileError');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  function getToken() {
    return localStorage.getItem('auth_token');
  }

  function getUserInfoFromToken() {
    const token = getToken();
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (e) {
      return null;
    }
  }

  async function loadProfile() {
    const token = getToken();
    if (!token) {
      window.location.href = 'auth.html';
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        showError('服务器响应异常');
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = 'auth.html';
          return;
        }
        showError(data.message || '获取用户信息失败');
        return;
      }

      if (data.success && data.user) {
        document.getElementById('username').value = data.user.username || '';
        document.getElementById('email').value = data.user.email || '';
      }
    } catch (error) {
      console.error('加载用户信息错误:', error);
      showError('网络错误，请检查服务器连接');
    }
  }

  async function handleProfileUpdate(event) {
    event.preventDefault();
    clearError();

    const token = getToken();
    if (!token) {
      window.location.href = 'auth.html';
      return;
    }

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!username && !email && !newPassword) {
      showError('请至少填写一个要修改的字段');
      return;
    }

    if (username && (username.length < 2 || username.length > 32)) {
      showError('用户名长度需在2-32字符之间');
      return;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError('邮箱格式不正确');
        return;
      }
    }

    if (newPassword) {
      if (!currentPassword) {
        showError('修改密码需要提供当前密码');
        return;
      }
      if (newPassword.length < 6) {
        showError('新密码至少6位');
        return;
      }
      if (newPassword !== confirmPassword) {
        showError('两次新密码输入不一致');
        return;
      }
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (newPassword) {
      updateData.currentPassword = currentPassword;
      updateData.newPassword = newPassword;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        showError('服务器响应异常');
        return;
      }

      if (!response.ok) {
        showError(data.message || '更新失败');
        return;
      }

      showStatus('✅ ' + (data.message || '更新成功'));

      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';

      if (data.user) {
        document.getElementById('username').value = data.user.username || '';
        document.getElementById('email').value = data.user.email || '';
      }
    } catch (error) {
      console.error('更新用户信息错误:', error);
      showError('网络错误，请检查服务器连接');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadProfile();

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', handleProfileUpdate);
    }

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '../popup.html';
      });
    }
  });
})();