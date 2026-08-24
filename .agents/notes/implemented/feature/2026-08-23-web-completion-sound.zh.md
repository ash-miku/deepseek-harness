# Agent Note: Web 端任务完成提示音

Status: implemented

[English](2026-08-23-web-completion-sound.md) | 中文

## Problem

操作者阅读其他会话或暂时离开页面时，智能体运行结束很容易被忽略。侧边栏的完成标记是视觉信号；浏览器标签页不在视线中时，它无法及时提醒任务已经结束。

## Decision

浏览器会话插件负责任务完成提示音。由 Host 支撑的 ui-conversation 设置命名空间保留 completionSound 布尔字段以兼容已有配置，并新增 completionSoundTone 与 completionSoundVolume。通用设置复用现有 selector pill、Menu 和 outline Button 样式，提供「关闭」「叮咚」「铛」「清脆铃声」、试听和 0–100 音量滑块。浏览器偏好与设置行一起放在 src/client/completion-sound.ts，不进入 React 会话壳。

SessionRuntime 仅在结构化 turn/end 携带 reason.kind === completed 时发出内部 session/completed Context 事件，并按会话事件序号去重。CompletionSoundController 消费该事件，不再从 running true 到 false 的列表边沿推断完成，因此取消、失败、重连收敛和无关的会话状态变化都不会播放提示。音频尚未解锁时观察到的完成会暂存为一个待处理提示，在下一次成功的用户手势后播放。

提示音由短促的 Web Audio 正弦音和三角波音合成，不随功能发布二进制声音资源。控制器只在指针／键盘手势或试听操作中创建 AudioContext，按持久化的应用音量缩放增益，并随插件生命周期关闭。音频失败只影响提示路径，不会影响会话渲染或设置写入。

## Alternatives considered

- **在 ConversationRoot 中使用 React effect。** 已拒绝：常驻壳只代表当前选中的会话；apply 层控制器可以观察后台会话，也能让浏览器副作用留在展示组件之外。
- **从 Web 服务加载声音文件。** 已拒绝：合成双音提示不需要资源服务、预加载和缓存行为，同时能满足叮咚通知的需求。
- **新增 runtime 会话事件或 wire 字段。** 已拒绝：已有的运行状态迁移和会话列表投影已经携带完成事实；新增模型可见或持久事件只会扩大协议而不会增加权威来源。

## Consequences

组装后的 Web 客户端现在可以使用完成提示音，不需要修改 Host 协议消息。已有设置文档会通过 schema 默认值解析新增字段，显式开关会与其他 ui-conversation 偏好一起持久化。浏览器自动播放策略仍然有效：页面在没有用户手势时不能立即播放，因此首次完成会排队，直到操作者交互或点击试听。默认开启的行为可以在通用设置中关闭。
