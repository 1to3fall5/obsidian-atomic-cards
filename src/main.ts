import {
  Editor,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
} from "obsidian";
import { renderCard, getNest, withNest } from "./card";
import { readNoteMeta, resolveFile } from "./metadata";
import { parseCardsBlock } from "./parser";
import { AtomicCardsSettingTab } from "./settings";
import {
  AtomicCardsSettings,
  CardEntry,
  CardOptions,
  DEFAULT_SETTINGS,
  MergedOptions,
  SETTINGS_VERSION,
  Size,
} from "./types";

export default class AtomicCardsPlugin extends Plugin {
  settings: AtomicCardsSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new AtomicCardsSettingTab(this.app, this));

    const handler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) =>
      this.renderCardsBlock(source, el, ctx);

    this.registerMarkdownCodeBlockProcessor("cards", handler);
    this.registerMarkdownCodeBlockProcessor("atomic-cards", handler);
    this.registerMarkdownCodeBlockProcessor("ac", handler);

    this.registerCommands();
  }

  onunload(): void {
    /* Component 生命周期由 ctx.addChild 托管 */
  }

  async loadSettings(): Promise<void> {
    const saved = await this.loadData();
    if (saved && typeof saved === "object") {
      // 布局默认值变了，旧存档要迁移，否则用户端看到的还是旧布局
      if (saved.settingsVersion !== SETTINGS_VERSION) {
        Object.assign(saved, {
          columns: DEFAULT_SETTINGS.columns,
          layout: DEFAULT_SETTINGS.layout,
          nestedSize: DEFAULT_SETTINGS.nestedSize,
          defaultExpanded: DEFAULT_SETTINGS.defaultExpanded,
          nestedExpanded: DEFAULT_SETTINGS.nestedExpanded,
          settingsVersion: SETTINGS_VERSION,
        });
        await this.saveData(saved);
      }
      this.settings = Object.assign({ ...DEFAULT_SETTINGS }, saved);
    } else {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /* =======================================================================
   * 渲染
   * ===================================================================== */

  private mergeOptions(o: CardOptions, nested = false): MergedOptions {
    const s = this.settings;
    const size: Size = o.size ?? (nested ? s.nestedSize : "normal");
    const isSmall = size === "small";
    return {
      // 所有层级默认一张卡片占一整行；要横排网格就写 columns: 0 或具体列数
      columns: o.columns ?? s.columns,
      width: o.width || (isSmall ? 150 : s.minCardWidth),
      height: o.height ?? s.cardHeight,
      summary: o.summary ?? (isSmall ? 90 : s.summaryLength),
      expanded: o.expanded ?? (nested ? s.nestedExpanded : s.defaultExpanded),
      cover: o.cover ?? s.showCover,
      meta: o.meta ?? (isSmall ? false : s.showMeta),
      tags: o.tags ?? (isSmall ? false : s.showTags),
      // 标题不再跳转，"打开"按钮成了唯一跳转入口，小卡片也默认给
      open: o.open ?? (isSmall ? true : s.showOpenButton),
      density: o.density ?? (isSmall ? "compact" : s.density),
      layout: o.layout ?? s.layout,
      size,
      reverse: o.reverse ?? false,
      from: o.from ?? "",
      tag: o.tag ?? "",
      title: o.title ?? "",
      sort: o.sort ?? "name",
      limit: o.limit ?? 0,
    };
  }

  private renderCardsBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const depth = getNest();
    const { options, entries } = parseCardsBlock(source);
    // 嵌在别的卡片里时（depth > 0）默认切成知识点小卡片
    const opts = this.mergeOptions(options, depth > 0);

    const root = el.createDiv({ cls: "ac-root" });
    if (opts.title) root.createDiv({ cls: "ac-root__title", text: opts.title });

    const grid = root.createDiv({ cls: `ac-grid ac-grid--${opts.size}` });
    grid.style.gridTemplateColumns =
      opts.columns > 0
        ? `repeat(${opts.columns}, minmax(0, 1fr))`
        : `repeat(auto-fill, minmax(${opts.width}px, 1fr))`;

    if (depth >= this.settings.maxNestDepth) {
      grid.createDiv({
        cls: "ac-warn",
        text: `已达到最大嵌套深度（${this.settings.maxNestDepth}），停止递归渲染以避免循环引用。`,
      });
      return;
    }

    void this.fillGrid(grid, entries, opts, ctx, depth);
  }

  private async fillGrid(
    grid: HTMLElement,
    entries: CardEntry[],
    opts: MergedOptions,
    ctx: MarkdownPostProcessorContext,
    depth: number
  ): Promise<void> {
    const component = new MarkdownRenderChild(grid);
    component.load();
    ctx.addChild(component);

    const env = {
      app: this.app,
      settings: this.settings,
      sourcePath: ctx.sourcePath,
      component,
      depth: depth + 1,
    };

    const list = this.resolveEntries(entries, opts, ctx.sourcePath);
    if (!list.length) {
      grid.createDiv({ cls: "ac-empty", text: "没有匹配的原子文档" });
      return;
    }

    // 顺序渲染，保证卡片顺序稳定
    for (const entry of list) {
      const meta = await readNoteMeta(this.app, entry.target, ctx.sourcePath, this.settings, entry.alias);
      if (!grid.isConnected) return;
      const card = withNest(env.depth, () => renderCard(env, meta, opts));
      grid.appendChild(card);
    }
  }

  /* =======================================================================
   * 数据来源
   * ===================================================================== */

  private hasTag(file: TFile, tag: string): boolean {
    const c = this.app.metadataCache.getFileCache(file);
    const found: string[] = [];
    const push = (v: unknown) => {
      if (typeof v === "string") found.push(v.replace(/^#/, ""));
      else if (Array.isArray(v)) v.forEach(push);
    };
    push(c?.frontmatter?.tags);
    push(c?.frontmatter?.tag);
    (c?.tags ?? []).forEach((t) => found.push(t.tag.replace(/^#/, "")));
    return found.some((t) => t === tag || t.startsWith(`${tag}/`));
  }

  private sortEntries(entries: CardEntry[], opts: MergedOptions, sourcePath: string): CardEntry[] {
    const out = [...entries];
    if (opts.sort === "name") {
      out.sort((a, b) => a.target.localeCompare(b.target, "zh-Hans-CN"));
    } else if (opts.sort === "updated" || opts.sort === "created") {
      const key = opts.sort === "updated" ? "mtime" : "ctime";
      const timeOf = (t: string) => {
        const f = resolveFile(this.app, t, sourcePath);
        return f ? (f.stat as unknown as Record<string, number>)[key] ?? 0 : 0;
      };
      out.sort((a, b) => timeOf(b.target) - timeOf(a.target));
    }
    return opts.limit > 0 ? out.slice(0, opts.limit) : out;
  }

  private resolveEntries(entries: CardEntry[], opts: MergedOptions, sourcePath: string): CardEntry[] {
    if (entries.length) return entries;

    // 反查：列出所有引用了当前文档的笔记（上层章节）
    if (opts.reverse) {
      const links = this.app.metadataCache.resolvedLinks;
      const out: CardEntry[] = [];
      for (const src of Object.keys(links)) {
        if (links[src]?.[sourcePath]) out.push({ target: src.replace(/\.md$/i, "") });
      }
      return this.sortEntries(out, opts, sourcePath);
    }

    if (opts.from || opts.tag) {
      let files = this.app.vault.getMarkdownFiles();
      if (sourcePath) files = files.filter((f) => f.path !== sourcePath);
      if (opts.from) {
        const folder = opts.from.replace(/^\/|\/$/g, "");
        files = files.filter((f) => f.path === `${folder}.md` || f.path.startsWith(`${folder}/`));
      }
      if (opts.tag) {
        const want = opts.tag.replace(/^#/, "");
        files = files.filter((f) => this.hasTag(f, want));
      }
      return this.sortEntries(
        files.map((f) => ({ target: f.path.replace(/\.md$/i, "") })),
        opts,
        sourcePath
      );
    }

    return entries;
  }

  /* =======================================================================
   * 命令
   * ===================================================================== */

  private activeEditor(): Editor | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.editor ?? null;
  }

  private registerCommands(): void {
    this.addCommand({
      id: "insert-cards-block",
      name: "插入卡片块模板",
      editorCallback: (editor: Editor) => {
        const cursor = editor.getCursor();
        const block = "```cards\n\n- [[]]\n```\n";
        editor.replaceRange(block, cursor);
        editor.setCursor({ line: cursor.line + 2, ch: 6 });
      },
    });

    this.addCommand({
      id: "embeds-to-cards",
      name: "把嵌入 ![[...]] 转成卡片墙",
      editorCallback: (editor: Editor) => this.embedsToCards(editor),
    });

    this.addCommand({
      id: "links-to-cards",
      name: "把选区里的 [[链接]] 转成卡片墙",
      editorCallback: (editor: Editor) => this.linksToCards(editor),
    });

    this.addCommand({
      id: "insert-reverse-cards",
      name: "插入反查卡片块（列出引用本文的章节）",
      editorCallback: (editor: Editor) => {
        const cursor = editor.getCursor();
        editor.replaceRange("```cards\nreverse: true\ntitle: 被引用在\n```\n", cursor);
      },
    });

    this.addCommand({
      id: "toggle-all-cards",
      name: "展开 / 收起本页所有卡片",
      callback: () => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>(".ac-card"));
        if (!cards.length) {
          new Notice("当前视图里没有卡片");
          return;
        }
        const collapsed = cards.filter((c) => !c.classList.contains("is-expanded"));
        const targets = collapsed.length ? collapsed : cards;
        for (const c of targets) c.querySelector<HTMLElement>(".ac-btn--toggle")?.click();
        new Notice(collapsed.length ? `已展开 ${targets.length} 张卡片` : `已收起 ${targets.length} 张卡片`);
      },
    });
  }

  private selectionLineRange(editor: Editor): [number, number] {
    if (!editor.somethingSelected()) return [0, editor.lineCount() - 1];
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const endLine = to.ch === 0 && to.line > from.line ? to.line - 1 : to.line;
    return [from.line, Math.max(endLine, from.line)];
  }

  /** 把正文里连续的 ![[笔记]] 行合并成一个 cards 块 */
  private embedsToCards(editor: Editor): void {
    const content = editor.getValue();
    const lines = content.split("\n");
    const [from, to] = this.selectionLineRange(editor);

    const out: string[] = [];
    let buffer: string[] = [];
    let converted = 0;
    const flush = () => {
      if (!buffer.length) return;
      out.push("```cards");
      for (const t of buffer) out.push(`- [[${t}]]`);
      out.push("```");
      converted += buffer.length;
      buffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      if (i < from || i > to) {
        out.push(lines[i]);
        continue;
      }
      const m = lines[i].match(/^(\s*)(?:[-*+]\s*)?!\[\[([^\]]+)\]\]\s*$/);
      if (m) {
        buffer.push(m[2]);
        continue;
      }
      flush();
      out.push(lines[i]);
    }
    flush();

    if (!converted) {
      new Notice("没有找到独占一行的 ![[...]] 嵌入");
      return;
    }
    editor.setValue(out.join("\n"));
    new Notice(`已把 ${converted} 处嵌入合并为卡片墙`);
  }

  /** 选区里的 [[链接]]（列表或正文）→ cards 块 */
  private linksToCards(editor: Editor): void {
    const sel = editor.getSelection();
    if (!sel.trim()) {
      new Notice("请先选中包含 [[链接]] 的文本");
      return;
    }
    const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(sel)) !== null) {
      const t = m[1].trim();
      if (t && !found.includes(t)) found.push(t);
    }
    if (!found.length) {
      new Notice("选区里没有 [[链接]]");
      return;
    }
    const block = `\`\`\`cards\n${found.map((t) => `- [[${t}]]`).join("\n")}\n\`\`\``;
    editor.replaceSelection(block);
    new Notice(`已生成 ${found.length} 张卡片`);
  }
}
