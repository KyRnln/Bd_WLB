(function () {
  if (window.__sampleCrawlHookInstalled) return;
  window.__sampleCrawlHookInstalled = true;

  const TARGET_API = '/api/v1/affiliate/sample/group/list';

  function postToContent(type, payload) {
    window.postMessage({ source: 'sample-crawl-hook', type, ...payload }, '*');
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const url = response.url || '';
        if (url.includes(TARGET_API)) {
          const clone = response.clone();
          clone.json().then(json => {
            postToContent('apiResponse', { json });
          }).catch(() => {});
        }
      } catch (_) {}
      return response;
    };
  }

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__sampleCrawlUrl = typeof url === 'string' ? url : (url ? String(url) : '');
    return originalXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        const url = this.__sampleCrawlUrl || '';
        if (url.includes(TARGET_API)) {
          const json = JSON.parse(this.responseText);
          postToContent('apiResponse', { json });
        }
      } catch (_) {}
    });
    return originalXHRSend.apply(this, arguments);
  };

  postToContent('hookInstalled', {});
})();
