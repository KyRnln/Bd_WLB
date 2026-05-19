class TikTokShopCidExtractor {
  constructor() {
    this.pending = null;
    this.init();
    console.log('[CID] content script 已加载');
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'searchCreator') {
        this.searchCreator(request.creatorId)
          .then((res) => sendResponse(res))
          .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
        return true;
      }
      if (request.action === 'showBatchProgress') {
        this.showBatchProgress(request);
        sendResponse({ success: true });
        return false;
      }
    });

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== 'tt-cid-hook') return;
      if (data.type !== 'candidates') return;
      this.safeSendMessage({
        action: 'hookCandidates',
        url: data.url,
        candidates: data.candidates
      });
    });
  }

  safeSendMessage(message) {
    try {
      if (!chrome.runtime?.id) {
        console.warn('[CID] 扩展上下文已失效');
        return;
      }
      chrome.runtime.sendMessage(message);
    } catch (e) {
      console.warn('[CID] 扩展上下文失效，消息发送失败:', e.message);
    }
  }

  safeSendMessagePromise(message) {
    try {
      if (!chrome.runtime?.id) {
        console.warn('[CID] 扩展上下文已失效');
        return Promise.resolve({ success: false, error: '扩展上下文失效' });
      }
      return chrome.runtime.sendMessage(message);
    } catch (e) {
      console.warn('[CID] 扩展上下文失效，消息发送失败:', e.message);
      return Promise.resolve({ success: false, error: '扩展上下文失效' });
    }
  }

  async searchCreator(creatorIdRaw) {
    const creatorId = String(creatorIdRaw || '').trim();
    if (!creatorId) throw new Error('请输入达人ID');

    const hookRes = await this.safeSendMessagePromise({ action: 'installNetworkHook' });
    console.log('[CID] installNetworkHook 返回:', hookRes);

    const input = await this.findInputElement();
    if (!input) throw new Error('找不到搜索输入框，请确保页面已正确加载');

    const waitCidPromise = this.safeSendMessagePromise({
      action: 'startWaitingForCid',
      query: creatorId,
      timeoutMs: 20000
    });

    this.setNativeInputValue(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await this.delay(100);

    this.setNativeInputValue(input, creatorId);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await this.delay(100);

    const keyInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
    input.dispatchEvent(new KeyboardEvent('keydown', keyInit));
    input.dispatchEvent(new KeyboardEvent('keypress', keyInit));
    input.dispatchEvent(new KeyboardEvent('keyup', keyInit));

    try {
      if (input.form?.requestSubmit) input.form.requestSubmit();
    } catch (_) { }

    const waitRes = await waitCidPromise;
    if (!waitRes?.success || !waitRes.cid) {
      throw new Error(waitRes?.error || '等待CID失败');
    }
    const cid = String(waitRes.cid);
    console.log('[CID] 已获取CID:', cid, 'sourceUrl:', waitRes.sourceUrl);

    const url = this.buildDetailUrl(cid);

    await this.delay(1500);
    const avatarBase64 = await this.getAvatarBase64();
    console.log('[CID] 头像抓取:', avatarBase64 ? '成功' : '未获取到');

    await this.safeSendMessagePromise({ action: 'storeResult', data: { id: creatorId, cid, url, avatarBase64 } });
    const openRes = await this.safeSendMessagePromise({ action: 'openTab', url });
    if (openRes?.success && openRes?.tabId) {
      await this.safeSendMessagePromise({ action: 'closeTab', tabId: openRes.tabId });
    }

    return { success: true, cid, url, avatarBase64 };
  }

  async getAvatarBase64() {
    const XPATH = '/html/body/div[1]/div/div[2]/main/div/div/div/div/div/div[2]/div[4]/div[4]/div/div/div[1]/div/div/div[3]/table/tbody/tr/td[1]/div/div/div/div/div/div[1]/span/img';
    const CSS_FALLBACKS = [
      'table tbody tr:first-child td:first-child span img',
      'table tbody tr:first-child td:first-child img',
      '.arco-table-body tr:first-child td:first-child img'
    ];
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await this.delay(500);
      let imgSrc = '';
      try {
        const node = document.evaluate(XPATH, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (node && node.src && node.src.startsWith('http')) imgSrc = node.src;
      } catch (_) { }
      if (!imgSrc) {
        for (const sel of CSS_FALLBACKS) {
          const img = document.querySelector(sel);
          if (img && img.src && img.src.startsWith('http')) { imgSrc = img.src; break; }
        }
      }
      if (imgSrc) {
        const b64 = await this.fetchImageAsBase64(imgSrc);
        if (b64) return b64;
      }
    }
    return '';
  }

  async fetchImageAsBase64(url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return '';
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const mime = resp.headers.get('content-type') || 'image/jpeg';
      return `data:${mime};base64,${btoa(bin)}`;
    } catch (e) {
      console.warn('[CID] 头像fetch失败:', e.message);
      return '';
    }
  }

  buildDetailUrl(cid) {
    const params = new URLSearchParams(window.location.search);
    const shopRegion = params.get('shop_region') || 'MY';
    const base = 'https://affiliate.tiktokshopglobalselling.com/connection/creator/detail';
    const enterFrom = params.get('enter_from') || 'affiliate_crm';
    return `${base}?cid=${encodeURIComponent(cid)}&enter_from=${encodeURIComponent(enterFrom)}&shop_region=${encodeURIComponent(shopRegion)}`;
  }

  setNativeInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
  }

  async findInputElement() {
    const selectors = [
      '#keyword_input',
      'input[placeholder*="搜索达人"]',
      'input[placeholder*="搜索"]',
      'input[data-tid="m4b_input_search"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    for (let i = 0; i < 10; i++) {
      await this.delay(500);
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
    }
    return null;
  }

  delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  showBatchProgress(data) {
    let container = document.getElementById('tt-cid-batch-progress');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tt-cid-batch-progress';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: #ffffff;
        color: #374151;
        padding: 16px 24px;
        border-radius: 8px;
        z-index: 2147483647;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        pointer-events: none;
        min-width: 320px;
        border: 1px solid #e8e8e8;
      `;
      document.body.appendChild(container);
    }
    const { status, currentIndex, total, successCount, failCount, currentCreatorId } = data;
    const successIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    const failIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    if (status === 'running') {
      const pct = total > 0 ? Math.round((currentIndex / total) * 100) : 0;
      container.innerHTML = `
        <div style="font-weight:600;color:#1a1a2e;">批量获取CID进行中</div>
        <div style="width:100%;background:#e5e7eb;border-radius:4px;height:6px;">
          <div style="width:${pct}%;background:#22c55e;height:100%;border-radius:4px;transition:width 0.3s;"></div>
        </div>
        <div style="font-size:12px;color:#6b7280;">${currentIndex}/${total} · ${currentCreatorId || ''}</div>
        <div style="font-size:12px;color:#6b7280;display:flex;align-items:center;gap:4px;">${successIcon} ${successCount} · ${failIcon} ${failCount}</div>
      `;
      container.style.display = 'flex';
    } else if (status === 'completed') {
      container.innerHTML = `
        <div style="font-weight:600;color:#1a1a2e;">批量获取完成</div>
        <div style="font-size:12px;color:#6b7280;display:flex;align-items:center;gap:4px;justify-content:center;">共 ${total} 个 · ${successIcon} ${successCount} · ${failIcon} ${failCount}</div>
      `;
      setTimeout(() => { container.style.display = 'none'; }, 20000);
    }
  }
}

new TikTokShopCidExtractor();
