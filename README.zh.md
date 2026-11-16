# monkey-scripts

个人的油猴（Tampermonkey / Violentmonkey）脚本集合。

---

## 脚本

### 小红书批量操作助手（统一版）

一个脚本、一套标注交互、三个批量动作：**批量导出文本**（只读）、**批量取消收藏**（写）、
**批量取消点赞**（写，占位）。选卡片、队列、限速、面板全部共用，只是动作不同；
所有写操作在执行前都会先弹对话框确认。面板默认收起为角上的小胶囊，点标题栏展开（下图为展开态）；
展开后只有「标注 / 执行」两组按钮，外加一行选项；每个动作一个按钮，点一下即执行。

![展开后的控制面板特写，纯白背景，不含任何账号或笔记内容。两行分组：标注（标注模式开关、「全选」勾选框）、执行（「导出文本」「取消收藏」为统一浅灰按钮，点中执行时变蓝；「取消点赞」为始终灰色禁用的占位），下方是速度与格式选项。](images/script-xhs-batch-actions.png)

- 文档：[中文](xhs/README.zh.md) · [English](xhs/README.md)
- 安装：[`xhs/xhs-batch-actions.user.js`](xhs/xhs-batch-actions.user.js) · [Greasy Fork](https://greasyfork.org/zh-CN/scripts/605739)

---

### 雅思词汇掌握度助手

在 leonwang.cc 的雅思词汇页上按可配置分组标记单词、筛选还没掌握的词，并查看每个单元的掌握
进度；刷词页还会显示全部单元的总进度，并提供 JSON 导出 / 导入入口。标记可通过 WebDAV（默认
坚果云）在多台设备间同步；详情弹窗默认隐藏中文，方便只看英文自测，另外支持深色主题。

![雅思词汇页顶部有筛选条和本单元进度条，部分卡片保留原位并染上所属分组的颜色。](images/script-ielts-tracker.png)

- 文档：[中文](ielts-vocab-tracker/README.zh.md) · [English](ielts-vocab-tracker/README.md)
- 安装：[`ielts-vocab-tracker/ielts-vocab-tracker.user.js`](ielts-vocab-tracker/ielts-vocab-tracker.user.js) · [Greasy Fork](https://greasyfork.org/zh-CN/scripts/605737)

---

## 免责声明

小红书批量脚本仅供**个人使用**，使用风险自负；批量操作可能触发限流或临时封禁。雅思词汇助手
与 leonwang.cc 官方无关，使用风险自负。
