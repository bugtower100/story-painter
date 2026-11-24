# SealChat 默认 HTML 样式

此目录的七份 JSON 原样取自 [kagangtuya-star/sealchat](https://github.com/kagangtuya-star/sealchat/tree/84e9531d72d233420a9c37924ad4028713071c8a/service/log_styles)，快照提交 `84e9531d72d233420a9c37924ad4028713071c8a`（2026-11-24 读取）。保留模板、CSS、设计变量、规则和名称，不作配色或结构改写。

- `sealchat-bubble.json`：气泡
- `sealchat-compact.json`：紧凑
- `sealchat-novel.json`：小说
- `sealchat-script.json`：剧本
- `sealchat-dossier.json`：调查档案
- `sealchat-terminal.json`：舰桥日志
- `starter.json`：基础排版

`src/utils/logStyleCatalog.ts` 和 `src/components/LogStyleSketch.vue` 取自同一提交的 `ui/src/views/log/logStyleCatalog.ts` 与 `ui/src/views/log/components/LogStyleSketch.vue`；仅调整缩略图组件的导入路径，保留上游分类、说明与缩略图。适用同一份 MIT 许可。

遵循上游 MIT 许可，完整许可见 `LICENSE.txt`。内置样式的 HTML 导出在源码注释中保留许可，样式 ZIP 包含许可文件；网页不显示来源说明。

工作台按现有日志字段渲染消息模板；不生成 SealChat 的封面、分页、目录或未提供的引用／悄悄话字段。小说和剧本原模板不显示头像；角色差分数据仍保留，气泡与紧凑模板显示当前差分。
