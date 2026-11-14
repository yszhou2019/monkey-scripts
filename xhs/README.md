# XHS Batch Actions — Unified Xiaohongshu Batch Toolkit

One userscript, one marking workflow, three batch actions for Xiaohongshu (RED / 小红书).
They share the same card selection, queue, speed control and floating panel — only the
action differs.

> Works on the web app (`xiaohongshu.com`) — the 笔记 / 收藏 / 点赞 tabs.
> **Every write action asks for confirmation before anything is executed.**

![The unified floating panel at the bottom-right of the Xiaohongshu favorites page, with the action dropdown set to read-only export. Four marked cards are outlined: two green (processed) with check badges and two red (pending) with minus badges. All note covers and text are pixelated for privacy, and no account information is shown.](../images/script-xhs-batch-actions.png)

---

## Actions

| Action | Type | Status | What it does |
| --- | --- | --- | --- |
| **批量导出文本** (Batch export) | read-only | ready | Dumps each note's original title, body, author, date, hashtags and link to a local file. |
| **批量取消收藏** (Batch uncollect) | write | ready | Removes favorites through the internal API, without opening a modal per note. |
| **批量取消点赞** (Batch unlike) | write | placeholder | Reserved entry, not implemented yet; the run button is disabled. |

### Confirmation gate (all write actions)

Before a write action dispatches anything, a dialog shows the action name, how many notes
are marked, and that the change is irreversible. Cancelling means **zero requests sent**
and the selection stays untouched (verified against the live site). The first uncollect
run also opens one note to capture the API signature — that note is consumed too, and the
dialog says so explicitly.

When a write action is selected the panel border turns red and the run button is labelled
with that action's name. The safe workflow is **export first, then uncollect**, because
successfully uncollected notes leave the queue.

---

## Why a single script

The two earlier scripts (bulk uncollect and note exporter) duplicated the whole marking
engine — click interception, badges, MutationObserver re-marking, speed tiers, storage.
Merging removes that duplication while keeping destructive actions clearly separated from
the read-only one at the UI level. A third action can now be added without another copy of
the panel.

---

## How marking works (shared)

1. Toggle **开启标注模式** and click cards to mark them, or use **全选当前已加载**.
   Scrolling while marking is fine.
2. Each mark stores `{ noteId, tokenized link, card title }` in localStorage. The
   waterfall list is virtualized and recycles scrolled-away cards (measured 63 → 38), so
   the batch never depends on a card still being in the DOM.
3. Choose an action, pick a speed, press **开始导出** / **开始取消收藏**. Pause, clear
   marks and clear results are independent.
4. Red `·` badge = pending, green `✓` = processed.

---

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/).
2. Import `xhs-batch-actions.user.js` (Tampermonkey → Utilities → Import), or paste it
   into a new script.
3. Open your logged-in Xiaohongshu profile → 收藏 or 点赞. A small **collapsed pill**
   appears at the bottom-right. Click its title bar to expand the full control panel.
   It starts collapsed on every page load, so it never covers the feed by default.

---

## Usage

| Control | What it does |
| --- | --- |
| **Title bar (click)** | Collapse / expand the panel. Collapsed it still shows the marked count, the 标注中 state, or live run progress. Marking mode stays active while collapsed, so you can keep clicking cards with the panel out of the way. The pill keeps its red border when a write action is selected. |
| **动作** (Action) | Select export / uncollect / unlike. Switching to a write action turns the panel red. |
| **开启标注模式** | Toggle, then click cards to mark / unmark. |
| **全选当前已加载** | Mark every loaded card; scroll down and click again to append. |
| **开始导出 / 开始取消收藏** | Run the selected action. Write actions confirm first. |
| **暂停** | Pause / resume. |
| **仅导出已抓取** | Download everything in the export cache, including earlier batches. |
| **清空标注** / **清空结果** | Clear the selection or the cached content, independently. |
| **速度** | Slow 2.2–4s · Normal 1.2–2.4s · Fast 0.6–1.2s. |
| **格式** | Markdown (default) / TXT / JSON / CSV; only enabled for the export action. |

