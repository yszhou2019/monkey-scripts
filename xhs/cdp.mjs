// 极简 CDP 客户端（Node 22 内置 WebSocket，无需 npm install）
//
//   node cdp.mjs --eval "JS表达式（需要 return）"
//   node cdp.mjs --nav "https://..." --wait 6000 --eval "JS表达式"
//   node cdp.mjs --click "section.note-item a.cover" --wait 5000 --eval "JS表达式"
//
// --click 走 CDP Input 域，产生的是浏览器级真实事件（isTrusted=true），
// 不会被站点风控当成合成事件；页面内返回值统一 JSON.stringify 后回传，
// 避免 Vue 响应式深层对象序列化失败。

const argv = process.argv.slice(2);
const PORT = process.env.CDP_PORT || '9222';
const arg = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};

const navUrl = arg('--nav');
const clickSel = arg('--click');
const waitMs = Number(arg('--wait') || 0);
const expr = arg('--eval');
const shotPath = arg('--shot');
const injectFile = arg('--inject');

if (!navUrl && !expr && !clickSel && !shotPath && !injectFile) {
  console.error('用法: node cdp.mjs [--nav URL] [--click SELECTOR] [--wait 毫秒] [--eval "JS"] [--shot 文件.png] [--inject 文件.js]');
  process.exit(1);
}

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page' && (t.url || '').includes('xiaohongshu.com')) ||
  list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) {
  console.error('没有可调试的页面，Chrome 是否已启动？');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const listeners = [];
let id = 0;

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method) {
    listeners.forEach((fn) => fn(m));
  }
});

await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

function send(method, params) {
  return new Promise((resolve, reject) => {
    id += 1;
    pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable', {});

async function evaluate(js) {
  const r = await send('Runtime.evaluate', {
    expression: `(async () => { ${js} })().then(v => JSON.stringify(v === undefined ? null : v))`,
    awaitPromise: true,
    returnByValue: true
  });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails.exception && r.exceptionDetails.exception.description;
    throw new Error('页面内异常: ' + (d || JSON.stringify(r.exceptionDetails)));
  }
  const raw = r.result.value;
  try { return JSON.parse(raw); } catch (e) { return raw; }
}

async function realClick(sel) {
  let box = null;
  for (let i = 0; i < 8; i++) {
    // 小红书瀑布流是多列绝对定位，DOM 顺序 ≠ 视觉顺序，且第一屏之外可能有占位/回收节点。
    // 所以必须在所有命中里挑第一个「真实可见」的，而不是默认的第一个。
    box = await evaluate(
      'const els=[...document.querySelectorAll(' + JSON.stringify(sel) + ')];' +
      'let hit=null;' +
      'for(const el of els){' +
      '  const r=el.getBoundingClientRect();' +
      '  const s=getComputedStyle(el);' +
      '  if(r.width>2&&r.height>2&&r.left>=0&&r.top>=0&&r.right<=window.innerWidth&&r.bottom<=window.innerHeight&&s.display!=="none"&&s.visibility!=="hidden"){hit=el;break;}' +
      '}' +
      'if(!hit){const el=els[0];if(!el)return null;el.scrollIntoView({block:"center",inline:"center"});' +
      '  const r2=el.getBoundingClientRect();' +
      '  return (r2.width>0&&r2.left>=0)?{x:r2.left+r2.width/2,y:r2.top+r2.height/2,w:r2.width,h:r2.height}:null;}' +
      'const r=hit.getBoundingClientRect();' +
      'return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};'
    );
    if (box) break;
    await sleep(500);
  }
  if (!box) throw new Error('选择器未命中或不可见: ' + sel);
  await sleep(300);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await sleep(60);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1 });
  return box;
}

if (navUrl) {
  const loaded = new Promise((res) => {
    listeners.push((m) => { if (m.method === 'Page.loadEventFired') res(); });
  });
  await send('Page.navigate', { url: navUrl });
  await Promise.race([loaded, sleep(9000)]);
}

if (clickSel) await realClick(clickSel);

if (injectFile) {
  const fs = await import('node:fs');
  const code = fs.readFileSync(injectFile, 'utf8');
  const r = await send('Runtime.evaluate', { expression: code, awaitPromise: false, returnByValue: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails.exception && r.exceptionDetails.exception.description;
    console.error('注入异常:', d || JSON.stringify(r.exceptionDetails));
    process.exit(1);
  }
  console.log('已注入:', injectFile);
}

if (waitMs) await sleep(waitMs);

if (expr) {
  const v = await evaluate(expr);
  console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));
}

if (shotPath) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(r.data, 'base64');
  const fs = await import('node:fs');
  fs.writeFileSync(shotPath, buf);
  console.log('截图已保存:', shotPath, buf.length, 'bytes');
}

ws.close();
