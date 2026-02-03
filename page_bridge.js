// Page-world bridge for debugging (accessible from DevTools console)
(() => {
  const REQ = 'QI_CREATOR_DEBUG_REQUEST';
  const RES = 'QI_CREATOR_DEBUG_RESPONSE';

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  window.__quickInputCreatorDebug = function __quickInputCreatorDebug(timeoutMs = 1500) {
    const requestId = makeId();
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMessage);
        resolve({
          ok: false,
          reason: 'timeout',
          requestId,
          url: location.href
        });
      }, timeoutMs);

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.type !== RES || data.requestId !== requestId) return;
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(data.payload);
      }

      window.addEventListener('message', onMessage);
      window.postMessage({ type: REQ, requestId }, '*');
    });
  };
})();

