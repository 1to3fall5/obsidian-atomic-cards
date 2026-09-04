import { App, CachedMetadata, Component, FrontMatterCache, MarkdownRenderer, TFile } from "obsidian";

export interface NoteBadge {
  key: string;
  value: string;
}

export interface NoteMeta {
  file: TFile | null;
  /** 原始引用（可含 #标题 或 #^块id） */
  target: string;
  /** # 之后的部分，没有则为空 */
  ref: string;
  title: string;
  summary: string;
  cover: string | null;
  tags: string[];
  badges: NoteBadge[];
  updated: string;
  wordCount: number;
  /** 段落级引用（[[页#标题]] / [[页#^块]]）时，该段落的正文 */
  blockContent?: string;
}

const cache = new Map<string, NoteMeta>();

function stripFrontmatter(raw: string): string {
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? raw.slice(m[0].length) : raw;
}

/** 把 markdown 正文压成一段纯文本摘要 */
export function toPlainText(body: string): string {
  return stripFrontmatter(body)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*>\s*\[!\w+[^\]]*\].*$/gm, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_m, a: string, b: string) => b || a)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_`~=]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstText(content: string): string {
  const text = toPlainText(content);
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

/**
 * 从文档里截取一个段落（知识点）。
 * 支持 `[[页#标题]]` 与 `[[页#^块id]]` 两种引用。
 */
export function extractBlock(
  raw: string,
  fileCache: CachedMetadata | null,
  ref: string
): { title: string; content: string } | null {
  const lines = raw.split(/\r?\n/);
  const wanted = decodeURIComponent(ref);

  // 块引用 ^blockid
  if (wanted.startsWith("^")) {
    const block = fileCache?.blocks?.[wanted.slice(1)];
    if (!block) return null;
    const content = lines
      .slice(block.position.start.line, block.position.end.line + 1)
      .join("\n");
    return { title: firstText(content) || wanted, content };
  }

  // 标题引用 #heading
  const headings = fileCache?.headings ?? [];
  const idx = headings.findIndex((h) => h.heading === wanted);
  if (idx < 0) return null;

  const h = headings[idx];
  const start = h.position.start.line;
  let end = lines.length - 1;
  for (let i = idx + 1; i < headings.length; i++) {
    if (headings[i].level <= h.level) {
      end = headings[i].position.start.line - 1;
      break;
    }
  }
  return { title: h.heading, content: lines.slice(start, Math.max(end, start) + 1).join("\n") };
}

function pickField(fm: FrontMatterCache | undefined, fields: string[]): string {
  if (!fm) return "";
  for (const f of fields) {
    const v = fm[f];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

function collectTags(app: App, file: TFile): string[] {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string") out.push(v.replace(/^#/, ""));
    else if (Array.isArray(v)) v.forEach(push);
  };
  push(fm?.tags);
  push(fm?.tag);
  if (!out.length) {
    const cacheTags = app.metadataCache.getFileCache(file)?.tags ?? [];
    for (const t of cacheTags) out.push(t.tag.replace(/^#/, ""));
  }
  return Array.from(new Set(out)).slice(0, 6);
}

function extractCover(app: App, file: TFile, body: string, fields: string[]): string | null {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  const declared = pickField(fm, fields);
  const candidates = [declared];

  if (!declared) {
    const wikiImg = body.match(/!\[\[([^\]|]+)/);
    if (wikiImg) candidates.push(wikiImg[1]);
    const mdImg = body.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (mdImg) candidates.push(mdImg[1]);
  }

  for (const c of candidates) {
    if (!c) continue;
    if (/^https?:\/\//i.test(c)) return c;
    const f = app.metadataCache.getFirstLinkpathDest(c.split("|")[0].trim(), file.path);
    if (f) return app.vault.getResourcePath(f);
  }
  return null;
}

export function resolveFile(app: App, target: string, sourcePath: string): TFile | null {
  const clean = target.split("#")[0].split("|")[0].trim();
  if (!clean) return null;
  return app.metadataCache.getFirstLinkpathDest(clean, sourcePath);
}

function formatDate(v: unknown): string {
  if (!v) return "";
  if (typeof v !== "string") return "";
  return v.length > 10 ? v.slice(0, 10) : v;
}

export async function readNoteMeta(
  app: App,
  target: string,
  sourcePath: string,
  settings: {
    summaryFields: string[];
    coverFields: string[];
    metaFields: string[];
    summaryLength: number;
  },
  alias?: string
): Promise<NoteMeta> {
  const hashIdx = target.indexOf("#");
  const pathPart = (hashIdx >= 0 ? target.slice(0, hashIdx) : target).split("|")[0].trim();
  const ref = hashIdx >= 0 ? target.slice(hashIdx + 1).trim() : "";
  const file = resolveFile(app, pathPart, sourcePath);
  const fallbackTitle = alias || ref || pathPart.split("/").pop() || target;

  if (!file) {
    return {
      file: null,
      target,
      ref,
      title: fallbackTitle,
      summary: "",
      cover: null,
      tags: [],
      badges: [],
      updated: "",
      wordCount: 0,
    };
  }

  const key = `${file.path}#${ref}:${file.stat.mtime}:${settings.summaryLength}`;
  const hit = cache.get(key);
  if (hit) return alias ? { ...hit, title: alias } : hit;

  const raw = await app.vault.cachedRead(file);
  const fileCache = app.metadataCache.getFileCache(file) ?? null;
  const fm = fileCache?.frontmatter;

  // 段落级引用：只取该段落，而不是整篇
  const block = ref ? extractBlock(raw, fileCache, ref) : null;
  const contentBody = block?.content ?? stripFrontmatter(raw);

  const manual = block ? "" : pickField(fm, settings.summaryFields);
  const plain = toPlainText(contentBody);
  const summary =
    manual ||
    plain.slice(0, settings.summaryLength) + (plain.length > settings.summaryLength ? "…" : "");

  const badges: NoteBadge[] = [];
  if (!block) {
    for (const key of settings.metaFields) {
      const v = fm?.[key];
      if (v === undefined || v === null) continue;
      const text = Array.isArray(v) ? v.join("/") : String(v);
      if (text.trim()) badges.push({ key, value: text.trim() });
    }
  } else {
    // 段落卡片只标来源文档类型，避免和整篇混淆
    const t = fm?.type;
    if (typeof t === "string" && t.trim()) badges.push({ key: "type", value: t.trim() });
  }

  const title =
    alias || (block ? block.title : "") || String(fm?.title || file.basename);

  const meta: NoteMeta = {
    file,
    target,
    ref,
    title,
    summary,
    cover: extractCover(app, file, contentBody, settings.coverFields),
    tags: block ? [] : collectTags(app, file),
    badges,
    updated: block ? "" : formatDate(fm?.updated) || formatDate(fm?.modified) || formatDate(fm?.created),
    wordCount: plain.length,
    blockContent: block?.content,
  };

  cache.set(key, meta);
  if (cache.size > 500) cache.clear();
  return meta;
}

/** 兼容新旧版本 Obsidian 的 markdown 渲染入口 */
export function renderMarkdown(
  app: App,
  markdown: string,
  el: HTMLElement,
  sourcePath: string,
  component: Component
): void {
  const md = MarkdownRenderer as unknown as {
    render?: (a: App, m: string, e: HTMLElement, p: string, c: Component) => void;
    renderMarkdown?: (m: string, e: HTMLElement, p: string, c: Component) => void;
  };
  // 必须优先用 render()：renderMarkdown() 是简化版，不会把独占一行的 ![[ ]]
  // 处理成块级嵌入，只留下一个 <span class="internal-embed"> 占位符，
  // 导致卡片正文里的嵌套嵌入永远无法被接管成卡片。
  if (typeof md.render === "function") {
    md.render(app, markdown, el, sourcePath, component);
  } else if (typeof md.renderMarkdown === "function") {
    md.renderMarkdown(markdown, el, sourcePath, component);
  } else {
    el.setText(markdown);
  }
}