---

## Action 1 — Batch export (read-only)

Each marked note is opened in a hidden same-origin iframe at
`/explore/{noteId}?xsec_token=…`, which renders `#detail-title`, `#detail-desc`,
`#detail-desc a.tag`, `.author`, `.date`. The script reads them and removes the iframe
immediately. No modal, no page reload, no scrolling, no write request.

Formats (every record is headed by the **original post title**, never an id or index):

- **Markdown** (default) — `# {title}`, then author, date, hashtags, link and full body,
  separated by `---`.
- **TXT** — plain text with one header block per note.
- **JSON** — `{ exportedAt, count, notes: [{ title, author, date, tags, desc, noteId, url }] }`.
- **CSV** — `title,author,date,tags,desc,noteId,url` with a UTF-8 BOM; quotes and newlines
  escaped.

File: `xhs-notes-YYYYMMDD-HHMMSS.{ext}`, saved to your browser's download folder.

---

## Action 2 — Batch uncollect (write)

- Endpoint `POST https://edith.xiaohongshu.com/api/sns/web/v1/note/uncollect`, body
  `{"note_ids":"<id>"}`, `withCredentials = true` (otherwise `-101 未登录`).
- Signature headers (`X-s`, `X-t`, `X-S-Common`, …) are captured from one genuine
  uncollect request. They bind to the URL path rather than the body and the timestamp is
  not expiry-checked, so one capture is reused for every note and cached for 24 h.
- Risk-control codes `300031 / 300012 / 4601` trigger a 60 s cooldown and a few retries,
  then the run stops while keeping the remaining marks.
- Signature capture needs at least one marked card currently rendered in the list. If all
  of them were recycled by the virtual list, scroll back to one of them first; the script
  will tell you instead of guessing.

---

## Action 3 — Batch unlike (placeholder)

Not implemented. The option is visible, the run button is disabled, and calling the
dispatcher shows a notice. The script carries a `runUnlike` TODO block describing what is
needed: find the real unlike endpoint, capture a signature bound to **that** path (do not
reuse the uncollect signature), reuse the queue / pacing / risk handling, set
`ACTIONS.unlike.implemented = true`, and above all **keep the confirmation gate**.

---

## Where your data lives

| Stage | Storage |
| --- | --- |
| Selection (id + tokenized link + card title) | `localStorage['xhs_batch_marks_v1']` |
| Exported content (title, body, …) | `localStorage['xhs_batch_results_v1']`, written after every note |
| Signature headers | `localStorage['xhs_batch_sig_v1']` |
| Exported file | **Disk** — a real download, e.g. `xhs-notes-20261111-004627.md` |
| Hidden iframe | Memory only, removed right after reading |

- localStorage survives reloads and enables resume: export skips notes already fetched.
- It has a ~5 MB quota and is browser-local. **The downloaded file is the durable copy.**
- Exporting does not clear the cache; use **清空结果** when done.

---

## Reliability & limits

- Failed notes stay marked and are retried once automatically.
- Automatic rest every 60 notes (export) / 100 notes (uncollect), with randomized intervals.
- Prefer **Slow** for large batches.
- `xsec_token` links can go stale — reload the list and re-mark if a note keeps failing.
- The read-only action never calls a write API and never clicks a collect / like button.

---

## Compatibility / tweaking

- Match rule: `https://www.xiaohongshu.com/*`.
- `ACTIONS` at the top defines the three actions and their `write` / `implemented` flags;
  the confirmation gate reads `write`, so future write actions inherit it automatically.
- Key selectors in `SEL`: `section.note-item`, `a.cover`, `.title`, `#detail-title`,
  `#detail-desc`, `#detail-desc a.tag`, `.author-wrapper .author`, `.date`,
  `.note-detail-mask`, `.collect-wrapper`, `.close-circle`.
  If the site changes its markup, re-derive these from the live DOM in DevTools.

---

## Disclaimer

For **personal use only**. Use at your own risk; bulk operations may trigger rate limits or
temporary restrictions. Respect the original authors and Xiaohongshu's terms when reusing
exported text.
