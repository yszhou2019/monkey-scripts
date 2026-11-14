// ==UserScript==
// @name         小红书批量操作助手 · XHS Batch Actions
// @namespace    https://github.com/yszhou2019/monkey-scripts
// @version      3.1.0
// @description  统一的小红书批量工具：一套标注交互 + 三种动作（批量导出文本[只读] / 批量取消收藏[写] / 批量取消点赞[写，占位]）。所有写操作执行前必须经对话框确认。
// @author       you
// @match        https://www.xiaohongshu.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* =======================================================================
   * 统一架构
   *   标注引擎（本节）  —— 一套：卡片打标、全选、角标、虚拟列表补标、限速、暂停
   *   动作（下面三节）  —— 只是「对队列做什么」不同：
   *     dump      只读：隐藏 iframe 读详情页 → 导出 Markdown / TXT / JSON / CSV
   *     uncollect 写  ：捕获签名头 → 调 note/uncollect 接口
   *     unlike    写  ：占位，暂不实现
   *
   * 安全：任何 write 动作在真正执行前统一过 confirm 门槛（见 runDispatch）。
   *
   * 实测要点（2026-11）：
   *   - 瀑布流是虚拟列表，滚动后卡片会被回收 → 标注时把 noteId + 带 token 的
   *     a.cover href 一起存下来，执行时不依赖卡片还在 DOM。
   *   - 详情页 /explore/{id}?xsec_token=... 渲染 #detail-title / #detail-desc 等，
   *     同源 iframe 可直接读 contentDocument。
   *   - uncollect 接口签名只绑定 URL path、不绑 body，X-t 不校验时效 →
   *     捕获一次真实请求头即可复用到任意 noteId；必须 withCredentials=true。
   * ===================================================================== */

  const CFG = {
    // 通用
    SPEED: {
      slow: [2200, 4000],
      normal: [1200, 2400],
      fast: [600, 1200],
    },
    DEFAULT_SPEED: 'normal',
    DEFAULT_ACTION: 'dump',
    DEFAULT_FORMAT: 'md',
    OBSERVE_DEBOUNCE_MS: 500,

    // 存储（统一版使用独立 key，不与旧独立版互通）
    MARKS_KEY: 'xhs_batch_marks_v1',
    RESULTS_KEY: 'xhs_batch_results_v1',
    SIG_KEY: 'xhs_batch_sig_v1',

    // dump：iframe
    IFRAME_WAIT_MS: 12000,
    SETTLE_MS: 350,
    RETRY_WAIT_MS: 1800,
    DUMP_PAUSE_EVERY: 60,
    DUMP_PAUSE_MS: 15000,

    // uncollect：接口
    API_HOST: 'https://edith.xiaohongshu.com',
    API_PATH: '/api/sns/web/v1/note/uncollect',
    BLOCK_CODES: [300031, 300012, 4601],
    SIG_INVALID_CODES: [-1, -101, 406],
    MAX_BLOCK_RETRY: 3,
    BLOCK_COOLDOWN_MS: 60000,
    MODAL_WAIT_MS: 9000,
    SIG_WAIT_MS: 6000,
    SIG_MAX_AGE_MS: 24 * 60 * 60 * 1000,
    WRITE_PAUSE_EVERY: 100,
    WRITE_PAUSE_MS: 20000,
  };

  const SEL = {
    card: 'section.note-item',
    cover: 'a.cover',
    cardTitle: '.title',
    // 详情（弹窗 / iframe 通用）
    dTitle: '#detail-title',
    dDesc: '#detail-desc',
    dTag: '#detail-desc a.tag',
    dAuthor: '.author-wrapper .author, .author-container .author, .username',
    dDate: '.date',
    // uncollect 专用
    modal: '.note-detail-mask',
    collectBtn: '.collect-wrapper',
    closeBtn: '.close-circle',
  };

  const ACTIONS = {
    dump: {
      label: '批量导出文本',
      short: '导出',
      write: false,
      implemented: true,
      tip: '只读：用隐藏 iframe 抓标题与正文，不改任何数据。',
    },
    uncollect: {
      label: '批量取消收藏',
      short: '取消收藏',
      write: true,
      implemented: true,
      tip: '写操作：会真实移除收藏、不可撤销，执行前会弹确认框。',
    },
    unlike: {
      label: '批量取消点赞',
      short: '取消点赞',
      write: true,
      implemented: false,       // PLACEHOLDER，见 runUnlike
      tip: '占位：批量取消点赞暂未实现，仅保留入口与确认流程。',
    },
  };

  /* ===================== 工具 ===================== */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randSleep = (min, max) => sleep(min + Math.random() * (max - min));

  async function waitFor(fn, timeout, interval) {
    const start = Date.now();
    interval = interval || 250;
    while (Date.now() - start < timeout) {
      let v;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  function cleanText(s) {
    return String(s || '')
      .replace(/\t/g, '')
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.replace(/[ \u00a0]+$/, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
      '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /* ===================== 存储 ===================== */
  // marks: Map<noteId, {id, href, title}>   标注队列
  // results: { [noteId]: record }            dump 抓取结果（断点续跑）
  // processed: Set<noteId>                  本轮已处理，仅用于绿色角标
  let marks = loadMarks();
  let results = loadResults();
  const processed = new Set();

  function loadMarks() {
    try {
      const arr = JSON.parse(localStorage.getItem(CFG.MARKS_KEY) || '[]');
      return new Map(arr.filter((x) => x && x.id).map((x) => [x.id, x]));
    } catch (e) { return new Map(); }
  }
  function saveMarks() {
    try { localStorage.setItem(CFG.MARKS_KEY, JSON.stringify([...marks.values()])); } catch (e) {}
  }
  function loadResults() {
    try { return JSON.parse(localStorage.getItem(CFG.RESULTS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveResults() {
    try { localStorage.setItem(CFG.RESULTS_KEY, JSON.stringify(results)); } catch (e) {}
  }

  function getNoteMeta(sec) {
    if (!sec) return null;
    const id = sec.getAttribute('data-note-id');
    if (!id) return null;
    const cover = sec.querySelector(SEL.cover);
    const href = cover ? (cover.getAttribute('href') || '') : '';
    const t = sec.querySelector(SEL.cardTitle);
    const title = t ? (t.innerText || '').trim() : '';
    return { id: id, href: href, title: title };
  }

  function findCardById(id) {
    const all = document.querySelectorAll(SEL.card);
    for (let i = 0; i < all.length; i++) {
      if (all[i].getAttribute('data-note-id') === id) return all[i];
    }
    return null;
  }

  function buildDetailUrl(meta) {
    const href = meta.href || '';
    const m = href.match(/xsec_token=([^&]+)/);
    const token = m ? decodeURIComponent(m[1]) : '';
    if (token) {
      return 'https://www.xiaohongshu.com/explore/' + meta.id +
        '?xsec_token=' + encodeURIComponent(token) + '&xsec_source=pc_user';
    }
    if (href) {
      try { return new URL(href, location.origin).href; } catch (e) {}
    }
    return 'https://www.xiaohongshu.com/explore/' + meta.id;
  }

  /* ===================== 动作 1：dump（只读） ===================== */
  function extractFrom(doc, meta, url) {
    const g = (s) => {
      const e = doc.querySelector(s);
      return e ? (e.innerText || '').trim() : '';
    };
    const title = cleanText(g(SEL.dTitle)) || meta.title || meta.id;
    const tags = [...doc.querySelectorAll(SEL.dTag)]
      .map((a) => (a.innerText || '').trim()).filter(Boolean);
    return {
      title: title,
      author: cleanText(g(SEL.dAuthor)),
      date: cleanText(g(SEL.dDate)),
      tags: tags,
      desc: cleanText(g(SEL.dDesc)),
      noteId: meta.id,
      url: url,
    };
  }

  async function fetchNote(meta) {
    const url = buildDetailUrl(meta);
    const f = document.createElement('iframe');
    f.style.cssText =
      'position:absolute;left:-99999px;top:0;width:1px;height:1px;' +
      'opacity:0;border:0;pointer-events:none;';
    f.setAttribute('aria-hidden', 'true');
    f.src = url;
    document.body.appendChild(f);
    try {
      const doc = await waitFor(() => {
        const d = f.contentDocument;
        if (!d) return null;
        const t = d.querySelector(SEL.dTitle);
        if (!t || !(t.innerText || '').trim()) return null;
        return d;
      }, CFG.IFRAME_WAIT_MS, 250);
      if (!doc) return null;
      await sleep(CFG.SETTLE_MS);
      return extractFrom(doc, meta, url);
    } finally {
      f.remove();
    }
  }

  /* ===================== 导出格式 ===================== */
  function orderedRecords() {
    return [...marks.values()].map((m) => results[m.id]).filter(Boolean);
  }
  function allRecords() {
    return Object.keys(results).map((k) => results[k]);
  }

  function toMarkdown(records) {
    const out = ['> 小红书笔记导出 · 共 ' + records.length + ' 条 · ' + new Date().toLocaleString(), ''];
    records.forEach((r) => {
      out.push('# ' + r.title);
      out.push('');
      out.push('- 作者：' + (r.author || '—'));
      out.push('- 日期：' + (r.date || '—'));
      out.push('- 标签：' + (r.tags.length ? r.tags.join(' ') : '—'));
      out.push('- 链接：' + r.url);
      out.push('');
      out.push(r.desc || '（无正文）');
      out.push('');
      out.push('---');
      out.push('');
    });
    return out.join('\n');
  }
  function toTxt(records) {
    return records.map((r, i) => [
      '[' + (i + 1) + '/' + records.length + '] ' + r.title,
      '作者：' + (r.author || '—'),
      '日期：' + (r.date || '—'),
      '标签：' + (r.tags.length ? r.tags.join(' ') : '—'),
      '链接：' + r.url,
      '',
      r.desc || '（无正文）',
      '',
      '────────────────────────────',
      '',
    ].join('\n')).join('\n');
  }
  function toJson(records) {
    return JSON.stringify({ exportedAt: new Date().toISOString(), count: records.length, notes: records }, null, 2);
  }
  function csvCell(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }
  function toCsv(records) {
    const head = ['title', 'author', 'date', 'tags', 'desc', 'noteId', 'url'];
    const rows = records.map((r) => [
      r.title, r.author, r.date, r.tags.join(' '), r.desc, r.noteId, r.url,
    ].map(csvCell).join(','));
    return '\uFEFF' + head.join(',') + '\n' + rows.join('\n');
  }
  const FORMATS = {
    md: { ext: 'md', mime: 'text/markdown', build: toMarkdown },
    txt: { ext: 'txt', mime: 'text/plain', build: toTxt },
    json: { ext: 'json', mime: 'application/json', build: toJson },
    csv: { ext: 'csv', mime: 'text/csv', build: toCsv },
  };

  function download(text, fmt) {
    const f = FORMATS[fmt] || FORMATS.md;
    const blob = new Blob([text], { type: f.mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xhs-notes-' + stamp() + '.' + f.ext;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return a.download;
  }

  function exportResults(useAll) {
    const records = useAll ? allRecords() : orderedRecords();
    if (!records.length) {
      alert('还没有抓取到任何内容，请先执行「批量导出文本」。');
      return null;
    }
    const fmt = selFormat.value || CFG.DEFAULT_FORMAT;
    const name = download(FORMATS[fmt].build(records), fmt);
    statusEl.textContent = '已导出 ' + records.length + ' 条 → ' + name;
    return name;
  }

  async function runDump(lo, hi) {
    const queue = [...marks.values()];
    let done = 0, failed = 0, skipped = 0;
    const failedIds = [];

    for (let i = 0; i < queue.length; i++) {
      if (abortFlag) break;
      while (paused && !abortFlag) await sleep(300);
      if (abortFlag) break;

      const meta = queue[i];
      if (results[meta.id]) { skipped++; processed.add(meta.id); continue; }

      updatePanel('导出 ' + (i + 1) + '/' + queue.length + '（成功 ' + done + ' 失败 ' + failed + '）');
      let rec = await fetchNote(meta);
      if (!rec) {
        await randSleep(CFG.RETRY_WAIT_MS, CFG.RETRY_WAIT_MS + 1200);
        rec = await fetchNote(meta);
      }
      if (rec) {
        results[meta.id] = rec;
        saveResults();
        processed.add(meta.id);
        done++;
        const sec = findCardById(meta.id);
        if (sec) addBadge(sec, true);
      } else {
        failed++;
        failedIds.push(meta.id);
        console.warn('[xhs-batch] 抓取失败', meta.id, meta.title);
      }
      if (done > 0 && done % CFG.DUMP_PAUSE_EVERY === 0) {
        updatePanel('已抓取 ' + done + ' 条，休息 ' + CFG.DUMP_PAUSE_MS / 1000 + ' 秒…');
        await sleep(CFG.DUMP_PAUSE_MS);
      }
      await randSleep(lo, hi);
    }

    syncBadges();
    updatePanel('抓取完成：新增 ' + done + '，跳过 ' + skipped + '，失败 ' + failed);
    if (orderedRecords().length) exportResults(false);
    if (failed) console.warn('[xhs-batch] 失败列表（标注已保留，可重试）', failedIds);
  }

  /* ===================== 动作 2：uncollect（写） ===================== */
  let hookInstalled = false;
  let lastUncollectHeaders = null;
  let sigHeaders = null;
  let sigAt = 0;

  function installHook() {
    if (hookInstalled) return;
    hookInstalled = true;
    const XO = window.XMLHttpRequest;
    const origOpen = XO.prototype.open;
    const origSet = XO.prototype.setRequestHeader;
    const origSend = XO.prototype.send;
    XO.prototype.open = function (m, u) {
      this.__m = m; this.__u = u;
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

  function collectState() {
    const m = document.querySelector(SEL.modal);
    const u = m && m.querySelector(SEL.collectBtn + ' use');
    if (!u) return 'unknown';
    const h = (u.getAttribute('href') || u.getAttribute('xlink:href') || '');
    if (h.indexOf('#collected') !== -1) return 'collected';
    if (h.indexOf('#collect') !== -1) return 'uncollected';
    return 'unknown';
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

  // 真实点开一张已收藏笔记并取消，借此捕获签名头。
  // 注意：这一步本身就是一次写操作，已由 runDispatch 的 confirm 覆盖。
  async function acquireSignature(id) {
    installHook();
    const sec = findCardById(id);
    if (!sec) return null;
    lastUncollectHeaders = null;
    const link = sec.querySelector(SEL.cover);
    (link || sec).click();

    const ready = await waitFor(() => {
      const m = document.querySelector(SEL.modal);
      if (!m) return null;
      const b = m.querySelector(SEL.collectBtn);
      if (!b) return null;
      return collectState() === 'unknown' ? null : b;
    }, CFG.MODAL_WAIT_MS, 300);
    if (!ready) { closeModal(); return null; }

    if (collectState() === 'uncollected') {
      ready.click();
      await waitFor(() => collectState() === 'collected', 8000, 300);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      await sleep(800);
    }
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

  function apiUncollect(id) {
    return new Promise((resolve) => {
      const x = new XMLHttpRequest();
      x.open('POST', CFG.API_HOST + CFG.API_PATH, true);
      x.withCredentials = true;   // 不带 cookie 会返回 -101 未登录
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
    } catch (e) { return { code: null, raw: raw || ('HTTP ' + x.status) }; }
  }

  async function runUncollect(lo, hi) {
    const queue = [...marks.values()];
    let done = 0, failed = 0, blockedRetries = 0;
    const failedIds = [];

    // 确保签名（首次会真实取消 1 张）
    if (!sigValid()) {
      updatePanel('正在获取接口签名（1 次真实点击）…');
      let got = false;
      for (let k = 0; k < queue.length && !got; k++) {
        const id = queue[k];
        if (!findCardById(id)) continue;
        sigHeaders = await acquireSignature(id);
        if (sigHeaders) {
          got = true;
          marks.delete(id);
          saveMarks();
          processed.add(id);
          done++;
        }
        if (abortFlag) break;
      }
      if (!got) {
        updatePanel('签名获取失败，未执行任何取消操作');
        alert('无法获取接口签名。\n\n请在列表页滚动到任一已标注笔记使其可见，或手动点开任意笔记取消一次收藏后刷新重试。\n本次没有执行批量取消。');
        return;
      }
    }

    for (let i = 0; i < queue.length; i++) {
      if (abortFlag) break;
      while (paused && !abortFlag) await sleep(300);
      if (abortFlag) break;
      const id = queue[i].id;
      if (!marks.has(id)) continue;

      updatePanel('取消收藏 ' + (i + 1) + '/' + queue.length + '（成功 ' + done + ' 失败 ' + failed + '）');
      let resp = parseResp(await apiUncollect(id));
      if (resp.code === null) {
        await randSleep(1500, 3000);
        resp = parseResp(await apiUncollect(id));
      }
      if (CFG.SIG_INVALID_CODES.indexOf(resp.code) !== -1) {
        updatePanel('签名失效，重新获取…');
        const fresh = await acquireSignature(id);
        if (fresh) resp = parseResp(await apiUncollect(id));
      }

      if (resp.code === 0) {
        blockedRetries = 0;
        marks.delete(id);
        saveMarks();
        processed.add(id);
        done++;
        const sec = findCardById(id);
        if (sec) addBadge(sec, true);
      } else if (CFG.BLOCK_CODES.indexOf(resp.code) !== -1) {
        blockedRetries++;
        if (blockedRetries > CFG.MAX_BLOCK_RETRY) {
          failedIds.push(id); failed++;
          updatePanel('风控拦截，已停止');
          alert('连续触发风控（code ' + resp.code + '），已停止。\n已完成 ' + done + ' 张，剩余标注已保留。\n建议休息 30 分钟并切到「保守」速度再继续。');
          return;
        }
        updatePanel('触发风控，冷却 ' + CFG.BLOCK_COOLDOWN_MS / 1000 + ' 秒…');
        await sleep(CFG.BLOCK_COOLDOWN_MS);
        i--;
        continue;
      } else {
        failedIds.push(id); failed++;
        console.warn('[xhs-batch] 取消失败', id, resp.code, resp.raw);
      }

      if (done > 0 && done % CFG.WRITE_PAUSE_EVERY === 0) {
        updatePanel('已完成 ' + done + ' 张，休息 ' + CFG.WRITE_PAUSE_MS / 1000 + ' 秒…');
        await sleep(CFG.WRITE_PAUSE_MS);
      }
      await randSleep(lo, hi);
    }

    syncBadges();
    updatePanel('完成：成功 ' + done + '，失败 ' + failed);
    if (failed) console.warn('[xhs-batch] 失败列表', failedIds);
    alert('批量取消收藏完成\n成功 ' + done + ' 张，失败 ' + failed + ' 张' +
      (marks.size ? '\n剩余 ' + marks.size + ' 条标注，可再次执行' : ''));
  }

  /* ===================== 动作 3：unlike（写，PLACEHOLDER） =====================
   * 暂不实现。将来接入时按这个顺序做：
   *   1. 实测真实的取消点赞接口 path 与 body（小红书 web 端，注意与 /note/collect 区分）。
   *   2. 签名只绑定 URL path，所以要么为该 path 单独捕获一次签名头，
   *      要么复用 installHook 把过滤条件从 'note/uncollect' 换成对应的 like/unlike 关键字，
   *      并单独缓存（不要和 uncollect 的签名混用）。
   *   3. 复用本文件的队列 / 限速 / 风控（BLOCK_CODES）/ 分批休息逻辑。
   *   4. 它属于 write 动作：必须保留 runDispatch 里的 confirm 门槛，不要绕过。
   *   5. 把 ACTIONS.unlike.implemented 改成 true，并在下方 switch 里调用即可。
   * ===================================================================== */
  async function runUnlike() {
    throw new Error('批量取消点赞：占位，尚未实现');
  }

  /* ===================== 角标（共用） ===================== */
  function addBadge(sec, done) {
    let b = sec.querySelector('.xb-badge');
    if (!b) {
      b = document.createElement('div');
      b.className = 'xb-badge';
      b.style.cssText =
        'position:absolute;top:6px;left:6px;z-index:999;width:22px;height:22px;' +
        'border-radius:50%;color:#fff;display:flex;align-items:center;' +
        'justify-content:center;font-size:13px;pointer-events:none;';
      if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
      sec.appendChild(b);
    }
    b.style.background = done ? '#52c41a' : '#ff2442';
    b.textContent = done ? '✓' : '·';
    b.title = done ? '已处理' : '待处理';
    sec.style.outline = done ? '3px solid #52c41a' : '3px solid #ff2442';
    sec.style.outlineOffset = '2px';
  }
  function removeBadge(sec) {
    const b = sec && sec.querySelector('.xb-badge');
    if (b) b.remove();
    if (sec) sec.style.outline = '';
  }
  function syncBadges() {
    document.querySelectorAll('.xb-badge').forEach((b) => {
      const sec = b.closest(SEL.card);
      const id = sec && sec.getAttribute('data-note-id');
      if (!id || (!marks.has(id) && !processed.has(id))) removeBadge(sec);
    });
    const ids = new Set([...marks.keys(), ...processed]);
    ids.forEach((id) => {
      const sec = findCardById(id);
      if (sec) addBadge(sec, processed.has(id) || !!results[id]);
    });
  }

  /* ===================== 面板（共用） =====================
   * 标题栏常驻，点击折叠 / 展开；默认收起，避免遮挡页面内容。
   * 收起时胶囊上仍显示标注数与运行/标注状态，且不关闭标注模式，
   * 这样可以收起面板后继续边滚动边点卡片。
   * 折叠状态不持久化：每次打开页面都回到收起态。
   * ====================================================== */
  const panel = document.createElement('div');
  panel.id = 'xhs-batch-panel';
  panel.style.cssText =
    'position:fixed;right:16px;bottom:16px;z-index:99999;background:#fff;' +
    'border:1px solid #ddd;border-radius:10px;padding:8px 12px;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.15);font-size:13px;line-height:1.8;' +
    'font-family:-apple-system,"Microsoft YaHei",sans-serif;min-width:0;';
  panel.innerHTML =
    '<div class="xb-head" style="display:flex;align-items:center;gap:6px;' +
      'cursor:pointer;user-select:none;white-space:nowrap;" title="点击展开面板">' +
      '<span style="font-weight:700;">小红书批量操作</span>' +
      '<span style="color:#999;font-weight:400;font-size:12px;">v3</span>' +
      '<span class="xb-summary" style="color:#666;font-size:12px;"></span>' +
      '<span class="xb-chevron" style="margin-left:6px;color:#999;font-size:14px;line-height:1;">▾</span>' +
    '</div>' +
    '<div class="xb-body" style="display:none;">' +
      '<div class="xb-info" style="color:#333;margin-top:4px;"></div>' +
      '<div class="xb-status" style="color:#1677ff;font-size:12px;min-height:16px;"></div>' +
      '<div style="margin-top:4px;color:#555;">动作 <select class="xb-action">' +
        '<option value="dump" selected>批量导出文本（只读）</option>' +
        '<option value="uncollect">批量取消收藏（写）</option>' +
        '<option value="unlike">批量取消点赞（占位）</option>' +
      '</select></div>' +
      '<div style="margin-top:4px;">' +
        '<button class="xb-btn-mark"></button>' +
        '<button class="xb-btn-run">开始执行</button>' +
      '</div>' +
      '<div style="margin-top:2px;">' +
        '<button class="xb-btn-all">全选当前已加载</button>' +
        '<button class="xb-btn-pause">暂停</button>' +
      '</div>' +
      '<div style="margin-top:2px;">' +
        '<button class="xb-btn-save">仅导出已抓取</button>' +
        '<button class="xb-btn-clear">清空标注</button>' +
        '<button class="xb-btn-reset">清空结果</button>' +
      '</div>' +
      '<div style="margin-top:4px;color:#666;font-size:12px;">' +
        '速度 <select class="xb-speed">' +
          '<option value="slow">保守 2.2-4s</option>' +
          '<option value="normal" selected>标准 1.2-2.4s</option>' +
          '<option value="fast">激进 0.6-1.2s</option>' +
        '</select> ' +
        '格式 <select class="xb-format">' +
          '<option value="md" selected>Markdown</option>' +
          '<option value="txt">TXT</option>' +
          '<option value="json">JSON</option>' +
          '<option value="csv">CSV</option>' +
        '</select>' +
      '</div>' +
      '<div class="xb-tip" style="margin-top:4px;color:#999;font-size:11px;line-height:1.5;"></div>' +
    '</div>';
  document.body.appendChild(panel);

  const infoEl = panel.querySelector('.xb-info');
  const statusEl = panel.querySelector('.xb-status');
  const tipEl = panel.querySelector('.xb-tip');
  const headEl = panel.querySelector('.xb-head');
  const bodyEl = panel.querySelector('.xb-body');
  const summaryEl = panel.querySelector('.xb-summary');
  const chevEl = panel.querySelector('.xb-chevron');
  const btnMark = panel.querySelector('.xb-btn-mark');
  const btnRun = panel.querySelector('.xb-btn-run');
  const btnPause = panel.querySelector('.xb-btn-pause');
  const btnAll = panel.querySelector('.xb-btn-all');
  const btnSave = panel.querySelector('.xb-btn-save');
  const btnClear = panel.querySelector('.xb-btn-clear');
  const btnReset = panel.querySelector('.xb-btn-reset');
  const selAction = panel.querySelector('.xb-action');
  const selSpeed = panel.querySelector('.xb-speed');
  const selFormat = panel.querySelector('.xb-format');

  [btnMark, btnRun, btnPause, btnAll, btnSave, btnClear, btnReset].forEach((b) => {
    b.style.cssText = 'margin:3px 6px 0 0;padding:4px 10px;border:none;border-radius:6px;color:#fff;font-size:12px;';
  });
  [selAction, selSpeed, selFormat].forEach((s) => { s.style.cssText = 'font-size:12px;padding:1px 4px;'; });

  let markingMode = false;
  let running = false;
  let paused = false;
  let abortFlag = false;

  /* ---- 折叠 / 展开（默认收起，不持久化） ---- */
  let collapsed = true;

  function renderSummary() {
    if (!collapsed) { summaryEl.textContent = ''; return; }
    if (running) {
      // 收起后仍能看到「导出 3/10」这类进度，不必展开面板
      summaryEl.textContent = (statusEl.textContent || '执行中')
        .replace(/（[^）]*）/g, '').slice(0, 16);
    } else {
      summaryEl.textContent = (markingMode ? '标注中 · ' : '') +
        '已标注 ' + marks.size + ' 张';
    }
  }

  function setCollapsed(v) {
    collapsed = !!v;
    bodyEl.style.display = collapsed ? 'none' : 'block';
    panel.style.minWidth = collapsed ? '0' : '250px';
    panel.style.padding = collapsed ? '8px 12px' : '10px 12px';
    chevEl.textContent = collapsed ? '▾' : '▴';
    headEl.title = collapsed ? '点击展开面板' : '点击收起面板';
    renderSummary();
  }

  headEl.onclick = () => setCollapsed(!collapsed);
  headEl.onmouseenter = () => { headEl.style.opacity = '.65'; };
  headEl.onmouseleave = () => { headEl.style.opacity = '1'; };

  btnMark.onclick = () => { markingMode = !markingMode; updatePanel(); };
  btnRun.onclick = () => { if (!running) runDispatch(); };
  btnPause.onclick = () => {
    if (!running) return;
    paused = !paused;
    btnPause.textContent = paused ? '继续' : '暂停';
    if (!paused) statusEl.textContent = '';
    renderSummary();
  };
  btnAll.onclick = () => {
    if (running) return;
    let n = 0;
    document.querySelectorAll(SEL.card).forEach((sec) => {
      const meta = getNoteMeta(sec);
      if (meta && !marks.has(meta.id)) { marks.set(meta.id, meta); n++; }
    });
    saveMarks(); syncBadges(); updatePanel();
    statusEl.textContent = '已全选 ' + n + ' 张（继续下滑可再全选追加）';
  };
  btnSave.onclick = () => { if (!running) exportResults(true); };
  btnClear.onclick = () => {
    if (running) return;
    marks.clear(); saveMarks(); syncBadges(); updatePanel();
  };
  btnReset.onclick = () => {
    if (running) return;
    if (!confirm('清空已抓取的内容？标注会保留，下次导出会重新抓取。')) return;
    results = {}; saveResults(); syncBadges(); updatePanel();
    statusEl.textContent = '已清空抓取结果';
  };
  selAction.onchange = () => { updatePanel(); };

  function refreshInfo() {
    const loaded = document.querySelectorAll(SEL.card).length;
    const grabbed = [...marks.keys()].filter((id) => !!results[id]).length;
    infoEl.textContent =
      '已标注 ' + marks.size + ' 张' +
      (grabbed ? '（已抓取 ' + grabbed + '）' : '') +
      (loaded ? ' | 已加载 ' + loaded : '');
  }

  function updatePanel(status) {
    refreshInfo();
    statusEl.textContent = status || '';
    const A = ACTIONS[selAction.value] || ACTIONS.dump;
    const canRun = !running && marks.size > 0 && A.implemented;

    btnMark.textContent = markingMode ? '退出标注模式' : '开启标注模式';
    btnRun.textContent = A.implemented ? ('开始' + A.short) : '暂未实现';
    btnMark.style.background = running ? '#ccc' : '#ff2442';
    btnRun.style.background = canRun ? (A.write ? '#ff2442' : '#1677ff') : '#ccc';
    btnPause.style.background = running ? '#1890ff' : '#ccc';
    btnAll.style.background = running ? '#ccc' : '#fa8c16';
    btnSave.style.background = running ? '#ccc' : '#52c41a';
    btnClear.style.background = running ? '#ccc' : '#888';
    btnReset.style.background = running ? '#ccc' : '#888';
    btnPause.textContent = paused ? '继续' : '暂停';

    btnMark.disabled = running;
    btnRun.disabled = !canRun;
    btnPause.disabled = !running;
    btnAll.disabled = running;
    btnSave.disabled = running;
    btnClear.disabled = running;
    btnReset.disabled = running;
    selAction.disabled = running;
    selSpeed.disabled = running;
    selFormat.disabled = running || selAction.value !== 'dump';

    // 写操作用红色边框 + 警示色，降低误触
    panel.style.border = A.write ? '2px solid #ff2442' : '1px solid #ddd';
    statusEl.style.color = A.write ? '#ff2442' : '#1677ff';
    tipEl.textContent = markingMode
      ? '标注模式：点卡片打标记，可边滚动边标；标过的卡片不怕被回收。'
      : A.tip;
    renderSummary();
  }

  /* ===================== 标注模式点击拦截（共用） ===================== */
  document.addEventListener('click', (e) => {
    if (!markingMode || running) return;
    const sec = e.target.closest && e.target.closest(SEL.card);
    if (!sec) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const meta = getNoteMeta(sec);
    if (!meta) return;
    if (marks.has(meta.id)) { marks.delete(meta.id); removeBadge(sec); }
    else { marks.set(meta.id, meta); addBadge(sec, !!results[meta.id]); }
    saveMarks();
    updatePanel();
  }, true);

  /* ===================== DOM 监听（虚拟列表会重建卡片） ===================== */
  let refreshTimer = null;
  new MutationObserver((muts) => {
    const own = (n) => n.nodeType === 1 &&
      (n.classList.contains('xb-badge') ||
        (n.closest && n.closest('#xhs-batch-panel')) ||
        n.tagName === 'IFRAME');
    const relevant = muts.some((m) =>
      ![...m.addedNodes, ...m.removedNodes].every((n) => n.nodeType !== 1 || own(n)));
    if (!relevant || refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refreshInfo();
      if (marks.size || processed.size) syncBadges();
    }, CFG.OBSERVE_DEBOUNCE_MS);
  }).observe(document.body, { childList: true, subtree: true });

  /* ===================== 统一分发 + 写操作 confirm 门槛 ===================== */
  function buildConfirmText(action, n) {
    const A = ACTIONS[action];
    const extra = action === 'uncollect'
      ? '\n首次运行还会真实点开 1 张笔记来获取接口签名（该张也会被取消）。'
      : '';
    return [
      '即将执行【' + A.label + '】',
      '',
      '共 ' + n + ' 条标注。',
      '此操作会真实修改账号数据，且不可逆、无法撤销。' + extra,
      '',
      '建议先切换到「批量导出文本」做一次备份。',
      '',
      '确定继续吗？',
    ].join('\n');
  }

  async function runDispatch() {
    if (running || marks.size === 0) return;
    const action = selAction.value;
    const A = ACTIONS[action];
    if (!A) return;

    if (!A.implemented) {
      alert('【' + A.label + '】目前是占位入口，尚未实现。\n请在脚本中把 ACTIONS.unlike.implemented 改为 true 并接入对应实现。');
      return;
    }

    // === 所有 write 动作的统一确认门槛 ===
    if (A.write && !window.confirm(buildConfirmText(action, marks.size))) {
      statusEl.textContent = '已取消，未执行任何写操作';
      return;
    }

    running = true;
    paused = false;
    abortFlag = false;
    markingMode = false;
    processed.clear();

    const [lo, hi] = CFG.SPEED[selSpeed.value] || CFG.SPEED.normal;
    updatePanel('准备中…');
    try {
      if (action === 'dump') await runDump(lo, hi);
      else if (action === 'uncollect') await runUncollect(lo, hi);
      else if (action === 'unlike') await runUnlike();   // 占位，当前不可达
    } catch (e) {
      updatePanel('执行出错：' + (e && e.message ? e.message : String(e)));
      console.error('[xhs-batch]', e);
    } finally {
      running = false;
      syncBadges();
      const lastStatus = statusEl.textContent;   // 保留「抓取完成 / 已导出」等最终提示
      updatePanel(lastStatus);
    }
  }

  /* ===================== 启动 ===================== */
  setCollapsed(true);       // 每次打开页面都从收起态开始
  installHook();
  restoreSig();
  updatePanel();
  syncBadges();
  window.XHSBATCH = {
    get marks() { return marks; },
    get results() { return results; },
    get sig() { return sigHeaders; },
    get collapsed() { return collapsed; },
    setCollapsed: setCollapsed,
    run: runDispatch,
    fetchNote: fetchNote,
    export: exportResults,
    formats: FORMATS,
    actions: ACTIONS,
    cfg: CFG,
  };
})();
