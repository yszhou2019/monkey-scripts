// ==UserScript==
// @name         小红书收藏批量取消助手（接口版）
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  在收藏页标注卡片，通过内部接口批量取消收藏（无需逐张打开弹窗）
// @author       you
// @match        https://www.xiaohongshu.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* =======================================================================
   * 原理（2026-11 实测）
   * 取消收藏接口：POST https://edith.xiaohongshu.com/api/sns/web/v1/note/uncollect
   *              body: {"note_ids":"<单个笔记ID>"}   （实测一次只能处理一个）
   * 请求头需要：X-s / X-t / X-S-Common / x-b3-traceid / x-xray-traceid
   * 实测结论：
   *   1. 签名只绑定 URL path，不绑定 body —— 一次捕获的签名头可复用于任意笔记ID
   *   2. X-t 时间戳服务端不校验时效 —— 签名可长期复用
   *   3. 必须 withCredentials=true，否则跨域不带 cookie，返回 code -101
   * 因此：只需真实点一次收藏按钮拿到签名，之后 1400+ 条全部走接口，不开弹窗。
   * ===================================================================== */

  const CFG = {
    API_HOST: 'https://edith.xiaohongshu.com',
    API_PATH: '/api/sns/web/v1/note/uncollect',

    // 速度档位：每条之间的随机间隔（毫秒）
    SPEED: {
      slow: [2500, 5000],
      normal: [1500, 3000],
      fast: [800, 1600],
    },
    DEFAULT_SPEED: 'normal',

    // 每处理多少条休息一次（降低风控概率）
    PAUSE_EVERY: 100,
    PAUSE_MS: 20000,

    // 风控相关
    BLOCK_CODES: [300031, 300012, 4601],   // 明确的风控码
    SIG_INVALID_CODES: [-1, -101, 406],    // 签名失效/未登录
    MAX_BLOCK_RETRY: 3,                    // 遇到风控最多冷却重试几次
    BLOCK_COOLDOWN_MS: 60000,              // 每次风控冷却时长

    // 打开笔记获取签名时的等待
    MODAL_WAIT_MS: 9000,
    SIG_WAIT_MS: 6000,
    SIG_MAX_AGE_MS: 24 * 60 * 60 * 1000,   // 签名缓存有效期（实测不校验时效，留 24h 保险）

    STORAGE_KEY: 'xhs_uncollect_marks',
    SIG_KEY: 'xhs_uncollect_sig',
    OBSERVE_DEBOUNCE_MS: 500,
  };

  const SEL = {
    card: 'section.note-item',
    cover: 'a.cover',
    modal: '.note-detail-mask',
    collectBtn: '.collect-wrapper',
    closeBtn: '.close-circle',
  };

  /* ===================== 工具 ===================== */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randSleep = (min, max) => sleep(min + Math.random() * (max - min));

  async function waitFor(fn, timeout, interval) {
    const start = Date.now();
    interval = interval || 250;
    while (Date.now() - start < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  /* ===================== 标注存储 ===================== */
  let marks = loadMarks();
  function loadMarks() {
    try { return new Set(JSON.parse(localStorage.getItem(CFG.STORAGE_KEY) || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveMarks() {
    localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify([...marks]));
  }

  function getNoteId(sec) {
    if (!sec) return null;
    const id = sec.getAttribute('data-note-id');
    if (id) return id;
    const a = sec.querySelector(SEL.cover) || sec.querySelector('a[href*="/explore/"]');
    if (!a) return null;
    const m = (a.getAttribute('href') || '').match(/\/([0-9a-f]{24})/i);
    return m ? m[1] : null;
  }

  function findCardById(id) {
    const all = document.querySelectorAll(SEL.card);
    for (let i = 0; i < all.length; i++) {
      if (getNoteId(all[i]) === id) return all[i];
    }
    return null;
  }

  /* ===================== 网络钩子：捕获页面真实请求的签名头 ===================== */
  let hookInstalled = false;
  let lastUncollectHeaders = null;

  function installHook() {
    if (hookInstalled) return;
    hookInstalled = true;
    const XO = window.XMLHttpRequest;
    const origOpen = XO.prototype.open;
    const origSet = XO.prototype.setRequestHeader;
    const origSend = XO.prototype.send;

    XO.prototype.open = function (m, u) {
      this.__m = m;
      this.__u = u;
      return origOpen.apply(this, arguments);
    };
    XO.prototype.setRequestHeader = function (k, v) {
      (this.__h = this.__h || {})[k] = String(v);
      return origSet.apply(this, arguments);
    };
    XO.prototype.send = function (b) {
      const self = this;
      self.addEventListener('readystatechange', function () {
        if (self.readyState === 4 && String(self.__u).indexOf('note/uncollect') !== -1) {
          lastUncollectHeaders = Object.assign({}, self.__h);
        }
      });
      return origSend.apply(this, arguments);
    };
  }

  /* ===================== 签名管理 ===================== */
  let sigHeaders = null;
  let sigAt = 0;

  // 实测 X-t 不校验时效，签名可跨刷新长期复用 → 存 localStorage，下次不用再开弹窗
  function persistSig() {
    try { localStorage.setItem(CFG.SIG_KEY, JSON.stringify({ h: sigHeaders, t: sigAt })); } catch (e) {}
  }
  function restoreSig() {
    try {
      const o = JSON.parse(localStorage.getItem(CFG.SIG_KEY) || 'null');
      if (o && o.h && o.h['X-s']) { sigHeaders = o.h; sigAt = o.t || 0; return true; }
    } catch (e) {}
    return false;
  }

  function sigValid() {
    return !!sigHeaders && (Date.now() - sigAt) < CFG.SIG_MAX_AGE_MS;
  }

  // 读取弹窗内收藏按钮的状态（图标 #collected=已收藏 / #collect=未收藏）
  function collectState() {
    const m = document.querySelector(SEL.modal);
    const u = m && m.querySelector(SEL.collectBtn + ' use');
    if (!u) return 'unknown';
    const h = (u.getAttribute('href') || u.getAttribute('xlink:href') || '');
    if (h.indexOf('#collected') !== -1) return 'collected';
    if (h.indexOf('#collect') !== -1) return 'uncollected';
    return 'unknown';
  }

  // 打开一张笔记并真实点击「取消收藏」，从而捕获签名头
  // 不需要滚动：el.click() 只要求元素在 DOM 里，不要求在视口内
  async function acquireSignature(id) {
    installHook();
    const sec = findCardById(id);
    if (!sec) return null;

    lastUncollectHeaders = null;
    const link = sec.querySelector(SEL.cover);
    (link || sec).click();

    // 等弹窗 + 收藏按钮 + 状态图标全部就绪（状态需要几秒才同步，必须等）
    const ready = await waitFor(() => {
      const m = document.querySelector(SEL.modal);
      if (!m) return null;
      const b = m.querySelector(SEL.collectBtn);
      if (!b) return null;
      return collectState() === 'unknown' ? null : b;
    }, CFG.MODAL_WAIT_MS, 300);
    if (!ready) { closeModal(); return null; }

    // 若状态是「未收藏」，先点一次变成已收藏（否则点下去是收藏，抓不到 uncollect）
    if (collectState() === 'uncollected') {
      ready.click();
      await waitFor(() => collectState() === 'collected', 8000, 300);
      // 收藏操作可能弹出「选择收藏夹」面板，按 ESC 关掉
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      await sleep(800);
    }

    // 现在再点一次，必定是「取消收藏」→ 捕获 uncollect 的签名头
    const btn = document.querySelector(SEL.modal + ' ' + SEL.collectBtn);
    if (btn) btn.click();
    const got = await waitFor(() => lastUncollectHeaders, CFG.SIG_WAIT_MS, 200);

    closeModal();
    await sleep(1500);

    if (got && got['X-s']) {
      sigHeaders = got;
      sigAt = Date.now();
      persistSig();
      return sigHeaders;
    }
    return null;
  }

  function closeModal() {
    const c = document.querySelector(SEL.closeBtn);
    if (c) c.click();
    setTimeout(() => {
      if (document.querySelector(SEL.modal)) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      }
    }, 1200);
  }

  // 用缓存的签名头直接调接口取消收藏
  function apiUncollect(id) {
    return new Promise((resolve) => {
      const x = new XMLHttpRequest();
      x.open('POST', CFG.API_HOST + CFG.API_PATH, true);
      x.withCredentials = true;   // 关键：跨域带 cookie，否则返回 -101 未登录
      Object.keys(sigHeaders).forEach((k) => {
        if (k.toLowerCase() === 'content-length') return;
        try { x.setRequestHeader(k, sigHeaders[k]); } catch (e) {}
      });
      x.onreadystatechange = () => { if (x.readyState === 4) resolve(x); };
      x.onerror = () => resolve(null);
      x.send(JSON.stringify({ note_ids: id }));
    });
  }

  function parseResp(x) {
    if (!x) return { code: null, raw: '网络错误' };
    const raw = String(x.responseText || '').slice(0, 140);
    if (x.status === 406) return { code: -1, raw: raw };
    try {
      const j = JSON.parse(x.responseText);
      return { code: j.code, msg: j.msg || '', raw: raw };
    } catch (e) {
      return { code: null, raw: raw || ('HTTP ' + x.status) };
    }
  }

  /* ===================== 角标 ===================== */
  function addBadge(sec, done) {
    let badge = sec.querySelector('.xhs-mark-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'xhs-mark-badge';
      badge.style.cssText =
        'position:absolute;top:6px;left:6px;z-index:999;width:22px;height:22px;' +
        'border-radius:50%;color:#fff;display:flex;align-items:center;' +
        'justify-content:center;font-size:14px;pointer-events:none;';
      if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
      sec.appendChild(badge);
    }
    badge.style.background = done ? '#52c41a' : '#ff2442';
    badge.textContent = done ? '✓' : '✓';
    sec.style.outline = done ? '3px solid #52c41a' : '3px solid #ff2442';
    sec.style.outlineOffset = '2px';
  }

  function removeBadge(sec) {
    const b = sec && sec.querySelector('.xhs-mark-badge');
    if (b) b.remove();
    if (sec) sec.style.outline = '';
  }

  function syncBadges(doneSet) {
    document.querySelectorAll('.xhs-mark-badge').forEach((b) => {
      const sec = b.closest(SEL.card);
      const id = sec && getNoteId(sec);
      if (!id || !marks.has(id)) removeBadge(sec);
    });
    marks.forEach((id) => {
      const sec = findCardById(id);
      if (sec) addBadge(sec, doneSet && doneSet.has(id));
    });
  }

  /* ===================== 面板 ===================== */
  const panel = document.createElement('div');
  panel.id = 'xhs-uncollect-panel';
  panel.style.cssText =
    'position:fixed;right:16px;bottom:16px;z-index:99999;background:#fff;' +
    'border:1px solid #ddd;border-radius:10px;padding:10px 12px;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.15);font-size:13px;line-height:1.8;' +
    'font-family:-apple-system,sans-serif;min-width:200px;';
  panel.innerHTML =
    '<div style="font-weight:700;margin-bottom:2px;">批量取消收藏 <span style="color:#999;font-weight:400;">v2 接口版</span></div>' +
    '<div class="xhs-info" style="color:#333;"></div>' +
    '<div class="xhs-status" style="color:#ff2442;font-size:12px;min-height:16px;"></div>' +
    '<div style="margin-top:4px;">' +
    '<button class="xhs-btn-mark"></button>' +
    '<button class="xhs-btn-run">开始执行</button>' +
    '</div>' +
    '<div style="margin-top:2px;">' +
    '<button class="xhs-btn-all">全选当前已加载</button>' +
    '<button class="xhs-btn-pause">暂停</button>' +
    '<button class="xhs-btn-clear">清空标注</button>' +
    '</div>' +
    '<div style="margin-top:4px;color:#666;font-size:12px;">' +
    '速度 <select class="xhs-speed">' +
    '<option value="slow">保守 2.5-5s</option>' +
    '<option value="normal" selected>标准 1.5-3s</option>' +
    '<option value="fast">激进 0.8-1.6s</option>' +
    '</select>' +
    '</div>' +
    '<div class="xhs-tip" style="margin-top:4px;color:#999;font-size:11px;line-height:1.5;"></div>';
  document.body.appendChild(panel);

  const infoEl = panel.querySelector('.xhs-info');
  const statusEl = panel.querySelector('.xhs-status');
  const tipEl = panel.querySelector('.xhs-tip');
  const btnMark = panel.querySelector('.xhs-btn-mark');
  const btnRun = panel.querySelector('.xhs-btn-run');
  const btnPause = panel.querySelector('.xhs-btn-pause');
  const btnClear = panel.querySelector('.xhs-btn-clear');
  const btnAll = panel.querySelector('.xhs-btn-all');
  const selSpeed = panel.querySelector('.xhs-speed');

  [btnMark, btnRun, btnPause, btnClear, btnAll].forEach((b) => {
    b.style.cssText = 'margin:3px 6px 0 0;padding:4px 10px;border:none;border-radius:6px;color:#fff;font-size:12px;';
  });
  selSpeed.style.cssText = 'font-size:12px;padding:1px 4px;';

  let markingMode = false;
  let running = false;
  let paused = false;
  let abortFlag = false;
  const doneSet = new Set();

  btnMark.onclick = () => { markingMode = !markingMode; updatePanel(); };
  btnRun.onclick = () => { if (!running) run(); };
  btnPause.onclick = () => {
    if (!running) return;
    paused = !paused;
    btnPause.textContent = paused ? '继续' : '暂停';
    if (!paused) statusEl.textContent = '';
  };
  btnAll.onclick = () => {
    if (running) return;
    let n = 0;
    document.querySelectorAll(SEL.card).forEach((sec) => {
      const id = getNoteId(sec);
      if (id && !marks.has(id)) { marks.add(id); n++; }
    });
    saveMarks(); syncBadges(doneSet); updatePanel();
    statusEl.textContent = '已全选 ' + n + ' 张（继续下滑可再全选追加）';
  };

  btnClear.onclick = () => {
    if (running) return;
    marks.clear(); doneSet.clear();
    saveMarks(); syncBadges(doneSet); updatePanel();
  };

  function updatePanel(status) {
    const loaded = document.querySelectorAll(SEL.card).length;
    infoEl.textContent =
      '已标注 ' + marks.size + ' 张' +
      (doneSet.size ? '（本次已完成 ' + doneSet.size + '）' : '') +
      (loaded ? ' | 已加载 ' + loaded : '');
    statusEl.textContent = status || '';
    btnMark.textContent = markingMode ? '退出标注模式' : '开启标注模式';
    btnMark.style.background = running ? '#ccc' : '#ff2442';
    btnRun.style.background = running || marks.size === 0 ? '#ccc' : '#ff2442';
    btnPause.style.background = running ? '#1890ff' : '#ccc';
    btnClear.style.background = running ? '#ccc' : '#888';
    btnAll.style.background = running ? '#ccc' : '#fa8c16';
    btnPause.textContent = paused ? '继续' : '暂停';
    btnMark.disabled = running;
    btnRun.disabled = running || marks.size === 0;
    btnPause.disabled = !running;
    btnClear.disabled = running;
    btnAll.disabled = running;
    tipEl.textContent = markingMode
      ? '标注模式：直接点卡片打标记，可边滚动边标。'
      : (sigValid()
        ? '签名已就绪：执行时全程不开弹窗，直接走接口。'
        : '首次执行需点开 1 张笔记取签名，之后不再需要。');
  }

  /* ===================== 标注模式点击拦截 ===================== */
  document.addEventListener('click', (e) => {
    if (!markingMode || running) return;
    const sec = e.target.closest && e.target.closest(SEL.card);
    if (!sec) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const id = getNoteId(sec);
    if (!id) return;
    if (marks.has(id)) { marks.delete(id); removeBadge(sec); }
    else { marks.add(id); addBadge(sec, false); }
    saveMarks();
    updatePanel();
  }, true);

  /* ===================== DOM 监听（仅在有标注时补角标） ===================== */
  let refreshTimer = null;
  new MutationObserver((muts) => {
    if (marks.size === 0) return;
    const own = (n) => n.nodeType === 1 && (n.classList.contains('xhs-mark-badge') || (n.closest && n.closest('#xhs-uncollect-panel')));
    const relevant = muts.some((m) => ![...m.addedNodes, ...m.removedNodes].every((n) => n.nodeType !== 1 || own(n)));
    if (!relevant || refreshTimer) return;
    refreshTimer = setTimeout(() => { refreshTimer = null; syncBadges(doneSet); }, CFG.OBSERVE_DEBOUNCE_MS);
  }).observe(document.body, { childList: true, subtree: true });

  /* ===================== 主流程 ===================== */
  async function run() {
    if (running || marks.size === 0) return;
    running = true;
    paused = false;
    abortFlag = false;
    markingMode = false;
    doneSet.clear();

    const speedKey = selSpeed.value || CFG.DEFAULT_SPEED;
    const [lo, hi] = CFG.SPEED[speedKey] || CFG.SPEED.normal;
    const queue = [...marks];

    let done = 0, failed = 0, blockedRetries = 0;
    const failedIds = [];

    updatePanel('准备中…');

    // 1) 确保拿到签名（只需真实点一次收藏按钮）
    if (!sigValid()) {
      updatePanel('正在获取接口签名（1 次真实点击）…');
      let got = false;
      for (let k = 0; k < queue.length && !got; k++) {
        const id = queue[k];
        if (!findCardById(id)) continue;
        sigHeaders = await acquireSignature(id);
        if (sigHeaders) {
          got = true;
          // 这一步本身已取消了这张卡片
          if (marks.has(id)) { marks.delete(id); saveMarks(); doneSet.add(id); done++; }
        }
        if (abortFlag) break;
      }
      if (!got) {
        running = false;
        updatePanel('签名获取失败');
        alert('无法获取接口签名。\n\n请在收藏列表页手动点开任意一篇笔记，点一下收藏（取消它），然后刷新页面重试。');
        return;
      }
    }

    // 2) 逐条走接口，不再打开弹窗
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (abortFlag) break;
      while (paused && !abortFlag) await sleep(300);
      if (abortFlag) break;
      if (!marks.has(id)) continue;   // 已经在签名获取阶段处理掉了

      updatePanel('执行中 ' + (i + 1) + '/' + queue.length + '（成功' + done + ' 失败' + failed + '）');

      let resp = parseResp(await apiUncollect(id));

      // 网络错误：直接重试一次（签名没问题，不用重开弹窗）
      if (resp.code === null) {
        await randSleep(1500, 3000);
        resp = parseResp(await apiUncollect(id));
      }

      // 签名失效 → 重新获取一次再试
      if (CFG.SIG_INVALID_CODES.indexOf(resp.code) !== -1) {
        updatePanel('签名失效，重新获取…');
        const fresh = await acquireSignature(id);
        if (fresh) {
          resp = parseResp(await apiUncollect(id));
        }
      }

      if (resp.code === 0) {
        blockedRetries = 0;
        marks.delete(id);
        doneSet.add(id);
        done++;
        saveMarks();
        const sec = findCardById(id);
        if (sec) addBadge(sec, true);
      } else if (CFG.BLOCK_CODES.indexOf(resp.code) !== -1) {
        // 命中风控：冷却后重试
        blockedRetries++;
        if (blockedRetries > CFG.MAX_BLOCK_RETRY) {
          failedIds.push(id);
          failed++;
          running = false;
          updatePanel('风控拦截，已停止');
          alert(
            '连续触发风控（code ' + resp.code + '），已停止。\n\n' +
            '已完成 ' + done + ' 张，剩余标注已保留。\n' +
            '建议：休息 30 分钟，把速度调成「保守」再继续。'
          );
          syncBadges(doneSet);
          return;
        }
        updatePanel('触发风控，冷却 ' + CFG.BLOCK_COOLDOWN_MS / 1000 + ' 秒…');
        await sleep(CFG.BLOCK_COOLDOWN_MS);
        i--;   // 冷却后重试这一条
        continue;
      } else {
        failedIds.push(id);
        failed++;
        console.warn('[xhs] 取消失败', id, resp.code, resp.raw);
      }

      // 分批休息
      if (done > 0 && done % CFG.PAUSE_EVERY === 0) {
        updatePanel('已完成 ' + done + ' 张，休息 ' + CFG.PAUSE_MS / 1000 + ' 秒降低风控…');
        await sleep(CFG.PAUSE_MS);
      }

      await randSleep(lo, hi);
    }

    running = false;
    syncBadges(doneSet);
    updatePanel('完成：成功 ' + done + '，失败 ' + failed);
    if (failed > 0) console.warn('[xhs] 失败列表', failedIds);
    alert(
      '批量取消完成\n成功 ' + done + ' 张，失败 ' + failed + ' 张' +
      (marks.size > 0 ? '\n剩余 ' + marks.size + ' 条标注（失败或已跳过），可再次执行' : '')
    );
  }

  /* ===================== 启动 ===================== */
  installHook();
  restoreSig();   // 有缓存签名就不用再开弹窗了
  updatePanel();
  syncBadges(doneSet);
  window.XHSUNC = {
    get marks() { return marks; },
    get sig() { return sigHeaders; },
    run: run,
    cfg: CFG,
  };
})();
