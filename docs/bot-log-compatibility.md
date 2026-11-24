# 青果与溯洄本地日志

- 青果（OlivaDiceLogger）：导入导出的 `.trpglog`，或相同内容的 `.txt` / `.log` 文件。支持 `名字(ID) YYYY-MM-DD HH:mm:ss` 后接正文的格式，连续消息不要求空行分隔。实现依据 [OlivaDiceLogger 的 releaseLogFile](https://github.com/OlivOS-Team/OlivaDiceLogger/blob/main/OlivaDiceLogger/logger.py)。不包含青果链接下载或内部 `.olivadicelog` 数据库格式。
- 溯洄（Dice!）：导入默认文本日志；支持横杠或斜杠日期，以及仅含时间的头部。保留名字、ID、时间、正文、图片标记；已有差分标签和窗口后缀同样保留。
- 主界面替换导入和列表编辑的多文件追加均接受 `.trpglog`。导入后可按原有流程标记 main / HO1 等窗口、整理内容块、编辑、染色和导出。

统一文本头解析与染色规则，避免先匹配仅含时间的形式而把 `2026-11-24` 吞入名字。回归测试覆盖连续发言、单条消息、CRLF、嵌套括号昵称、平台 ID、时间、段落、图片标记、差分、窗口以及导出后再导入。
