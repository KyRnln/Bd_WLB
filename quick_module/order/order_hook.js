(function () {
  if (window.__orderHookInstalled) return;
  window.__orderHookInstalled = true;

  const TARGET_APIS = [
    '/api/v1/affiliate/sample/group/list',
    'affiliate/sample/group/list'
  ];

  function postToContent(type, payload) {
    window.postMessage({ source: 'order-hook', type, ...payload }, '*');
  }

  function isTargetApi(url) {
    if (!url) return false;
    var urlStr = typeof url === 'string' ? url : String(url);
    return TARGET_APIS.some(function (api) { return urlStr.includes(api); });
  }

  var originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = async function () {
      var args = arguments;
      var response = await originalFetch.apply(this, args);
      try {
        var url = response.url || '';
        if (isTargetApi(url)) {
          var clone = response.clone();
          clone.json().then(function (json) {
            postToContent('apiResponse', { json: json, url: url });
          }).catch(function () {});
        }
      } catch (_) {}
      return response;
    };
  }

  var originalXHROpen = XMLHttpRequest.prototype.open;
  var originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__orderHookUrl = typeof url === 'string' ? url : (url ? String(url) : '');
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        var url = this.__orderHookUrl || '';
        if (isTargetApi(url)) {
          var json = JSON.parse(this.responseText);
          postToContent('apiResponse', { json: json, url: url });
        }
      } catch (_) {}
    });
    return originalXHRSend.apply(this, arguments);
  };

  postToContent('hookInstalled', {});
})();
