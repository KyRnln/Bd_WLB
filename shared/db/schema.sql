-- =====================================================
-- 商务WLB插件 - 在线版数据库结构
-- 数据库: MariaDB 10.5+
-- 编码: utf8mb4
-- =====================================================

-- -----------------------------------------------------
-- 1. 用户表 (users)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    username        VARCHAR(64) NOT NULL UNIQUE COMMENT '用户名',
    email           VARCHAR(255) NOT NULL UNIQUE COMMENT '邮箱',
    password_hash   VARCHAR(255) NOT NULL COMMENT '密码哈希',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    last_login_at   DATETIME COMMENT '最后登录时间',
    is_active       TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否激活: 0-否 1-是',
    INDEX idx_users_email (email),
    INDEX idx_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- -----------------------------------------------------
-- 2. 达人表 (creators)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS creators (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
    user_id         BIGINT UNSIGNED NOT NULL COMMENT '所属用户ID',
    creator_id      VARCHAR(64) NOT NULL COMMENT '达人ID (唯一标识)',
    cid             VARCHAR(64) COMMENT '达人CID',
    region          VARCHAR(10) COMMENT '地区代码: MY/TH/ID/SG/PH/VN',
    tag             ENUM('绩效达人', '流失达人', '隐藏达人') DEFAULT NULL COMMENT '达人标签',
    remark          TEXT COMMENT '备注信息',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 外键关联用户
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- 索引
    INDEX idx_creators_user_id (user_id),
    INDEX idx_creators_cid (cid),
    INDEX idx_creators_region (region),
    INDEX idx_creators_tag (tag),

    -- 同一用户下达人ID唯一
    UNIQUE KEY uk_user_creator_id (user_id, creator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='达人表';

-- -----------------------------------------------------
-- 3. 短语标签表 (tags)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '标签ID',
    user_id         BIGINT UNSIGNED NOT NULL COMMENT '所属用户ID',
    name            VARCHAR(64) NOT NULL COMMENT '标签名称',
    sort_order      INT NOT NULL DEFAULT 0 COMMENT '排序顺序',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 外键关联用户
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- 索引
    INDEX idx_tags_user_id (user_id),
    INDEX idx_tags_sort (user_id, sort_order),

    -- 同一用户下标签名唯一
    UNIQUE KEY uk_user_tag_name (user_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短语标签表';

-- -----------------------------------------------------
-- 4. 快捷短语表 (phrases)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS phrases (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '短语ID',
    user_id         BIGINT UNSIGNED NOT NULL COMMENT '所属用户ID',
    tag_id          BIGINT UNSIGNED COMMENT '所属标签ID',
    title           VARCHAR(255) NOT NULL COMMENT '短语标题',
    content         TEXT NOT NULL COMMENT '短语内容',
    sort_order      INT NOT NULL DEFAULT 0 COMMENT '排序顺序',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 外键关联用户和标签
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE SET NULL,

    -- 索引
    INDEX idx_phrases_user_id (user_id),
    INDEX idx_phrases_tag_id (tag_id),
    INDEX idx_phrases_sort (user_id, tag_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='快捷短语表';

-- -----------------------------------------------------
-- 5. 翻译配置表 (translate_configs)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS translate_configs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '配置ID',
    user_id         BIGINT UNSIGNED NOT NULL UNIQUE COMMENT '所属用户ID',
    provider        ENUM('qwen', 'openai', 'deepseek', 'custom') NOT NULL DEFAULT 'qwen' COMMENT 'AI提供商',
    api_url         VARCHAR(512) NOT NULL COMMENT 'API地址',
    api_key         VARCHAR(512) NOT NULL COMMENT 'API密钥 (加密存储)',
    model_name      VARCHAR(128) NOT NULL COMMENT '模型名称',
    prompt_template TEXT COMMENT '提示词模板',
    target_langs    JSON COMMENT '目标语言列表 ["英语","泰语","越南语","印尼语"]',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 外键关联用户
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- 索引
    INDEX idx_translate_configs_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='翻译配置表';

-- -----------------------------------------------------
-- 6. 用户偏好设置表 (user_settings)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '设置ID',
    user_id         BIGINT UNSIGNED NOT NULL UNIQUE COMMENT '所属用户ID',
    settings_key     VARCHAR(64) NOT NULL COMMENT '设置键',
    settings_value   TEXT COMMENT '设置值 (JSON格式)',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 外键关联用户
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- 索引
    INDEX idx_user_settings_user_id (user_id),
    INDEX idx_user_settings_key (settings_key),

    -- 同一用户下设置键唯一
    UNIQUE KEY uk_user_settings_key (user_id, settings_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户偏好设置表';

-- -----------------------------------------------------
-- 初始化数据
-- -----------------------------------------------------

-- 插入默认标签 (需要配合应用逻辑创建第一个用户后执行)
-- INSERT INTO tags (user_id, name, sort_order) VALUES (1, '默认', 0);

-- 示例查询
-- SELECT c.*, t.name as tag_name FROM creators c LEFT JOIN tags t ON c.tag_id = t.id WHERE c.user_id = 1;
-- SELECT p.*, t.name as tag_name FROM phrases p LEFT JOIN tags t ON p.tag_id = t.id WHERE p.user_id = 1;
