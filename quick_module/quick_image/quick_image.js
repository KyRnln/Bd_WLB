// 快捷图片模块 - 管理页面逻辑

(function() {
  'use strict';

  const STORAGE_KEY = 'quickImages';

  function getStorage() {
    return chrome.storage ? chrome.storage.local : null;
  }

  function getAllImages() {
    return new Promise((resolve) => {
      const s = getStorage();
      if (!s) { resolve([]); return; }
      s.get([STORAGE_KEY], (result) => {
        resolve(Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : []);
      });
    });
  }

  function saveAllImages(images) {
    return new Promise((resolve, reject) => {
      const s = getStorage();
      if (!s) { reject(new Error('存储不可用')); return; }
      s.set({ [STORAGE_KEY]: images }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }

  async function putImage(data) {
    const images = await getAllImages();
    const idx = images.findIndex(i => i.id === data.id);
    if (idx >= 0) images[idx] = data;
    else images.push(data);
    await saveAllImages(images);
  }

  async function deleteImage(id) {
    const images = await getAllImages();
    const filtered = images.filter(i => i.id !== id);
    await saveAllImages(filtered);
  }

  function showStatus(msg, type = 'info', elementId = 'quickImageStatus') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = msg;
    el.className = 'status ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  function compressImage(file, maxW = 800, quality = 0.8) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxW) { h = h * maxW / w; w = maxW; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL(file.type || 'image/png', quality);
          resolve({ dataUrl, width: w, height: h });
        };
        img.onerror = () => resolve(null);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function addImageFromFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      showStatus('不支持的图片格式：' + ext, 'error');
      return;
    }
    compressImage(file).then(async (result) => {
      if (!result) { showStatus('图片处理失败', 'error'); return; }
      const name = file.name.replace(/\.[^.]+$/, '').substring(0, 50);
      const item = {
        id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        name: name || '未命名',
        imageData: result.dataUrl,
        fileName: file.name,
        fileSize: file.size,
        width: result.width,
        height: result.height,
        type: file.type || 'image/png',
        createdAt: Date.now()
      };
      try {
        await putImage(item);
        showStatus('✅ 图片已添加：' + name, 'success');
        renderGrid();
      } catch (e) {
        showStatus('保存失败：' + e.message, 'error');
      }
    });
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!files.length) { showStatus('未选择图片文件', 'error'); return; }
    for (const f of files) {
      await addImageFromFile(f);
    }
  }

  async function handlePaste(e) {
    const items = e.clipboardData.items;
    let hasImage = false;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        hasImage = true;
        const file = item.getAsFile();
        if (file) {
          const name = '粘贴图片_' + new Date().toLocaleString().replace(/[/:]/g, '-');
          const renamed = new File([file], name + '.' + (file.type.split('/')[1] || 'png'), { type: file.type });
          await addImageFromFile(renamed);
        }
      }
    }
    if (!hasImage) {
      showStatus('剪贴板中没有图片', 'error');
    }
  }

  async function renderGrid() {
    const listEl = document.getElementById('qiList');
    if (!listEl) return;
    const images = await getAllImages();
    if (!images.length) {
      listEl.innerHTML = '<div class="qi-empty"><p>暂无快捷图片</p><p style="font-size:12px;">点击下方区域或拖拽图片添加</p></div>';
      return;
    }
    listEl.innerHTML = '<div class="qi-grid">' + images.map(img => `
      <div class="qi-card" data-id="${escapeHtml(img.id)}">
        <img class="qi-thumb" src="${img.imageData}" alt="${escapeHtml(img.name)}" />
        <div class="qi-info">
          <div class="qi-name" title="${escapeHtml(img.name)}">${escapeHtml(img.name)}</div>
          <div class="qi-meta">${formatSize(img.fileSize)} · ${img.width}×${img.height}</div>
        </div>
        <div class="qi-actions">
          <button class="btn-sm btn-delete" data-id="${escapeHtml(img.id)}">删除</button>
        </div>
      </div>
    `).join('') + '</div>';

    listEl.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('确定删除这张图片吗？')) return;
        await deleteImage(btn.dataset.id);
        showStatus('已删除', 'success');
        renderGrid();
      });
    });

    listEl.querySelectorAll('.qi-thumb').forEach(img => {
      img.addEventListener('click', () => {
        showPreview(img.src, img.alt);
      });
    });
  }

  function showPreview(src, alt) {
    const existing = document.querySelector('.qi-preview-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'qi-preview-overlay';
    overlay.style.cssText = `
      position:fixed;z-index:9999;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.6);display:flex;align-items:center;
      justify-content:center;cursor:pointer;
    `;
    overlay.innerHTML = `
      <div style="max-width:90vw;max-height:90vh;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f2f2f2;">
          <span style="font-size:13px;font-weight:600;color:#1a1c1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px;">${escapeHtml(alt || '')}</span>
          <span style="cursor:pointer;color:#999;font-size:18px;padding:0 4px;line-height:1;" id="qiPreviewClose">×</span>
        </div>
        <img src="${src}" style="max-width:80vw;max-height:80vh;object-fit:contain;display:block;" />
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('#qiPreviewClose')?.addEventListener('click', () => overlay.remove());
  }

  function formatSize(bytes) {
    if (!bytes) return '未知';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1048576).toFixed(1) + 'MB';
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  // --- Export / Import ---

  async function exportData() {
    const images = await getAllImages();
    if (!images.length) {
      showStatus('没有数据可导出', 'error');
      return;
    }
    try {
      const json = JSON.stringify(images, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quick_images_backup_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showStatus('✅ 已导出 ' + images.length + ' 张图片 (约' + formatSize(blob.size) + ')', 'success');
    } catch (e) {
      showStatus('导出失败：' + e.message, 'error');
    }
  }

  async function importData(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('格式错误，应为数组');
      const existing = await getAllImages();
      const existingIds = new Set(existing.map(i => i.id));
      let count = 0;
      for (const item of data) {
        if (item && item.id && item.imageData && !existingIds.has(item.id)) {
          existing.push({
            id: item.id,
            name: item.name || '未命名',
            imageData: item.imageData,
            fileName: item.fileName || '',
            fileSize: item.fileSize || 0,
            width: item.width || 0,
            height: item.height || 0,
            type: item.type || 'image/png',
            createdAt: item.createdAt || Date.now()
          });
          count++;
        }
      }
      if (count > 0) await saveAllImages(existing);
      showStatus('✅ 已导入 ' + count + ' 张图片', 'success');
      renderGrid();
    } catch (e) {
      showStatus('导入失败：' + e.message, 'error');
    }
  }

  // --- Init ---

  document.addEventListener('DOMContentLoaded', () => {
    renderGrid();

    // Back
    document.getElementById('backBtn')?.addEventListener('click', () => {
      window.location.href = '../../popup.html';
    });

    // Add area click -> file picker
    const addArea = document.getElementById('qiAddArea');
    const fileInput = document.getElementById('qiImageFileInput');
    if (addArea && fileInput) {
      addArea.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          handleFiles(e.target.files);
          e.target.value = '';
        }
      });
    }

    // Drag & drop on add area
    if (addArea) {
      addArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        addArea.style.borderColor = '#0078d4';
        addArea.style.background = 'rgba(0,120,212,0.06)';
      });
      addArea.addEventListener('dragleave', () => {
        addArea.style.borderColor = '';
        addArea.style.background = '';
      });
      addArea.addEventListener('drop', (e) => {
        e.preventDefault();
        addArea.style.borderColor = '';
        addArea.style.background = '';
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
      });
    }

    // Paste support (on the whole page)
    document.addEventListener('paste', (e) => {
      // Only handle if focus is not on an input that shouldn't be intercepted
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      handlePaste(e);
    });

    // Export
    document.getElementById('exportImageBtn')?.addEventListener('click', exportData);

    // Import
    const importBtn = document.getElementById('importImageBtn');
    const importInput = document.getElementById('qiFileInput');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', async (e) => {
        if (e.target.files.length) {
          await importData(e.target.files[0]);
          e.target.value = '';
        }
      });
    }
  });
})();