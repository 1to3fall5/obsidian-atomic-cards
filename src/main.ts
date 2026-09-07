import {
  Editor,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
} from "obsidian";
import { renderCard, getNest, withNest, ReorderRequest, isCardReorderDrag } from "./card";
import { readNoteMeta } from "./metadata";
import { AtomicCardsSettingTab } from "./settings";
import {
  AtomicCardsSettings,
  DEFAULT_SETTINGS,
  RenderOptions,
  SETTINGS_VERSION,
  Size,
  SKIP_EMBED_EXT,
} from "./types";

export default class AtomicCardsPlugin extends Plugin {
  settings: AtomicCardsSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    try {
      await this.loadSettings();
      this.addSettingTab(new AtomicCardsSettingTab(this.app, this));

      // 接管 Obsidian 原生 ![[ ]] 嵌入：语法保持原生，只把渲染替换成卡片。
      // sortOrder 取大值 → 排在所有内置处理器（含嵌入渲染）之后运行，
      // 否则 post processor 会跑在嵌入生成之前，什么也匹配不到。
      this.registerMarkdownPostProcessor(
        (el, ctx) => {
          this.upgradeEmbeds(el, ctx);
          // 嵌入由 Obsidian 异步填充，补两次扫描兜底。
          // 已接管的元素带 data-ac-upgraded，重复扫描不会重复渲染。
          window.setTimeout(() => this.upgradeEmbeds(el, ctx), 60);
          window.setTimeout(() => this.upgradeEmbeds(el, ctx), 400);
        },
        1000
      );

      this.registerCommands();

      // ⚠️ 不要注册 CodeMirror 扩展（src/editor.ts）：@codemirror/* 必须是 external，
      // 一旦打包就会出现两份 @codemirror/state，导致
      // "Unrecognized extension value ... multiple instances" 而整个插件加载失败。
      // Live Preview 的卡片外观改由 snippet 的 CSS 方案实现（见第五节）。

      // 接管拖放：从文件列表拖笔记进来 → 插入 ![[ ]] 而不是默认的 [[ ]]。
      // ⚠️ 不能用 workspace 的 "editor-drop" 事件：实测拖 Obsidian 内部文件时它不触发。
      // 改监听 DOM 的原生 drop（capture 阶段），一定能拿到。
      this.registerDomEvent(document, "drop", (evt: DragEvent) => this.onDomDrop(evt), true);

      if (this.settings.verbose) {
        console.log("[atomic-cards] 已加载，upgradeEmbeds =", this.settings.upgradeEmbeds);
      }
    } catch (err) {
      console.error("[atomic-cards] onload 失败：", err);
      new Notice(`Atomic Cards 加载失败：${String(err)}`);
    }
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
   * 渲染：接管原生嵌入
   * ===================================================================== */

  private upgradeEmbeds(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    try {
      this.doUpgradeEmbeds(el, ctx);
    } catch (err) {
      console.error("[atomic-cards] upgradeEmbeds 出错：", err);
    }
  }

  private doUpgradeEmbeds(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (!this.settings.upgradeEmbeds) return;
    // 达到嵌套上限时不再接管，避免循环引用无限套娃
    if (getNest() >= this.settings.maxNestDepth) return;

    // :not(.media-embed) 直接在选择器层排掉图片/音视频嵌入，
    // 不用把它们捞进循环再过滤（条目正文里常有几十张图）。
    const nodes = Array.from(
      el.querySelectorAll<HTMLElement>(
        ".internal-embed:not(.media-embed), .markdown-embed:not(.media-embed)"
      )
    ).filter((n) => !n.dataset.acUpgraded);

    let taken = 0;
    for (const embed of nodes) {
      // ⚠️ 只判断"嵌入本身"是不是媒体元素，不能查所有后代：
      // 笔记正文里普遍有图片，用 querySelector 会把整篇嵌入误判成图片嵌入。
      const first = embed.firstElementChild;
      if (first && /^(IMG|AUDIO|VIDEO|CANVAS|IFRAME)$/.test(first.tagName)) continue;

      // src 优先，没有则用 alt 兜底
      const src = (embed.getAttribute("src") ?? embed.getAttribute("alt") ?? "").trim();
      if (!src) continue;
      // 图片 / 音视频 / PDF / 画布等按扩展名排除
      if (SKIP_EMBED_EXT.test(src.split("#")[0])) continue;

      embed.dataset.acUpgraded = "1";
      taken++;
      void this.replaceWithCard(embed, src, ctx).catch((err) =>
        console.error("[atomic-cards] 渲染卡片失败：", src, err)
      );
    }
    // 常规运行不打印，排查时在设置里打开「详细日志」
    if (taken && this.settings.verbose) {
      console.log("[atomic-cards] 已接管", taken, "处嵌入");
    }
  }

