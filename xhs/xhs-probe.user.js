// ==UserScript==
// @name         XHS 结构探针（临时诊断用，用完可删）
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  抓取小红书收藏页/详情弹窗/取消收藏弹层的真实 DOM 与接口请求，用于修正选择器
// @author       you
// @match        https://www.xiaohongshu.com/*
// @match        https://www.rednote.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const REC = { cards: null, detail: null, popup: null, net: [], signer: null };

  /* ---------- 抓包 ---------- */
  let capturing = false;

  function isApi(url) {
    return /\/(api|edith)\//i.test(String(url || ''));
  }

  function mask(v) {
    const s = String(v || '');
    // 签名类头只保留前缀，避免泄露完整凭证
    if (/^XY[SWZ]_/.test(s)) return s.slice(0, 12) + '...(len=' + s.length + ')';
    return s.length > 200 ? s.slice(0, 200) + '...' : s;
  }

  function hookNet() {
    const P = XMLHttpRequest.prototype;
    const open = P.open, send = P.send, setHeader = P.setRequestHeader;

    P.open = function (method, url) {
      try { this.__p_url = String(url); this.__p_method = method; } catch (e) {}
      return open.apply(this, arguments);
    };
    P.setRequestHeader = function (k, v) {
      try {
        if (!this.__p_h) this.__p_h = {};
        this.__p_h[k] = v;
      } catch (e) {}
      return setHeader.apply(this, arguments);
    };
    P.send = function (body) {
      const self = this;
      self.addEventListener('loadend', function () {
        try {
          if (!capturing || !isApi(self.__p_url)) return;
          REC.net.push({
            url: self.__p_url,
            method: self.__p_method,
            status: self.status,
            headers: Object.keys(self.__p_h || {}).reduce(function (a, k) {
              a[k] = mask(self.__p_h[k]);
              return a;
            }, {}),
            reqBody: mask(body),
            resp: (self.responseText || '').slice(0, 500)
          });
        } catch (e) {}
      });
      return send.apply(this, arguments);
    };

    const of = window.fetch;
    if (typeof of === 'function') {
      window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : (input && input.url);
        return of.apply(this, arguments).then(function (res) {
          try {
            if (capturing && isApi(url)) {
              const c = res.clone();
              c.text().then(function (t) {
                REC.net.push({
                  url: url,
                  method: init && init.method,
                  status: res.status,
                  headers: (init && init.headers) || {},
                  reqBody: init && init.body ? mask(init.body) : '',
                  resp: (t || '').slice(0, 500)
                });
              }).catch(function () {});
            }
          } catch (e) {}
          return res;
        });
      };
    }
  }

  function cssPath(el, maxDepth) {
    const parts = [];
    let n = el;
    maxDepth = maxDepth || 6;
    while (n && n.nodeType === 1 && parts.length < maxDepth) {
      let p = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(p + '#' + n.id); break; }
      const cls = [].slice.call(n.classList).filter(function (c) { return c.indexOf('xhs-') !== 0; }).slice(0, 2);
      if (cls.length) p += '.' + cls.join('.');
      const par = n.parentElement;
      if (par) {
        const sibs = [].slice.call(par.children).filter(function (c) { return c.tagName === n.tagName; });
        if (sibs.length > 1) p += ':nth-of-type(' + (sibs.indexOf(n) + 1) + ')';
      }
      parts.unshift(p);
      n = n.parentElement;
    }
    return parts.join(' > ');
  }

  /* ---------- 面板 ---------- */
  function buildUI() {
    const box = document.createElement('div');
    box.id = 'xhs-probe-panel';
    box.style.cssText =
      'position:fixed;left:16px;bottom:16px;z-index:2147483000;background:#1c1c1e;color:#f2f2f7;' +
      'border:1px solid #3a3a3c;border-radius:12px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.45);' +
      'font-size:12px;line-height:1.7;font-family:-apple-system,"Microsoft YaHei",sans-serif;width:230px;';
    box.innerHTML =
      '<div style="padding-bottom:6px;border-bottom:1px solid #3a3a3c;margin-bottom:6px;"><b>🔬 XHS 结构探针</b></div>' +
      '<div id="xhs-probe-status" style="color:#ffd60a;min-height:20px;">就绪</div>' +
      '<div style="margin-top:4px;"></div>';
    document.body.appendChild(box);

    const status = box.querySelector('#xhs-probe-status');
    const btns = box.querySelector('div:last-child');

    function mk(label, fn, color) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'width:100%;margin-bottom:4px;padding:5px 8px;border:none;border-radius:6px;' +
        'color:#fff;background:' + (color || '#0a84ff') + ';cursor:pointer;font-size:12px;';
      b.onclick = fn;
      btns.appendChild(b);
      return b;
    }

    mk('① 抓卡片结构', function () {
      const cards = document.querySelectorAll('section.note-item, .note-item, [data-note-id]');
      const first = cards[0];
      status.textContent = '卡片数 ' + cards.length + '（详情见控制台）';
      console.log('[探针] 当前 URL:', location.href);
      console.log('[探针] 卡片数:', cards.length);
      console.log('[探针] 容器候选:', {
        feeds: document.querySelectorAll('.feeds-container').length,
        noteList: document.querySelectorAll('.note-list-container, .content-container').length
      });
      if (first) {
        const a = first.querySelector('a[href*="/explore/"], a[href*="/discovery/item/"], a[href*="/search_result/"]');
        console.log('[探针] 首张卡片 HTML:\n', first.outerHTML.slice(0, 2000));
        console.log('[探针] 首张卡片链接 href:', a && a.getAttribute('href'));
        console.log('[探针] 首张卡片 class:', first.getAttribute('class'));
      }
    });

    mk('② 抓详情互动栏', function () {
      const modal = document.querySelector('.note-detail-mask, .note-modal, #noteContainer, .note-container');
      status.textContent = modal ? '已定位弹窗，见控制台' : '❌ 未找到弹窗（请先手动打开一条笔记）';
      if (!modal) return;
      console.log('[探针] 弹窗 class:', modal.getAttribute('class'));
      const bars = modal.querySelectorAll('[class*="engage"], [class*="interact"]');
      console.log('[探针] 互动栏候选数:', bars.length);
      bars.forEach(function (b, i) {
        console.log('[探针] 互动栏 ' + i + ':\n', b.outerHTML.slice(0, 1500));
      });
      const cw = modal.querySelector('[class*="collect-wrapper"]');
      console.log('[探针] collect-wrapper:', cw && cw.outerHTML.slice(0, 1200));
      const use = cw && (cw.querySelector('use') || cw.querySelector('svg use'));
      console.log('[探针] use href:', use && (use.getAttribute('href') || use.getAttribute('xlink:href')));
    });

    mk('③ 抓取消弹层', function () {
      const hits = [];
      document.querySelectorAll('div,span,p,li,button,a,i,em').forEach(function (el) {
        if (el.childElementCount > 0) return;
        const r = el.getBoundingClientRect();
        if (r.width < 1 && r.height < 1) return;
        if ((el.textContent || '').replace(/\s+/g, '') !== '取消收藏') return;
        hits.push({ path: cssPath(el), outer: el.outerHTML.slice(0, 300) });
      });
      status.textContent = hits.length ? '找到 ' + hits.length + ' 个「取消收藏」（见控制台）' : '❌ 未找到（请先点开收藏按钮）';
      console.log('[探针] 取消收藏节点:', hits);
    });

    mk('④ 开始/停止抓包', function () {
      capturing = !capturing;
      status.textContent = capturing ? '● 抓包中…（现在去手动取消一张收藏）' : '抓包已停止，共 ' + REC.net.length + ' 条';
      if (!capturing) console.log('[探针] 抓包结果:', REC.net);
    }, '#30d158');

    mk('⑤ 复制全部结果', function () {
      const out = {
        url: location.href,
        ua: navigator.userAgent,
        cardCount: document.querySelectorAll('section.note-item, .note-item').length,
        net: REC.net
      };
      const s = JSON.stringify(out, null, 2);
      try {
        navigator.clipboard.writeText(s).then(function () {
          status.textContent = '✓ 已复制到剪贴板，粘贴给我';
        });
      } catch (e) { status.textContent = '复制失败，请手动复制'; }
      console.log('[探针] 结果 JSON:\n' + s);
    }, '#ff9f0a');

    mk('⑥ 探测签名函数', function () {
      const found = [];
      const path = '/api/sns/web/v1/feed';
      const data = { source_note_id: '65f0b2e4000000001203b8d7', image_formats: ['jpg'] };
      const names = Object.getOwnPropertyNames(window);
      for (const n of names) {
        if (!/^[a-zA-Z_$][\w$]{0,3}$/.test(n)) continue;
        let f;
        try { f = window[n]; } catch (e) { continue; }
        if (typeof f !== 'function') continue;
        try {
          const r = f(path, JSON.stringify(data));
          if (typeof r === 'string' && /^XY[SWZ]_/.test(r)) { found.push({ name: n, kind: 'string' }); continue; }
          if (r && typeof r === 'object') {
            const v = r['x-s'] || r.xs || r.sign || r['X-s'];
            if (typeof v === 'string' && /^XY[SWZ]_/.test(v)) found.push({ name: n, kind: 'object' });
          }
        } catch (e) {}
      }
      status.textContent = found.length ? '✓ 找到 ' + found.length + ' 个候选' : '❌ 未找到自动签名函数';
      console.log('[探针] 签名函数候选:', found);
    }, '#ff9f0a');
  }

  hookNet();

  function boot() { buildUI(); }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });

  window.XHSPROBE = REC;
})();
