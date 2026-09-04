import { App, Component, Notice, setIcon } from "obsidian";
import { NoteMeta, renderMarkdown } from "./metadata";
import { AtomicCardsSettings, RenderOptions } from "./types";

export interface CardEnv {
  app: App;
  settings: AtomicCardsSettings;
  sourcePath: string;
  component: Component;
  /** 当前嵌套层级，用于递归渲染时限制深度 */
  depth: number;
}

let nestMarker = 0;

export function getNest(): number {
  return nestMarker;
}

export function withNest<T>(depth: number, fn: () => T): T {
  const prev = nestMarker;
  nestMarker = depth;
  try {
    return fn();
  } finally {
    nestMarker = prev;
  }
}

function fmtCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k 字` : `${n} 字`;
}

/** 没有封面时，用类型/路径推断一个图标 */
function iconFor(meta: NoteMeta): string {
  // 段落 / 知识点级引用
  if (meta.blockContent) return "quote";
  const type = (meta.badges.find((b) => b.key === "type")?.value || "").toLowerCase();
  const hay = `${type} ${meta.file?.path ?? meta.target}`.toLowerCase();
  if (/chapter|章节|组合/.test(hay)) return "layers";
  if (/concept|概念/.test(hay)) return "lightbulb";
  if (/entity|实体/.test(hay)) return "user";
  if (/resource|资源/.test(hay)) return "package";
  if (/goal|目标/.test(hay)) return "target";
  if (/meta|dashboard|index/.test(hay)) return "layout-grid";
  if (/atom|原子/.test(hay)) return "circle-dot";
  return "file-text";
}

async function openNote(env: CardEnv, meta: NoteMeta, e: MouseEvent) {
  if (!meta.file) {
    const name = meta.target.split("#")[0].replace(/\.md$/i, "");
    try {
      const file = await env.app.vault.create(
        `${name}.md`,
        `---\ntype: atom\ntitle: "${meta.title}"\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n# ${meta.title}\n\n`
      );
      await env.app.workspace.openLinkText(file.path, env.sourcePath, false);
    } catch (err) {
      new Notice(`创建失败：${String(err)}`);
    }
    return;
  }
  const newLeaf = e.ctrlKey || e.metaKey || e.button === 1;
  // target 可能带 #标题 / #^块id，交给 Obsidian 定位到段落
  await env.app.workspace.openLinkText(meta.target || meta.file.path, env.sourcePath, newLeaf);
}

function hrefOf(meta: NoteMeta): string {
  if (!meta.file) return "#";
  return meta.ref ? `${meta.file.path}#${meta.ref}` : meta.file.path;
}

function buildMetaRow(meta: NoteMeta): HTMLElement | null {
  if (!meta.badges.length && !meta.updated && !meta.wordCount) return null;
  const row = document.createElement("div");
  row.className = "ac-card__meta";
  for (const b of meta.badges.slice(0, 2)) {
    row.createSpan({ cls: `ac-badge ac-badge--${b.key}`, text: b.value });
  }
  if (meta.updated) row.createSpan({ cls: "ac-meta__date", text: meta.updated });
  if (meta.wordCount) row.createSpan({ cls: "ac-meta__words", text: fmtCount(meta.wordCount) });
  return row;
}

function buildTagRow(meta: NoteMeta, limit: number): HTMLElement | null {
  if (!meta.tags.length) return null;
  const row = document.createElement("div");
  row.className = "ac-card__tags";
  for (const t of meta.tags.slice(0, limit)) row.createSpan({ cls: "ac-tag", text: `#${t}` });
  return row;
}

