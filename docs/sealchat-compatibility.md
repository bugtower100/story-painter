# SealChat 兼容与样式工作台

主界面导入日志后，打开「跑团工作台」。中央是纸张画布，右侧分为内容、页面、样式、头像差分；顶部集中搜索定位、撤销重做、HTML 和 PDF 导出。预览默认前 200 条有效发言，可搜索后续内容或显示全部，导出包含全部有效发言，遵循主界面的角色隐藏及内容过滤设置。

内容面板采用频道导航与编排大纲。频道表示 main、HO1、HO2 等来源归属，切换频道只过滤画布；全部编排表示最终阅读顺序，导出包含全部有效发言。点击预览选中发言，双击在右侧编辑这一条，拖拽改变顺序；大纲支持整块或单条发言移动，不改变频道。顶部「频道与编排」在宽幅面板中提供频道导航及完整整理工具，与原列表共用同一编辑器、内容块、窗口归属和历史记录，切换不会清空。原列表按视图、导入、搜索和正文分区，选中发言后才显示批量操作。头像上传和差分管理统一移到工作台；选中发言后可直接选择本条差分，预览实时更新。

频道与编排的组织方式参考上游 [`LogSectionsDialog.vue`](https://github.com/kagangtuya-star/sealchat/blob/84e9531d72d233420a9c37924ad4028713071c8a/ui/src/views/log/components/LogSectionsDialog.vue) 的来源片段与最终顺序分离，以及 [`SplitChannelSidebar.vue`](https://github.com/kagangtuya-star/sealchat/blob/84e9531d72d233420a9c37924ad4028713071c8a/ui/src/views/split/components/SplitChannelSidebar.vue) 的频道导航。这里沿用本地日志及手动内容块，不引入世界账号、聊天室、章节元数据或远端频道接口；同频道的多个块保持独立，未分块发言仍可逐条移动。

「页面」设置 A4 / Letter / 连续网页、单双栏、字号、字体和背景。HTML 是完整静态页面；PDF 按钮打开浏览器打印窗口，选择「另存为 PDF」，建议关闭浏览器页眉页脚。PDF 使用相同模板和打印样式，保留可选文字。中央画布为连续排版，不复制 SealChat 的逐页工程布局；浏览器打印时自动分页。工作台没有发布功能。

## 日志和差分

- SealChat 标准 JSON：兼容 `version / items`，识别其小写 `imUserId`。该格式没有导出头像及差分。
- SealChat HTML：从 `window.__EXPORT_DATA__` 中读取 JSON，不运行原网页脚本。支持单个 HTML 分片和含 `manifest/meta.json`、`parts/*.html` 的完整 ZIP，按分片编号合并。
- 按分片各自的 `inline_assets` 表解析 `scasset:` 图片。角色使用 `sender_identity_id`，缺失时使用 `sender_id`。同名但不同 ID 的角色分别管理头像和差分。
- HTML 标准导出保留每条发言的实际头像，没有原差分名称或编号。导入时按头像生成稳定的 `sc-…` 标签，相同头像复用；在文本编辑、列表整理和 HTML 导出间保留这些标签。引用 SealChat 原差分编号的模板规则需改为当前标签。
- 默认头像、差分图片可单独替换；支持多选图片并以文件名生成标签。正在被发言使用的差分可替换，清除发言的标签后才能删除。
- 正文富文本转为可编辑的文本段落和图片标记；保留换行、图片、名字、ID、窗口和时间，不保留 SealChat 的局部字体、聊天皮肤、动画、发布工程或分页元素。图片仍需存在于导出包中，或为可访问的 HTTP(S) 地址；导出包未提供的附件不能恢复。

## HTML / CSS / 样式包

样式面板内置 SealChat 原版气泡、紧凑、剧本、小说、调查档案、舰桥日志、基础排版七份样式，模板、配色与规则保持上游原样。点击卡片立即切换，不需要再载入或应用。样式参数提供对应的布尔、数字、颜色和文本控件；高级 HTML/CSS/规则默认折叠，有效修改自动应用，无效输入保留上次效果。小说和剧本原版不显示头像，差分数据不会被删除。来源版本及许可保留在源码 `src/assets/log-styles/` 中。

正文使用上游模板需要的段落结构，连续同角色、同差分、同窗口、同消息类型且匹配同一模板的发言添加 `log-merged` 标记，保留原版合并外观。该设置只影响排版，不合并日志数据；「页面」可关闭。保留 `log-pages` / `log-flow` 容器及布尔设计变量，以支持原版背景、字体和打印规则。

可导入 HTML 模板、CSS 文件、SealChat v1 完整样式 JSON 或资源 ZIP。HTML 是每条消息的模板，必须恰好有一个 `data-log-slot="body"`，不是任意网页截图或已渲染的整份日志。HTML 文件里的 `<style>` 自动提取为 CSS。

支持 `data-log-text`、`data-log-if`、图片 `data-log-bind-src`、`data-log-part` 和正文插槽；可绑定名字、配色、头像、正文纯文本、时间、标题和窗口。支持设计变量及按消息类型、角色 ID、差分标签匹配的首条规则。消息类型按当前编辑日志推断为 ic / ooc / dice；标准导出未提供的工程元数据、悄悄话或引用专用字段不作恢复。

含资源的样式使用 ZIP 导入：`manifest.json`、`tokens.json`、`settings.schema.json`、`templates/*.html`、`styles/main.css`、`assets/*`。CSS 中的 `url(assets/...)` 解析为本地图片或字体。下载样式包使用同一布局，保留设置 schema、规则、模板和资源；设置 schema 不自动生成元素控件，设计变量可通过「样式参数」或 JSON 编辑区修改。

无效模板显示具体错误，保留此前已应用的样式。工作台默认使用上述样式，输出静态 HTML；窗口筛选和整理在内容面板进行，导出包含全部有效发言。TXT、论坛代码、Word 仍从主界面导出，不使用 HTML 模板。

设置与图片在当前浏览器保存，大资源使用 IndexedDB；可下载样式包备份。预览使用隔离 iframe，自定义导出不执行脚本。ZIP 限 20 MB 压缩体积、200 个文件和 50 MB 解压体积。

## 参考协议

根据 2026-11-24 读取的 [SealChat](https://github.com/kagangtuya-star/sealchat) 主分支实现：

- [样式编写协议](https://github.com/kagangtuya-star/sealchat/blob/master/doc/log-layout-style-authoring.md)
- [样式 ZIP 格式](https://github.com/kagangtuya-star/sealchat/blob/master/ui/src/services/log/logStyleZip.ts)
- [标准导出数据格式](https://github.com/kagangtuya-star/sealchat/blob/master/service/export_formatter.go)
- [HTML 分片数据嵌入方式](https://github.com/kagangtuya-star/sealchat/blob/master/service/export_viewer_renderer.go)

协议对接独立实现；没有接入 SealChat 服务端账号、发布、上游分页算法或完整工程编辑器。
