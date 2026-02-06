const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const port = 3001;

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'fgs13990845071..',
  database: 'wlb_extension',
  charset: 'utf8mb4',
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 中间件
app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:*', 'https://localhost:*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 限制每个IP 1000次请求
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 同步达人数据
app.post('/api/sync/creators', async (req, res) => {
  try {
    const { creators } = req.body;
    if (!Array.isArray(creators)) {
      return res.status(400).json({ error: '无效的数据格式' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 清空现有数据
      await connection.execute('DELETE FROM creators');

      // 插入新数据
      if (creators.length > 0) {
        for (const creator of creators) {
          await connection.execute(
            'INSERT INTO creators (creator_id, creator_cid, region_code, remark) VALUES (?, ?, ?, ?)',
            [creator.id, creator.cid || null, creator.region || null, creator.remark || null]
          );
        }
      }

      await connection.commit();
      res.json({ success: true, message: `同步了 ${creators.length} 个达人` });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('同步达人数据失败:', error);
    res.status(500).json({ error: '同步失败: ' + error.message });
  }
});

// 获取达人数据
app.get('/api/creators', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT * FROM creators ORDER BY updated_at DESC');
    connection.release();

    const creators = rows.map(row => ({
      id: row.creator_id,
      cid: row.creator_cid,
      region: row.region_code,
      remark: row.remark
    }));

    res.json({ success: true, data: creators });
  } catch (error) {
    console.error('获取达人数据失败:', error);
    res.status(500).json({ error: '获取失败: ' + error.message });
  }
});

// 同步短语数据
app.post('/api/sync/phrases', async (req, res) => {
  try {
    const { phrases } = req.body;
    if (!Array.isArray(phrases)) {
      return res.status(400).json({ error: '无效的数据格式' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 清空现有数据
      await connection.execute('DELETE FROM phrases');

      // 插入新数据
      if (phrases.length > 0) {
        for (const phrase of phrases) {
          await connection.execute(
            'INSERT INTO phrases (category, phrase_text, shortcut) VALUES (?, ?, ?)',
            [phrase.category || 'general', phrase.phrase_text || phrase.content || '', phrase.shortcut || null]
          );
        }
      }

      await connection.commit();
      res.json({ success: true, message: `同步了 ${phrases.length} 个短语` });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('同步短语数据失败:', error);
    res.status(500).json({ error: '同步失败: ' + error.message });
  }
});

// 获取短语数据
app.get('/api/phrases', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT * FROM phrases ORDER BY created_at DESC');
    connection.release();

    const phrases = rows.map(row => ({
      id: row.id.toString(),
      category: row.category,
      phrase_text: row.phrase_text,
      content: row.phrase_text, // 兼容旧版
      shortcut: row.shortcut,
      created_at: row.created_at
    }));

    res.json({ success: true, data: phrases });
  } catch (error) {
    console.error('获取短语数据失败:', error);
    res.status(500).json({ error: '获取失败: ' + error.message });
  }
});

// 合并数据（上传并下载合并）
app.post('/api/merge', async (req, res) => {
  try {
    const { creators, phrases } = req.body;

    // 添加调试日志
    console.log('收到merge请求:');
    console.log('creators数量:', creators ? creators.length : 0);
    console.log('phrases数量:', phrases ? phrases.length : 0);
    if (creators && creators.length > 0) {
      console.log('第一个creator:', creators[0]);
    }
    if (phrases && phrases.length > 0) {
      console.log('第一个phrase:', phrases[0]);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      let mergedCreators = [];
      let mergedPhrases = [];

      // 获取现有数据
      const [existingCreators] = await connection.execute('SELECT * FROM creators');
      const [existingPhrases] = await connection.execute('SELECT * FROM phrases');

      // 合并达人数据（去重）
      const creatorMap = new Map();
      existingCreators.forEach(c => creatorMap.set(c.creator_id, c));
      if (creators) {
        creators.forEach(c => {
          if (!creatorMap.has(c.id)) {
            creatorMap.set(c.id, {
              creator_id: c.id,
              creator_cid: c.cid || null,
              region_code: c.region || null,
              remark: c.remark || null,
              updated_at: new Date()
            });
          }
        });
      }
      mergedCreators = Array.from(creatorMap.values());

      // 合并短语数据
      const existingPhraseTexts = new Set(existingPhrases.map(p => p.phrase_text));
      const newPhrases = [];
      if (phrases) {
        phrases.forEach(p => {
          if (!existingPhraseTexts.has(p.phrase_text || p.content)) {
            newPhrases.push({
              category: p.category || 'general',
              phrase_text: p.phrase_text || p.content || '',
              shortcut: p.shortcut || null
            });
          }
        });
      }

      // 更新数据库
      await connection.execute('DELETE FROM creators');
      // 逐条插入creators以避免批量插入的语法问题
      for (const creator of mergedCreators) {
        await connection.execute(
          'INSERT INTO creators (creator_id, creator_cid, region_code, remark) VALUES (?, ?, ?, ?)',
          [creator.creator_id, creator.creator_cid, creator.region_code, creator.remark]
        );
      }

      await connection.execute('DELETE FROM phrases');
      // 逐条插入phrases以避免批量插入的语法问题
      for (const phrase of newPhrases) {
        await connection.execute(
          'INSERT INTO phrases (category, phrase_text, shortcut) VALUES (?, ?, ?)',
          [phrase.category, phrase.phrase_text, phrase.shortcut]
        );
      }

      await connection.commit();

      res.json({
        success: true,
        message: `合并完成：${mergedCreators.length} 个达人，${existingPhrases.length + newPhrases.length} 个短语`
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('数据合并失败:', error);
    res.status(500).json({ error: '合并失败: ' + error.message });
  }
});

// 错误处理
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  console.log(`WLB API服务器运行在端口 ${port}`);
  console.log(`健康检查: http://localhost:${port}/health`);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('正在关闭服务器...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('正在关闭服务器...');
  await pool.end();
  process.exit(0);
});