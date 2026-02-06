// WLB扩展数据库同步模块

class DatabaseSync {
  constructor() {
    this.apiUrl = 'https://kyrnln.cloud/wlb/api';
    this.isOnline = false;
    this.lastSyncTime = null;
  }

  // 检查API连接状态
  async checkConnection() {
    try {
      const response = await fetch(`${this.apiUrl.replace('/api', '')}/health`, {
        method: 'GET',
        timeout: 5000
      });

      if (response.ok) {
        this.isOnline = true;
        return { success: true };
      } else {
        this.isOnline = false;
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      this.isOnline = false;
      return { success: false, error: error.message };
    }
  }

  // 同步达人数据到云端
  async syncCreatorsToCloud(creators) {
    try {
      const response = await fetch(`${this.apiUrl}/sync/creators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ creators })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.lastSyncTime = new Date();
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error || '同步失败' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 从云端获取达人数据
  async syncCreatorsFromCloud() {
    try {
      const response = await fetch(`${this.apiUrl}/creators`, {
        method: 'GET'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true, data: result.data };
      } else {
        return { success: false, error: result.error || '获取失败' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 同步短语数据到云端
  async syncPhrasesToCloud(phrases) {
    try {
      const response = await fetch(`${this.apiUrl}/sync/phrases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phrases })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.lastSyncTime = new Date();
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error || '同步失败' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 从云端获取短语数据
  async syncPhrasesFromCloud() {
    try {
      const response = await fetch(`${this.apiUrl}/phrases`, {
        method: 'GET'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true, data: result.data };
      } else {
        return { success: false, error: result.error || '获取失败' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 合并数据（上传本地数据并下载云端数据）
  async mergeData(localCreators, localPhrases) {
    try {
      const response = await fetch(`${this.apiUrl}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creators: localCreators,
          phrases: localPhrases
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.lastSyncTime = new Date();
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error || '合并失败' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 双向同步（先上传本地数据，再下载最新数据）
  async fullSync(localCreators, localPhrases) {
    try {
      // 1. 上传本地数据
      const uploadResult = await this.mergeData(localCreators, localPhrases);
      if (!uploadResult.success) {
        return uploadResult;
      }

      // 2. 下载最新数据
      const [creatorsResult, phrasesResult] = await Promise.all([
        this.syncCreatorsFromCloud(),
        this.syncPhrasesFromCloud()
      ]);

      if (creatorsResult.success && phrasesResult.success) {
        return {
          success: true,
          message: '双向同步完成',
          data: {
            creators: creatorsResult.data,
            phrases: phrasesResult.data
          }
        };
      } else {
        return {
          success: false,
          error: `下载失败: ${creatorsResult.error || phrasesResult.error}`
        };
      }

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 获取最后同步时间
  getLastSyncTime() {
    return this.lastSyncTime;
  }

  // 检查是否在线
  isConnected() {
    return this.isOnline;
  }
}

// 创建全局实例
const dbSync = new DatabaseSync();

// 导出给其他模块使用
window.DatabaseSync = DatabaseSync;
window.dbSync = dbSync;