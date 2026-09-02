# Atomic Cards（Obsidian 插件）

把**原子文档**以内联**卡片墙**的形式组合进**章节文档**。

> 章节文档 = 一段自己的正文 + 若干原子文档的卡片。原子文档仍是独立页面，章节文档只负责组合（transclusion）。

## 安装

**从 Release 安装**：在本仓库 Releases 下载 `main.js`、`manifest.json`、`styles.css` 三个文件，
放进 `<你的 vault>/.obsidian/plugins/atomic-cards/`，重启 Obsidian，到 设置 → 第三方插件 启用 **Atomic Cards**。

**从源码构建**：见文末「开发」。

## 为什么自研

现有的 Notes Explorer / Cards View / Note Gallery / Banyan 都是**全局浏览面板**；DataCards 依赖 Dataview 查询、无法在文档里显式点名"就是这几篇"。
本插件要的是：在章节文档正文下方，**显式列出**几个原子文档 → 渲染成卡片 → 可就地展开正文 → 卡片里还能再放卡片（递归嵌套）。

## 用法

````
```cards
columns: 3
title: 本章引用的原子文档
- [[笔记A]]
- [[笔记B|自定义标题]]
- [[笔记C]]
```
````

### 交互

- **点标题** = 展开 / 收起这张卡片（不会跳转到原文档）
- **Ctrl / Cmd + 点标题**，或点右下角 **打开 ↗** = 跳到原始文档（段落引用会定位到该段落）
- 卡片默认**一张占一整行**、**默认展开**，像一节一节可折叠的正文（所有层级都一样）
- 嵌套的卡片墙左侧有缩进竖线标明层级；想横排成网格就写 `columns: 0` 或 `columns: 3`

### 块内选项

| 键 | 值 | 说明 |
|---|---|---|
| `columns` | 数字 / 0 | **1 = 每张卡片占一整行（默认）**；0 = 自适应；其他 = 固定列数 |
| `expanded` | true/false | 默认 **true**（所有层级），点标题折叠 |
| `size` | small / normal | 紧凑小卡片 / 常规卡片；默认 normal |
| `width` | px | 自适应时卡片最小宽度（small 150，normal 240） |
| `height` | px | 卡片最大高度，超出内部滚动 |
| `layout` | wrap / card | 包裹卡片（默认，横向扁平）/ 竖版卡牌（顶部大封面） |
| `summary` | 数字 | 摘要字符数（small 默认 90） |
| `cover` / `meta` / `tags` / `open` | true/false | 封面 / 元信息 / 标签 / 打开按钮 |
| `density` | compact / comfortable | 紧凑或宽松 |
| `from` | 文件夹 | 汇总某文件夹的全部笔记 |
| `tag` | 标签 | 汇总某标签的全部笔记 |
| `sort` | name / updated / created | 排序 |
| `limit` | 数字 | 最多几张 |
| `reverse` | true | 反查：列出所有引用本文的笔记（上层章节） |
| `title` | 文本 | 卡片墙标题 |

### 数据来源优先级

1. 显式列表项（`- [[...]]`）
2. `reverse: true` → 反查引用
3. `from` / `tag` → 按文件夹或标签汇总

### 命令（Ctrl+P）

- 插入卡片块模板
- 把嵌入 `![[...]]` 转成卡片墙
- 把选区里的 `[[链接]]` 转成卡片墙
- 插入反查卡片块
- 展开 / 收起本页所有卡片

## 卡片显示什么

- 封面：frontmatter 的 `cover` / `image` / `banner` / `thumbnail`，否则正文第一张图
- 标题：frontmatter `title`，否则文件名 / 段落标题；**点击 = 折叠展开**，Ctrl/Cmd+点击 = 跳到原文
- 摘要：frontmatter `summary` / `description` / `abstract`，否则正文首段自动截取
- 徽章：`type` / `status` / `domain` / `complexity` + 更新时间 + 字数
- 标签：frontmatter `tags` 或正文标签
- 展开：就地渲染完整正文（含内部的 cards 块，递归，默认 3 层上限）

## 开发

```bash
cd .plugins/atomic-cards
npm install
npm run typecheck   # 类型检查
npm run build       # 输出到 ../../.obsidian/plugins/atomic-cards/
npm run dev         # watch 模式
```

改动 `src/` 后执行 `npm run build`，再在 Obsidian 里 `Ctrl+P → Reload app without saving`。

## 零插件替代方案

仓库里的 `.obsidian/snippets/atomic-cards.css` 提供 callout 版卡片墙（无需插件、无需 Dataview）：

```
> [!cards]+ 本章引用的原子文档
> ![[笔记A]]
> ![[笔记B]]
```