export function renderCard(env: CardEnv, meta: NoteMeta, opts: RenderOptions): HTMLElement {
  const isWrap = opts.layout !== "card";
  const isSmall = opts.size === "small";

  const card = document.createElement("div");
  card.className = `ac-card ac-${opts.density} ac-size-${opts.size} ac-${
    isWrap ? "wrap" : "cardstyle"
  }`;
  card.dataset.path = meta.file?.path ?? meta.target;
  if (!meta.file) card.classList.add("is-missing");
  if (meta.blockContent) card.classList.add("is-block");
  if (opts.height > 0) card.style.setProperty("--ac-card-h", `${opts.height}px`);

  /* ---------- 正文容器（先建，最后 append） ---------- */
  const body = document.createElement("div");
  body.className = "ac-card__body";
  body.style.display = "none";
  let bodyLoaded = false;

  const loadBody = () => {
    if (bodyLoaded || !meta.file) return;
    bodyLoaded = true;
    const file = meta.file;
    void env.app.vault.cachedRead(file).then((raw) => {
      const full = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
      const md = meta.blockContent ?? full;
      body.empty();
      withNest(env.depth, () => {
        renderMarkdown(env.app, md, body, file.path, env.component);
      });
    });
  };

  /* ---------- 竖版卡牌：顶部封面 ---------- */
  if (!isWrap && opts.cover && meta.cover) {
    const cover = card.createDiv({ cls: "ac-card__cover" });
    const img = cover.createEl("img", {
      attr: { src: meta.cover, alt: meta.title, loading: "lazy", draggable: "false" },
    });
    img.addEventListener("error", () => cover.remove());
  }

  /* ---------- 头部：图标 + 标题 + 标签 + 徽章 + 操作，全在一行 ---------- */
  const head = card.createDiv({ cls: "ac-card__head" });

  if (isWrap) {
    const thumb = head.createDiv({ cls: "ac-card__thumb" });
    if (opts.cover && meta.cover) {
      const img = thumb.createEl("img", {
        attr: { src: meta.cover, alt: meta.title, loading: "lazy", draggable: "false" },
      });
      img.addEventListener("error", () => {
        thumb.empty();
        setIcon(thumb, iconFor(meta));
      });
    } else {
      setIcon(thumb, iconFor(meta));
    }
  }

  const titleEl = document.createElement("a");
  titleEl.className = "ac-card__title";
  titleEl.setAttr("href", hrefOf(meta));
  titleEl.textContent = meta.title;
  titleEl.title = meta.file
    ? `${hrefOf(meta)}（点击展开/收起，Ctrl+点击跳到原文）`
    : `新建：${meta.target}`;
  head.appendChild(titleEl);

  if (!meta.file) head.createSpan({ cls: "ac-card__missing", text: "未创建" });

  if (opts.tags) {
    const tagRow = buildTagRow(meta, isSmall ? 2 : 3);
    if (tagRow) head.appendChild(tagRow);
  }

  if (opts.meta) {
    const metaRow = buildMetaRow(meta);
    if (metaRow) head.appendChild(metaRow);
  }

  const actions = head.createDiv({ cls: "ac-card__actions" });

  const toggleBtn = actions.createEl("button", { cls: "ac-btn ac-btn--toggle" });
  const toggleIcon = toggleBtn.createSpan({ cls: "ac-btn__icon" });
  const toggleText = toggleBtn.createSpan({ cls: "ac-btn__text", text: "展开" });
  setIcon(toggleIcon, "chevron-down");

  if (opts.open) {
    const openBtn = actions.createEl("button", { cls: "ac-btn ac-btn--open" });
    const openIcon = openBtn.createSpan({ cls: "ac-btn__icon" });
    openBtn.createSpan({ cls: "ac-btn__text", text: "打开" });
    setIcon(openIcon, "arrow-up-right");
    openBtn.title = meta.file ? "在原始文档中打开" : "创建这篇文档";
    openBtn.addEventListener("click", (e) => void openNote(env, meta, e));
  }

  /* ---------- 摘要（中） ---------- */
  card.createDiv({
    cls: "ac-card__summary",
    text: meta.summary || (meta.file ? "（暂无摘要）" : "点击标题创建这篇原子文档"),
  });

  /* ---------- 正文（深） ---------- */
  card.appendChild(body);

  /* ---------- 展开 / 收起 ---------- */
  let expanded = false;
  const setExpanded = (next: boolean) => {
    expanded = next;
    card.classList.toggle("is-expanded", expanded);
    toggleText.textContent = expanded ? "收起" : "展开";
    setIcon(toggleIcon, expanded ? "chevron-up" : "chevron-down");
    body.style.display = expanded ? "" : "none";
    if (expanded) loadBody();
  };

  toggleBtn.addEventListener("click", () => setExpanded(!expanded));

  // 点标题是折叠开关；按住 Ctrl/Cmd 才跳到原文
  titleEl.addEventListener("click", (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      void openNote(env, meta, e);
      return;
    }
    setExpanded(!expanded);
  });

  // 头部空白处也可以折叠（按钮和链接自己处理，不重复触发）
  head.addEventListener("click", (e) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest("button, a")) return;
    setExpanded(!expanded);
  });

  if (opts.expanded) setExpanded(true);

  return card;
}
