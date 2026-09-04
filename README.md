# Atomic Cards（Obsidian 插件）

把 Obsidian **原生嵌入** `![[笔记]]` 渲染成可折叠的**卡片**。

> 不引入任何新语法 —— 笔记里写的就是标准的 `![[ ]]` 嵌入，插件只负责"怎么渲染它"。

## 安装

**从 Release 安装**：在本仓库 Releases 下载 `main.js`、`manifest.json`、`styles.css` 三个文件，
放进 `<你的 vault>/.obsidian/plugins/atomic-cards/`，重启 Obsidian，到 设置 → 第三方插件 启用 **Atomic Cards**。

**从源码构建**：见文末「开发」。

## 为什么自研

现有的 Notes Explorer / Cards View / Note Gallery / Banyan 都是**全局浏览面板**；DataCards 依赖 Dataview 查询、无法在文档里显式点名"就是这几篇"。
本插件要的是：在章节文档正文下方，**显式列出**几个原子文档 → 渲染成卡片 → 可就地展开正文 → 卡片里还能再放嵌入（递归嵌套）。

**关键取舍：语法保持原生。** 笔记里就是 `![[ ]]`，不引入 cards 代码块之类的自定义语法 —— 这样图谱、反链、导出，以及任何理解 `![[ ]]` 的工具都能照常工作。渲染层可以换，笔记内容永远是干净的。

## 用法

直接用标准嵌入语法，独占一行即可：

```
- ![[笔记A]]
- ![[笔记B]]
- ![[笔记C#某个标题]]
- ![[笔记D#^块id]]
```

- 只接管**块级嵌入**（独占一行）；写在段落中间的行内嵌入 `![[x]]` 保持原样
- 图片 / 音频 / 视频 / PDF / 画布等非笔记嵌入不会被卡片化
- 卡片里再放 `![[ ]]` 会继续渲染成嵌套卡片（递归，默认 3 层上限）

在 设置 → Atomic Cards 里可关掉「接管原生嵌入 ![[ ]]」，关掉后插件完全不介入，嵌入保持 Obsidian 默认样式。

### 交互

- **点标题** = 展开 / 收起这张卡片（不会跳转到原文档）
- **Ctrl / Cmd + 点标题**，或点右下角 **打开 ↗** = 跳到原始文档（段落引用会定位到该段落）
- 卡片默认展开、一张占一整行，像一节一节可折叠的正文

### 段落级引用

`![[笔记#标题]]` 和 `![[笔记#^块id]]` 只嵌入那一段，卡片标题会显示该段落标题。

## 命令（Ctrl+P）

- 展开 / 收起本页所有卡片
- 把选区里的 `[[链接]]` 转成嵌入列表
- 插入反查列表（引用本文的笔记）

> 反查是**静态生成**的：命令执行时把结果写成 `- ![[...]]` 列表插入笔记，之后不会自动更新。
> 这是刻意的设计 —— 反查结果仍是原生语法，不引入"动态查询块"这种离开了插件就渲染不出来的东西。

## 卡片显示什么

- 封面：frontmatter 的 `cover` / `image` / `banner` / `thumbnail`，否则正文第一张图
- 标题：frontmatter `title`，否则文件名 / 段落标题；**点击 = 折叠展开**，Ctrl/Cmd+点击 = 跳到原文
- 摘要：frontmatter `summary` / `description` / `abstract`，否则正文首段自动截取
- 徽章：`type` / `status` / `domain` / `complexity` + 更新时间 + 字数
- 标签：frontmatter `tags` 或正文标签
- 展开：就地渲染完整正文（正文里的 `![[ ]]` 会继续渲染成嵌套卡片）

## 开发

```bash
cd .plugins/atomic-cards
npm install
npm run typecheck   # 类型检查
npm test            # 冒烟测试
npm run build       # 输出到 ../../.obsidian/plugins/atomic-cards/
npm run dev         # watch 模式
```

改动 `src/` 后执行 `npm run build`，再在 Obsidian 里 `Ctrl+P → Reload app without saving`。

## 零插件替代方案

仓库里的 `.obsidian/snippets/atomic-cards.css` 提供 callout 版卡片（无需插件、无需 Dataview）：

```
> [!cards]+ 本章引用的原子文档
> ![[笔记A]]
> ![[笔记B]]
```

## 可选样式片段（CSS snippet）

`snippets/atomic-cards-override.css` 是一套**可选的增强样式**，视觉为「白卡片 + 灰色内容区 + 深色可读文字」：

- 卡片白底 + 边框 + 阴影；**不改动 Obsidian 页面颜色**，保持界面原生外观
- 展开后的内容区浅灰底（`#F5F6F8`），与卡片本体拉开层次
- 嵌套卡片（条目级）白底浮在灰色内容区上
- 全部颜色走 `--ac-*` CSS 变量：`:root` 为亮色，`.theme-dark` 为深色，跟随主题自动切换

**用法**：把 `snippets/atomic-cards-override.css` 复制到 `<vault>/.obsidian/snippets/`，
到 设置 → 外观 → CSS 代码片段 打开 **atomic-cards-override**。

snippet 是热加载的：改完即生效，关掉开关即回到插件自带样式 —— 两套可随时切换。
