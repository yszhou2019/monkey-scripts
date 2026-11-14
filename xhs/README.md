# XHS Batch Actions — Unified Xiaohongshu Batch Toolkit

One userscript, one marking workflow, three batch actions for Xiaohongshu (RED / 小红书).
They share the same card selection, queue, speed control and floating panel — only the
action differs.

> Works on the web app (`xiaohongshu.com`) — the 笔记 / 收藏 / 点赞 tabs.
> **Every write action asks for confirmation before anything is executed.**

![The expanded control panel on a plain white background, containing no account or note content. Two labelled rows: 标注 (mark-mode toggle and a 全选 checkbox), 执行 (export and uncollect as uniform light-grey buttons — the running one turns blue — plus the permanently greyed-out unlike placeholder), and speed/format options below.](../images/script-xhs-batch-actions.png)

---

## Actions

| Action | Type | Status | What it does |
| --- | --- | --- | --- |
| **批量导出文本** (Batch export) | read-only | ready | Dumps each note's original title, body, author, date, hashtags and link to a local file. |
| **批量取消收藏** (Batch uncollect) | write | ready | Removes favorites through the internal API, without opening a modal per note. |
| **批量取消点赞** (Batch unlike) | write | placeholder | Reserved entry, not implemented yet; its button is disabled. |

### Confirmation gate (all write actions)

Before a write action dispatches anything, a dialog shows the action name, how many notes
are marked, and that the change is irreversible. Cancelling means **zero requests sent**
and the selection stays untouched (verified against the live site). The first uncollect
run also opens one note to capture the API signature — that note is consumed too, and the
dialog says so explicitly.

Each action is its own button in the **执行** row — clicking it runs that action directly,
with no separate "start" step. All three buttons share the same light-grey default;
**the one you clicked turns blue while it is running** and returns to grey when the run ends.
The unimplemented **取消点赞** stays greyed out and disabled at all times.
Colour no longer distinguishes read-only from write actions: writes are gated by the
confirmation dialog, and only the panel border and status text turn red while a write is
actually running. The safe workflow is **export first, then uncollect**, because successfully
uncollected notes leave the queue.

---

## Why a single script

The two earlier scripts (bulk uncollect and note exporter) duplicated the whole marking
engine — click interception, badges, MutationObserver re-marking, speed tiers, storage.
Merging removes that duplication while keeping destructive actions behind a confirmation
gate rather than a separate colour-coded UI. A third action can now be added without another
copy of the panel.

---

## How marking works (shared)

1. Toggle **开启标注模式** and click cards to mark them, or check **全选** to mark everything
   at once. Scrolling while marking is fine.
2. The script also keeps `seen`: metadata for **every** card loaded in this session, including
   ones the virtualized list already recycled. Checking **全选** marks all of `seen`;
   unchecking it selects nothing. The two are strictly symmetric — no snapshot, no undo.
   A partial selection shows an indeterminate checkbox, and the "已加载 N 张" counter is
   exactly how many cards 全选 will hit (only cards with an `xsec_token` link are collected;
   incomplete links are skipped).
3. Each mark stores `{ noteId, tokenized link, card title }` in `sessionStorage`, wiped when
   the tab closes. The waterfall list is virtualized and recycles scrolled-away cards
   (measured 63 → 38), so the batch never depends on a card still being in the DOM.
4. Pick a speed, then click one of the **执行** buttons — **导出文本** or **取消收藏**.
   That single click runs the action (write actions confirm first).
5. Red `·` badge = pending, green `✓` = processed.

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

The panel has exactly two button groups, plus a small options row. There is **no 清理 row**:
unchecking 全选 clears every mark, and fetched note bodies disappear when the tab closes, so
no separate cleanup control is needed.

| Row | Control | What it does |
| --- | --- | --- |
| — | **Title bar (click)** | Collapse / expand. Collapsed it still shows the marked count, the 标注中 state, or live run progress. Marking mode stays active while collapsed. |
| **标注** | **开启标注模式 / 退出标注模式** | One button, two states. Then click cards to mark / unmark. |
| **标注** | ☑ **全选** (checkbox) | Checked = mark every card loaded in this session (including ones scrolled out of view); unchecked = clear all marks. Partial selection shows indeterminate; "已加载 N 张" is the count 全选 will hit. |
| **执行** | **导出文本** (grey → blue while running) | Run the read-only export immediately. |
| **执行** | **取消收藏** (grey → blue while running) | Run uncollect immediately — after the confirmation dialog. |
| **执行** | **取消点赞** (grey) | Placeholder, permanently disabled. |
| **选项** | 速度 / 格式 | Slow 2.2–4s · Normal 1.2–2.4s · Fast 0.6–1.2s; Markdown (default) / TXT / JSON / CSV. |
| — | 仅导出已抓取 (link) | Download everything fetched in this session, e.g. to export again in another format. |
| — | **暂停** | Appears only while a batch is running. |

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

Not implemented. Its button sits in the **执行** row, greyed out and disabled; calling the
dispatcher directly only shows a notice. The script carries a `runUnlike` TODO block describing what is
needed: find the real unlike endpoint, capture a signature bound to **that** path (do not
reuse the uncollect signature), reuse the queue / pacing / risk handling, set
`ACTIONS.unlike.implemented = true`, and above all **keep the confirmation gate**.

---

## Where your data lives

| Stage | Storage | When it disappears |
| --- | --- | --- |
| Every card seen this session | `sessionStorage['xhs_batch_seen_v1']` | Closing the tab / restarting the browser |
| Selection (id + tokenized link + card title) | `sessionStorage['xhs_batch_marks_v1']` | Same as above |
| Fetched note bodies | `sessionStorage['xhs_batch_results_v1']`, written after every note | Same as above |
| Signature headers | `localStorage['xhs_batch_sig_v1']` | Automatically expires after 24 h |
| Exported file | **Disk** — a real download, e.g. `xhs-notes-20261111-004627.md` | Never (until you delete it) |
| Hidden iframe | Memory only, removed right after reading | Immediately |

**It is stateless by default.** Reopening the browser starts a fresh batch: no marks from
last time, no note bodies left behind. `sessionStorage` (rather than plain memory) is still
needed because the feed is virtualized — scrolled-away cards are recycled, and a reload or
re-render inside the same tab must not lose your selection.

`results` holds the note bodies read through hidden iframes during export, so a failed run
can resume without re-fetching and 仅导出已抓取 can re-download them in another format. The
file on disk is the real output; this browser-side copy is only a scratch pad. It now
vanishes with the tab, so the panel offers no manual cleanup control at all.

The only cross-session item is the signature header set: a technical credential for the
`uncollect` endpoint. Recapturing it requires genuinely opening and uncollecting one note
(an irreversible write), so reusing it for 24 h is the safer choice. It contains none of
your marks or note content.

- Export skips notes already fetched within the session, so a failed run can resume.
- **The downloaded file is the durable copy**; the three browser-side entries are scratch space.
- On upgrade, the script erases any marks and fetched bodies left in `localStorage` by older
  versions once at startup.

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
