# monkey-scripts

A personal collection of Tampermonkey / Violentmonkey userscripts.

---

## Scripts

### XHS Batch Actions — Unified Xiaohongshu Batch Toolkit

One userscript, one marking workflow, three batch actions: **batch export** (read-only),
**batch uncollect** (write) and **batch unlike** (write, placeholder). They share the same
card selection, queue, speed control and panel — only the action differs. Every write
action asks for confirmation before anything is executed. The panel starts collapsed as a
small pill in the corner; click its title bar to expand it (as shown below). Inside, three
labelled groups — mark, clear, execute — keep the workflow to one button per action.

![The expanded control panel on a plain white background, containing no account or note content. Three labelled rows: 标注 (mark-mode toggle and select-all link), 清理 (clear marks, clear cache), 执行 (blue export, red uncollect, greyed-out unlike placeholder), plus speed and format options.](images/script-xhs-batch-actions.png)

- Docs: [English](xhs/README.md) · [中文](xhs/README.zh.md)
- Install: [`xhs/xhs-batch-actions.user.js`](xhs/xhs-batch-actions.user.js)

---

### IELTS Vocab Tracker — Familiarity Marking for IELTS Vocabulary

Mark words you already know on the leonwang.cc IELTS vocabulary handout, filter the grid
down to the ones still unknown, and track progress per chapter — or across every chapter on
the spelling practice page, which also hosts the JSON export / import controls. The detail
popup hides Chinese by default for self-testing, and a low-glare dark theme is included.

![The IELTS vocabulary grid with a filter bar and per-chapter progress bar above it. Some cards are greyed out with a green check to show they are marked as known.](images/script-ielts-tracker.png)

- Docs: [English](ielts-vocab-tracker/README.md) · [中文](ielts-vocab-tracker/README.zh.md)
- Install: [`ielts-vocab-tracker/ielts-vocab-tracker.user.js`](ielts-vocab-tracker/ielts-vocab-tracker.user.js)

---

## Disclaimer

For **personal use only**. Use at your own risk; bulk operations may trigger rate limits
or temporary restrictions on your account.
