# @deepseek-ai/dsh-client-ui-git-changes

把工作区的 Git 改动做成一个 Conversation View Tab。

## 功能

本包是双面包：

- **Node 面**（`exports["."]`）在 `/api/git-changes` 下注册两条经过鉴权的 `ctx.connection.fetch` 路由：
  - `status` — 识别仓库、当前分支、本地分支列表，以及改动文件（已暂存 / 未暂存 / 未跟踪，或与某分支对比）。
  - `diff` — 单个文件的 unified diff；未跟踪的文本文件会合成 new-file diff，二进制文件给出标记。
  Git 通过 `execFile` 调用，不经过 shell；浏览器传入的每个路径与 ref 在变成参数前都会校验。
- **浏览器面**（`exports["./client"]`）在 `conversation.view` 槽注册 `changes` 条目：文件列表，加上行内与两侧两种 diff，工具栏里有对比基准选择与刷新。

## 扩展点

- 从 `cordis.patch.yml` 中移除该行即可同时去掉 Tab 与两条路由。
- 线路词汇在 `src/git-contract.ts`；diff 投影是 `src/client/diff-model.ts` 中的纯函数。

## 已知限制与后续工作

- **暂存区操作** — 视图只读；暂存、丢弃、提交等写操作尚未实现。
- **未跟踪文件上限** — 超过 2 MiB 的未跟踪文件只做摘要，不展示完整内容。
- **分支对比** — 基准列表只列本地分支；远端 ref 与任意 revision 尚未实现。

## 输入区统计

浏览器把未提交的文件总量贡献到 `conversation.composer.dock.stats`，与会话用量并排显示。它显示本地化的改动文件文案、绿色新增与红色删除。点击统计会通过 Conversation 外壳已有的视图选择动作选中当前会话的 Changes 标签。会话变化、运行状态变化或窗口重新获得焦点时刷新计数；干净或不可用的仓库隐藏该条目。分支对比的选择不影响该页脚。文件计数包含已暂存、未暂存、未跟踪与二进制改动；行数总量使用工作区相对 HEAD 的差异（首次提交前为空树），未跟踪文本计为新增。二进制文件不贡献文本行。
