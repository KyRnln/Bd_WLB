/**
 * Auto-squircle: Automatically applies G2 continuous curve to all rounded elements
 */
(function() {
  const n = 5;
  const MIN_RADIUS = 2;
  const MAX_RADIUS = 9998;

  function superellipsePath(radius, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const rx = Math.max(0, w / 2 - radius);
    const ry = Math.max(0, h / 2 - radius);
    const steps = 100;
    const points = [];

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 * Math.PI;
      const cos = Math.cos(t);
      const sin = Math.sin(t);
      const x = cx + Math.sign(cos) * Math.pow(Math.abs(cos), 2 / n) * rx;
      const y = cy + Math.sign(sin) * Math.pow(Math.abs(sin), 2 / n) * ry;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return `polygon(${points.join(',')})`;
  }

  function getBorderRadius(el) {
    const style = getComputedStyle(el);
    const br = style.borderRadius;
    if (!br || br === '0px') return 0;
    const val = parseFloat(br);
    return isNaN(val) ? 0 : val;
  }

  function applySquircle(el) {
    const radius = getBorderRadius(el);
    if (radius < MIN_RADIUS || radius > MAX_RADIUS) return;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    el.style.clipPath = superellipsePath(radius, rect.width, rect.height);
    el.dataset.squircleApplied = 'true';
    resizeObserver.observe(el);
  }

  function processElements(root = document) {
    const els = root.querySelectorAll('*');
    els.forEach(el => {
      if (el.dataset.squircleApplied) return;
      applySquircle(el);
    });
  }

  let resizeTimer;
  const resizeObserver = new ResizeObserver(entries => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const entry of entries) {
        const el = entry.target;
        if (el.dataset.squircleApplied) {
          const radius = getBorderRadius(el);
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            el.style.clipPath = superellipsePath(radius, width, height);
          }
        }
      }
    }, 16);
  });

  let mutationTimer;
  const mutationObserver = new MutationObserver(mutations => {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            applySquircle(node);
            processElements(node);
          }
        }
      }
    }, 50);
  });

  function init() {
    processElements();
    if (document.body) {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AutoSquircle = { apply: applySquircle, process: processElements };
})();
