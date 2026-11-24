# SealChat 兼容与样式工作台

主界面导入日志后，打开「头像与差分工作台」。左侧分为基础排版、HTML 样式、头像与差分；右侧使用实际日志预览前 100 条有效发言，导出包含全部有效发言。HTML 单文件与 ZIP 使用同一排版实现，遵循主界面的角色隐藏及内容过滤设置。

## 日志和差分

- SealChat 标准 JSON：兼容 `version / items`，识别其小写 `imUserId`。该格式没有导出头像及差分。
- SealChat HTML：从 `window.__EXPORT_DATA__` 中读取 JSON，不运行原网页脚本。支持单个 HTML 分片和含 `manifest/meta.json`、`parts/*.html` 的完整 ZIP，按分片编号合并。
- 按分片各自的 `inline_assets` 表解析 `scasset:` 图片。角色使用 `sender_identity_id`，缺失时使用 `sender_id`。同名但不同 ID 的角色分别管理头像和差分。
- HTML 标准导出保留每条发言的实际头像，没有原差分名称或编号。导入时按头像生成稳定的 `sc-…` 标签，相同头像复用；在文本编辑、列表整理和 HTML 导出间保留这些标签。引用 SealChat 原差分编号的模板规则需改为当前标签。
- 默认头像、差分图片可单独替换；支持多选图片并以文件名生成标签。正在被发言使用的差分可替换，清除发言的标签后才能删除。
- 正文富文本转为可编辑的文本段落和图片标记；保留换行、图片、名字、ID、窗口和时间，不保留 SealChat 的局部字体、聊天皮肤、动画、发布工程或分页元素。图片仍需存在于导出包中，或为可访问的 HTTP(S) 地址；导出包未提供的附件不能恢复。

## HTML / CSS / 样式包

可导入 HTML 模板、CSS 文件、SealChat v1 完整样式 JSON 或资源 ZIP。HTML 是每条消息的模板，必须恰好有一个 `data-log-slot="body"`，不是任意网页截图或已渲染的整份日志。HTML 文件里的 `<style>` 自动提取为 CSS。

支持 `data-log-text`、`data-log-if`、图片 `data-log-bind-src`、`data-log-part` 和正文插槽；可绑定名字、配色、头像、正文纯文本、时间、标题和窗口。支持设计变量及按消息类型、角色 ID、差分标签匹配的首条规则。消息类型按当前编辑日志推断为 ic / ooc / dice；标准导出未提供的工程元数据、悄悄话或引用专用字段不作恢复。

含资源的样式使用 ZIP 导入：`manifest.json`、`tokens.json`、`settings.schema.json`、`templates/*.html`、`styles/main.css`、`assets/*`。CSS 中的 `url(assets/...)` 解析为本地图片或字体。下载样式包使用同一布局，保留设置 schema、规则、模板和资源；设置 schema 不自动生成控件，设计变量可在 JSON 编辑区修改。

编辑后点击「应用样式」。无效模板显示具体错误，保留此前已应用的样式。取消「使用自定义样式导出」可回到默认气泡页。自定义样式导出为静态 HTML，原有交互式窗口筛选仅用于默认气泡样式。TXT、论坛代码、Word 不使用 HTML 模板。

设置与图片在当前浏览器保存，大资源使用 IndexedDB；可下载样式包备份。预览使用隔离 iframe，自定义导出不执行脚本。ZIP 限 20 MB 压缩体积、200 个文件和 50 MB 解压体积。

## 参考协议

根据 2026-11-24 读取的 [SealChat](https://github.com/kagangtuya-star/sealchat) 主分支实现：

- [样式编写协议](https://github.com/kagangtuya-star/sealchat/blob/master/doc/log-layout-style-authoring.md)
- [样式 ZIP 格式](https://github.com/kagangtuya-star/sealchat/blob/master/ui/src/services/log/logStyleZip.ts)
- [标准导出数据格式](https://github.com/kagangtuya-star/sealchat/blob/master/service/export_formatter.go)
- [HTML 分片数据嵌入方式](https://github.com/kagangtuya-star/sealchat/blob/master/service/export_viewer_renderer.go)

协议对接独立实现；没有接入 SealChat 服务端账号、发布、PDF 分页或完整工程编辑器。
