# monkey-scripts

A personal collection of Tampermonkey / Violentmonkey userscripts.

---

## Scripts

### XHS Batch Uncollect — Xiaohongshu Bulk Favorite Remover

Mass-remove favorites (取消收藏) on the Xiaohongshu (RED / 小红书) **web app** without
opening every note one by one. Mark cards straight from the list page, then
batch-uncollect them in the background through the internal API.

![The floating control panel at the bottom-right of the Xiaohongshu favorites page, with buttons for mark mode, select all loaded, run, pause, clear, and a speed selector. Marked cards are outlined with a red check badge.](images/script-xhs.png)

- Docs: [English](xhs/README.md) · [中文](xhs/README.zh.md)
- Install: [`xhs/xhs-batch-uncollect.user.js`](xhs/xhs-batch-uncollect.user.js)

---

### IELTS Vocab Tracker — Familiarity Marking for IELTS Vocabulary

Mark words you already know on the leonwang.cc IELTS vocabulary handout, filter the grid
down to the ones still unknown, and track progress per chapter. The detail popup hides
Chinese by default for self-testing, and marks export / import as JSON.

![The IELTS vocabulary grid with a filter bar and per-chapter progress bar above it. Some cards are greyed out with a green check to show they are marked as known.](images/script-ielts-tracker.png)

- Docs: [English](ielts-vocab-tracker/README.md) · [中文](ielts-vocab-tracker/README.zh.md)
- Install: [`ielts-vocab-tracker/ielts-vocab-tracker.user.js`](ielts-vocab-tracker/ielts-vocab-tracker.user.js)

---

## Disclaimer

For **personal use only**. Use at your own risk; bulk operations may trigger rate limits
or temporary restrictions on your account.
