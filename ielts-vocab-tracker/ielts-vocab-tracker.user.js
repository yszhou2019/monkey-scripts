// ==UserScript==
// @name         雅思词汇掌握度助手 · IELTS Vocab Tracker
// @namespace    https://www.leonwang.cc/ielts-vocab/
// @version      2.8.0
// @description  为 leonwang.cc 雅思词汇卡片增加可配置分组标记（默认“认识”与“发音待练”）、分组筛选、本单元与全站熟悉度进度条、深色主题；单词详情默认隐藏中文、只留英文例句，状态可导出 / 导入 JSON。
// @match        https://www.leonwang.cc/ielts-vocab/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ===================== 主题（尽早注入，避免打开页面时白屏闪烁） =====================
  const THEME_KEY = 'ielts-vocab-tracker.theme.v1';
  const THEME_ORDER = ['system', 'dark', 'light'];
  const THEME_LABELS = { system: '🌗 自动', dark: '🌙 深色', light: '☀️ 浅色' };
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const THEME_CSS = `
    html[data-vb-theme="dark"] {
      --primary: #dce5ec;
      --accent: #5aaee6;
      --bg: #12171c;
      --card-bg: #1b2229;
      --text: #e3e7ea;
      --shadow: 0 2px 8px rgba(0, 0, 0, .35);
      color-scheme: dark;
    }

    html[data-vb-theme="dark"] body { background: var(--bg); color: var(--text); }

    html[data-vb-theme="dark"] .sidebar { background: #171e24; box-shadow: 2px 0 12px rgba(0, 0, 0, .4); }
    html[data-vb-theme="dark"] .sidebar h2 { color: #dce5ec; }
    html[data-vb-theme="dark"] .sidebar button { background: #212a32; color: #c7d0d8; }
    html[data-vb-theme="dark"] .sidebar button:hover { background: #2a353f; }
    html[data-vb-theme="dark"] .sidebar button.active {
      background: #3277a8; color: #fff; box-shadow: 0 4px 12px rgba(50, 119, 168, .35);
    }

    html[data-vb-theme="dark"] .card {
      background: var(--card-bg); border-color: #2a333c; box-shadow: 0 2px 6px rgba(0, 0, 0, .3);
    }
    html[data-vb-theme="dark"] .card:hover { box-shadow: 0 8px 20px rgba(0, 0, 0, .45); }
    html[data-vb-theme="dark"] .card .word { color: var(--primary); }
    html[data-vb-theme="dark"] .card .phonetic { color: #94a3ae; }
    html[data-vb-theme="dark"] .card .pos { background: #1d3a4d; color: #7cc4f0; }
    html[data-vb-theme="dark"] .card .meaning { color: #d3dbe2; }
    html[data-vb-theme="dark"] .btn-icon { background: #242e37; }
    html[data-vb-theme="dark"] .btn-icon:hover { background: #303c47; }
    html[data-vb-theme="dark"] .upload-icon-sm { color: #7f8c99; }
    html[data-vb-theme="dark"] .upload-icon-sm:hover { color: #c7d0d8; }

    html[data-vb-theme="dark"] .vb-c0 {
      --vb-g-bg: #202830; --vb-g-border: #2c3640;
      --vb-g-word: #8a97a2; --vb-g-phonetic: #7f8c96; --vb-g-meaning: #8d99a3;
      --vb-g-pos-bg: #273038; --vb-g-pos-fg: #7f8c96;
      --vb-g-btn-bg: #1e3f2c; --vb-g-btn-fg: #5fd394;
      --vb-g-shadow: 0 6px 16px rgba(0, 0, 0, .35);
    }
    html[data-vb-theme="dark"] .vb-c1 {
      --vb-g-bg: #2a2517; --vb-g-border: #3e3520;
      --vb-g-word: #dce5ec; --vb-g-phonetic: #94a3ae; --vb-g-meaning: #d3dbe2;
      --vb-g-pos-bg: #3a3119; --vb-g-pos-fg: #d8b767;
      --vb-g-btn-bg: #3a3119; --vb-g-btn-fg: #f0c96b;
      --vb-g-shadow: 0 6px 16px rgba(0, 0, 0, .35);
    }
    html[data-vb-theme="dark"] .vb-c2 {
      --vb-g-bg: #182631; --vb-g-border: #24384a;
      --vb-g-word: #dce5ec; --vb-g-phonetic: #8fa2b0; --vb-g-meaning: #c3d0da;
      --vb-g-pos-bg: #1d3a4d; --vb-g-pos-fg: #7cc4f0;
      --vb-g-btn-bg: #1d3a4d; --vb-g-btn-fg: #7cc4f0;
      --vb-g-shadow: 0 6px 16px rgba(0, 0, 0, .35);
    }
    html[data-vb-theme="dark"] .vb-c3 {
      --vb-g-bg: #17251c; --vb-g-border: #263a2c;
      --vb-g-word: #dce5ec; --vb-g-phonetic: #8fa2b0; --vb-g-meaning: #c3d0da;
      --vb-g-pos-bg: #1e3f2c; --vb-g-pos-fg: #5fd394;
      --vb-g-btn-bg: #1e3f2c; --vb-g-btn-fg: #5fd394;
      --vb-g-shadow: 0 6px 16px rgba(0, 0, 0, .35);
    }
    html[data-vb-theme="dark"] .vb-c4 {
      --vb-g-bg: #221d2e; --vb-g-border: #362d47;
      --vb-g-word: #dce5ec; --vb-g-phonetic: #9a92ad; --vb-g-meaning: #cdc5db;
      --vb-g-pos-bg: #2e2740; --vb-g-pos-fg: #b9a5ef;
      --vb-g-btn-bg: #2e2740; --vb-g-btn-fg: #b9a5ef;
      --vb-g-shadow: 0 6px 16px rgba(0, 0, 0, .35);
    }
    html[data-vb-theme="dark"] .vb-c5 {
      --vb-g-bg: #2b1a1f; --vb-g-border: #432a32;
      --vb-g-word: #dce5ec; --vb-g-phonetic: #a89299; --vb-g-meaning: #dcc4ca;
      --vb-g-pos-bg: #3d232b; --vb-g-pos-fg: #ec9aae;
      --vb-g-btn-bg: #3d232b; --vb-g-btn-fg: #ec9aae;
      --vb-g-shadow: 0 6px 16px rgba(0, 0, 0, .35);
    }
    html[data-vb-theme="dark"] .vb-row-tag { color: var(--vb-g-pos-fg); background: var(--vb-g-pos-bg); }

    html[data-vb-theme="dark"] .overlay { background: rgba(0, 0, 0, .72); }
    html[data-vb-theme="dark"] .overlay-content {
      background: #1a2128; box-shadow: 0 20px 50px rgba(0, 0, 0, .6);
    }
    html[data-vb-theme="dark"] .overlay-note-area { background: #161c22; border-top-color: #2a333c; }
    html[data-vb-theme="dark"] .word-main h2 { color: #dce5ec; }
    html[data-vb-theme="dark"] .word-main .phonetic { color: #94a3ae; }
    html[data-vb-theme="dark"] .pos-badge { background: #1d3a4d; color: #7cc4f0; }
    html[data-vb-theme="dark"] .meaning-large { color: #e3e7ea; }
    html[data-vb-theme="dark"] .example-box { background: #1b242c; border-left-color: #5aaee6; color: #dbe2e8; }
    html[data-vb-theme="dark"] .example-box .cn { color: #a7b2bb; }
    html[data-vb-theme="dark"] .root-box { background: #2a2417; color: #dcc27a; }
    html[data-vb-theme="dark"] .extra-box { color: #c7d0d8; }
    html[data-vb-theme="dark"] .lecture-note { background: #1b2229; border-color: #2f3943; color: #e3e7ea; }
    html[data-vb-theme="dark"] .lecture-note:focus { border-color: #5aaee6; }
    html[data-vb-theme="dark"] .close-btn { color: #93a0aa; }

    html[data-vb-theme="dark"] .page-switch {
      background: #1b2229; border-color: #303a44; color: #dce5ec;
      box-shadow: 0 8px 22px rgba(0, 0, 0, .4);
    }
    html[data-vb-theme="dark"] .page-switch:hover { color: #5aaee6; }
    html[data-vb-theme="dark"] .mobile-chapter-nav { background: #171e24; box-shadow: 0 2px 12px rgba(0, 0, 0, .45); }
    html[data-vb-theme="dark"] .mobile-chapter-select {
      background: #212a32; border-color: #303a44; color: #dce5ec;
    }
    html[data-vb-theme="dark"] .brush-toolbar { background: #1e262e; box-shadow: 0 4px 15px rgba(0, 0, 0, .5); }
    html[data-vb-theme="dark"] .brush-toolbar button:hover { background: #2b3540; }
    html[data-vb-theme="dark"] .toggle-draw-btn { background: #242e37; color: #c7d0d8; }
    html[data-vb-theme="dark"] .toggle-draw-btn.active { background: #c0392b; color: #fff; }

    html[data-vb-theme="dark"] .main::-webkit-scrollbar-track,
    html[data-vb-theme="dark"] .sidebar::-webkit-scrollbar-track,
    html[data-vb-theme="dark"] .overlay-scroll::-webkit-scrollbar-track { background: #1a2128; }
    html[data-vb-theme="dark"] .main::-webkit-scrollbar-thumb,
    html[data-vb-theme="dark"] .sidebar::-webkit-scrollbar-thumb,
    html[data-vb-theme="dark"] .overlay-scroll::-webkit-scrollbar-thumb { background: #3a4650; }
    html[data-vb-theme="dark"] .main::-webkit-scrollbar-thumb:hover,
    html[data-vb-theme="dark"] .sidebar::-webkit-scrollbar-thumb:hover,
    html[data-vb-theme="dark"] .overlay-scroll::-webkit-scrollbar-thumb:hover { background: #4a5763; }
    html[data-vb-theme="dark"] .main,
    html[data-vb-theme="dark"] .sidebar,
    html[data-vb-theme="dark"] .overlay-scroll { scrollbar-color: #3a4650 #1a2128; }

    html[data-vb-theme="dark"] .vb-progress-meta { color: #94a3ae; }
    html[data-vb-theme="dark"] .vb-progress-meta strong { color: #dce5ec; }
    html[data-vb-theme="dark"] .vb-progress-track { background: #2a343d; }
    html[data-vb-theme="dark"] .vb-filter button { background: #1b2229; border-color: #303a44; color: #c1cbd4; }
    html[data-vb-theme="dark"] .vb-filter button span { color: #8b98a3; }
    html[data-vb-theme="dark"] .vb-filter button:hover { border-color: #5aaee6; color: #7cc4f0; }
    html[data-vb-theme="dark"] .vb-filter button.active { background: #2f7ab0; border-color: #2f7ab0; color: #fff; }
    html[data-vb-theme="dark"] .vb-filter button.active span { color: rgba(255, 255, 255, .85); }

    html[data-vb-theme="dark"] .vb-panel {
      background: #1a2128; color: #e3e7ea; box-shadow: 0 18px 45px rgba(0, 0, 0, .6);
    }
    html[data-vb-theme="dark"] .vb-head { border-bottom-color: #2a333c; }
    html[data-vb-theme="dark"] .vb-head strong { color: #dce5ec; }
    html[data-vb-theme="dark"] .vb-sub { color: #94a3ae; }
    html[data-vb-theme="dark"] .vb-head button { color: #93a0aa; }
    html[data-vb-theme="dark"] .vb-head button:hover { background: #242e37; color: #e3e7ea; }
    html[data-vb-theme="dark"] .vb-tools { border-bottom-color: #2a333c; color: #aab6bf; }
    html[data-vb-theme="dark"] .vb-tools-note { color: #8b98a3; }
    html[data-vb-theme="dark"] .vb-mini { background: #1f282f; border-color: #303a44; color: #dce5ec; }
    html[data-vb-theme="dark"] .vb-row { border-bottom-color: #242d35; }
    html[data-vb-theme="dark"] .vb-row-word { color: #e3e7ea; }
    html[data-vb-theme="dark"] .vb-row-pos { color: #7cc4f0; }
    html[data-vb-theme="dark"] .vb-row-meaning { color: #aab6bf; }
    html[data-vb-theme="dark"] .vb-row-btn { background: #1f282f; border-color: #303a44; color: #93a0aa; }
    html[data-vb-theme="dark"] .vb-empty { color: #8b98a3; }
    html[data-vb-theme="dark"] .vb-foot { border-top-color: #2a333c; }
    html[data-vb-theme="dark"] .vb-grid-hint { color: #94a3ae; }
    html[data-vb-theme="dark"] .vb-toast { background: rgba(10, 14, 18, .95); color: #eef2f5; }
    html[data-vb-theme="dark"] .vb-launcher.on { background: #24313d; }
    html[data-vb-theme="dark"] .overlay-content .vb-cn-toggle {
      background: #202a33; border-color: #33404b; color: #b7c2cb;
    }
    html[data-vb-theme="dark"] .overlay-content .vb-cn-toggle:hover { border-color: #5aaee6; color: #7cc4f0; }
    html[data-vb-theme="dark"] .overlay-content .vb-cn-toggle.on {
      background: #1d3a4d; border-color: #5aaee6; color: #7cc4f0;
    }

    html[data-vb-theme="dark"] .vb-settings { background: rgba(6, 9, 12, .62); }
    html[data-vb-theme="dark"] .vb-settings-card {
      background: #1a2128; color: #e3e7ea; box-shadow: 0 24px 60px rgba(0, 0, 0, .6);
    }
    html[data-vb-theme="dark"] .vb-settings-head { border-bottom-color: #2a333c; }
    html[data-vb-theme="dark"] .vb-settings-head strong { color: #dce5ec; }
    html[data-vb-theme="dark"] .vb-settings-close { color: #93a0aa; }
    html[data-vb-theme="dark"] .vb-settings-close:hover { background: #242e37; color: #e3e7ea; }
    html[data-vb-theme="dark"] .vb-group-row { color: #e3e7ea; }
    html[data-vb-theme="dark"] .vb-grip { color: #7f8c99; }
    html[data-vb-theme="dark"] .vb-group-icon,
    html[data-vb-theme="dark"] .vb-group-name {
      background: #1f282f; border-color: #303a44; color: #dce5ec;
    }
    html[data-vb-theme="dark"] .vb-group-counts { color: #aab6bf; }
    html[data-vb-theme="dark"] .vb-group-eye { color: #93a0aa; }
    html[data-vb-theme="dark"] .vb-group-eye:hover { background: #242e37; color: #e3e7ea; }
    html[data-vb-theme="dark"] .vb-group-eye.on { color: #5aaee6; }
    html[data-vb-theme="dark"] .vb-group-del { color: #93a0aa; }
    html[data-vb-theme="dark"] .vb-settings-foot { border-top-color: #2a333c; }
    html[data-vb-theme="dark"] .vb-settings-note { color: #8b98a3; }
  `;

  function loadThemeMode() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return THEME_ORDER.includes(value) ? value : 'system';
    } catch (e) {
      return 'system';
    }
  }

  let themeMode = loadThemeMode();
  let themeBtn = null;

  function resolveTheme(mode) {
    return mode === 'system' ? (darkQuery.matches ? 'dark' : 'light') : mode;
  }

  function applyTheme() {
    const root = document.documentElement;
    if (!root) {
      setTimeout(applyTheme, 0);
      return;
    }
    const resolved = resolveTheme(themeMode);
    root.dataset.vbTheme = resolved;
    root.style.colorScheme = resolved;
  }

  function mountThemeStyle() {
    if (document.getElementById('vb-theme')) return;
    const host = document.head || document.documentElement;
    if (!host) {
      setTimeout(mountThemeStyle, 0);
      return;
    }
    const el = document.createElement('style');
    el.id = 'vb-theme';
    el.textContent = THEME_CSS;
    host.appendChild(el);
  }

  function updateThemeButton() {
    if (!themeBtn) return;
    themeBtn.textContent = THEME_LABELS[themeMode];
    themeBtn.title = `当前：${THEME_LABELS[themeMode]}，点击切换`;
    themeBtn.setAttribute('aria-label', `主题：${THEME_LABELS[themeMode]}`);
  }

  function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(themeMode) + 1) % THEME_ORDER.length];
    themeMode = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      // 隐私模式下只对当前页面生效
    }
    applyTheme();
    updateThemeButton();
  }

  if (typeof darkQuery.addEventListener === 'function') {
    darkQuery.addEventListener('change', () => {
      if (themeMode === 'system') applyTheme();
    });
  }

  // ===================== 共享数据 =====================
  // 沿用旧 key，重命名后老用户的已认识标记不会丢失
  const STORE_KEY = 'ielts-vocab-bag.v1';
  const CHAPTER_COUNT = 22;
  const TOTALS_KEY = 'ielts-vocab-tracker.totals.v1';

  function emptyStore() {
    return { version: 1, updatedAt: '', settings: {}, chapters: {} };
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyStore();
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return emptyStore();
      data.chapters = data.chapters && typeof data.chapters === 'object' ? data.chapters : {};
      data.settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
      data.settings.groups = normalizeGroups(data.settings.groups);
      return data;
    } catch (e) {
      console.warn('[词汇追踪] 读取本地数据失败', e);
      return emptyStore();
    }
  }

  function writeStore(data) {
    data.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[词汇追踪] 保存失败（可能是浏览器禁用了本地存储）', e);
    }
  }

  // 2026-11 的章节词数快照，仅在读不到站点缓存时兜底
  const DEFAULT_TOTALS = {
    1: 227, 2: 130, 3: 168, 4: 70, 5: 401, 6: 122, 7: 79, 8: 68,
    9: 175, 10: 135, 11: 91, 12: 172, 13: 132, 14: 139, 15: 135,
    16: 171, 17: 101, 18: 186, 19: 124, 20: 268, 21: 417, 22: 57,
  };

  function readTotals() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(TOTALS_KEY) || '{}') || {};
    } catch (e) {
      saved = {};
    }
    const counts = Object.assign({}, DEFAULT_TOTALS);
    if (saved.counts && typeof saved.counts === 'object') {
      Object.keys(saved.counts).forEach((id) => {
        const n = Number(saved.counts[id]);
        if (n > 0) counts[id] = n;
      });
    }
    return { cacheName: saved.cacheName || '', counts };
  }

  function writeTotals(cacheName, counts) {
    try {
      localStorage.setItem(TOTALS_KEY, JSON.stringify({
        cacheName,
        counts,
        savedAt: new Date().toISOString(),
      }));
    } catch (e) {
      // 本地存储不可用时继续用内存里的默认值
    }
  }

  function recordChapterTotal(chapterId, total) {
    if (!(total > 0)) return;
    const current = readTotals();
    if (current.counts[chapterId] === total) return;
    current.counts[chapterId] = total;
    writeTotals(current.cacheName, current.counts);
  }

  // 站点 service worker 会预缓存全部章节数据，优先从这里统计，避免额外下载
  async function syncTotalsFromCache() {
    if (!('caches' in window)) return false;
    let cacheName = '';
    try {
      const names = await caches.keys();
      cacheName = names.find((name) => name.indexOf('ielts-vocab-pwa-') === 0) || '';
    } catch (e) {
      return false;
    }
    if (!cacheName || readTotals().cacheName === cacheName) return false;

    let cache;
    try {
      cache = await caches.open(cacheName);
    } catch (e) {
      return false;
    }

    const counts = {};
    for (let id = 1; id <= CHAPTER_COUNT; id += 1) {
      const res = await cache.match(`/ielts-vocab/data-${id}.js`, { ignoreSearch: true });
      if (!res) return false;
      const text = await res.text();
      // 各章数据的引号风格不统一（单引号 / 双引号都有）
      const n = (text.match(/\bword\s*:\s*['"]/g) || []).length;
      if (!n) return false;
      counts[id] = n;
    }
    writeTotals(cacheName, counts);
    return true;
  }

  // 进度条组件：卡片页与刷词页共用同一套结构与样式
  const PROGRESS_CSS = `
    .vb-progress { margin-top: 10px; }
    .vb-progress-meta {
      display: flex; align-items: baseline; justify-content: space-between;
      margin-bottom: 4px; font-size: .72rem; color: #7f8c8d;
    }
    .vb-progress-meta strong { font-weight: 700; color: #2c3e50; }
    .vb-progress-track {
      height: 6px; border-radius: 999px; overflow: hidden;
      background: #e3e8ec;
    }
    .vb-progress-fill {
      height: 100%; width: 0; border-radius: 999px;
      background: linear-gradient(90deg, #3498db, #27ae60);
      transition: width .3s ease;
    }
    .vb-mini {
      border: 1px solid #dfe6e9; background: #fff; color: #2c3e50;
      font-family: inherit; font-size: .74rem; line-height: 1.4;
      padding: 3px 8px; border-radius: 7px; cursor: pointer;
    }
    .vb-mini:hover { border-color: #3498db; color: #3498db; }
    .vb-toast {
      position: fixed; left: 50%; bottom: 108px; z-index: 1100;
      transform: translate(-50%, 12px);
      max-width: 80vw; padding: 9px 18px; border-radius: 20px;
      background: rgba(44, 62, 80, .92); color: #fff;
      font: .84rem/1.4 'Segoe UI', system-ui, sans-serif;
      opacity: 0; pointer-events: none; transition: opacity .22s, transform .22s;
    }
    .vb-toast.show { opacity: 1; transform: translate(-50%, 0); }
  `;

  function createProgressBar(label) {
    const root = document.createElement('div');
    root.className = 'vb-progress';
    root.innerHTML = `
      <div class="vb-progress-meta">
        <span>${label} <strong class="vb-progress-count">0 / 0</strong></span>
        <span class="vb-progress-pct">0%</span>
      </div>
      <div class="vb-progress-track"><div class="vb-progress-fill"></div></div>
    `;
    const countEl = root.querySelector('.vb-progress-count');
    const pctEl = root.querySelector('.vb-progress-pct');
    const fillEl = root.querySelector('.vb-progress-fill');

    return {
      el: root,
      update(known, total) {
        root.style.display = total > 0 ? '' : 'none';
        if (!total) {
          countEl.textContent = '0 / 0';
          pctEl.textContent = '0%';
          fillEl.style.width = '0%';
          return;
        }
        const pct = (known / total) * 100;
        countEl.textContent = `${known} / ${total}`;
        pctEl.textContent = `${Math.round(pct * 10) / 10}%`;
        fillEl.style.width = `${pct.toFixed(2)}%`;
      },
    };
  }

  // ===================== 共享：提示与导入导出 =====================
  let toastEl = null;
  let toastTimer = null;

  function showToast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'vb-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function buildExportPayload(chapters, groups) {
    const titles = {};
    document.querySelectorAll('#mobileChapterSelect option').forEach((opt) => {
      if (opt.value) titles[opt.value] = opt.textContent.trim();
    });
    Object.keys(chapters).forEach((id) => {
      if (!titles[id]) titles[id] = `第 ${id} 章`;
    });
    return {
      app: 'ielts-vocab-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      chapterTitles: titles,
      settings: { groups: groups || DEFAULT_GROUPS.map((group) => Object.assign({}, group)) },
      chapters,
    };
  }

  function downloadStoreJson(chapters, groups) {
    const json = JSON.stringify(buildExportPayload(chapters, groups), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `ielts-vocab-tracker-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('掌握度状态已导出');
  }

  async function copyStoreJson(chapters, groups) {
    const json = JSON.stringify(buildExportPayload(chapters, groups), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      showToast('已复制到剪贴板');
    } catch (e) {
      showToast('复制失败，请改用「导出」');
    }
  }

  function parseImportPayload(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      showToast('导入失败：不是有效的 JSON');
      return null;
    }
    if (!data || typeof data !== 'object' || !data.chapters || typeof data.chapters !== 'object') {
      showToast('导入失败：缺少 chapters 字段');
      return null;
    }
    const rawGroups = data.settings && Array.isArray(data.settings.groups) ? data.settings.groups : [];
    return { chapters: data.chapters, groups: rawGroups };
  }

  // ===================== 分组配置 =====================
  const GROUP_COLOR_COUNT = 6;
  const DEFAULT_GROUPS = [
    { id: 'pron', name: '发音', icon: '🎤', visible: true, counts: false, color: 1 },
    { id: 'known', name: '认识', icon: '✓', visible: true, counts: true, color: 0 },
  ];

  function normalizeGroups(raw) {
    const list = [];
    const seen = new Set();
    (Array.isArray(raw) ? raw : []).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const id = String(item.id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      const color = Number.isInteger(item.color)
        ? ((item.color % GROUP_COLOR_COUNT) + GROUP_COLOR_COUNT) % GROUP_COLOR_COUNT
        : list.length % GROUP_COLOR_COUNT;
      list.push({
        id,
        name: String(item.name || '').trim().slice(0, 12) || '分组',
        icon: String(item.icon || '').trim().slice(0, 4) || '●',
        visible: item.visible !== false,
        counts: !!item.counts,
        color,
      });
    });
    if (!list.length) return DEFAULT_GROUPS.map((group) => Object.assign({}, group));
    if (!seen.has('known')) {
      list.push(Object.assign({}, DEFAULT_GROUPS.find((group) => group.id === 'known')));
    }
    return list;
  }

  // 旧版本没有 group 字段，用 status 兼容
  function entryGroup(entry) {
    if (!entry) return '';
    if (entry.group) return entry.group;
    return entry.status === 'pron' ? 'pron' : 'known';
  }

  function mergeChapters(target, source) {
    let added = 0;
    Object.keys(source).forEach((chapterId) => {
      const words = source[chapterId];
      if (!words || typeof words !== 'object') return;
      if (!target[chapterId]) target[chapterId] = {};
      Object.keys(words).forEach((key) => {
        const value = words[key];
        if (!value || typeof value !== 'object') return;
        if (target[chapterId][key]) return;
        target[chapterId][key] = {
          word: String(value.word || key),
          pos: String(value.pos || ''),
          meaning: String(value.meaning || ''),
          addedAt: value.addedAt || new Date().toISOString(),
          group: entryGroup(value),
        };
        added += 1;
      });
    });
    return added;
  }

  function pickJsonFile(onPayload) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) {
        input.remove();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const payload = parseImportPayload(String(reader.result || ''));
        if (payload) onPayload(payload);
        input.remove();
      };
      reader.readAsText(file);
    });
    input.click();
  }

  // 只在词汇卡片页启用，避免影响站点其它页面
  const isHandoutPage = /\/ielts-vocab\/handout\.html$/i.test(location.pathname);
  if (isHandoutPage) {
    mountThemeStyle();
    applyTheme();
  }

  // ===================== 页面功能 =====================
  function bootHandout() {
    const grid = document.getElementById('cardGrid');
    if (!grid) return;

    // 入口不是 handout.html 时（例如站点改版）在这里补上主题
    if (!document.getElementById('vb-theme')) {
      mountThemeStyle();
      applyTheme();
    }

    // ===================== 数据 =====================
    let store = readStore();
    // 每次打开页面都从“全部”开始，筛选只影响当前浏览
    let currentFilter = 'all';

    function getChapterId() {
      const active = document.querySelector('.sidebar button.active[data-chapter]');
      if (active) return active.dataset.chapter;
      const select = document.getElementById('mobileChapterSelect');
      if (select && select.value) return select.value;
      const title = document.getElementById('chapterTitle');
      const match = (title ? title.textContent : '').match(/第\s*(\d+)\s*章/);
      return match ? match[1] : '1';
    }

    function getBag(chapterId) {
      return store.chapters[chapterId] || {};
    }

    function bagCount(chapterId) {
      return Object.keys(getBag(chapterId)).length;
    }

    function chapterTitle(chapterId) {
      const btn = document.querySelector(`.sidebar button[data-chapter="${chapterId}"]`);
      if (btn) return btn.textContent.trim();
      const title = document.getElementById('chapterTitle');
      return title ? title.textContent.trim() : `第 ${chapterId} 章`;
    }

    // ===================== 样式 =====================
    const style = document.createElement('style');
    style.id = 'vb-style';
    style.textContent = `
      ${PROGRESS_CSS}
      .vb-topbar {
        position: sticky; top: 0; z-index: 5;
        margin: -8px 0 12px; padding: 8px 0 10px;
        background: var(--bg, #f5f7fa);
      }
      .vb-filter { display: flex; flex-wrap: wrap; gap: 8px; }
      .vb-filter .vb-settings-btn { margin-left: auto; }
      .vb-filter .vb-theme-btn { margin-left: 0; }
      .vb-filter button {
        display: inline-flex; align-items: center; gap: 6px;
        border: 1px solid #dfe6e9; background: #fff; color: #576574;
        border-radius: 999px; padding: 7px 14px;
        font-size: .85rem; font-family: inherit; cursor: pointer;
        transition: border-color .2s, color .2s, background .2s;
      }
      .vb-filter button span { font-size: .73rem; font-weight: 700; color: #95a5a6; }
      .vb-filter button:hover { border-color: #3498db; color: #3498db; }
      .vb-filter button.active { background: #3498db; border-color: #3498db; color: #fff; }
      .vb-filter button.active span { color: rgba(255, 255, 255, .85); }

      .card .vb-gbtn { opacity: .3; }
      .card:hover .vb-gbtn { opacity: 1; }
      .card .vb-gbtn.on { opacity: 1; background: var(--vb-g-btn-bg, #d5f0de); color: var(--vb-g-btn-fg, #1e8449); }
      .vb-hidden { display: none !important; }

      .overlay-content .vb-cn-toggle {
        align-self: center;
        border: 1px solid #dfe6e9; background: #f8fafb; color: #576574;
        font: inherit; font-size: .75rem; line-height: 1.4;
        padding: 3px 10px; border-radius: 999px;
        cursor: pointer; flex-shrink: 0; transition: .2s;
      }
      .overlay-content .vb-cn-toggle:hover { border-color: #3498db; color: #3498db; }
      .overlay-content .vb-cn-toggle.on { background: #eaf2f8; border-color: #3498db; color: #3498db; }
      .overlay-content.vb-cn-hidden .meaning-large,
      .overlay-content.vb-cn-hidden .example-box .cn,
      .overlay-content.vb-cn-hidden .root-box,
      .overlay-content.vb-cn-hidden .extra-box { display: none; }

      .vb-c0 {
        --vb-g-bg: #edf0f2; --vb-g-border: #dfe4e8;
        --vb-g-word: #7a8791; --vb-g-phonetic: #9aa5ad; --vb-g-meaning: #8b98a2;
        --vb-g-pos-bg: #e1e6ea; --vb-g-pos-fg: #8b99a3;
        --vb-g-btn-bg: #d5f0de; --vb-g-btn-fg: #1e8449;
        --vb-g-shadow: 0 6px 16px rgba(0, 0, 0, .07);
      }
      .vb-c1 {
        --vb-g-bg: #fdf8ec; --vb-g-border: #efe4cc;
        --vb-g-word: #2c3e50; --vb-g-phonetic: #7f8c8d; --vb-g-meaning: #576574;
        --vb-g-pos-bg: #f7ecd5; --vb-g-pos-fg: #a2793a;
        --vb-g-btn-bg: #fcf0d4; --vb-g-btn-fg: #b7791f;
        --vb-g-shadow: 0 6px 16px rgba(183, 121, 31, .12);
      }
      .vb-c2 {
        --vb-g-bg: #edf4fd; --vb-g-border: #d3e3f7;
        --vb-g-word: #2c3e50; --vb-g-phonetic: #7b8a97; --vb-g-meaning: #5b6b78;
        --vb-g-pos-bg: #dbe9f9; --vb-g-pos-fg: #2f7ab0;
        --vb-g-btn-bg: #dbe9f9; --vb-g-btn-fg: #2471a3;
        --vb-g-shadow: 0 6px 16px rgba(47, 122, 176, .12);
      }
      .vb-c3 {
        --vb-g-bg: #eef8f0; --vb-g-border: #d5ecd9;
        --vb-g-word: #2c3e50; --vb-g-phonetic: #7b8a97; --vb-g-meaning: #5b6b78;
        --vb-g-pos-bg: #dcf0e1; --vb-g-pos-fg: #26834e;
        --vb-g-btn-bg: #d5f0de; --vb-g-btn-fg: #1e8449;
        --vb-g-shadow: 0 6px 16px rgba(30, 132, 73, .12);
      }
      .vb-c4 {
        --vb-g-bg: #f4f0fb; --vb-g-border: #e4dcf5;
        --vb-g-word: #2c3e50; --vb-g-phonetic: #7b8a97; --vb-g-meaning: #5b6b78;
        --vb-g-pos-bg: #e9e2f8; --vb-g-pos-fg: #6c46b8;
        --vb-g-btn-bg: #e9e2f8; --vb-g-btn-fg: #6c46b8;
        --vb-g-shadow: 0 6px 16px rgba(108, 70, 184, .12);
      }
      .vb-c5 {
        --vb-g-bg: #fdf0f2; --vb-g-border: #f6d9df;
        --vb-g-word: #2c3e50; --vb-g-phonetic: #7b8a97; --vb-g-meaning: #5b6b78;
        --vb-g-pos-bg: #fae0e5; --vb-g-pos-fg: #b03a55;
        --vb-g-btn-bg: #fae0e5; --vb-g-btn-fg: #b03a55;
        --vb-g-shadow: 0 6px 16px rgba(176, 58, 85, .12);
      }

      html .card.vb-grouped { background: var(--vb-g-bg); border-color: var(--vb-g-border); box-shadow: none; }
      html .card.vb-grouped:hover { box-shadow: var(--vb-g-shadow); }
      html .card.vb-grouped .word { color: var(--vb-g-word); }
      html .card.vb-grouped .phonetic { color: var(--vb-g-phonetic); }
      html .card.vb-grouped .pos { background: var(--vb-g-pos-bg); color: var(--vb-g-pos-fg); }
      html .card.vb-grouped .meaning { color: var(--vb-g-meaning); }
      .card.vb-grouped.vb-c0 .tag { filter: grayscale(1); opacity: .7; }

      .vb-grid-hint {
        grid-column: 1 / -1;
        padding: 40px 16px;
        text-align: center;
        color: #7f8c8d;
        font-size: .9rem;
        line-height: 1.7;
      }
      .vb-launcher {
        position: fixed; right: 96px; bottom: 28px; z-index: 900;
        width: 54px; height: 54px; border: none; border-radius: 50%;
        background: #3498db; color: #fff; font-size: 1.5rem; cursor: grab;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 6px 20px rgba(52, 152, 219, .35);
        transition: transform .2s, background .2s;
        touch-action: none;
        user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
      }
      .vb-launcher:hover { transform: scale(1.07); }
      .vb-launcher.on { background: #2c3e50; }
      .vb-launcher.dragging { cursor: grabbing; transform: none; transition: background .2s; }
      .vb-launcher.dragging:hover { transform: none; }
      .vb-badge {
        position: absolute; top: -4px; right: -4px;
        min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
        background: #e74c3c; color: #fff;
        font: 700 11px/20px 'Segoe UI', system-ui, sans-serif;
        text-align: center;
      }
      .vb-panel {
        position: fixed; top: 76px; right: 20px; bottom: 96px; width: 344px;
        max-width: calc(100vw - 32px); z-index: 900;
        display: flex; flex-direction: column; overflow: hidden;
        background: #fff; border-radius: 14px;
        box-shadow: 0 18px 45px rgba(44, 62, 80, .22);
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #2d3436;
        opacity: 0; pointer-events: none;
        transform: translateX(calc(100% + 40px));
        transition: transform .25s ease, opacity .25s ease;
      }
      .vb-panel.open { opacity: 1; pointer-events: auto; transform: none; }
      .vb-head {
        display: flex; align-items: center; gap: 8px;
        padding: 14px 16px 10px;
        border-bottom: 1px solid #eef1f4;
      }
      .vb-head strong { font-size: 1rem; color: #2c3e50; }
      .vb-sub {
        flex: 1; min-width: 0;
        font-size: .75rem; color: #7f8c8d;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .vb-head button {
        border: none; background: none; color: #95a5a6;
        font-size: 1.1rem; cursor: pointer; padding: 2px 4px; border-radius: 6px;
      }
      .vb-head button:hover { background: #f0f3f5; color: #2c3e50; }
      .vb-tools {
        display: flex; align-items: center; gap: 6px;
        padding: 10px 16px; border-bottom: 1px solid #eef1f4;
        font-size: .78rem; color: #576574;
      }
      .vb-tools-note { flex: 1; color: #95a5a6; font-size: .72rem; }
      .vb-list { flex: 1; overflow-y: auto; padding: 6px 10px; }
      .vb-row {
        display: flex; align-items: flex-start; gap: 8px;
        padding: 9px 6px; border-bottom: 1px dashed #f1f4f6;
      }
      .vb-row:last-child { border-bottom: none; }
      .vb-row-main { flex: 1; min-width: 0; }
      .vb-row-word { font-weight: 700; color: #2c3e50; font-size: .92rem; }
      .vb-row-pos { font-weight: 500; color: #3498db; font-size: .7rem; margin-left: 4px; }
      .vb-row-tag {
        margin-left: 6px; padding: 1px 7px; border-radius: 999px;
        background: var(--vb-g-pos-bg); color: var(--vb-g-pos-fg);
        font-size: .68rem; font-weight: 600; white-space: nowrap;
      }
      .vb-row-meaning {
        color: #576574; font-size: .78rem; line-height: 1.45; margin-top: 2px;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .vb-row-btn {
        border: 1px solid #dfe6e9; background: #fff; color: #7f8c8d;
        font-size: .72rem; padding: 3px 8px; border-radius: 7px;
        cursor: pointer; flex-shrink: 0;
      }
      .vb-row-btn:hover { border-color: #e74c3c; color: #e74c3c; }
      .vb-empty {
        padding: 34px 18px; text-align: center;
        color: #95a5a6; font-size: .82rem; line-height: 1.8;
      }
      .vb-foot {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 16px 14px; border-top: 1px solid #eef1f4;
      }
      .vb-foot .vb-mini { flex: 1; padding: 6px 8px; }
      .vb-foot .vb-danger:hover { border-color: #e74c3c; color: #e74c3c; }

      .vb-settings {
        position: fixed; inset: 0; z-index: 950;
        display: none; align-items: center; justify-content: center;
        padding: 20px; background: rgba(24, 32, 40, .45);
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #2d3436;
      }
      .vb-settings.open { display: flex; }
      .vb-settings-card {
        width: 460px; max-width: 100%; max-height: min(80vh, 640px);
        display: flex; flex-direction: column; overflow: hidden;
        background: #fff; border-radius: 16px;
        box-shadow: 0 24px 60px rgba(44, 62, 80, .28);
      }
      .vb-settings-head {
        display: flex; align-items: center; gap: 8px;
        padding: 14px 16px 10px; border-bottom: 1px solid #eef1f4;
      }
      .vb-settings-head strong { flex: 1; font-size: 1rem; color: #2c3e50; }
      .vb-settings-close {
        border: none; background: none; color: #95a5a6;
        font-size: 1.1rem; cursor: pointer; padding: 2px 4px; border-radius: 6px;
      }
      .vb-settings-close:hover { background: #f0f3f5; color: #2c3e50; }
      .vb-settings-list { flex: 1; overflow-y: auto; padding: 10px 12px; }
      .vb-group-row {
        display: flex; align-items: center; gap: 8px;
        padding: 7px 8px; margin-bottom: 6px;
        border: 1px solid var(--vb-g-border); border-radius: 10px;
        background: var(--vb-g-bg); color: #2c3e50;
      }
      .vb-group-row.off { opacity: .55; }
      .vb-group-row.dragging { opacity: .75; box-shadow: 0 8px 20px rgba(0, 0, 0, .16); }
      .vb-grip {
        border: none; background: transparent; color: #b0b8bf;
        font-size: .9rem; line-height: 1; padding: 2px 3px;
        letter-spacing: -2px; cursor: grab; touch-action: none;
      }
      .vb-grip:active { cursor: grabbing; }
      .vb-group-icon, .vb-group-name {
        border: 1px solid #dfe6e9; background: #fff; border-radius: 8px;
        font: inherit; font-size: .85rem; color: #2c3e50; padding: 5px 8px;
      }
      .vb-group-icon { width: 46px; text-align: center; }
      .vb-group-name { flex: 1; min-width: 0; }
      .vb-group-counts {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: .75rem; color: #576574; white-space: nowrap; cursor: pointer;
      }
      .vb-group-counts input { margin: 0; }
      .vb-group-eye, .vb-group-del {
        border: none; background: transparent; color: #95a5a6;
        font-size: .95rem; line-height: 1; padding: 4px 5px;
        border-radius: 8px; cursor: pointer;
      }
      .vb-group-eye:hover { background: rgba(52, 152, 219, .1); color: #3498db; }
      .vb-group-eye.on { color: #3498db; }
      .vb-group-del:hover:not(:disabled) { background: rgba(231, 76, 60, .1); color: #e74c3c; }
      .vb-group-del:disabled { opacity: .3; cursor: not-allowed; }
      .vb-settings-foot {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 16px 14px; border-top: 1px solid #eef1f4;
      }
      .vb-settings-note { font-size: .72rem; color: #95a5a6; line-height: 1.4; }

      @media (max-width: 768px) {
        .vb-topbar { top: 56px; margin-top: 0; }
        .vb-filter .vb-theme-btn { margin-left: 0; }
        .vb-launcher { right: 76px; bottom: 18px; width: 48px; height: 48px; font-size: 1.3rem; }
        .vb-panel { top: 64px; right: 8px; left: 8px; bottom: 84px; width: auto; max-width: none; }
        .vb-settings { padding: 12px; align-items: flex-start; }
        .vb-settings-card { margin-top: 48px; max-height: calc(100vh - 96px); }
      }
    `;
    document.head.appendChild(style);

    // ===================== 筛选栏 =====================
    const filterBar = document.createElement('div');
    filterBar.className = 'vb-filter';
    filterBar.id = 'vbFilter';

    themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'vb-theme-btn';
    themeBtn.addEventListener('click', cycleTheme);

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'vb-settings-btn';
    settingsBtn.id = 'vbSettingsBtn';
    settingsBtn.textContent = '⚙';
    settingsBtn.title = '分组设置';

    filterBar.append(settingsBtn, themeBtn);
    updateThemeButton();

    function getGroups() {
      if (!Array.isArray(store.settings.groups)) {
        store.settings.groups = normalizeGroups(null);
      }
      return store.settings.groups;
    }

    function activeGroups() {
      return getGroups().filter((group) => group.visible);
    }

    function findGroup(id) {
      return getGroups().find((group) => group.id === id) || null;
    }

    function renderFilterBar() {
      filterBar.querySelectorAll('button[data-filter]').forEach((btn) => btn.remove());
      const frag = document.createDocumentFragment();
      const addChip = (filterId, label) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.filter = filterId;
        btn.innerHTML = `${label} <span>0</span>`;
        frag.appendChild(btn);
      };
      addChip('all', '全部');
      addChip('unknown', '不认识');
      activeGroups().forEach((group) => {
        addChip(group.id, `${esc(group.icon)} ${esc(group.name)}`);
      });
      filterBar.insertBefore(frag, settingsBtn);
      filterBar.querySelectorAll('button[data-filter]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === currentFilter);
      });
    }

    renderFilterBar();

    const progress = createProgressBar('本单元已认识');

    const topbar = document.createElement('div');
    topbar.className = 'vb-topbar';
    topbar.append(filterBar, progress.el);
    grid.parentNode.insertBefore(topbar, grid);

    // ===================== 面板 =====================
    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'vb-launcher';
    launcher.title = '已标记的单词（掌握度追踪）· 可拖动位置';
    launcher.innerHTML = '✅<span class="vb-badge" id="vbBadge">0</span>';

    const panel = document.createElement('div');
    panel.className = 'vb-panel';
    panel.innerHTML = `
      <div class="vb-head">
        <strong>✅ 已标记</strong>
        <span class="vb-sub" id="vbSub"></span>
        <button type="button" id="vbClose" title="关闭">✕</button>
      </div>
      <div class="vb-tools">
        <span class="vb-tools-note">颜色 = 分组 · 分组可在 ⚙ 中配置 · 导出/导入见刷词页</span>
      </div>
      <div class="vb-list" id="vbList"></div>
      <div class="vb-foot">
        <button type="button" class="vb-mini vb-danger" id="vbClear">清空本章</button>
      </div>
    `;

    document.body.append(launcher, panel);

    // ===================== 分组设置 =====================
    const settingsModal = document.createElement('div');
    settingsModal.className = 'vb-settings';
    settingsModal.innerHTML = `
      <div class="vb-settings-card" role="dialog" aria-label="分组设置">
        <div class="vb-settings-head">
          <strong>⚙ 分组设置</strong>
          <button type="button" class="vb-settings-close" id="vbSettingsClose" title="关闭">✕</button>
        </div>
        <div class="vb-settings-list" id="vbGroupList"></div>
        <div class="vb-settings-foot">
          <button type="button" class="vb-mini" id="vbAddGroup">＋ 新建分组</button>
          <span class="vb-settings-note">拖动 ⋮⋮ 调整顺序 · 卡片按钮与筛选同步</span>
        </div>
      </div>
    `;
    document.body.appendChild(settingsModal);

    const groupList = settingsModal.querySelector('#vbGroupList');

    function renderGroupSettings() {
      groupList.innerHTML = getGroups().map((group) => `
        <div class="vb-group-row vb-c${group.color}${group.visible ? '' : ' off'}" data-id="${esc(group.id)}">
          <button type="button" class="vb-grip" title="拖动排序">⋮⋮</button>
          <input class="vb-group-icon" value="${esc(group.icon)}" maxlength="4" title="图标（emoji 或字符）" aria-label="图标">
          <input class="vb-group-name" value="${esc(group.name)}" maxlength="12" title="分组名称" aria-label="分组名称">
          <label class="vb-group-counts" title="计入「已认识」进度"><input type="checkbox" ${group.counts ? 'checked' : ''}> 计入</label>
          <button type="button" class="vb-group-eye ${group.visible ? 'on' : ''}" title="${group.visible ? '隐藏分组' : '显示分组'}">👁</button>
          <button type="button" class="vb-group-del" title="删除分组" ${group.id === 'known' ? 'disabled' : ''}>🗑</button>
        </div>
      `).join('');
    }

    function saveGroups() {
      writeStore(store);
    }

    function refreshGroupUI() {
      if (currentFilter !== 'all' && currentFilter !== 'unknown') {
        const group = findGroup(currentFilter);
        if (!group || !group.visible) currentFilter = 'all';
      }
      renderFilterBar();
      applyFilter();
      renderPanel();
    }

    function openSettings() {
      renderGroupSettings();
      settingsModal.classList.add('open');
    }

    function closeSettings() {
      settingsModal.classList.remove('open');
    }

    settingsBtn.addEventListener('click', openSettings);
    settingsModal.querySelector('#vbSettingsClose').addEventListener('click', closeSettings);
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettings();
    });

    settingsModal.querySelector('#vbAddGroup').addEventListener('click', () => {
      const groups = getGroups();
      const used = new Set(groups.map((group) => group.color));
      let color = groups.length % GROUP_COLOR_COUNT;
      for (let i = 0; i < GROUP_COLOR_COUNT; i += 1) {
        if (!used.has(i)) { color = i; break; }
      }
      groups.push({
        id: `g${Date.now().toString(36)}`,
        name: '新分组',
        icon: '⭐',
        visible: true,
        counts: false,
        color,
      });
      saveGroups();
      renderGroupSettings();
      refreshGroupUI();
      showToast('已新建分组');
    });

    groupList.addEventListener('input', (e) => {
      const row = e.target.closest('.vb-group-row');
      const group = row && findGroup(row.dataset.id);
      if (!group) return;
      if (e.target.classList.contains('vb-group-icon')) {
        group.icon = e.target.value.trim().slice(0, 4) || '●';
      } else if (e.target.classList.contains('vb-group-name')) {
        group.name = e.target.value.trim().slice(0, 12) || '分组';
      } else {
        return;
      }
      saveGroups();
      refreshGroupUI();
    });

    groupList.addEventListener('change', (e) => {
      const row = e.target.closest('.vb-group-row');
      const group = row && findGroup(row.dataset.id);
      if (!group) return;
      if (e.target.matches('.vb-group-counts input')) {
        group.counts = e.target.checked;
        saveGroups();
        applyFilter();
        renderPanel();
      } else if (e.target.classList.contains('vb-group-icon')) {
        e.target.value = group.icon;
      } else if (e.target.classList.contains('vb-group-name')) {
        e.target.value = group.name;
      }
    });

    groupList.addEventListener('click', (e) => {
      const row = e.target.closest('.vb-group-row');
      const group = row && findGroup(row.dataset.id);
      if (!group) return;
      if (e.target.closest('.vb-group-eye')) {
        group.visible = !group.visible;
        saveGroups();
        renderGroupSettings();
        refreshGroupUI();
      } else if (e.target.closest('.vb-group-del')) {
        deleteGroup(group);
      }
    });

    function deleteGroup(group) {
      if (group.id === 'known') return;
      let marks = 0;
      Object.keys(store.chapters).forEach((chapterId) => {
        const bag = store.chapters[chapterId];
        Object.keys(bag).forEach((word) => {
          if (entryGroup(bag[word]) === group.id) marks += 1;
        });
      });
      const suffix = marks ? `该组的 ${marks} 个标记也会清除。` : '';
      if (!confirm(`删除分组「${group.name}」？${suffix}`)) return;
      Object.keys(store.chapters).forEach((chapterId) => {
        const bag = store.chapters[chapterId];
        Object.keys(bag).forEach((word) => {
          if (entryGroup(bag[word]) === group.id) delete bag[word];
        });
      });
      store.settings.groups = getGroups().filter((item) => item.id !== group.id);
      saveGroups();
      renderGroupSettings();
      refreshGroupUI();
      showToast('分组已删除');
    }

    // 拖动排序：行顺序同时决定卡片按钮与筛选条顺序
    let groupDragRow = null;

    function commitGroupOrder() {
      const order = Array.from(groupList.querySelectorAll('.vb-group-row')).map((row) => row.dataset.id);
      getGroups().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      saveGroups();
      refreshGroupUI();
    }

    groupList.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('.vb-grip');
      if (!grip) return;
      groupDragRow = grip.closest('.vb-group-row');
      groupDragRow.classList.add('dragging');
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    groupList.addEventListener('pointermove', (e) => {
      if (!groupDragRow) return;
      e.preventDefault();
      const rows = Array.from(groupList.querySelectorAll('.vb-group-row')).filter((row) => row !== groupDragRow);
      const y = e.clientY;
      let before = null;
      for (let i = 0; i < rows.length; i += 1) {
        const rect = rows[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) { before = rows[i]; break; }
      }
      if (before) groupList.insertBefore(groupDragRow, before);
      else groupList.appendChild(groupDragRow);
    });

    function endGroupDrag() {
      if (!groupDragRow) return;
      groupDragRow.classList.remove('dragging');
      groupDragRow = null;
      commitGroupOrder();
    }

    groupList.addEventListener('pointerup', endGroupDrag);
    groupList.addEventListener('pointercancel', endGroupDrag);

    // ===================== 启动按钮拖动 =====================
    const LAUNCHER_POS_KEY = 'ielts-vocab-tracker.launcher.v1';
    const DRAG_THRESHOLD = 5;

    function readLauncherPos() {
      try {
        const pos = JSON.parse(localStorage.getItem(LAUNCHER_POS_KEY) || 'null');
        if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') return null;
        return pos;
      } catch (e) {
        return null;
      }
    }

    function writeLauncherPos(left, top) {
      try {
        localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify({ left, top }));
      } catch (e) {
        // 隐私模式或配额用尽时忽略，按钮仍可拖动
      }
    }

    function clampLauncher(left, top) {
      const size = launcher.offsetWidth || 54;
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - size - margin);
      const maxTop = Math.max(margin, window.innerHeight - size - margin);
      return {
        left: Math.min(Math.max(left, margin), maxLeft),
        top: Math.min(Math.max(top, margin), maxTop),
      };
    }

    function placeLauncher(left, top) {
      const pos = clampLauncher(left, top);
      launcher.style.left = pos.left + 'px';
      launcher.style.top = pos.top + 'px';
      launcher.style.right = 'auto';
      launcher.style.bottom = 'auto';
      return pos;
    }

    const savedPos = readLauncherPos();
    if (savedPos) placeLauncher(savedPos.left, savedPos.top);

    let dragState = null;
    let lastDragEndAt = 0;

    launcher.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = launcher.getBoundingClientRect();
      dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false,
      };
      launcher.setPointerCapture(e.pointerId);
    });

    launcher.addEventListener('pointermove', (e) => {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!dragState.moved) {
        dragState.moved = true;
        launcher.classList.add('dragging');
      }
      e.preventDefault();
      placeLauncher(e.clientX - dragState.offsetX, e.clientY - dragState.offsetY);
    });

    function endLauncherDrag(e) {
      if (!dragState || (e && e.pointerId !== dragState.pointerId)) return;
      const moved = dragState.moved;
      dragState = null;
      launcher.classList.remove('dragging');
      if (e && launcher.hasPointerCapture(e.pointerId)) launcher.releasePointerCapture(e.pointerId);
      if (!moved) return;
      lastDragEndAt = Date.now();
      const pos = clampLauncher(
        parseFloat(launcher.style.left) || 0,
        parseFloat(launcher.style.top) || 0
      );
      writeLauncherPos(pos.left, pos.top);
    }

    launcher.addEventListener('pointerup', endLauncherDrag);
    launcher.addEventListener('pointercancel', endLauncherDrag);
    window.addEventListener('resize', () => {
      if (launcher.style.left) placeLauncher(parseFloat(launcher.style.left), parseFloat(launcher.style.top));
    });

    const els = {
      badge: launcher.querySelector('#vbBadge'),
      sub: panel.querySelector('#vbSub'),
      list: panel.querySelector('#vbList'),
      close: panel.querySelector('#vbClose'),
      clearBtn: panel.querySelector('#vbClear'),
    };

    function esc(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function setPanelOpen(open) {
      panel.classList.toggle('open', open);
      launcher.classList.toggle('on', open);
    }

    launcher.addEventListener('click', () => {
      if (Date.now() - lastDragEndAt < 300) return;
      setPanelOpen(!panel.classList.contains('open'));
    });
    els.close.addEventListener('click', () => setPanelOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (settingsModal.classList.contains('open')) {
        closeSettings();
      } else if (panel.classList.contains('open')) {
        setPanelOpen(false);
      }
    });

    // ===================== 筛选逻辑 =====================
    function setFilter(filter) {
      currentFilter = filter;
      filterBar.querySelectorAll('button[data-filter]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
      });
      applyFilter();
    }

    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (btn) setFilter(btn.dataset.filter);
    });

    function cardWord(card) {
      const el = card.querySelector('.word');
      return el ? el.textContent.trim() : '';
    }

    function ensureGroupButtons(card, activeGroupId) {
      const actions = card.querySelector('.card-actions');
      if (!actions) return;
      const groups = activeGroups();
      const existing = new Map();
      actions.querySelectorAll('.vb-gbtn').forEach((btn) => existing.set(btn.dataset.group, btn));
      existing.forEach((btn, id) => {
        if (!groups.some((group) => group.id === id)) {
          btn.remove();
          existing.delete(id);
        }
      });
      groups.forEach((group) => {
        let btn = existing.get(group.id);
        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.dataset.group = group.id;
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setWordGroup(card, group.id);
          });
          existing.set(group.id, btn);
        }
        btn.className = `btn-icon vb-gbtn vb-c${group.color}`;
        btn.textContent = group.icon || '●';
        btn.classList.toggle('on', activeGroupId === group.id);
        btn.title = activeGroupId === group.id ? `取消“${group.name}”标记` : `标记为${group.name}`;
        actions.appendChild(btn);
      });
    }

    function setWordGroup(card, groupId) {
      const group = findGroup(groupId);
      if (!group) return;
      const word = cardWord(card);
      if (!word) return;
      const chapterId = getChapterId();
      if (!store.chapters[chapterId]) store.chapters[chapterId] = {};
      const bag = store.chapters[chapterId];
      const prev = bag[word];
      const current = prev ? entryGroup(prev) : '';

      if (current === groupId) {
        delete bag[word];
        showToast(`已取消标记：${word}`);
      } else {
        const posEl = card.querySelector('.pos');
        const meaningEl = card.querySelector('.meaning');
        bag[word] = {
          word,
          pos: (prev && prev.pos) || (posEl ? posEl.textContent.trim() : ''),
          meaning: (prev && prev.meaning) || (meaningEl ? meaningEl.textContent.trim() : ''),
          addedAt: (prev && prev.addedAt) || new Date().toISOString(),
          group: groupId,
        };
        showToast(`已标记为${group.name}：${word}`);
      }
      writeStore(store);
      applyFilter();
      renderPanel();
    }

    function updateFilterCounts(total, perGroup, visibleMarked) {
      filterBar.querySelectorAll('button[data-filter]').forEach((btn) => {
        const filter = btn.dataset.filter;
        let count;
        if (filter === 'all') count = total;
        else if (filter === 'unknown') count = Math.max(0, total - visibleMarked);
        else count = perGroup[filter] || 0;
        btn.querySelector('span').textContent = count;
      });
    }

    function updateGridHint(total, perGroup, visibleMarked) {
      let hint = grid.querySelector('.vb-grid-hint');
      let text = '';
      if (currentFilter === 'unknown' && total > 0 && visibleMarked === total) {
        text = '本章所有单词都已标记。切换上方筛选可以查看它们。';
      } else if (currentFilter !== 'all' && currentFilter !== 'unknown') {
        const group = findGroup(currentFilter);
        if (group && !perGroup[group.id]) {
          text = `本章还没有「${group.name}」的单词。切到「全部」后可点卡片上的 ${group.icon}。`;
        }
      }

      if (!text) {
        if (hint) hint.remove();
        return;
      }
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'vb-grid-hint';
        grid.appendChild(hint);
      }
      hint.textContent = text;
    }

    function applyFilter() {
      const chapterId = getChapterId();
      const bag = getBag(chapterId);
      const cards = Array.from(grid.querySelectorAll('.card'));
      const groups = activeGroups();
      const byId = new Map(groups.map((group) => [group.id, group]));
      const perGroup = {};
      groups.forEach((group) => { perGroup[group.id] = 0; });
      let visibleMarked = 0;

      cards.forEach((card) => {
        const word = cardWord(card);
        if (!word) return;
        const entry = bag[word];
        const groupId = entry ? entryGroup(entry) : '';
        const group = byId.get(groupId) || null;
        if (group) {
          perGroup[group.id] += 1;
          visibleMarked += 1;
        }
        card.classList.remove('vb-grouped');
        for (let i = 0; i < GROUP_COLOR_COUNT; i += 1) card.classList.remove(`vb-c${i}`);
        if (group) card.classList.add('vb-grouped', `vb-c${group.color}`);
        card.classList.toggle('vb-hidden',
          (currentFilter === 'unknown' && !!group)
          || (currentFilter !== 'all' && currentFilter !== 'unknown' && (!group || groupId !== currentFilter)));
        ensureGroupButtons(card, group ? groupId : '');
      });

      const knownCount = groups
        .filter((group) => group.counts)
        .reduce((sum, group) => sum + (perGroup[group.id] || 0), 0);
      updateFilterCounts(cards.length, perGroup, visibleMarked);
      progress.update(knownCount, cards.length);
      recordChapterTotal(chapterId, cards.length);
      updateGridHint(cards.length, perGroup, visibleMarked);
    }

    // ===================== 面板 =====================
    function renderPanel() {
      const chapterId = getChapterId();
      const bag = getBag(chapterId);
      const byId = new Map(activeGroups().map((group) => [group.id, group]));
      const entries = Object.values(bag)
        .map((entry) => ({ entry, group: byId.get(entryGroup(entry)) || null }))
        .filter((item) => !!item.group)
        .sort((a, b) => String(a.entry.addedAt || '').localeCompare(String(b.entry.addedAt || '')));

      els.sub.textContent = `${chapterTitle(chapterId)} · ${entries.length} 个已标记`;
      els.badge.textContent = entries.length;
      els.badge.style.display = entries.length ? '' : 'none';

      if (entries.length === 0) {
        els.list.innerHTML = '<div class="vb-empty">本章还没有标记任何单词。<br>点卡片上的分组按钮即可标记。</div>';
        return;
      }

      els.list.innerHTML = entries.map(({ entry, group }) => `
        <div class="vb-row">
          <div class="vb-row-main">
            <div class="vb-row-word">${esc(entry.word)}${entry.pos ? `<span class="vb-row-pos">${esc(entry.pos)}</span>` : ''}${group.id === 'known' ? '' : `<span class="vb-row-tag vb-c${group.color}">${esc(group.icon)} ${esc(group.name)}</span>`}</div>
            ${entry.meaning ? `<div class="vb-row-meaning">${esc(entry.meaning)}</div>` : ''}
          </div>
          <button type="button" class="vb-row-btn" data-vb-remove="${esc(entry.word)}">取消</button>
        </div>
      `).join('');
    }

    els.list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-vb-remove]');
      if (!btn) return;
      const word = btn.getAttribute('data-vb-remove');
      const chapterId = getChapterId();
      const bag = getBag(chapterId);
      if (bag[word]) {
        delete bag[word];
        writeStore(store);
        applyFilter();
        renderPanel();
        showToast(`已取消标记：${word}`);
      }
    });

    // ===================== 清空本章 =====================
    els.clearBtn.addEventListener('click', () => {
      const chapterId = getChapterId();
      const count = bagCount(chapterId);
      if (!count) {
        showToast('本章还没有标记任何单词');
        return;
      }
      if (!confirm(`确定清空「${chapterTitle(chapterId)}」的 ${count} 个标记？`)) return;
      delete store.chapters[chapterId];
      writeStore(store);
      applyFilter();
      renderPanel();
      showToast('已清空本章标记');
    });

    // ===================== 详情页：默认隐藏中文 =====================
    let showCn = false;

    function applyCnVisibility() {
      const content = document.getElementById('overlayContent');
      if (!content) return;
      content.classList.toggle('vb-cn-hidden', !showCn);
      const btn = content.querySelector('.vb-cn-toggle');
      if (btn) {
        btn.textContent = showCn ? '隐藏中文' : '显示中文';
        btn.title = showCn ? '隐藏释义与例句翻译' : '显示释义与例句翻译';
        btn.classList.toggle('on', showCn);
      }
    }

    function decorateOverlay() {
      const content = document.getElementById('overlayContent');
      if (!content) return;
      const main = content.querySelector('.word-main');
      if (!main) return;
      let btn = content.querySelector('.vb-cn-toggle');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vb-cn-toggle';
        btn.addEventListener('click', () => {
          showCn = !showCn;
          applyCnVisibility();
        });
        main.appendChild(btn);
      }
      // 每打开一张词卡都从“中文隐藏”开始
      showCn = false;
      applyCnVisibility();
    }

    // ===================== 监听页面变化 =====================
    // 页面每次切换章节 / 上传图片都会重绘 cardGrid，重绘后重新套用标记与筛选
    let scheduled = false;
    function scheduleApply() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        applyFilter();
      }, 0);
    }

    const gridObserver = new MutationObserver(scheduleApply);
    gridObserver.observe(grid, { childList: true });

    const title = document.getElementById('chapterTitle');
    if (title) {
      const titleObserver = new MutationObserver(() => {
        renderPanel();
        scheduleApply();
      });
      titleObserver.observe(title, { childList: true, characterData: true, subtree: true });
    }

    const overlayContent = document.getElementById('overlayContent');
    if (overlayContent) {
      const overlayObserver = new MutationObserver(decorateOverlay);
      overlayObserver.observe(overlayContent, { childList: true });
    }

    renderPanel();
    applyFilter();
  }

  // ===================== 刷词页：全站进度 =====================
  const OVERVIEW_CSS = `
    .vb-overall {
      margin-top: 10px; padding: 10px 16px 12px;
      background: var(--card-bg, #fff);
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, .03);
    }
    .vb-overall .vb-progress { margin-top: 0; }
    .vb-overall .vb-progress-meta { color: var(--text-secondary, #7f8c8d); }
    .vb-overall .vb-progress-meta strong { color: var(--text, #2c3e50); }
    .vb-overall .vb-progress-track { height: 8px; background: var(--border, #e3e8ec); }
    .vb-overall .vb-progress-fill { background: linear-gradient(90deg, var(--accent, #3b82f6), #8b5cf6); }
    .vb-overall-actions {
      display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
      margin-top: 10px; padding-top: 8px;
      border-top: 1px solid var(--border, #eef1f4);
    }
    .vb-overall-note { flex: 1; min-width: 150px; font-size: .72rem; color: var(--text-secondary, #7f8c8d); }
    .vb-overall .vb-mini {
      background: transparent;
      border-color: var(--border, #dfe6e9);
      color: var(--text-secondary, #576574);
    }
    .vb-overall .vb-mini:hover { border-color: var(--accent, #3498db); color: var(--accent, #3498db); }
  `;

  function bootOverview() {
    const anchor = document.querySelector('.stats');
    if (!anchor || document.getElementById('vbOverall')) return;

    if (!document.getElementById('vb-style')) {
      const style = document.createElement('style');
      style.id = 'vb-style';
      style.textContent = PROGRESS_CSS + OVERVIEW_CSS;
      document.head.appendChild(style);
    }

    const bar = createProgressBar('全部章节已认识');
    const wrap = document.createElement('div');
    wrap.className = 'vb-overall';
    wrap.id = 'vbOverall';
    wrap.appendChild(bar.el);

    const actions = document.createElement('div');
    actions.className = 'vb-overall-actions';
    actions.innerHTML = `
      <span class="vb-overall-note">数据只存本机 · 换设备用 JSON 迁移</span>
      <button type="button" class="vb-mini" id="vbExport" title="导出全部章节的标记状态">导出</button>
      <button type="button" class="vb-mini" id="vbImport" title="从 JSON 文件合并导入">导入</button>
      <button type="button" class="vb-mini" id="vbCopy" title="复制全部章节的 JSON">复制 JSON</button>
    `;
    wrap.appendChild(actions);
    anchor.insertAdjacentElement('afterend', wrap);

    function render() {
      const data = readStore();
      const chapters = data.chapters;
      const counts = readTotals().counts;
      const counting = new Set(
        data.settings.groups
          .filter((group) => group.visible && group.counts)
          .map((group) => group.id)
      );
      let total = 0;
      let known = 0;
      for (let id = 1; id <= CHAPTER_COUNT; id += 1) {
        const chapterTotal = counts[id] || 0;
        total += chapterTotal;
        const bag = chapters[id] || {};
        let chapterKnown = 0;
        Object.keys(bag).forEach((word) => {
          if (counting.has(entryGroup(bag[word]))) chapterKnown += 1;
        });
        known += Math.min(chapterKnown, chapterTotal || chapterKnown);
      }
      bar.update(known, total);
    }

    actions.addEventListener('click', (e) => {
      const btn = e.target.closest('button[id]');
      if (!btn) return;
      if (btn.id === 'vbExport') {
        const data = readStore();
        downloadStoreJson(data.chapters, data.settings.groups);
      } else if (btn.id === 'vbCopy') {
        const data = readStore();
        copyStoreJson(data.chapters, data.settings.groups);
      } else if (btn.id === 'vbImport') {
        pickJsonFile((payload) => {
          const data = readStore();
          const knownIds = new Set(data.settings.groups.map((group) => group.id));
          const extra = normalizeGroups(payload.groups).filter((group) => !knownIds.has(group.id));
          data.settings.groups = normalizeGroups(data.settings.groups.concat(extra));
          const added = mergeChapters(data.chapters, payload.chapters);
          writeStore(data);
          render();
          showToast(added ? `导入完成，新增 ${added} 个单词` : '导入完成，没有新增单词');
        });
      }
    });

    render();
    syncTotalsFromCache().then((changed) => {
      if (changed) render();
    });
    window.addEventListener('storage', (e) => {
      if (e.key === STORE_KEY || e.key === TOTALS_KEY) render();
    });
  }

  function boot() {
    if (document.getElementById('cardGrid')) {
      bootHandout();
    } else if (/\/ielts-vocab\/(index\.html)?$/i.test(location.pathname)) {
      bootOverview();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
