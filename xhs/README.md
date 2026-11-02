# XHS Batch Uncollect — Xiaohongshu Bulk Favorite Remover

A Tampermonkey / Violentmonkey userscript that mass-removes favorites (取消收藏)
on the Xiaohongshu (RED / 小红书) **web app** without opening every note one by one.

> Works on the web version (`xiaohongshu.com`), not the mobile app.

---

## Why this exists

The web app makes you open each note, open the detail modal, and click the star to
remove a favorite. With hundreds of saved notes that is painful. This script lets you
**mark** notes straight from the list, then auto-uncollects them in the background
through Xiaohongshu's official internal API.

---

## How it works

1. On the **first run** it opens exactly **one** note and performs a real "uncollect",
   capturing the anti-bot signature headers (`X-s`, `X-t`, `X-S-Common`, …).
2. Those signature headers are bound only to the **URL path**, not the request body,
   and the timestamp is **not** expiry-checked — so a single capture is reused for every
   note. (Verified against the live site, Nov 2026.)
3. After that, every removal is a direct
   `POST https://edith.xiaohongshu.com/api/sns/web/v1/note/uncollect`
   **with no modal opened** — fast and silent.
4. The captured signature is cached in `localStorage` (24 h) so future sessions skip
   the one-time capture entirely.

---

## Install

1. Install a userscript manager in your browser:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome / Edge / Firefox / Safari)
   - or [Violentmonkey](https://violentmonkey.github.io/).
2. Add `xhs-batch-uncollect.user.js`:
   - **Tampermonkey** → Dashboard → Utilities → *Import* (pick the file), **or**
   - create a new script, paste the file contents, and save.
3. Go to your logged-in Xiaohongshu **favorites** page. A floating panel appears.

> The diagnostic companion `xhs-probe.user.js` is **optional** — see below.

---

## Usage

A floating panel shows up at the **bottom-right** of the page:

| Button | What it does |
| --- | --- |
| **开启标注模式** (Mark mode) | Toggle, then click any card to mark/unmark it for removal. Scroll freely while marking. |
| **全选当前已加载** (Select all loaded) | Mark every currently loaded card. Scroll down to load more, then click again to add them. |
| **开始执行** (Run) | Start removing. First run opens 1 note to grab the signature, then switches to API mode (no modals). |
| **暂停** (Pause) | Pause / resume the run. |
| **清空标注** (Clear) | Remove all marks. |
| **速度** (Speed) | Per-note interval: **Slow** 2.5–5s · **Normal** 1.5–3s · **Fast** 0.8–1.6s. |

- Marked cards show a **red ✓** outline/badge.
- Successfully removed cards flip to a **green ✓**.
- Your marks are stored in `localStorage`, so reloading the page keeps them.

---

## Anti-bot / risk notes

- **Stay logged in.** The request must carry your cookies (`withCredentials = true`),
  otherwise the API returns `-101 未登录`.
- Built-in pacing + an automatic rest every **100** notes.
- If risk-control codes are hit (`300031`, `300012`, `4601`, …), the script auto-cools
  for **60 s** and retries a few times, then **stops and keeps the remaining marks** so
  you can resume later.
- For very large lists, prefer **Slow**.

---

## Files in this folder

| File | Purpose |
| --- | --- |
| `xhs-batch-uncollect.user.js` | The main userscript. Install this. |
| `xhs-probe.user.js` | Temporary diagnostic tool — dumps live DOM + network requests to the console. Only for debugging after a site redesign. |
| `cdp.mjs` | Dev/QA harness (Node + Chrome DevTools Protocol) used to drive a headless Chrome for testing. Not needed for normal use. |
| `README.md` | This file (English). |
| `README.zh.md` | 中文说明。 |

---

## Compatibility / tweaking

- Match rule: `https://www.xiaohongshu.com/*` (the probe also matches `rednote.com`).
- Key selectors live in the `SEL` / `CFG` constants near the top:
  `section.note-item`, `a.cover`, `.note-detail-mask`, `.collect-wrapper`, `.close-circle`.
  If Xiaohongshu changes its markup and the script stops finding cards/buttons, update
  those constants (or run the probe and send me the console output).

---

## Disclaimer

For **personal use only**. Use at your own risk; bulk operations may trigger rate limits
or temporary restrictions on your account.