  private async replaceWithCard(
    embed: HTMLElement,
    src: string,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    const depth = getNest();
    const size: Size = depth > 0 ? this.settings.nestedSize : "normal";
    const isSmall = size === "small";

    const opts: RenderOptions = {
      size,
      density: isSmall ? "compact" : this.settings.density,
      layout: this.settings.layout,
      cover: this.settings.showCover,
      meta: isSmall ? false : this.settings.showMeta,
      tags: isSmall ? false : this.settings.showTags,
      // 标题是折叠开关，"打开"按钮是唯一的跳转入口
      open: isSmall ? true : this.settings.showOpenButton,
      expanded: depth > 0 ? this.settings.nestedExpanded : this.settings.defaultExpanded,
      height: this.settings.cardHeight,
      summary: isSmall ? 90 : this.settings.summaryLength,
    };

    // 挂在游离节点上：只借用生命周期，onunload 时清空它不影响文档
    const holder = document.createElement("div");
    const component = new MarkdownRenderChild(holder);
    component.load();
    ctx.addChild(component);

    const env = {
      app: this.app,
      settings: this.settings,
      sourcePath: ctx.sourcePath,
      component,
      // +1：卡片正文里再渲染的内容属于下一层，递增后嵌套深度上限才有效
      depth: depth + 1,
      onReorder: (req: ReorderRequest) => void this.reorderEmbeds(ctx.sourcePath, req),
    };

    // ⚠️ 先同步占住位置，再异步生成真正的卡片。
    // 之前是 await 之后再 replaceWith，但 readNoteMeta 是异步的，
    // 等它返回时 Obsidian 可能已经重建过节点 → embed.isConnected 为 false → 卡片丢失。
    // 先放占位元素就不存在这个竞态：占位元素随父节点一起留在文档里。
    const placeholder = document.createElement("div");
    placeholder.className = "ac-card ac-card--pending";
    placeholder.dataset.acPath = src;
    placeholder.setText(src.split("/").pop()?.replace(/\.md$/i, "") ?? src);
    embed.replaceWith(placeholder);

    // src 形如 "笔记"、"笔记.md"、"笔记#标题"、"笔记#^块id"
    const target = src.replace(/\.md(?=#|$)/i, "");
    const meta = await readNoteMeta(this.app, target, ctx.sourcePath, this.settings);

    const card = withNest(depth, () => renderCard(env, meta, opts));
    placeholder.replaceWith(card);
  }

  /* =======================================================================
   * 拖放：让"拖笔记进来"默认得到嵌入 ![[ ]]
   * ===================================================================== */

  private onDomDrop(evt: DragEvent): void {
    if (!this.settings.embedOnDrop) return;

    // 日志必须打在最前面：否则无法区分"事件没触发"和"被下面的判断挡掉了"
    const t = evt.target;
    if (this.settings.verbose) {
      console.log("[atomic-cards] dom drop:", {
        target: t instanceof Element ? `${t.tagName}.${t.className}` : String(t),
        inEditor: !!(t instanceof Element && t.closest(".markdown-source-view, .cm-editor, .cm-content")),
        types: evt.dataTransfer ? Array.from(evt.dataTransfer.types) : null,
        text: evt.dataTransfer?.getData("text/plain") ?? "",
      });
    }

    // ⚠️ 不能用 activeEditor()：拖拽时活动视图往往还停在文件资源管理器（拖拽源），
    //    取不到目标编辑器。要从 drop 的目标元素反查它属于哪个编辑器。
    // 卡片正在被拖去重排 → 不要触发链接改写，否则会把刚挪好的嵌入又改乱
    if (isCardReorderDrag()) return;

    const editor = this.editorFromDrop(evt) ?? this.activeEditor();
    if (!editor) {
      if (this.settings.verbose) console.log("[atomic-cards] 找不到目标编辑器");
      return;
    }

    // 不阻止默认行为：让 Obsidian 正常插入链接，稍后改写成 ![[笔记]]。
    // Obsidian 插入可能是异步的，分几次试探（改写过就不会再匹配，安全）。
    for (const delay of [80, 250, 600]) {
      window.setTimeout(() => this.linkToEmbedAtCursor(editor), delay);
    }
  }

  /* ---------- 重排：把源码里的 ![[source]] 行搬到 ![[target]] 的前/后 ----------
     直接改文件（vault.process），阅读模式和编辑模式都能用。
     只做整行搬运，不匹配就原样返回，不会损坏文件。 */
  private async reorderEmbeds(sourcePath: string, req: ReorderRequest): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) return;

    const verbose = this.settings.verbose;
    if (verbose) console.log("[atomic-cards] reorder:", req, "→", sourcePath);

    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const from = lines.findIndex((l) => this.lineEmbeds(l, req.source));
      if (from < 0) {
        if (verbose) console.log("[atomic-cards] 找不到源嵌入行：", req.source);
        return data;
      }
      const [moved] = lines.splice(from, 1);
      const to = lines.findIndex((l) => this.lineEmbeds(l, req.target));
      if (to < 0) {
        if (verbose) console.log("[atomic-cards] 找不到目标嵌入行：", req.target);
        return data;
      }
      lines.splice(req.before ? to : to + 1, 0, moved);
      if (verbose) console.log("[atomic-cards] 移动行", from, "→", to);
      return lines.join("\n");
    });

    new Notice(`已把「${req.source}」移到「${req.target}」${req.before ? "之前" : "之后"}`);
  }

  /**
   * 这一行是否是 name 的嵌入。
   * ⚠️ 笔记名是短名（灯光-烘焙），但源码里可能写成完整路径
   * （![[wiki-ai/…/灯光-烘焙]]），也可能带别名或小节引用，都要认。
   */
  private lineEmbeds(line: string, name: string): boolean {
    const t = line.trim();
    if (!t.startsWith("![[")) return false;
    const end = t.indexOf("]]");
    if (end < 0) return false;
    const inner = t.slice(3, end);
    const target = inner.split("|")[0].split("#")[0].trim().replace(/\.md$/i, "");
    return target === name || target.endsWith(`/${name}`);
  }

  /** 从拖放目标元素反查所属编辑器的 Editor 实例 */
  private editorFromDrop(evt: DragEvent): Editor | null {
    const target = evt.target;
    if (!(target instanceof Element)) return null;
    // 用数组收集：闭包里给 let 变量赋值会被 TS 收窄成 never
    const hits: MarkdownView[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.containerEl.contains(target)) hits.push(view);
    });
    return hits[0]?.editor ?? null;
  }

  /**
   * 把光标前刚插入的链接就地改写成 ![[笔记]]。
   * 拖 Obsidian 内部文件时，原生可能插入三种形态，都要认：
   *   ① [[笔记]]               （wikilink 设置）
   *   ② [标题](obsidian://…)   （实测默认走这种，dataTransfer 里是 obsidian:// URL）
   *   ③ obsidian://… 裸链接
   * 都不是就原样放过，避免误伤拖图片 / 外部文本。
   */
  private linkToEmbedAtCursor(editor: Editor): void {
    const cur = editor.getCursor();
    const line = editor.getLine(cur.line) ?? "";
    const head = line.slice(0, cur.ch);

    if (this.settings.verbose) {
      console.log("[atomic-cards] 光标前文本：", JSON.stringify(head.slice(-120)));
    }

    const replace = (matched: string, name: string) => {
      const from = { line: cur.line, ch: cur.ch - matched.length };
      editor.replaceRange(`![[${name}]]`, from, cur);
      if (this.settings.verbose) {
        console.log("[atomic-cards] 链接改写为嵌入：", matched, "→", `![[${name}]]`);
      }
    };

    // ① wikilink（且前面不是 !，避免重复改写）
    const wiki = head.match(/(?:^|[^!])(\[\[[^\]]+\]\])$/);
    if (wiki) {
      const inner = wiki[1].slice(2, -2).split("|")[0].trim();
      if (inner) {
        replace(wiki[1], inner);
        return;
      }
    }

    // ② markdown 链接，href 是 obsidian:// URL
    const md = head.match(/\[[^\]]*\]\(([^)]+)\)$/);
    if (md) {
      const name = this.noteNameFromObsidianUrl(md[1]);
      if (name) {
        replace(md[0], name);
        return;
      }
      return;
    }

    // ③ 裸 obsidian:// 链接
    const bare = head.match(/(obsidian:\/\/\S+)$/);
    if (bare) {
      const name = this.noteNameFromObsidianUrl(bare[1]);
      if (name) replace(bare[1], name);
    }
  }

  /** 从 obsidian://open?vault=X&file=<path> 里取出笔记名（去掉文件夹与 .md） */
  private noteNameFromObsidianUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const file = u.searchParams.get("file");
      if (!file) return null;
      const decoded = decodeURIComponent(file);
      const base = decoded.split("/").pop()?.replace(/\.md$/i, "").trim() ?? "";
      return base || null;
    } catch {
      return null;
    }
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
      id: "links-to-embeds",
      name: "把选区里的 [[链接]] 转成嵌入列表",
      editorCallback: (editor: Editor) => this.linksToEmbeds(editor),
    });

    this.addCommand({
      id: "insert-reverse-embeds",
      name: "插入反查列表（引用本文的笔记，生成为嵌入）",
      editorCallback: (editor: Editor) => this.insertReverseEmbeds(editor),
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

  /** 选区里的 [[链接]] → 原生嵌入列表 `- ![[链接]]` */
  private linksToEmbeds(editor: Editor): void {
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
    editor.replaceSelection(found.map((t) => `- ![[${t}]]`).join("\n"));
    new Notice(`已插入 ${found.length} 处嵌入`);
  }

  /** 反查：把引用了本文的笔记以原生嵌入列表插入（静态结果，不是动态渲染） */
  private insertReverseEmbeds(editor: Editor): void {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("当前没有打开的文件");
      return;
    }
    const links = this.app.metadataCache.resolvedLinks;
    const refs = Object.keys(links).filter((src) => links[src]?.[file.path]);
    if (!refs.length) {
      new Notice("没有笔记引用本文");
      return;
    }
    const text = `被引用在：\n\n${refs
      .map((r) => `- ![[${r.replace(/\.md$/i, "")}]]`)
      .join("\n")}\n`;
    editor.replaceRange(text, editor.getCursor());
    new Notice(`已插入 ${refs.length} 条引用`);
  }
}
