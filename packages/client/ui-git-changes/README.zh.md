---
description: "把工作区的 Git 改动做成 Conversation View 标签页，并在输入区会话用量旁展示未提交总量。"
kind: "package-reference"
---
# @deepseek-ai/dsh-client-ui-git-changes

[English](README.md) | 中文

## 概述

使用本包可以在不离开对话的情况下查看 Session 工作区的未提交 Git 改动，或将单个文件与本地分支对比。Changes 标签页列出已暂存、未暂存和未跟踪的路径及其行数，并为选中的文件渲染行内或两侧 diff。输入区页脚在会话用量药丸旁显示改动文件数及其文本新增与删除，点击后选中 Changes 标签页。

## 目录

- [功能](#what-it-does)
- [输入区统计](#composer-statistics)
- [扩展点](#extension-points)
- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="what-it-does"></a>
## 功能

本包是双面包。

- **Node 面**（`exports["."]`）在 `/api/git-changes` 下注册两条经过鉴权的 `ctx.connection.fetch` 路由：
  - `status` — 识别仓库、当前分支、本地分支列表，以及改动路径（已暂存、未暂存、未跟踪，或与某分支对比）。
  - `diff` — 单个文件的 unified diff；未跟踪的文本文件会合成 new-file diff，二进制文件给出标记。
- **浏览器面**（`exports["./client"]`）在 `conversation.view` 槽注册 `changes` 条目：文件列表，加上行内与两侧两种 diff，工具栏里有对比基准选择与刷新。

Git 通过 `execFile` 调用，不经过 shell；浏览器传入的每个路径与 ref 在变成参数前都会校验。

-----

<a id="composer-statistics"></a>
## 输入区统计

浏览器把未提交的文件总量贡献到 `conversation.composer.dock.stats`，与会话用量并排显示。它显示本地化的改动文件文案、绿色新增与红色删除。点击统计会通过 Conversation 外壳已有的视图选择动作选中当前会话的 Changes 标签。会话变化、运行状态变化或窗口重新获得焦点时刷新计数；干净或不可用的仓库隐藏该条目。分支对比的选择不影响该页脚。文件计数包含已暂存、未暂存、未跟踪与二进制改动；行数总量使用工作区相对 HEAD 的差异（首次提交前为空树），未跟踪文本计为新增。二进制文件不贡献文本行。

-----

<a id="extension-points"></a>
## 扩展点

- 从 `cordis.patch.yml` 中移除该行即可同时去掉标签页与两条路由。
- 线路词汇在 `src/git-contract.ts`；diff 投影是 `src/client/diff-model.ts` 中的纯函数。

-----

<a id="model-experience"></a>
## 模型体验

无。该包是浏览器端 UI 插件层，不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

<a id="known-limitations-and-deferred-work"></a>

- **暂存区操作** — 视图只读；暂存、丢弃、提交等写操作尚未实现。
- **未跟踪文件上限** — 超过 2 MiB 的未跟踪文件只做摘要，不展示完整内容。
- **分支对比** — 基准列表只列本地分支；远端 ref 与任意 revision 尚未实现。
- 不发布 invariant companion，因为这些界面不拥有任何可由两个独立观测产生分歧的关系。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

该功能、其刷新策略与被否决的备选方案记录在[输入区 Git 统计说明](../../../.agents/notes/implemented/feature/2026-09-13-composer-git-statistics.zh.md)。

</details>
