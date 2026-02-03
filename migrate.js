// 数据迁移脚本 - 从 chrome.storage.local 迁移到 IndexedDB
// 在 popup.js 加载前执行，确保数据迁移完成

(async function() {
  'use strict';
  
  console.log('🔄 开始数据迁移检查...');
  
  try {
    // 检查是否已经迁移过
    if (typeof db === 'undefined') {
      console.warn('⚠️ 数据库未加载，跳过迁移');
      return;
    }
    
    // 初始化数据库
    await db.init();
    
    // 检查是否已经迁移过（通过检查数据库中是否有数据）
    const existingAccounts = await db.selectAll('accounts');
    const existingInfluencers = await db.selectAll('influencers');
    
    if (existingAccounts.length > 0 || existingInfluencers.length > 0) {
      console.log('✅ 数据已存在于数据库中，跳过迁移');
      console.log(`   账户数量: ${existingAccounts.length}`);
      console.log(`   达人数量: ${existingInfluencers.length}`);
      return;
    }
    
    // 检查 chrome.storage 中是否有数据
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      console.log('⚠️ chrome.storage 不可用，跳过迁移');
      return;
    }
    
    // 从 chrome.storage 读取数据
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['savedAccounts', 'savedInfluencers', 'lastSelectedAccountId'], resolve);
    });
    
    const accounts = result.savedAccounts || [];
    const influencers = result.savedInfluencers || [];
    const lastSelectedAccountId = result.lastSelectedAccountId || null;
    
    if (accounts.length === 0 && influencers.length === 0) {
      console.log('✅ 没有需要迁移的数据');
      return;
    }
    
    console.log(`📦 发现需要迁移的数据: ${accounts.length} 个账户, ${influencers.length} 个达人`);
    
    // 迁移账户数据
    if (accounts.length > 0) {
      console.log('📤 迁移账户数据...');
      const operations = accounts.map(account => ({
        type: 'insert',
        data: {
          ...account,
          createdAt: account.createdAt || Date.now(),
          updatedAt: account.updatedAt || Date.now()
        }
      }));
      
      await db.batch('accounts', operations);
      console.log(`✅ 成功迁移 ${accounts.length} 个账户`);
    }
    
    // 迁移达人数据
    if (influencers.length > 0) {
      console.log('📤 迁移达人数据...');
      const operations = influencers.map(influencer => ({
        type: 'insert',
        data: {
          ...influencer,
          createdAt: influencer.createdAt || Date.now(),
          updatedAt: influencer.updatedAt || Date.now()
        }
      }));
      
      await db.batch('influencers', operations);
      console.log(`✅ 成功迁移 ${influencers.length} 个达人`);
    }
    
    // 迁移设置
    if (lastSelectedAccountId) {
      await db.setSetting('lastSelectedAccountId', lastSelectedAccountId);
      console.log('✅ 迁移最后选中的账户ID');
    }
    
    console.log('🎉 数据迁移完成！');
    console.log('   提示: 原始数据仍保留在 chrome.storage 中，可以手动删除');
    
    // 可选：迁移完成后删除 chrome.storage 中的数据（取消注释以启用）
    // await new Promise((resolve) => {
    //   chrome.storage.local.remove(['savedAccounts', 'savedInfluencers', 'lastSelectedAccountId'], resolve);
    // });
    // console.log('🗑️ 已删除 chrome.storage 中的原始数据');
    
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    console.error('   错误详情:', error.stack);
    console.log('   将回退使用 chrome.storage.local');
  }
})();
