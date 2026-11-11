// ==UserScript==
// @name         雅思词汇掌握度助手 · IELTS Vocab Tracker
// @namespace    https://www.leonwang.cc/ielts-vocab/
// @version      2.6.0
// @description  为 leonwang.cc 雅思词汇卡片增加“认识”标记、三档筛选、本单元与全站熟悉度进度条、深色主题；单词详情默认隐藏中文、只留英文例句，状态可导出 / 导入 JSON。
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

    html[data-vb-theme="dark"] .card.vb-known { background: #202830; border-color: #2c3640; box-shadow: none; }
    html[data-vb-theme="dark"] .card.vb-known:hover { box-shadow: 0 6px 16px rgba(0, 0, 0, .35); }
    html[data-vb-theme="dark"] .card.vb-known .word { color: #8a97a2; }
    html[data-vb-theme="dark"] .card.vb-known .phonetic { color: #7f8c96; }
    html[data-vb-theme="dark"] .card.vb-known .pos { background: #273038; color: #7f8c96; }
    html[data-vb-theme="dark"] .card.vb-known .meaning { color: #8d99a3; }
    html[data-vb-theme="dark"] .card .vb-mark-btn.on { background: #1e3f2c; color: #5fd394; }

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

  function buildExportPayload(chapters) {
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
      chapters,
    };
  }

  function downloadStoreJson(chapters) {
    const json = JSON.stringify(buildExportPayload(chapters), null, 2);
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

  async function copyStoreJson(chapters) {
    const json = JSON.stringify(buildExportPayload(chapters), null, 2);
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
    return data.chapters;
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
        };
        added += 1;
      });
    });
    return added;
  }

  function pickJsonFile(onChapters) {
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
        const chapters = parseImportPayload(String(reader.result || ''));
        if (chapters) onChapters(chapters);
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
      .vb-filter .vb-theme-btn { margin-left: auto; }
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

      .card .vb-mark-btn { opacity: .3; }
      .card:hover .vb-mark-btn { opacity: 1; }
      .card .vb-mark-btn.on { opacity: 1; background: #d5f0de; color: #1e8449; }
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

      .card.vb-known { background: #edf0f2; border-color: #dfe4e8; box-shadow: none; }
      .card.vb-known:hover { box-shadow: 0 6px 16px rgba(0, 0, 0, .07); }
      .card.vb-known .word { color: #7a8791; }
      .card.vb-known .phonetic { color: #9aa5ad; }
      .card.vb-known .pos { background: #e1e6ea; color: #8b99a3; }
      .card.vb-known .tag { filter: grayscale(1); opacity: .7; }
      .card.vb-known .meaning { color: #8b98a2; }

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
      @media (max-width: 768px) {
        .vb-topbar { top: 56px; margin-top: 0; }
        .vb-filter .vb-theme-btn { margin-left: 0; }
        .vb-launcher { right: 76px; bottom: 18px; width: 48px; height: 48px; font-size: 1.3rem; }
        .vb-panel { top: 64px; right: 8px; left: 8px; bottom: 84px; width: auto; max-width: none; }
      }
    `;
    document.head.appendChild(style);

    // ===================== 筛选栏 =====================
    const filterBar = document.createElement('div');
    filterBar.className = 'vb-filter';
    filterBar.id = 'vbFilter';
    filterBar.innerHTML = `
      <button type="button" data-filter="all" class="active">全部 <span>0</span></button>
      <button type="button" data-filter="unknown">不认识 <span>0</span></button>
      <button type="button" data-filter="known">认识 <span>0</span></button>
    `;

    themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'vb-theme-btn';
    themeBtn.addEventListener('click', cycleTheme);
    filterBar.appendChild(themeBtn);
    updateThemeButton();

    const progress = createProgressBar('本单元已认识');

    const topbar = document.createElement('div');
    topbar.className = 'vb-topbar';
    topbar.append(filterBar, progress.el);
    grid.parentNode.insertBefore(topbar, grid);

    // ===================== 面板 =====================
    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'vb-launcher';
    launcher.title = '已认识的单词（掌握度追踪）· 可拖动位置';
    launcher.innerHTML = '✅<span class="vb-badge" id="vbBadge">0</span>';

    const panel = document.createElement('div');
    panel.className = 'vb-panel';
    panel.innerHTML = `
      <div class="vb-head">
        <strong>✅ 已认识</strong>
        <span class="vb-sub" id="vbSub"></span>
        <button type="button" id="vbClose" title="关闭">✕</button>
      </div>
      <div class="vb-tools">
        <span class="vb-tools-note">已认识的词在各筛选中灰显 · 导出/导入见刷词页</span>
      </div>
      <div class="vb-list" id="vbList"></div>
      <div class="vb-foot">
        <button type="button" class="vb-mini vb-danger" id="vbClear">清空本章</button>
      </div>
    `;

    document.body.append(launcher, panel);

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
      if (e.key === 'Escape' && panel.classList.contains('open')) setPanelOpen(false);
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

    function ensureMarkButton(card, isKnown) {
      const actions = card.querySelector('.card-actions');
      if (!actions) return;
      let btn = actions.querySelector('.vb-mark-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-icon vb-mark-btn';
        btn.textContent = '✓';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleKnown(card);
        });
        actions.appendChild(btn);
      }
      btn.classList.toggle('on', isKnown);
      btn.title = isKnown ? '取消“认识”标记' : '标记为认识（卡片灰显，不再重点展示）';
    }

    function toggleKnown(card) {
      const word = cardWord(card);
      if (!word) return;
      const chapterId = getChapterId();
      if (!store.chapters[chapterId]) store.chapters[chapterId] = {};
      const bag = store.chapters[chapterId];

      if (bag[word]) {
        delete bag[word];
        showToast(`已取消标记：${word}`);
      } else {
        const posEl = card.querySelector('.pos');
        const meaningEl = card.querySelector('.meaning');
        bag[word] = {
          word,
          pos: posEl ? posEl.textContent.trim() : '',
          meaning: meaningEl ? meaningEl.textContent.trim() : '',
          addedAt: new Date().toISOString(),
        };
        showToast(`已标记为认识：${word}`);
      }
      writeStore(store);
      applyFilter();
      renderPanel();
    }

    function updateFilterCounts(total, knownCount) {
      filterBar.querySelectorAll('button[data-filter]').forEach((btn) => {
        const filter = btn.dataset.filter;
        const count = filter === 'all' ? total : filter === 'unknown' ? total - knownCount : knownCount;
        btn.querySelector('span').textContent = count;
      });
    }

    function updateGridHint(total, knownCount) {
      let hint = grid.querySelector('.vb-grid-hint');
      let text = '';
      if (currentFilter === 'unknown' && total > 0 && total - knownCount === 0) {
        text = '本章所有单词都已标记为认识。切换上方筛选可以查看它们。';
      } else if (currentFilter === 'known' && knownCount === 0) {
        text = '本章还没有标记任何单词。切到「全部」后可点卡片上的 ✓ 标记为认识。';
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
      let knownCount = 0;

      cards.forEach((card) => {
        const word = cardWord(card);
        if (!word) return;
        const isKnown = !!bag[word];
        if (isKnown) knownCount += 1;
        card.classList.toggle('vb-known', isKnown);
        card.classList.toggle('vb-hidden',
          (currentFilter === 'unknown' && isKnown) || (currentFilter === 'known' && !isKnown));
        ensureMarkButton(card, isKnown);
      });

      updateFilterCounts(cards.length, knownCount);
      progress.update(knownCount, cards.length);
      recordChapterTotal(chapterId, cards.length);
      updateGridHint(cards.length, knownCount);
    }

    // ===================== 面板 =====================
    function renderPanel() {
      const chapterId = getChapterId();
      const bag = getBag(chapterId);
      const entries = Object.values(bag).sort((a, b) =>
        String(a.addedAt || '').localeCompare(String(b.addedAt || ''))
      );

      els.sub.textContent = `${chapterTitle(chapterId)} · ${entries.length} 个已认识`;
      els.badge.textContent = entries.length;
      els.badge.style.display = entries.length ? '' : 'none';

      if (entries.length === 0) {
        els.list.innerHTML = '<div class="vb-empty">本章还没有标记任何单词。<br>点卡片上的 ✓ 一键标记为认识。</div>';
        return;
      }

      els.list.innerHTML = entries.map((entry) => `
        <div class="vb-row">
          <div class="vb-row-main">
            <div class="vb-row-word">${esc(entry.word)}${entry.pos ? `<span class="vb-row-pos">${esc(entry.pos)}</span>` : ''}</div>
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
      if (!confirm(`确定清空「${chapterTitle(chapterId)}」的 ${count} 个“认识”标记？`)) return;
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
      <button type="button" class="vb-mini" id="vbExport" title="导出全部章节的已认识状态">导出</button>
      <button type="button" class="vb-mini" id="vbImport" title="从 JSON 文件合并导入">导入</button>
      <button type="button" class="vb-mini" id="vbCopy" title="复制全部章节的 JSON">复制 JSON</button>
    `;
    wrap.appendChild(actions);
    anchor.insertAdjacentElement('afterend', wrap);

    function render() {
      const chapters = readStore().chapters;
      const counts = readTotals().counts;
      let total = 0;
      let known = 0;
      for (let id = 1; id <= CHAPTER_COUNT; id += 1) {
        const chapterTotal = counts[id] || 0;
        total += chapterTotal;
        const bagSize = Object.keys(chapters[id] || {}).length;
        known += Math.min(bagSize, chapterTotal || bagSize);
      }
      bar.update(known, total);
    }

    actions.addEventListener('click', (e) => {
      const btn = e.target.closest('button[id]');
      if (!btn) return;
      if (btn.id === 'vbExport') {
        downloadStoreJson(readStore().chapters);
      } else if (btn.id === 'vbCopy') {
        copyStoreJson(readStore().chapters);
      } else if (btn.id === 'vbImport') {
        pickJsonFile((imported) => {
          const data = readStore();
          const added = mergeChapters(data.chapters, imported);
          if (added) {
            writeStore(data);
            render();
          }
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
