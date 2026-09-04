import {
  Editor,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownView,
  Notice,
  Plugin,
} from "obsidian";
import { renderCard, getNest, withNest } from "./card";
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
    await this.loadSettings();
    this.addSettingTab(new AtomicCardsSettingTab(this.app, this));

    // 接管 Obsidian 原生 ![[ ]] 嵌入：语法保持原生，只把渲染替换成卡片
    this.registerMarkdownPostProcessor((el, ctx) => this.upgradeEmbeds(el, ctx));

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
    if (!this.settings.upgradeEmbeds) return;
    // 达到嵌套上限时不再接管，避免循环引用无限套娃
    if (getNest() >= this.settings.maxNestDepth) return;

    for (const embed of Array.from(el.querySelectorAll<HTMLElement>(".internal-embed"))) {
      // 只接管块级嵌入（独占一行）；行内嵌入 ![[x]] 保持原样
      if (embed.tagName !== "DIV") continue;
      // 同一个元素只处理一次
      if (embed.dataset.acUpgraded) continue;

      const src = (embed.getAttribute("src") ?? "").trim();
      if (!src) continue;
      // 图片 / 音视频 / PDF / 画布等不是笔记，跳过
      if (SKIP_EMBED_EXT.test(src.split("#")[0])) continue;
      // 已经渲染成媒体元素的，跳过
      if (embed.querySelector("img, audio, video, canvas")) continue;

      embed.dataset.acUpgraded = "1";
      void this.replaceWithCard(embed, src, ctx);
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
      depth,
    };

    // src 形如 "笔记"、"笔记.md"、"笔记#标题"、"笔记#^块id"
    const target = src.replace(/\.md(?=#|$)/i, "");
    const meta = await readNoteMeta(this.app, target, ctx.sourcePath, this.settings);
    if (!embed.isConnected) return;

    const card = withNest(depth, () => renderCard(env, meta, opts));
    embed.replaceWith(card);
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
