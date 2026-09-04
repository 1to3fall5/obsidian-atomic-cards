var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AtomicCardsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/card.ts
var import_obsidian2 = require("obsidian");

// src/metadata.ts
var import_obsidian = require("obsidian");
var cache = /* @__PURE__ */ new Map();
function stripFrontmatter(raw) {
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? raw.slice(m[0].length) : raw;
}
function toPlainText(body) {
  return stripFrontmatter(body).replace(/```[\s\S]*?```/g, "").replace(/^\s*>\s*\[!\w+[^\]]*\].*$/gm, "").replace(/!\[\[[^\]]*\]\]/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_m, a, b) => b || a).replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/^\s{0,3}#{1,6}\s+.*$/gm, "").replace(/^\s{0,3}>\s?/gm, "").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+\.\s+/gm, "").replace(/[*_`~=]/g, "").replace(/\s+/g, " ").trim();
}
function firstText(content) {
  const text = toPlainText(content);
  return text.length > 24 ? `${text.slice(0, 24)}\u2026` : text;
}
function extractBlock(raw, fileCache, ref) {
  var _a, _b;
  const lines = raw.split(/\r?\n/);
  const wanted = decodeURIComponent(ref);
  if (wanted.startsWith("^")) {
    const block = (_a = fileCache == null ? void 0 : fileCache.blocks) == null ? void 0 : _a[wanted.slice(1)];
    if (!block) return null;
    const content = lines.slice(block.position.start.line, block.position.end.line + 1).join("\n");
    return { title: firstText(content) || wanted, content };
  }
  const headings = (_b = fileCache == null ? void 0 : fileCache.headings) != null ? _b : [];
  const idx = headings.findIndex((h2) => h2.heading === wanted);
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
function pickField(fm, fields) {
  if (!fm) return "";
  for (const f of fields) {
    const v = fm[f];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}
function collectTags(app, file) {
  var _a, _b, _c;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
  const out = [];
  const push = (v) => {
    if (typeof v === "string") out.push(v.replace(/^#/, ""));
    else if (Array.isArray(v)) v.forEach(push);
  };
  push(fm == null ? void 0 : fm.tags);
  push(fm == null ? void 0 : fm.tag);
  if (!out.length) {
    const cacheTags = (_c = (_b = app.metadataCache.getFileCache(file)) == null ? void 0 : _b.tags) != null ? _c : [];
    for (const t of cacheTags) out.push(t.tag.replace(/^#/, ""));
  }
  return Array.from(new Set(out)).slice(0, 6);
}
function extractCover(app, file, body, fields) {
  var _a;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
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
function resolveFile(app, target, sourcePath) {
  const clean = target.split("#")[0].split("|")[0].trim();
  if (!clean) return null;
  return app.metadataCache.getFirstLinkpathDest(clean, sourcePath);
}
function formatDate(v) {
  if (!v) return "";
  if (typeof v !== "string") return "";
  return v.length > 10 ? v.slice(0, 10) : v;
}
async function readNoteMeta(app, target, sourcePath, settings, alias) {
  var _a, _b;
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
      wordCount: 0
    };
  }
  const key = `${file.path}#${ref}:${file.stat.mtime}:${settings.summaryLength}`;
  const hit = cache.get(key);
  if (hit) return alias ? { ...hit, title: alias } : hit;
  const raw = await app.vault.cachedRead(file);
  const fileCache = (_a = app.metadataCache.getFileCache(file)) != null ? _a : null;
  const fm = fileCache == null ? void 0 : fileCache.frontmatter;
  const block = ref ? extractBlock(raw, fileCache, ref) : null;
  const contentBody = (_b = block == null ? void 0 : block.content) != null ? _b : stripFrontmatter(raw);
  const manual = block ? "" : pickField(fm, settings.summaryFields);
  const plain = toPlainText(contentBody);
  const summary = manual || plain.slice(0, settings.summaryLength) + (plain.length > settings.summaryLength ? "\u2026" : "");
  const badges = [];
  if (!block) {
    for (const key2 of settings.metaFields) {
      const v = fm == null ? void 0 : fm[key2];
      if (v === void 0 || v === null) continue;
      const text = Array.isArray(v) ? v.join("/") : String(v);
      if (text.trim()) badges.push({ key: key2, value: text.trim() });
    }
  } else {
    const t = fm == null ? void 0 : fm.type;
    if (typeof t === "string" && t.trim()) badges.push({ key: "type", value: t.trim() });
  }
  const title = alias || (block ? block.title : "") || String((fm == null ? void 0 : fm.title) || file.basename);
  const meta = {
    file,
    target,
    ref,
    title,
    summary,
    cover: extractCover(app, file, contentBody, settings.coverFields),
    tags: block ? [] : collectTags(app, file),
    badges,
    updated: block ? "" : formatDate(fm == null ? void 0 : fm.updated) || formatDate(fm == null ? void 0 : fm.modified) || formatDate(fm == null ? void 0 : fm.created),
    wordCount: plain.length,
    blockContent: block == null ? void 0 : block.content
  };
  cache.set(key, meta);
  if (cache.size > 500) cache.clear();
  return meta;
}
function renderMarkdown(app, markdown, el, sourcePath, component) {
  const md = import_obsidian.MarkdownRenderer;
  if (typeof md.renderMarkdown === "function") {
    md.renderMarkdown(markdown, el, sourcePath, component);
  } else if (typeof md.render === "function") {
    md.render(app, markdown, el, sourcePath, component);
  } else {
    el.setText(markdown);
  }
}

// src/card.ts
var nestMarker = 0;
function getNest() {
  return nestMarker;
}
function withNest(depth, fn) {
  const prev = nestMarker;
  nestMarker = depth;
  try {
    return fn();
  } finally {
    nestMarker = prev;
  }
}
function fmtCount(n) {
  return n >= 1e3 ? `${(n / 1e3).toFixed(1)}k \u5B57` : `${n} \u5B57`;
}
function iconFor(meta) {
  var _a, _b, _c;
  if (meta.blockContent) return "quote";
  const type = (((_a = meta.badges.find((b) => b.key === "type")) == null ? void 0 : _a.value) || "").toLowerCase();
  const hay = `${type} ${(_c = (_b = meta.file) == null ? void 0 : _b.path) != null ? _c : meta.target}`.toLowerCase();
  if (/chapter|章节|组合/.test(hay)) return "layers";
  if (/concept|概念/.test(hay)) return "lightbulb";
  if (/entity|实体/.test(hay)) return "user";
  if (/resource|资源/.test(hay)) return "package";
  if (/goal|目标/.test(hay)) return "target";
  if (/meta|dashboard|index/.test(hay)) return "layout-grid";
  if (/atom|原子/.test(hay)) return "circle-dot";
  return "file-text";
}
async function openNote(env, meta, e) {
  if (!meta.file) {
    const name = meta.target.split("#")[0].replace(/\.md$/i, "");
    try {
      const file = await env.app.vault.create(
        `${name}.md`,
        `---
type: atom
title: "${meta.title}"
created: ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}
---

# ${meta.title}

`
      );
      await env.app.workspace.openLinkText(file.path, env.sourcePath, false);
    } catch (err) {
      new import_obsidian2.Notice(`\u521B\u5EFA\u5931\u8D25\uFF1A${String(err)}`);
    }
    return;
  }
  const newLeaf = e.ctrlKey || e.metaKey || e.button === 1;
  await env.app.workspace.openLinkText(meta.target || meta.file.path, env.sourcePath, newLeaf);
}
function hrefOf(meta) {
  if (!meta.file) return "#";
  return meta.ref ? `${meta.file.path}#${meta.ref}` : meta.file.path;
}
function buildMetaRow(meta) {
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
function buildTagRow(meta, limit) {
  if (!meta.tags.length) return null;
  const row = document.createElement("div");
  row.className = "ac-card__tags";
  for (const t of meta.tags.slice(0, limit)) row.createSpan({ cls: "ac-tag", text: `#${t}` });
  return row;
}
function renderCard(env, meta, opts) {
  var _a, _b;
  const isWrap = opts.layout !== "card";
  const isSmall = opts.size === "small";
  const card = document.createElement("div");
  card.className = `ac-card ac-${opts.density} ac-size-${opts.size} ac-${isWrap ? "wrap" : "cardstyle"}`;
  card.dataset.path = (_b = (_a = meta.file) == null ? void 0 : _a.path) != null ? _b : meta.target;
  if (!meta.file) card.classList.add("is-missing");
  if (meta.blockContent) card.classList.add("is-block");
  if (opts.height > 0) card.style.setProperty("--ac-card-h", `${opts.height}px`);
  const body = document.createElement("div");
  body.className = "ac-card__body";
  body.style.display = "none";
  let bodyLoaded = false;
  const loadBody = () => {
    if (bodyLoaded || !meta.file) return;
    bodyLoaded = true;
    const file = meta.file;
    void env.app.vault.cachedRead(file).then((raw) => {
      var _a2;
      const full = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
      const md = (_a2 = meta.blockContent) != null ? _a2 : full;
      body.empty();
      withNest(env.depth, () => {
        renderMarkdown(env.app, md, body, file.path, env.component);
      });
    });
  };
  if (!isWrap && opts.cover && meta.cover) {
    const cover = card.createDiv({ cls: "ac-card__cover" });
    const img = cover.createEl("img", {
      attr: { src: meta.cover, alt: meta.title, loading: "lazy", draggable: "false" }
    });
    img.addEventListener("error", () => cover.remove());
  }
  const head = card.createDiv({ cls: "ac-card__head" });
  if (isWrap) {
    const thumb = head.createDiv({ cls: "ac-card__thumb" });
    if (opts.cover && meta.cover) {
      const img = thumb.createEl("img", {
        attr: { src: meta.cover, alt: meta.title, loading: "lazy", draggable: "false" }
      });
      img.addEventListener("error", () => {
        thumb.empty();
        (0, import_obsidian2.setIcon)(thumb, iconFor(meta));
      });
    } else {
      (0, import_obsidian2.setIcon)(thumb, iconFor(meta));
    }
  }
  const titleEl = document.createElement("a");
  titleEl.className = "ac-card__title";
  titleEl.setAttr("href", hrefOf(meta));
  titleEl.textContent = meta.title;
  titleEl.title = meta.file ? `${hrefOf(meta)}\uFF08\u70B9\u51FB\u5C55\u5F00/\u6536\u8D77\uFF0CCtrl+\u70B9\u51FB\u8DF3\u5230\u539F\u6587\uFF09` : `\u65B0\u5EFA\uFF1A${meta.target}`;
  head.appendChild(titleEl);
  if (!meta.file) head.createSpan({ cls: "ac-card__missing", text: "\u672A\u521B\u5EFA" });
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
  const toggleText = toggleBtn.createSpan({ cls: "ac-btn__text", text: "\u5C55\u5F00" });
  (0, import_obsidian2.setIcon)(toggleIcon, "chevron-down");
  if (opts.open) {
    const openBtn = actions.createEl("button", { cls: "ac-btn ac-btn--open" });
    const openIcon = openBtn.createSpan({ cls: "ac-btn__icon" });
    openBtn.createSpan({ cls: "ac-btn__text", text: "\u6253\u5F00" });
    (0, import_obsidian2.setIcon)(openIcon, "arrow-up-right");
    openBtn.title = meta.file ? "\u5728\u539F\u59CB\u6587\u6863\u4E2D\u6253\u5F00" : "\u521B\u5EFA\u8FD9\u7BC7\u6587\u6863";
    openBtn.addEventListener("click", (e) => void openNote(env, meta, e));
  }
  card.createDiv({
    cls: "ac-card__summary",
    text: meta.summary || (meta.file ? "\uFF08\u6682\u65E0\u6458\u8981\uFF09" : "\u70B9\u51FB\u6807\u9898\u521B\u5EFA\u8FD9\u7BC7\u539F\u5B50\u6587\u6863")
  });
  card.appendChild(body);
  let expanded = false;
  const setExpanded = (next) => {
    expanded = next;
    card.classList.toggle("is-expanded", expanded);
    toggleText.textContent = expanded ? "\u6536\u8D77" : "\u5C55\u5F00";
    (0, import_obsidian2.setIcon)(toggleIcon, expanded ? "chevron-up" : "chevron-down");
    body.style.display = expanded ? "" : "none";
    if (expanded) loadBody();
  };
  toggleBtn.addEventListener("click", () => setExpanded(!expanded));
  titleEl.addEventListener("click", (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      void openNote(env, meta, e);
      return;
    }
    setExpanded(!expanded);
  });
  head.addEventListener("click", (e) => {
    const el = e.target;
    if (el == null ? void 0 : el.closest("button, a")) return;
    setExpanded(!expanded);
  });
  if (opts.expanded) setExpanded(true);
  return card;
}

// src/parser.ts
var SORT_KEYS = ["name", "updated", "created", "none"];
function applyOption(opts, rawKey, rawValue) {
  const key = rawKey.toLowerCase();
  const value = rawValue.trim().replace(/^["']|["']$/g, "");
  switch (key) {
    case "height":
      opts.height = Number(value) || 0;
      break;
    case "summary":
      opts.summary = Number(value) || 0;
      break;
    case "expanded":
    case "expand":
      opts.expanded = /^(true|yes|1|on)$/i.test(value);
      break;
    case "cover":
      opts.cover = /^(true|yes|1|on)$/i.test(value);
      break;
    case "meta":
      opts.meta = /^(true|yes|1|on)$/i.test(value);
      break;
    case "tags":
      opts.tags = /^(true|yes|1|on)$/i.test(value);
      break;
    case "open":
      opts.open = /^(true|yes|1|on)$/i.test(value);
      break;
    case "reverse":
    case "backlinks":
      opts.reverse = /^(true|yes|1|on)$/i.test(value);
      break;
    case "density":
      opts.density = value === "compact" ? "compact" : "comfortable";
      break;
    case "layout":
    case "style":
      opts.layout = value === "card" ? "card" : "wrap";
      break;
    case "size":
      opts.size = value === "small" ? "small" : "normal";
      break;
    case "from":
    case "folder":
      opts.from = value;
      break;
    case "tag":
      opts.tag = value.replace(/^#/, "");
      break;
    case "sort":
      opts.sort = SORT_KEYS.includes(value) ? value : "name";
      break;
    case "limit":
      opts.limit = Number(value) || 0;
      break;
    case "title":
      opts.title = value;
      break;
    default:
      break;
  }
}
function parseEntry(line) {
  let text = line.replace(/^[-*+]\s+/, "").trim();
  if (!text) return null;
  text = text.replace(/^!\s*/, "");
  const wiki = text.match(/^\[\[([^\]]+)\]\]\s*(.*)$/);
  if (wiki) {
    const [target, inlineAlias] = wiki[1].split("|");
    return {
      target: target.trim(),
      alias: (inlineAlias || "").trim() || (wiki[2] || "").trim() || void 0
    };
  }
  if (/^[>#`]/.test(text)) return null;
  const bare = text.replace(/\[\[|\]\]/g, "").trim();
  return bare ? { target: bare } : null;
}
function parseCardsBlock(source) {
  const options = {};
  const entries = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line === "---" || line === "***") continue;
    const optMatch = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (optMatch && !line.startsWith("- [[") && !line.startsWith("![[")) {
      applyOption(options, optMatch[1], optMatch[2]);
      continue;
    }
    const entry = parseEntry(line);
    if (entry) entries.push(entry);
  }
  return { options, entries };
}

// src/settings.ts
var import_obsidian3 = require("obsidian");
var AtomicCardsSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();
    new import_obsidian3.Setting(containerEl).setName("\u5E03\u5C40").setHeading();
    new import_obsidian3.Setting(containerEl).setName("\u5361\u7247\u6700\u5927\u9AD8\u5EA6 (px)").setDesc("0 = \u4E0D\u9650\u5236\uFF1B\u8D85\u8FC7\u540E\u5361\u7247\u5185\u90E8\u6EDA\u52A8").addText(
      (t) => t.setValue(String(s.cardHeight)).onChange(async (v) => {
        s.cardHeight = Number(v) || 0;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u5361\u7247\u5E03\u5C40").setDesc("\u5305\u88F9\u5361\u7247 = \u6A2A\u5411\u6241\u5E73\u7684\u5BB9\u5668\uFF1B\u7AD6\u7248\u5361\u724C = \u4F20\u7EDF\u5361\u7247\u5899\uFF08\u9876\u90E8\u5927\u5C01\u9762\uFF09").addDropdown(
      (d) => d.addOption("wrap", "\u5305\u88F9\u5361\u7247\uFF08\u6A2A\u5411\uFF09").addOption("card", "\u7AD6\u7248\u5361\u724C\uFF08\u9876\u90E8\u5C01\u9762\uFF09").setValue(s.layout).onChange(async (v) => {
        s.layout = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u5D4C\u5957\u5361\u7247\u7684\u5C3A\u5BF8").setDesc("\u5361\u7247\u91CC\u518D\u5957\u7684\u5361\u7247\u5899\u9ED8\u8BA4\u7528\u4EC0\u4E48\u5C3A\u5BF8\uFF1B\u5757\u5185\u5199 size: \u53EF\u5355\u72EC\u8986\u76D6").addDropdown(
      (d) => d.addOption("small", "\u77E5\u8BC6\u70B9\u5C0F\u5361\u7247\uFF08\u4E00\u884C\u591A\u4E2A\uFF09").addOption("normal", "\u5E38\u89C4\u5361\u7247").setValue(s.nestedSize).onChange(async (v) => {
        s.nestedSize = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u5BC6\u5EA6").addDropdown(
      (d) => d.addOption("comfortable", "\u5BBD\u677E").addOption("compact", "\u7D27\u51D1").setValue(s.density).onChange(async (v) => {
        s.density = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u5361\u7247\u5185\u5BB9").setHeading();
    new import_obsidian3.Setting(containerEl).setName("\u6458\u8981\u957F\u5EA6").setDesc("\u81EA\u52A8\u6458\u8981\u622A\u53D6\u7684\u5B57\u7B26\u6570\uFF08frontmatter \u6709 summary/description \u65F6\u4F18\u5148\u7528\uFF09").addText(
      (t) => t.setValue(String(s.summaryLength)).onChange(async (v) => {
        s.summaryLength = Number(v) || 180;
        await this.plugin.saveSettings();
      })
    );
    const toggle = (name, desc, get, set) => new import_obsidian3.Setting(containerEl).setName(name).setDesc(desc).addToggle(
      (t) => t.setValue(get()).onChange(async (v) => {
        set(v);
        await this.plugin.saveSettings();
      })
    );
    toggle("\u663E\u793A\u5C01\u9762", "\u8BFB\u53D6 frontmatter \u7684 cover/image/banner \u6216\u6B63\u6587\u7B2C\u4E00\u5F20\u56FE", () => s.showCover, (v) => s.showCover = v);
    toggle("\u663E\u793A\u5143\u4FE1\u606F", "type / status / domain / \u66F4\u65B0\u65F6\u95F4 / \u5B57\u6570", () => s.showMeta, (v) => s.showMeta = v);
    toggle("\u663E\u793A\u6807\u7B7E", "", () => s.showTags, (v) => s.showTags = v);
    toggle("\u663E\u793A\u300C\u6253\u5F00\u300D\u6309\u94AE", "", () => s.showOpenButton, (v) => s.showOpenButton = v);
    toggle("\u9ED8\u8BA4\u5C55\u5F00\u6B63\u6587", "\u6253\u5F00\u6587\u6863\u65F6\u5361\u7247\u76F4\u63A5\u663E\u793A\u5B8C\u6574\u5185\u5BB9\uFF0C\u70B9\u6807\u9898\u53EF\u6298\u53E0", () => s.defaultExpanded, (v) => s.defaultExpanded = v);
    toggle(
      "\u5D4C\u5957\u5361\u7247\u9ED8\u8BA4\u5C55\u5F00",
      "\u5361\u7247\u91CC\u518D\u5957\u7684\u5361\u7247\u5899\u662F\u5426\u9ED8\u8BA4\u5C55\u5F00\uFF1B\u5173\u95ED\u65F6\u53EA\u663E\u793A\u6807\u9898\u548C\u6458\u8981",
      () => s.nestedExpanded,
      (v) => s.nestedExpanded = v
    );
    new import_obsidian3.Setting(containerEl).setName("\u6700\u5927\u5D4C\u5957\u6DF1\u5EA6").setDesc("\u5361\u7247\u91CC\u518D\u653E cards \u5757\u65F6\u7684\u9012\u5F52\u5C42\u6570\u4E0A\u9650\uFF0C\u9632\u6B62\u5FAA\u73AF\u5F15\u7528\u5361\u6B7B").addText(
      (t) => t.setValue(String(s.maxNestDepth)).onChange(async (v) => {
        s.maxNestDepth = Math.max(1, Number(v) || 3);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u5B57\u6BB5\u6620\u5C04").setHeading();
    const listField = (name, desc, get, set) => new import_obsidian3.Setting(containerEl).setName(name).setDesc(desc).addText(
      (t) => t.setValue(get().join(", ")).setPlaceholder("a, b, c").onChange(async (v) => {
        set(
          v.split(",").map((x) => x.trim()).filter(Boolean)
        );
        await this.plugin.saveSettings();
      })
    );
    listField("\u6458\u8981\u5B57\u6BB5", "\u6309\u987A\u5E8F\u5C1D\u8BD5\u8BFB\u53D6\u7684 frontmatter \u5B57\u6BB5", () => s.summaryFields, (v) => s.summaryFields = v);
    listField("\u5C01\u9762\u5B57\u6BB5", "", () => s.coverFields, (v) => s.coverFields = v);
    listField("\u5143\u4FE1\u606F\u5B57\u6BB5", "\u4F1A\u4EE5\u5FBD\u7AE0\u5F62\u5F0F\u663E\u793A\u5728\u5361\u7247\u4E0A", () => s.metaFields, (v) => s.metaFields = v);
  }
};

// src/types.ts
var SETTINGS_VERSION = 2;
var DEFAULT_SETTINGS = {
  layout: "wrap",
  nestedSize: "normal",
  cardHeight: 0,
  summaryLength: 180,
  showCover: true,
  showMeta: true,
  showTags: true,
  showOpenButton: true,
  defaultExpanded: true,
  nestedExpanded: true,
  maxNestDepth: 3,
  density: "comfortable",
  summaryFields: ["summary", "description", "abstract", "excerpt", "\u7B80\u4ECB", "\u6458\u8981"],
  coverFields: ["cover", "image", "banner", "thumbnail", "img", "\u5C01\u9762"],
  metaFields: ["type", "status", "domain", "complexity"],
  verbose: false
};

// src/main.ts
var AtomicCardsPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AtomicCardsSettingTab(this.app, this));
    const handler = (source, el, ctx) => this.renderCardsBlock(source, el, ctx);
    this.registerMarkdownCodeBlockProcessor("cards", handler);
    this.registerMarkdownCodeBlockProcessor("atomic-cards", handler);
    this.registerMarkdownCodeBlockProcessor("ac", handler);
    this.registerCommands();
  }
  onunload() {
  }
  async loadSettings() {
    const saved = await this.loadData();
    if (saved && typeof saved === "object") {
      if (saved.settingsVersion !== SETTINGS_VERSION) {
        Object.assign(saved, {
          layout: DEFAULT_SETTINGS.layout,
          nestedSize: DEFAULT_SETTINGS.nestedSize,
          defaultExpanded: DEFAULT_SETTINGS.defaultExpanded,
          nestedExpanded: DEFAULT_SETTINGS.nestedExpanded,
          settingsVersion: SETTINGS_VERSION
        });
        await this.saveData(saved);
      }
      this.settings = Object.assign({ ...DEFAULT_SETTINGS }, saved);
    } else {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /* =======================================================================
   * 渲染
   * ===================================================================== */
  mergeOptions(o, nested = false) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
    const s = this.settings;
    const size = (_a = o.size) != null ? _a : nested ? s.nestedSize : "normal";
    const isSmall = size === "small";
    return {
      height: (_b = o.height) != null ? _b : s.cardHeight,
      summary: (_c = o.summary) != null ? _c : isSmall ? 90 : s.summaryLength,
      expanded: (_d = o.expanded) != null ? _d : nested ? s.nestedExpanded : s.defaultExpanded,
      cover: (_e = o.cover) != null ? _e : s.showCover,
      meta: (_f = o.meta) != null ? _f : isSmall ? false : s.showMeta,
      tags: (_g = o.tags) != null ? _g : isSmall ? false : s.showTags,
      // 标题不再跳转，"打开"按钮成了唯一跳转入口，小卡片也默认给
      open: (_h = o.open) != null ? _h : isSmall ? true : s.showOpenButton,
      density: (_i = o.density) != null ? _i : isSmall ? "compact" : s.density,
      layout: (_j = o.layout) != null ? _j : s.layout,
      size,
      reverse: (_k = o.reverse) != null ? _k : false,
      from: (_l = o.from) != null ? _l : "",
      tag: (_m = o.tag) != null ? _m : "",
      title: (_n = o.title) != null ? _n : "",
      sort: (_o = o.sort) != null ? _o : "name",
      limit: (_p = o.limit) != null ? _p : 0
    };
  }
  renderCardsBlock(source, el, ctx) {
    const depth = getNest();
    const { options, entries } = parseCardsBlock(source);
    const opts = this.mergeOptions(options, depth > 0);
    const root = el.createDiv({ cls: "ac-root" });
    if (opts.title) root.createDiv({ cls: "ac-root__title", text: opts.title });
    const grid = root.createDiv({ cls: `ac-grid ac-grid--${opts.size}` });
    grid.style.gridTemplateColumns = "1fr";
    if (depth >= this.settings.maxNestDepth) {
      grid.createDiv({
        cls: "ac-warn",
        text: `\u5DF2\u8FBE\u5230\u6700\u5927\u5D4C\u5957\u6DF1\u5EA6\uFF08${this.settings.maxNestDepth}\uFF09\uFF0C\u505C\u6B62\u9012\u5F52\u6E32\u67D3\u4EE5\u907F\u514D\u5FAA\u73AF\u5F15\u7528\u3002`
      });
      return;
    }
    void this.fillGrid(grid, entries, opts, ctx, depth);
  }
  async fillGrid(grid, entries, opts, ctx, depth) {
    const component = new import_obsidian4.MarkdownRenderChild(grid);
    component.load();
    ctx.addChild(component);
    const env = {
      app: this.app,
      settings: this.settings,
      sourcePath: ctx.sourcePath,
      component,
      depth: depth + 1
    };
    const list = this.resolveEntries(entries, opts, ctx.sourcePath);
    if (!list.length) {
      grid.createDiv({ cls: "ac-empty", text: "\u6CA1\u6709\u5339\u914D\u7684\u539F\u5B50\u6587\u6863" });
      return;
    }
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
  hasTag(file, tag) {
    var _a, _b, _c;
    const c = this.app.metadataCache.getFileCache(file);
    const found = [];
    const push = (v) => {
      if (typeof v === "string") found.push(v.replace(/^#/, ""));
      else if (Array.isArray(v)) v.forEach(push);
    };
    push((_a = c == null ? void 0 : c.frontmatter) == null ? void 0 : _a.tags);
    push((_b = c == null ? void 0 : c.frontmatter) == null ? void 0 : _b.tag);
    ((_c = c == null ? void 0 : c.tags) != null ? _c : []).forEach((t) => found.push(t.tag.replace(/^#/, "")));
    return found.some((t) => t === tag || t.startsWith(`${tag}/`));
  }
  sortEntries(entries, opts, sourcePath) {
    const out = [...entries];
    if (opts.sort === "name") {
      out.sort((a, b) => a.target.localeCompare(b.target, "zh-Hans-CN"));
    } else if (opts.sort === "updated" || opts.sort === "created") {
      const key = opts.sort === "updated" ? "mtime" : "ctime";
      const timeOf = (t) => {
        var _a;
        const f = resolveFile(this.app, t, sourcePath);
        return f ? (_a = f.stat[key]) != null ? _a : 0 : 0;
      };
      out.sort((a, b) => timeOf(b.target) - timeOf(a.target));
    }
    return opts.limit > 0 ? out.slice(0, opts.limit) : out;
  }
  resolveEntries(entries, opts, sourcePath) {
    var _a;
    if (entries.length) return entries;
    if (opts.reverse) {
      const links = this.app.metadataCache.resolvedLinks;
      const out = [];
      for (const src of Object.keys(links)) {
        if ((_a = links[src]) == null ? void 0 : _a[sourcePath]) out.push({ target: src.replace(/\.md$/i, "") });
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
  activeEditor() {
    var _a;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    return (_a = view == null ? void 0 : view.editor) != null ? _a : null;
  }
  registerCommands() {
    this.addCommand({
      id: "insert-cards-block",
      name: "\u63D2\u5165\u5361\u7247\u5757\u6A21\u677F",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const block = "```cards\n\n- [[]]\n```\n";
        editor.replaceRange(block, cursor);
        editor.setCursor({ line: cursor.line + 2, ch: 6 });
      }
    });
    this.addCommand({
      id: "embeds-to-cards",
      name: "\u628A\u5D4C\u5165 ![[...]] \u8F6C\u6210\u5361\u7247\u5899",
      editorCallback: (editor) => this.embedsToCards(editor)
    });
    this.addCommand({
      id: "links-to-cards",
      name: "\u628A\u9009\u533A\u91CC\u7684 [[\u94FE\u63A5]] \u8F6C\u6210\u5361\u7247\u5899",
      editorCallback: (editor) => this.linksToCards(editor)
    });
    this.addCommand({
      id: "insert-reverse-cards",
      name: "\u63D2\u5165\u53CD\u67E5\u5361\u7247\u5757\uFF08\u5217\u51FA\u5F15\u7528\u672C\u6587\u7684\u7AE0\u8282\uFF09",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        editor.replaceRange("```cards\nreverse: true\ntitle: \u88AB\u5F15\u7528\u5728\n```\n", cursor);
      }
    });
    this.addCommand({
      id: "toggle-all-cards",
      name: "\u5C55\u5F00 / \u6536\u8D77\u672C\u9875\u6240\u6709\u5361\u7247",
      callback: () => {
        var _a;
        const cards = Array.from(document.querySelectorAll(".ac-card"));
        if (!cards.length) {
          new import_obsidian4.Notice("\u5F53\u524D\u89C6\u56FE\u91CC\u6CA1\u6709\u5361\u7247");
          return;
        }
        const collapsed = cards.filter((c) => !c.classList.contains("is-expanded"));
        const targets = collapsed.length ? collapsed : cards;
        for (const c of targets) (_a = c.querySelector(".ac-btn--toggle")) == null ? void 0 : _a.click();
        new import_obsidian4.Notice(collapsed.length ? `\u5DF2\u5C55\u5F00 ${targets.length} \u5F20\u5361\u7247` : `\u5DF2\u6536\u8D77 ${targets.length} \u5F20\u5361\u7247`);
      }
    });
  }
  selectionLineRange(editor) {
    if (!editor.somethingSelected()) return [0, editor.lineCount() - 1];
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const endLine = to.ch === 0 && to.line > from.line ? to.line - 1 : to.line;
    return [from.line, Math.max(endLine, from.line)];
  }
  /** 把正文里连续的 ![[笔记]] 行合并成一个 cards 块 */
  embedsToCards(editor) {
    const content = editor.getValue();
    const lines = content.split("\n");
    const [from, to] = this.selectionLineRange(editor);
    const out = [];
    let buffer = [];
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
      new import_obsidian4.Notice("\u6CA1\u6709\u627E\u5230\u72EC\u5360\u4E00\u884C\u7684 ![[...]] \u5D4C\u5165");
      return;
    }
    editor.setValue(out.join("\n"));
    new import_obsidian4.Notice(`\u5DF2\u628A ${converted} \u5904\u5D4C\u5165\u5408\u5E76\u4E3A\u5361\u7247\u5899`);
  }
  /** 选区里的 [[链接]]（列表或正文）→ cards 块 */
  linksToCards(editor) {
    const sel = editor.getSelection();
    if (!sel.trim()) {
      new import_obsidian4.Notice("\u8BF7\u5148\u9009\u4E2D\u5305\u542B [[\u94FE\u63A5]] \u7684\u6587\u672C");
      return;
    }
    const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
    const found = [];
    let m;
    while ((m = re.exec(sel)) !== null) {
      const t = m[1].trim();
      if (t && !found.includes(t)) found.push(t);
    }
    if (!found.length) {
      new import_obsidian4.Notice("\u9009\u533A\u91CC\u6CA1\u6709 [[\u94FE\u63A5]]");
      return;
    }
    const block = `\`\`\`cards
${found.map((t) => `- [[${t}]]`).join("\n")}
\`\`\``;
    editor.replaceSelection(block);
    new import_obsidian4.Notice(`\u5DF2\u751F\u6210 ${found.length} \u5F20\u5361\u7247`);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vVGVtcC9hYy1zcmMvc3JjL21haW4udHMiLCAiLi4vLi4vLi4vVGVtcC9hYy1zcmMvc3JjL2NhcmQudHMiLCAiLi4vLi4vLi4vVGVtcC9hYy1zcmMvc3JjL21ldGFkYXRhLnRzIiwgIi4uLy4uLy4uL1RlbXAvYWMtc3JjL3NyYy9wYXJzZXIudHMiLCAiLi4vLi4vLi4vVGVtcC9hYy1zcmMvc3JjL3NldHRpbmdzLnRzIiwgIi4uLy4uLy4uL1RlbXAvYWMtc3JjL3NyYy90eXBlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcclxuICBFZGl0b3IsXHJcbiAgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcclxuICBNYXJrZG93blJlbmRlckNoaWxkLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBOb3RpY2UsXHJcbiAgUGx1Z2luLFxyXG4gIFRGaWxlLFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyByZW5kZXJDYXJkLCBnZXROZXN0LCB3aXRoTmVzdCB9IGZyb20gXCIuL2NhcmRcIjtcclxuaW1wb3J0IHsgcmVhZE5vdGVNZXRhLCByZXNvbHZlRmlsZSB9IGZyb20gXCIuL21ldGFkYXRhXCI7XHJcbmltcG9ydCB7IHBhcnNlQ2FyZHNCbG9jayB9IGZyb20gXCIuL3BhcnNlclwiO1xyXG5pbXBvcnQgeyBBdG9taWNDYXJkc1NldHRpbmdUYWIgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xyXG5pbXBvcnQge1xyXG4gIEF0b21pY0NhcmRzU2V0dGluZ3MsXHJcbiAgQ2FyZEVudHJ5LFxyXG4gIENhcmRPcHRpb25zLFxyXG4gIERFRkFVTFRfU0VUVElOR1MsXHJcbiAgTWVyZ2VkT3B0aW9ucyxcclxuICBTRVRUSU5HU19WRVJTSU9OLFxyXG4gIFNpemUsXHJcbn0gZnJvbSBcIi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEF0b21pY0NhcmRzUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICBzZXR0aW5nczogQXRvbWljQ2FyZHNTZXR0aW5ncyA9IHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9O1xyXG5cclxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBBdG9taWNDYXJkc1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICBjb25zdCBoYW5kbGVyID0gKHNvdXJjZTogc3RyaW5nLCBlbDogSFRNTEVsZW1lbnQsIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCkgPT5cclxuICAgICAgdGhpcy5yZW5kZXJDYXJkc0Jsb2NrKHNvdXJjZSwgZWwsIGN0eCk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFwiY2FyZHNcIiwgaGFuZGxlcik7XHJcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXCJhdG9taWMtY2FyZHNcIiwgaGFuZGxlcik7XHJcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXCJhY1wiLCBoYW5kbGVyKTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyQ29tbWFuZHMoKTtcclxuICB9XHJcblxyXG4gIG9udW5sb2FkKCk6IHZvaWQge1xyXG4gICAgLyogQ29tcG9uZW50IFx1NzUxRlx1NTQ3RFx1NTQ2OFx1NjcxRlx1NzUzMSBjdHguYWRkQ2hpbGQgXHU2MjU4XHU3QkExICovXHJcbiAgfVxyXG5cclxuICBhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcclxuICAgIGlmIChzYXZlZCAmJiB0eXBlb2Ygc2F2ZWQgPT09IFwib2JqZWN0XCIpIHtcclxuICAgICAgLy8gXHU1RTAzXHU1QzQwXHU5RUQ4XHU4QkE0XHU1MDNDXHU1M0Q4XHU0RTg2XHVGRjBDXHU2NUU3XHU1QjU4XHU2ODYzXHU4OTgxXHU4RkMxXHU3OUZCXHVGRjBDXHU1NDI2XHU1MjE5XHU3NTI4XHU2MjM3XHU3QUVGXHU3NzBCXHU1MjMwXHU3Njg0XHU4RkQ4XHU2NjJGXHU2NUU3XHU1RTAzXHU1QzQwXHJcbiAgICAgIGlmIChzYXZlZC5zZXR0aW5nc1ZlcnNpb24gIT09IFNFVFRJTkdTX1ZFUlNJT04pIHtcclxuICAgICAgICBPYmplY3QuYXNzaWduKHNhdmVkLCB7XHJcbiAgICAgICAgICBsYXlvdXQ6IERFRkFVTFRfU0VUVElOR1MubGF5b3V0LFxyXG4gICAgICAgICAgbmVzdGVkU2l6ZTogREVGQVVMVF9TRVRUSU5HUy5uZXN0ZWRTaXplLFxyXG4gICAgICAgICAgZGVmYXVsdEV4cGFuZGVkOiBERUZBVUxUX1NFVFRJTkdTLmRlZmF1bHRFeHBhbmRlZCxcclxuICAgICAgICAgIG5lc3RlZEV4cGFuZGVkOiBERUZBVUxUX1NFVFRJTkdTLm5lc3RlZEV4cGFuZGVkLFxyXG4gICAgICAgICAgc2V0dGluZ3NWZXJzaW9uOiBTRVRUSU5HU19WRVJTSU9OLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEoc2F2ZWQpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9LCBzYXZlZCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnNldHRpbmdzID0geyAuLi5ERUZBVUxUX1NFVFRJTkdTIH07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gIH1cclxuXHJcbiAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgKiBcdTZFMzJcdTY3RDNcclxuICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbiAgcHJpdmF0ZSBtZXJnZU9wdGlvbnMobzogQ2FyZE9wdGlvbnMsIG5lc3RlZCA9IGZhbHNlKTogTWVyZ2VkT3B0aW9ucyB7XHJcbiAgICBjb25zdCBzID0gdGhpcy5zZXR0aW5ncztcclxuICAgIGNvbnN0IHNpemU6IFNpemUgPSBvLnNpemUgPz8gKG5lc3RlZCA/IHMubmVzdGVkU2l6ZSA6IFwibm9ybWFsXCIpO1xyXG4gICAgY29uc3QgaXNTbWFsbCA9IHNpemUgPT09IFwic21hbGxcIjtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGhlaWdodDogby5oZWlnaHQgPz8gcy5jYXJkSGVpZ2h0LFxyXG4gICAgICBzdW1tYXJ5OiBvLnN1bW1hcnkgPz8gKGlzU21hbGwgPyA5MCA6IHMuc3VtbWFyeUxlbmd0aCksXHJcbiAgICAgIGV4cGFuZGVkOiBvLmV4cGFuZGVkID8/IChuZXN0ZWQgPyBzLm5lc3RlZEV4cGFuZGVkIDogcy5kZWZhdWx0RXhwYW5kZWQpLFxyXG4gICAgICBjb3Zlcjogby5jb3ZlciA/PyBzLnNob3dDb3ZlcixcclxuICAgICAgbWV0YTogby5tZXRhID8/IChpc1NtYWxsID8gZmFsc2UgOiBzLnNob3dNZXRhKSxcclxuICAgICAgdGFnczogby50YWdzID8/IChpc1NtYWxsID8gZmFsc2UgOiBzLnNob3dUYWdzKSxcclxuICAgICAgLy8gXHU2ODA3XHU5ODk4XHU0RTBEXHU1MThEXHU4REYzXHU4RjZDXHVGRjBDXCJcdTYyNTNcdTVGMDBcIlx1NjMwOVx1OTRBRVx1NjIxMFx1NEU4Nlx1NTUyRlx1NEUwMFx1OERGM1x1OEY2Q1x1NTE2NVx1NTNFM1x1RkYwQ1x1NUMwRlx1NTM2MVx1NzI0N1x1NEU1Rlx1OUVEOFx1OEJBNFx1N0VEOVxyXG4gICAgICBvcGVuOiBvLm9wZW4gPz8gKGlzU21hbGwgPyB0cnVlIDogcy5zaG93T3BlbkJ1dHRvbiksXHJcbiAgICAgIGRlbnNpdHk6IG8uZGVuc2l0eSA/PyAoaXNTbWFsbCA/IFwiY29tcGFjdFwiIDogcy5kZW5zaXR5KSxcclxuICAgICAgbGF5b3V0OiBvLmxheW91dCA/PyBzLmxheW91dCxcclxuICAgICAgc2l6ZSxcclxuICAgICAgcmV2ZXJzZTogby5yZXZlcnNlID8/IGZhbHNlLFxyXG4gICAgICBmcm9tOiBvLmZyb20gPz8gXCJcIixcclxuICAgICAgdGFnOiBvLnRhZyA/PyBcIlwiLFxyXG4gICAgICB0aXRsZTogby50aXRsZSA/PyBcIlwiLFxyXG4gICAgICBzb3J0OiBvLnNvcnQgPz8gXCJuYW1lXCIsXHJcbiAgICAgIGxpbWl0OiBvLmxpbWl0ID8/IDAsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJDYXJkc0Jsb2NrKHNvdXJjZTogc3RyaW5nLCBlbDogSFRNTEVsZW1lbnQsIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IHZvaWQge1xyXG4gICAgY29uc3QgZGVwdGggPSBnZXROZXN0KCk7XHJcbiAgICBjb25zdCB7IG9wdGlvbnMsIGVudHJpZXMgfSA9IHBhcnNlQ2FyZHNCbG9jayhzb3VyY2UpO1xyXG4gICAgLy8gXHU1RDRDXHU1NzI4XHU1MjJCXHU3Njg0XHU1MzYxXHU3MjQ3XHU5MUNDXHU2NUY2XHVGRjA4ZGVwdGggPiAwXHVGRjA5XHU5RUQ4XHU4QkE0XHU1MjA3XHU2MjEwXHU3N0U1XHU4QkM2XHU3MEI5XHU1QzBGXHU1MzYxXHU3MjQ3XHJcbiAgICBjb25zdCBvcHRzID0gdGhpcy5tZXJnZU9wdGlvbnMob3B0aW9ucywgZGVwdGggPiAwKTtcclxuXHJcbiAgICBjb25zdCByb290ID0gZWwuY3JlYXRlRGl2KHsgY2xzOiBcImFjLXJvb3RcIiB9KTtcclxuICAgIGlmIChvcHRzLnRpdGxlKSByb290LmNyZWF0ZURpdih7IGNsczogXCJhYy1yb290X190aXRsZVwiLCB0ZXh0OiBvcHRzLnRpdGxlIH0pO1xyXG5cclxuICAgIC8vIFx1NTM2MVx1NzI0N1x1NTg5OVx1NTZGQVx1NUI5QVx1NTM1NVx1NTIxN1x1RkYxQVx1NEUwMFx1ODg0Q1x1NEUwMFx1NUYyMFx1MzAwMVx1NTM2MFx1NkVFMVx1NUJCRFx1NUVBNlx1RkYwOFx1NEUwRFx1NTA1QVx1NTIwNlx1NTIxNyAvIFx1ODFFQVx1OTAwMlx1NUU5NFx1N0Y1MVx1NjgzQ1x1RkYwOVxyXG4gICAgY29uc3QgZ3JpZCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBgYWMtZ3JpZCBhYy1ncmlkLS0ke29wdHMuc2l6ZX1gIH0pO1xyXG4gICAgZ3JpZC5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID0gXCIxZnJcIjtcclxuXHJcbiAgICBpZiAoZGVwdGggPj0gdGhpcy5zZXR0aW5ncy5tYXhOZXN0RGVwdGgpIHtcclxuICAgICAgZ3JpZC5jcmVhdGVEaXYoe1xyXG4gICAgICAgIGNsczogXCJhYy13YXJuXCIsXHJcbiAgICAgICAgdGV4dDogYFx1NURGMlx1OEZCRVx1NTIzMFx1NjcwMFx1NTkyN1x1NUQ0Q1x1NTk1N1x1NkRGMVx1NUVBNlx1RkYwOCR7dGhpcy5zZXR0aW5ncy5tYXhOZXN0RGVwdGh9XHVGRjA5XHVGRjBDXHU1MDVDXHU2QjYyXHU5MDEyXHU1RjUyXHU2RTMyXHU2N0QzXHU0RUU1XHU5MDdGXHU1MTREXHU1RkFBXHU3M0FGXHU1RjE1XHU3NTI4XHUzMDAyYCxcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB2b2lkIHRoaXMuZmlsbEdyaWQoZ3JpZCwgZW50cmllcywgb3B0cywgY3R4LCBkZXB0aCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIGZpbGxHcmlkKFxyXG4gICAgZ3JpZDogSFRNTEVsZW1lbnQsXHJcbiAgICBlbnRyaWVzOiBDYXJkRW50cnlbXSxcclxuICAgIG9wdHM6IE1lcmdlZE9wdGlvbnMsXHJcbiAgICBjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXHJcbiAgICBkZXB0aDogbnVtYmVyXHJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgTWFya2Rvd25SZW5kZXJDaGlsZChncmlkKTtcclxuICAgIGNvbXBvbmVudC5sb2FkKCk7XHJcbiAgICBjdHguYWRkQ2hpbGQoY29tcG9uZW50KTtcclxuXHJcbiAgICBjb25zdCBlbnYgPSB7XHJcbiAgICAgIGFwcDogdGhpcy5hcHAsXHJcbiAgICAgIHNldHRpbmdzOiB0aGlzLnNldHRpbmdzLFxyXG4gICAgICBzb3VyY2VQYXRoOiBjdHguc291cmNlUGF0aCxcclxuICAgICAgY29tcG9uZW50LFxyXG4gICAgICBkZXB0aDogZGVwdGggKyAxLFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBsaXN0ID0gdGhpcy5yZXNvbHZlRW50cmllcyhlbnRyaWVzLCBvcHRzLCBjdHguc291cmNlUGF0aCk7XHJcbiAgICBpZiAoIWxpc3QubGVuZ3RoKSB7XHJcbiAgICAgIGdyaWQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWVtcHR5XCIsIHRleHQ6IFwiXHU2Q0ExXHU2NzA5XHU1MzM5XHU5MTREXHU3Njg0XHU1MzlGXHU1QjUwXHU2NTg3XHU2ODYzXCIgfSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBcdTk4N0FcdTVFOEZcdTZFMzJcdTY3RDNcdUZGMENcdTRGRERcdThCQzFcdTUzNjFcdTcyNDdcdTk4N0FcdTVFOEZcdTdBMzNcdTVCOUFcclxuICAgIGZvciAoY29uc3QgZW50cnkgb2YgbGlzdCkge1xyXG4gICAgICBjb25zdCBtZXRhID0gYXdhaXQgcmVhZE5vdGVNZXRhKHRoaXMuYXBwLCBlbnRyeS50YXJnZXQsIGN0eC5zb3VyY2VQYXRoLCB0aGlzLnNldHRpbmdzLCBlbnRyeS5hbGlhcyk7XHJcbiAgICAgIGlmICghZ3JpZC5pc0Nvbm5lY3RlZCkgcmV0dXJuO1xyXG4gICAgICBjb25zdCBjYXJkID0gd2l0aE5lc3QoZW52LmRlcHRoLCAoKSA9PiByZW5kZXJDYXJkKGVudiwgbWV0YSwgb3B0cykpO1xyXG4gICAgICBncmlkLmFwcGVuZENoaWxkKGNhcmQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgKiBcdTY1NzBcdTYzNkVcdTY3NjVcdTZFOTBcclxuICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbiAgcHJpdmF0ZSBoYXNUYWcoZmlsZTogVEZpbGUsIHRhZzogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBjID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XHJcbiAgICBjb25zdCBmb3VuZDogc3RyaW5nW10gPSBbXTtcclxuICAgIGNvbnN0IHB1c2ggPSAodjogdW5rbm93bikgPT4ge1xyXG4gICAgICBpZiAodHlwZW9mIHYgPT09IFwic3RyaW5nXCIpIGZvdW5kLnB1c2godi5yZXBsYWNlKC9eIy8sIFwiXCIpKTtcclxuICAgICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2KSkgdi5mb3JFYWNoKHB1c2gpO1xyXG4gICAgfTtcclxuICAgIHB1c2goYz8uZnJvbnRtYXR0ZXI/LnRhZ3MpO1xyXG4gICAgcHVzaChjPy5mcm9udG1hdHRlcj8udGFnKTtcclxuICAgIChjPy50YWdzID8/IFtdKS5mb3JFYWNoKCh0KSA9PiBmb3VuZC5wdXNoKHQudGFnLnJlcGxhY2UoL14jLywgXCJcIikpKTtcclxuICAgIHJldHVybiBmb3VuZC5zb21lKCh0KSA9PiB0ID09PSB0YWcgfHwgdC5zdGFydHNXaXRoKGAke3RhZ30vYCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzb3J0RW50cmllcyhlbnRyaWVzOiBDYXJkRW50cnlbXSwgb3B0czogTWVyZ2VkT3B0aW9ucywgc291cmNlUGF0aDogc3RyaW5nKTogQ2FyZEVudHJ5W10ge1xyXG4gICAgY29uc3Qgb3V0ID0gWy4uLmVudHJpZXNdO1xyXG4gICAgaWYgKG9wdHMuc29ydCA9PT0gXCJuYW1lXCIpIHtcclxuICAgICAgb3V0LnNvcnQoKGEsIGIpID0+IGEudGFyZ2V0LmxvY2FsZUNvbXBhcmUoYi50YXJnZXQsIFwiemgtSGFucy1DTlwiKSk7XHJcbiAgICB9IGVsc2UgaWYgKG9wdHMuc29ydCA9PT0gXCJ1cGRhdGVkXCIgfHwgb3B0cy5zb3J0ID09PSBcImNyZWF0ZWRcIikge1xyXG4gICAgICBjb25zdCBrZXkgPSBvcHRzLnNvcnQgPT09IFwidXBkYXRlZFwiID8gXCJtdGltZVwiIDogXCJjdGltZVwiO1xyXG4gICAgICBjb25zdCB0aW1lT2YgPSAodDogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZiA9IHJlc29sdmVGaWxlKHRoaXMuYXBwLCB0LCBzb3VyY2VQYXRoKTtcclxuICAgICAgICByZXR1cm4gZiA/IChmLnN0YXQgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+KVtrZXldID8/IDAgOiAwO1xyXG4gICAgICB9O1xyXG4gICAgICBvdXQuc29ydCgoYSwgYikgPT4gdGltZU9mKGIudGFyZ2V0KSAtIHRpbWVPZihhLnRhcmdldCkpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG9wdHMubGltaXQgPiAwID8gb3V0LnNsaWNlKDAsIG9wdHMubGltaXQpIDogb3V0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNvbHZlRW50cmllcyhlbnRyaWVzOiBDYXJkRW50cnlbXSwgb3B0czogTWVyZ2VkT3B0aW9ucywgc291cmNlUGF0aDogc3RyaW5nKTogQ2FyZEVudHJ5W10ge1xyXG4gICAgaWYgKGVudHJpZXMubGVuZ3RoKSByZXR1cm4gZW50cmllcztcclxuXHJcbiAgICAvLyBcdTUzQ0RcdTY3RTVcdUZGMUFcdTUyMTdcdTUxRkFcdTYyNDBcdTY3MDlcdTVGMTVcdTc1MjhcdTRFODZcdTVGNTNcdTUyNERcdTY1ODdcdTY4NjNcdTc2ODRcdTdCMTRcdThCQjBcdUZGMDhcdTRFMEFcdTVDNDJcdTdBRTBcdTgyODJcdUZGMDlcclxuICAgIGlmIChvcHRzLnJldmVyc2UpIHtcclxuICAgICAgY29uc3QgbGlua3MgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLnJlc29sdmVkTGlua3M7XHJcbiAgICAgIGNvbnN0IG91dDogQ2FyZEVudHJ5W10gPSBbXTtcclxuICAgICAgZm9yIChjb25zdCBzcmMgb2YgT2JqZWN0LmtleXMobGlua3MpKSB7XHJcbiAgICAgICAgaWYgKGxpbmtzW3NyY10/Lltzb3VyY2VQYXRoXSkgb3V0LnB1c2goeyB0YXJnZXQ6IHNyYy5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIikgfSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHRoaXMuc29ydEVudHJpZXMob3V0LCBvcHRzLCBzb3VyY2VQYXRoKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAob3B0cy5mcm9tIHx8IG9wdHMudGFnKSB7XHJcbiAgICAgIGxldCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcclxuICAgICAgaWYgKHNvdXJjZVBhdGgpIGZpbGVzID0gZmlsZXMuZmlsdGVyKChmKSA9PiBmLnBhdGggIT09IHNvdXJjZVBhdGgpO1xyXG4gICAgICBpZiAob3B0cy5mcm9tKSB7XHJcbiAgICAgICAgY29uc3QgZm9sZGVyID0gb3B0cy5mcm9tLnJlcGxhY2UoL15cXC98XFwvJC9nLCBcIlwiKTtcclxuICAgICAgICBmaWxlcyA9IGZpbGVzLmZpbHRlcigoZikgPT4gZi5wYXRoID09PSBgJHtmb2xkZXJ9Lm1kYCB8fCBmLnBhdGguc3RhcnRzV2l0aChgJHtmb2xkZXJ9L2ApKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAob3B0cy50YWcpIHtcclxuICAgICAgICBjb25zdCB3YW50ID0gb3B0cy50YWcucmVwbGFjZSgvXiMvLCBcIlwiKTtcclxuICAgICAgICBmaWxlcyA9IGZpbGVzLmZpbHRlcigoZikgPT4gdGhpcy5oYXNUYWcoZiwgd2FudCkpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0aGlzLnNvcnRFbnRyaWVzKFxyXG4gICAgICAgIGZpbGVzLm1hcCgoZikgPT4gKHsgdGFyZ2V0OiBmLnBhdGgucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpIH0pKSxcclxuICAgICAgICBvcHRzLFxyXG4gICAgICAgIHNvdXJjZVBhdGhcclxuICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZW50cmllcztcclxuICB9XHJcblxyXG4gIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICogXHU1NDdEXHU0RUU0XHJcbiAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG4gIHByaXZhdGUgYWN0aXZlRWRpdG9yKCk6IEVkaXRvciB8IG51bGwge1xyXG4gICAgY29uc3QgdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICByZXR1cm4gdmlldz8uZWRpdG9yID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZ2lzdGVyQ29tbWFuZHMoKTogdm9pZCB7XHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJpbnNlcnQtY2FyZHMtYmxvY2tcIixcclxuICAgICAgbmFtZTogXCJcdTYzRDJcdTUxNjVcdTUzNjFcdTcyNDdcdTU3NTdcdTZBMjFcdTY3N0ZcIixcclxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4ge1xyXG4gICAgICAgIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcclxuICAgICAgICBjb25zdCBibG9jayA9IFwiYGBgY2FyZHNcXG5cXG4tIFtbXV1cXG5gYGBcXG5cIjtcclxuICAgICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKGJsb2NrLCBjdXJzb3IpO1xyXG4gICAgICAgIGVkaXRvci5zZXRDdXJzb3IoeyBsaW5lOiBjdXJzb3IubGluZSArIDIsIGNoOiA2IH0pO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiZW1iZWRzLXRvLWNhcmRzXCIsXHJcbiAgICAgIG5hbWU6IFwiXHU2MjhBXHU1RDRDXHU1MTY1ICFbWy4uLl1dIFx1OEY2Q1x1NjIxMFx1NTM2MVx1NzI0N1x1NTg5OVwiLFxyXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB0aGlzLmVtYmVkc1RvQ2FyZHMoZWRpdG9yKSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImxpbmtzLXRvLWNhcmRzXCIsXHJcbiAgICAgIG5hbWU6IFwiXHU2MjhBXHU5MDA5XHU1MzNBXHU5MUNDXHU3Njg0IFtbXHU5NEZFXHU2M0E1XV0gXHU4RjZDXHU2MjEwXHU1MzYxXHU3MjQ3XHU1ODk5XCIsXHJcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHRoaXMubGlua3NUb0NhcmRzKGVkaXRvciksXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJpbnNlcnQtcmV2ZXJzZS1jYXJkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NjNEMlx1NTE2NVx1NTNDRFx1NjdFNVx1NTM2MVx1NzI0N1x1NTc1N1x1RkYwOFx1NTIxN1x1NTFGQVx1NUYxNVx1NzUyOFx1NjcyQ1x1NjU4N1x1NzY4NFx1N0FFMFx1ODI4Mlx1RkYwOVwiLFxyXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XHJcbiAgICAgICAgY29uc3QgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xyXG4gICAgICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UoXCJgYGBjYXJkc1xcbnJldmVyc2U6IHRydWVcXG50aXRsZTogXHU4OEFCXHU1RjE1XHU3NTI4XHU1NzI4XFxuYGBgXFxuXCIsIGN1cnNvcik7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJ0b2dnbGUtYWxsLWNhcmRzXCIsXHJcbiAgICAgIG5hbWU6IFwiXHU1QzU1XHU1RjAwIC8gXHU2NTM2XHU4RDc3XHU2NzJDXHU5ODc1XHU2MjQwXHU2NzA5XHU1MzYxXHU3MjQ3XCIsXHJcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgY2FyZHMgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiLmFjLWNhcmRcIikpO1xyXG4gICAgICAgIGlmICghY2FyZHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICBuZXcgTm90aWNlKFwiXHU1RjUzXHU1MjREXHU4OUM2XHU1NkZFXHU5MUNDXHU2Q0ExXHU2NzA5XHU1MzYxXHU3MjQ3XCIpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBjb2xsYXBzZWQgPSBjYXJkcy5maWx0ZXIoKGMpID0+ICFjLmNsYXNzTGlzdC5jb250YWlucyhcImlzLWV4cGFuZGVkXCIpKTtcclxuICAgICAgICBjb25zdCB0YXJnZXRzID0gY29sbGFwc2VkLmxlbmd0aCA/IGNvbGxhcHNlZCA6IGNhcmRzO1xyXG4gICAgICAgIGZvciAoY29uc3QgYyBvZiB0YXJnZXRzKSBjLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFwiLmFjLWJ0bi0tdG9nZ2xlXCIpPy5jbGljaygpO1xyXG4gICAgICAgIG5ldyBOb3RpY2UoY29sbGFwc2VkLmxlbmd0aCA/IGBcdTVERjJcdTVDNTVcdTVGMDAgJHt0YXJnZXRzLmxlbmd0aH0gXHU1RjIwXHU1MzYxXHU3MjQ3YCA6IGBcdTVERjJcdTY1MzZcdThENzcgJHt0YXJnZXRzLmxlbmd0aH0gXHU1RjIwXHU1MzYxXHU3MjQ3YCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2VsZWN0aW9uTGluZVJhbmdlKGVkaXRvcjogRWRpdG9yKTogW251bWJlciwgbnVtYmVyXSB7XHJcbiAgICBpZiAoIWVkaXRvci5zb21ldGhpbmdTZWxlY3RlZCgpKSByZXR1cm4gWzAsIGVkaXRvci5saW5lQ291bnQoKSAtIDFdO1xyXG4gICAgY29uc3QgZnJvbSA9IGVkaXRvci5nZXRDdXJzb3IoXCJmcm9tXCIpO1xyXG4gICAgY29uc3QgdG8gPSBlZGl0b3IuZ2V0Q3Vyc29yKFwidG9cIik7XHJcbiAgICBjb25zdCBlbmRMaW5lID0gdG8uY2ggPT09IDAgJiYgdG8ubGluZSA+IGZyb20ubGluZSA/IHRvLmxpbmUgLSAxIDogdG8ubGluZTtcclxuICAgIHJldHVybiBbZnJvbS5saW5lLCBNYXRoLm1heChlbmRMaW5lLCBmcm9tLmxpbmUpXTtcclxuICB9XHJcblxyXG4gIC8qKiBcdTYyOEFcdTZCNjNcdTY1ODdcdTkxQ0NcdThGREVcdTdFRURcdTc2ODQgIVtbXHU3QjE0XHU4QkIwXV0gXHU4ODRDXHU1NDA4XHU1RTc2XHU2MjEwXHU0RTAwXHU0RTJBIGNhcmRzIFx1NTc1NyAqL1xyXG4gIHByaXZhdGUgZW1iZWRzVG9DYXJkcyhlZGl0b3I6IEVkaXRvcik6IHZvaWQge1xyXG4gICAgY29uc3QgY29udGVudCA9IGVkaXRvci5nZXRWYWx1ZSgpO1xyXG4gICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KFwiXFxuXCIpO1xyXG4gICAgY29uc3QgW2Zyb20sIHRvXSA9IHRoaXMuc2VsZWN0aW9uTGluZVJhbmdlKGVkaXRvcik7XHJcblxyXG4gICAgY29uc3Qgb3V0OiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgbGV0IGJ1ZmZlcjogc3RyaW5nW10gPSBbXTtcclxuICAgIGxldCBjb252ZXJ0ZWQgPSAwO1xyXG4gICAgY29uc3QgZmx1c2ggPSAoKSA9PiB7XHJcbiAgICAgIGlmICghYnVmZmVyLmxlbmd0aCkgcmV0dXJuO1xyXG4gICAgICBvdXQucHVzaChcImBgYGNhcmRzXCIpO1xyXG4gICAgICBmb3IgKGNvbnN0IHQgb2YgYnVmZmVyKSBvdXQucHVzaChgLSBbWyR7dH1dXWApO1xyXG4gICAgICBvdXQucHVzaChcImBgYFwiKTtcclxuICAgICAgY29udmVydGVkICs9IGJ1ZmZlci5sZW5ndGg7XHJcbiAgICAgIGJ1ZmZlciA9IFtdO1xyXG4gICAgfTtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGlmIChpIDwgZnJvbSB8fCBpID4gdG8pIHtcclxuICAgICAgICBvdXQucHVzaChsaW5lc1tpXSk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgbSA9IGxpbmVzW2ldLm1hdGNoKC9eKFxccyopKD86Wy0qK11cXHMqKT8hXFxbXFxbKFteXFxdXSspXFxdXFxdXFxzKiQvKTtcclxuICAgICAgaWYgKG0pIHtcclxuICAgICAgICBidWZmZXIucHVzaChtWzJdKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICBmbHVzaCgpO1xyXG4gICAgICBvdXQucHVzaChsaW5lc1tpXSk7XHJcbiAgICB9XHJcbiAgICBmbHVzaCgpO1xyXG5cclxuICAgIGlmICghY29udmVydGVkKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJcdTZDQTFcdTY3MDlcdTYyN0VcdTUyMzBcdTcyRUNcdTUzNjBcdTRFMDBcdTg4NENcdTc2ODQgIVtbLi4uXV0gXHU1RDRDXHU1MTY1XCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBlZGl0b3Iuc2V0VmFsdWUob3V0LmpvaW4oXCJcXG5cIikpO1xyXG4gICAgbmV3IE5vdGljZShgXHU1REYyXHU2MjhBICR7Y29udmVydGVkfSBcdTU5MDRcdTVENENcdTUxNjVcdTU0MDhcdTVFNzZcdTRFM0FcdTUzNjFcdTcyNDdcdTU4OTlgKTtcclxuICB9XHJcblxyXG4gIC8qKiBcdTkwMDlcdTUzM0FcdTkxQ0NcdTc2ODQgW1tcdTk0RkVcdTYzQTVdXVx1RkYwOFx1NTIxN1x1ODg2OFx1NjIxNlx1NkI2M1x1NjU4N1x1RkYwOVx1MjE5MiBjYXJkcyBcdTU3NTcgKi9cclxuICBwcml2YXRlIGxpbmtzVG9DYXJkcyhlZGl0b3I6IEVkaXRvcik6IHZvaWQge1xyXG4gICAgY29uc3Qgc2VsID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xyXG4gICAgaWYgKCFzZWwudHJpbSgpKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJcdThCRjdcdTUxNDhcdTkwMDlcdTRFMkRcdTUzMDVcdTU0MkIgW1tcdTk0RkVcdTYzQTVdXSBcdTc2ODRcdTY1ODdcdTY3MkNcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IHJlID0gL1xcW1xcWyhbXlxcXXwjXSspKD86I1teXFxdfF0qKT8oPzpcXHxbXlxcXV0qKT9cXF1cXF0vZztcclxuICAgIGNvbnN0IGZvdW5kOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgbGV0IG06IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XHJcbiAgICB3aGlsZSAoKG0gPSByZS5leGVjKHNlbCkpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHQgPSBtWzFdLnRyaW0oKTtcclxuICAgICAgaWYgKHQgJiYgIWZvdW5kLmluY2x1ZGVzKHQpKSBmb3VuZC5wdXNoKHQpO1xyXG4gICAgfVxyXG4gICAgaWYgKCFmb3VuZC5sZW5ndGgpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlx1OTAwOVx1NTMzQVx1OTFDQ1x1NkNBMVx1NjcwOSBbW1x1OTRGRVx1NjNBNV1dXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBibG9jayA9IGBcXGBcXGBcXGBjYXJkc1xcbiR7Zm91bmQubWFwKCh0KSA9PiBgLSBbWyR7dH1dXWApLmpvaW4oXCJcXG5cIil9XFxuXFxgXFxgXFxgYDtcclxuICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKGJsb2NrKTtcclxuICAgIG5ldyBOb3RpY2UoYFx1NURGMlx1NzUxRlx1NjIxMCAke2ZvdW5kLmxlbmd0aH0gXHU1RjIwXHU1MzYxXHU3MjQ3YCk7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBBcHAsIENvbXBvbmVudCwgTm90aWNlLCBzZXRJY29uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IE5vdGVNZXRhLCByZW5kZXJNYXJrZG93biB9IGZyb20gXCIuL21ldGFkYXRhXCI7XHJcbmltcG9ydCB7IEF0b21pY0NhcmRzU2V0dGluZ3MsIE1lcmdlZE9wdGlvbnMgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYXJkRW52IHtcclxuICBhcHA6IEFwcDtcclxuICBzZXR0aW5nczogQXRvbWljQ2FyZHNTZXR0aW5ncztcclxuICBzb3VyY2VQYXRoOiBzdHJpbmc7XHJcbiAgY29tcG9uZW50OiBDb21wb25lbnQ7XHJcbiAgLyoqIFx1NUY1M1x1NTI0RFx1NUQ0Q1x1NTk1N1x1NUM0Mlx1N0VBN1x1RkYwQ1x1NzUyOFx1NEU4RVx1OTAxMlx1NUY1Mlx1NkUzMlx1NjdEM1x1NjVGNlx1OTY1MFx1NTIzNlx1NkRGMVx1NUVBNiAqL1xyXG4gIGRlcHRoOiBudW1iZXI7XHJcbn1cclxuXHJcbmxldCBuZXN0TWFya2VyID0gMDtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXROZXN0KCk6IG51bWJlciB7XHJcbiAgcmV0dXJuIG5lc3RNYXJrZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3aXRoTmVzdDxUPihkZXB0aDogbnVtYmVyLCBmbjogKCkgPT4gVCk6IFQge1xyXG4gIGNvbnN0IHByZXYgPSBuZXN0TWFya2VyO1xyXG4gIG5lc3RNYXJrZXIgPSBkZXB0aDtcclxuICB0cnkge1xyXG4gICAgcmV0dXJuIGZuKCk7XHJcbiAgfSBmaW5hbGx5IHtcclxuICAgIG5lc3RNYXJrZXIgPSBwcmV2O1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gZm10Q291bnQobjogbnVtYmVyKTogc3RyaW5nIHtcclxuICByZXR1cm4gbiA+PSAxMDAwID8gYCR7KG4gLyAxMDAwKS50b0ZpeGVkKDEpfWsgXHU1QjU3YCA6IGAke259IFx1NUI1N2A7XHJcbn1cclxuXHJcbi8qKiBcdTZDQTFcdTY3MDlcdTVDMDFcdTk3NjJcdTY1RjZcdUZGMENcdTc1MjhcdTdDN0JcdTU3OEIvXHU4REVGXHU1Rjg0XHU2M0E4XHU2NUFEXHU0RTAwXHU0RTJBXHU1NkZFXHU2ODA3ICovXHJcbmZ1bmN0aW9uIGljb25Gb3IobWV0YTogTm90ZU1ldGEpOiBzdHJpbmcge1xyXG4gIC8vIFx1NkJCNVx1ODQzRCAvIFx1NzdFNVx1OEJDNlx1NzBCOVx1N0VBN1x1NUYxNVx1NzUyOFxyXG4gIGlmIChtZXRhLmJsb2NrQ29udGVudCkgcmV0dXJuIFwicXVvdGVcIjtcclxuICBjb25zdCB0eXBlID0gKG1ldGEuYmFkZ2VzLmZpbmQoKGIpID0+IGIua2V5ID09PSBcInR5cGVcIik/LnZhbHVlIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XHJcbiAgY29uc3QgaGF5ID0gYCR7dHlwZX0gJHttZXRhLmZpbGU/LnBhdGggPz8gbWV0YS50YXJnZXR9YC50b0xvd2VyQ2FzZSgpO1xyXG4gIGlmICgvY2hhcHRlcnxcdTdBRTBcdTgyODJ8XHU3RUM0XHU1NDA4Ly50ZXN0KGhheSkpIHJldHVybiBcImxheWVyc1wiO1xyXG4gIGlmICgvY29uY2VwdHxcdTY5ODJcdTVGRjUvLnRlc3QoaGF5KSkgcmV0dXJuIFwibGlnaHRidWxiXCI7XHJcbiAgaWYgKC9lbnRpdHl8XHU1QjlFXHU0RjUzLy50ZXN0KGhheSkpIHJldHVybiBcInVzZXJcIjtcclxuICBpZiAoL3Jlc291cmNlfFx1OEQ0NFx1NkU5MC8udGVzdChoYXkpKSByZXR1cm4gXCJwYWNrYWdlXCI7XHJcbiAgaWYgKC9nb2FsfFx1NzZFRVx1NjgwNy8udGVzdChoYXkpKSByZXR1cm4gXCJ0YXJnZXRcIjtcclxuICBpZiAoL21ldGF8ZGFzaGJvYXJkfGluZGV4Ly50ZXN0KGhheSkpIHJldHVybiBcImxheW91dC1ncmlkXCI7XHJcbiAgaWYgKC9hdG9tfFx1NTM5Rlx1NUI1MC8udGVzdChoYXkpKSByZXR1cm4gXCJjaXJjbGUtZG90XCI7XHJcbiAgcmV0dXJuIFwiZmlsZS10ZXh0XCI7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIG9wZW5Ob3RlKGVudjogQ2FyZEVudiwgbWV0YTogTm90ZU1ldGEsIGU6IE1vdXNlRXZlbnQpIHtcclxuICBpZiAoIW1ldGEuZmlsZSkge1xyXG4gICAgY29uc3QgbmFtZSA9IG1ldGEudGFyZ2V0LnNwbGl0KFwiI1wiKVswXS5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIik7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBmaWxlID0gYXdhaXQgZW52LmFwcC52YXVsdC5jcmVhdGUoXHJcbiAgICAgICAgYCR7bmFtZX0ubWRgLFxyXG4gICAgICAgIGAtLS1cXG50eXBlOiBhdG9tXFxudGl0bGU6IFwiJHttZXRhLnRpdGxlfVwiXFxuY3JlYXRlZDogJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApfVxcbi0tLVxcblxcbiMgJHttZXRhLnRpdGxlfVxcblxcbmBcclxuICAgICAgKTtcclxuICAgICAgYXdhaXQgZW52LmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgZW52LnNvdXJjZVBhdGgsIGZhbHNlKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBuZXcgTm90aWNlKGBcdTUyMUJcdTVFRkFcdTU5MzFcdThEMjVcdUZGMUEke1N0cmluZyhlcnIpfWApO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBjb25zdCBuZXdMZWFmID0gZS5jdHJsS2V5IHx8IGUubWV0YUtleSB8fCBlLmJ1dHRvbiA9PT0gMTtcclxuICAvLyB0YXJnZXQgXHU1M0VGXHU4MEZEXHU1RTI2ICNcdTY4MDdcdTk4OTggLyAjXlx1NTc1N2lkXHVGRjBDXHU0RUE0XHU3RUQ5IE9ic2lkaWFuIFx1NUI5QVx1NEY0RFx1NTIzMFx1NkJCNVx1ODQzRFxyXG4gIGF3YWl0IGVudi5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChtZXRhLnRhcmdldCB8fCBtZXRhLmZpbGUucGF0aCwgZW52LnNvdXJjZVBhdGgsIG5ld0xlYWYpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBocmVmT2YobWV0YTogTm90ZU1ldGEpOiBzdHJpbmcge1xyXG4gIGlmICghbWV0YS5maWxlKSByZXR1cm4gXCIjXCI7XHJcbiAgcmV0dXJuIG1ldGEucmVmID8gYCR7bWV0YS5maWxlLnBhdGh9IyR7bWV0YS5yZWZ9YCA6IG1ldGEuZmlsZS5wYXRoO1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZE1ldGFSb3cobWV0YTogTm90ZU1ldGEpOiBIVE1MRWxlbWVudCB8IG51bGwge1xyXG4gIGlmICghbWV0YS5iYWRnZXMubGVuZ3RoICYmICFtZXRhLnVwZGF0ZWQgJiYgIW1ldGEud29yZENvdW50KSByZXR1cm4gbnVsbDtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSBcImFjLWNhcmRfX21ldGFcIjtcclxuICBmb3IgKGNvbnN0IGIgb2YgbWV0YS5iYWRnZXMuc2xpY2UoMCwgMikpIHtcclxuICAgIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBgYWMtYmFkZ2UgYWMtYmFkZ2UtLSR7Yi5rZXl9YCwgdGV4dDogYi52YWx1ZSB9KTtcclxuICB9XHJcbiAgaWYgKG1ldGEudXBkYXRlZCkgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtbWV0YV9fZGF0ZVwiLCB0ZXh0OiBtZXRhLnVwZGF0ZWQgfSk7XHJcbiAgaWYgKG1ldGEud29yZENvdW50KSByb3cuY3JlYXRlU3Bhbih7IGNsczogXCJhYy1tZXRhX193b3Jkc1wiLCB0ZXh0OiBmbXRDb3VudChtZXRhLndvcmRDb3VudCkgfSk7XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuZnVuY3Rpb24gYnVpbGRUYWdSb3cobWV0YTogTm90ZU1ldGEsIGxpbWl0OiBudW1iZXIpOiBIVE1MRWxlbWVudCB8IG51bGwge1xyXG4gIGlmICghbWV0YS50YWdzLmxlbmd0aCkgcmV0dXJuIG51bGw7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICByb3cuY2xhc3NOYW1lID0gXCJhYy1jYXJkX190YWdzXCI7XHJcbiAgZm9yIChjb25zdCB0IG9mIG1ldGEudGFncy5zbGljZSgwLCBsaW1pdCkpIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLXRhZ1wiLCB0ZXh0OiBgIyR7dH1gIH0pO1xyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJDYXJkKGVudjogQ2FyZEVudiwgbWV0YTogTm90ZU1ldGEsIG9wdHM6IE1lcmdlZE9wdGlvbnMpOiBIVE1MRWxlbWVudCB7XHJcbiAgY29uc3QgaXNXcmFwID0gb3B0cy5sYXlvdXQgIT09IFwiY2FyZFwiO1xyXG4gIGNvbnN0IGlzU21hbGwgPSBvcHRzLnNpemUgPT09IFwic21hbGxcIjtcclxuXHJcbiAgY29uc3QgY2FyZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgY2FyZC5jbGFzc05hbWUgPSBgYWMtY2FyZCBhYy0ke29wdHMuZGVuc2l0eX0gYWMtc2l6ZS0ke29wdHMuc2l6ZX0gYWMtJHtcclxuICAgIGlzV3JhcCA/IFwid3JhcFwiIDogXCJjYXJkc3R5bGVcIlxyXG4gIH1gO1xyXG4gIGNhcmQuZGF0YXNldC5wYXRoID0gbWV0YS5maWxlPy5wYXRoID8/IG1ldGEudGFyZ2V0O1xyXG4gIGlmICghbWV0YS5maWxlKSBjYXJkLmNsYXNzTGlzdC5hZGQoXCJpcy1taXNzaW5nXCIpO1xyXG4gIGlmIChtZXRhLmJsb2NrQ29udGVudCkgY2FyZC5jbGFzc0xpc3QuYWRkKFwiaXMtYmxvY2tcIik7XHJcbiAgaWYgKG9wdHMuaGVpZ2h0ID4gMCkgY2FyZC5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tYWMtY2FyZC1oXCIsIGAke29wdHMuaGVpZ2h0fXB4YCk7XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU2QjYzXHU2NTg3XHU1QkI5XHU1NjY4XHVGRjA4XHU1MTQ4XHU1RUZBXHVGRjBDXHU2NzAwXHU1NDBFIGFwcGVuZFx1RkYwOSAtLS0tLS0tLS0tICovXHJcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgYm9keS5jbGFzc05hbWUgPSBcImFjLWNhcmRfX2JvZHlcIjtcclxuICBib2R5LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICBsZXQgYm9keUxvYWRlZCA9IGZhbHNlO1xyXG5cclxuICBjb25zdCBsb2FkQm9keSA9ICgpID0+IHtcclxuICAgIGlmIChib2R5TG9hZGVkIHx8ICFtZXRhLmZpbGUpIHJldHVybjtcclxuICAgIGJvZHlMb2FkZWQgPSB0cnVlO1xyXG4gICAgY29uc3QgZmlsZSA9IG1ldGEuZmlsZTtcclxuICAgIHZvaWQgZW52LmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpLnRoZW4oKHJhdykgPT4ge1xyXG4gICAgICBjb25zdCBmdWxsID0gcmF3LnJlcGxhY2UoL14tLS1cXHI/XFxuW1xcc1xcU10qP1xccj9cXG4tLS1cXHI/XFxuPy8sIFwiXCIpO1xyXG4gICAgICBjb25zdCBtZCA9IG1ldGEuYmxvY2tDb250ZW50ID8/IGZ1bGw7XHJcbiAgICAgIGJvZHkuZW1wdHkoKTtcclxuICAgICAgd2l0aE5lc3QoZW52LmRlcHRoLCAoKSA9PiB7XHJcbiAgICAgICAgcmVuZGVyTWFya2Rvd24oZW52LmFwcCwgbWQsIGJvZHksIGZpbGUucGF0aCwgZW52LmNvbXBvbmVudCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNENcdUZGMUFcdTk4NzZcdTkwRThcdTVDMDFcdTk3NjIgLS0tLS0tLS0tLSAqL1xyXG4gIGlmICghaXNXcmFwICYmIG9wdHMuY292ZXIgJiYgbWV0YS5jb3Zlcikge1xyXG4gICAgY29uc3QgY292ZXIgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJhYy1jYXJkX19jb3ZlclwiIH0pO1xyXG4gICAgY29uc3QgaW1nID0gY292ZXIuY3JlYXRlRWwoXCJpbWdcIiwge1xyXG4gICAgICBhdHRyOiB7IHNyYzogbWV0YS5jb3ZlciwgYWx0OiBtZXRhLnRpdGxlLCBsb2FkaW5nOiBcImxhenlcIiwgZHJhZ2dhYmxlOiBcImZhbHNlXCIgfSxcclxuICAgIH0pO1xyXG4gICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCAoKSA9PiBjb3Zlci5yZW1vdmUoKSk7XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NTkzNFx1OTBFOFx1RkYxQVx1NTZGRVx1NjgwNyArIFx1NjgwN1x1OTg5OCArIFx1NjgwN1x1N0I3RSArIFx1NUZCRFx1N0FFMCArIFx1NjRDRFx1NEY1Q1x1RkYwQ1x1NTE2OFx1NTcyOFx1NEUwMFx1ODg0QyAtLS0tLS0tLS0tICovXHJcbiAgY29uc3QgaGVhZCA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWNhcmRfX2hlYWRcIiB9KTtcclxuXHJcbiAgaWYgKGlzV3JhcCkge1xyXG4gICAgY29uc3QgdGh1bWIgPSBoZWFkLmNyZWF0ZURpdih7IGNsczogXCJhYy1jYXJkX190aHVtYlwiIH0pO1xyXG4gICAgaWYgKG9wdHMuY292ZXIgJiYgbWV0YS5jb3Zlcikge1xyXG4gICAgICBjb25zdCBpbWcgPSB0aHVtYi5jcmVhdGVFbChcImltZ1wiLCB7XHJcbiAgICAgICAgYXR0cjogeyBzcmM6IG1ldGEuY292ZXIsIGFsdDogbWV0YS50aXRsZSwgbG9hZGluZzogXCJsYXp5XCIsIGRyYWdnYWJsZTogXCJmYWxzZVwiIH0sXHJcbiAgICAgIH0pO1xyXG4gICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsICgpID0+IHtcclxuICAgICAgICB0aHVtYi5lbXB0eSgpO1xyXG4gICAgICAgIHNldEljb24odGh1bWIsIGljb25Gb3IobWV0YSkpO1xyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHNldEljb24odGh1bWIsIGljb25Gb3IobWV0YSkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY29uc3QgdGl0bGVFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xyXG4gIHRpdGxlRWwuY2xhc3NOYW1lID0gXCJhYy1jYXJkX190aXRsZVwiO1xyXG4gIHRpdGxlRWwuc2V0QXR0cihcImhyZWZcIiwgaHJlZk9mKG1ldGEpKTtcclxuICB0aXRsZUVsLnRleHRDb250ZW50ID0gbWV0YS50aXRsZTtcclxuICB0aXRsZUVsLnRpdGxlID0gbWV0YS5maWxlXHJcbiAgICA/IGAke2hyZWZPZihtZXRhKX1cdUZGMDhcdTcwQjlcdTUxRkJcdTVDNTVcdTVGMDAvXHU2NTM2XHU4RDc3XHVGRjBDQ3RybCtcdTcwQjlcdTUxRkJcdThERjNcdTUyMzBcdTUzOUZcdTY1ODdcdUZGMDlgXHJcbiAgICA6IGBcdTY1QjBcdTVFRkFcdUZGMUEke21ldGEudGFyZ2V0fWA7XHJcbiAgaGVhZC5hcHBlbmRDaGlsZCh0aXRsZUVsKTtcclxuXHJcbiAgaWYgKCFtZXRhLmZpbGUpIGhlYWQuY3JlYXRlU3Bhbih7IGNsczogXCJhYy1jYXJkX19taXNzaW5nXCIsIHRleHQ6IFwiXHU2NzJBXHU1MjFCXHU1RUZBXCIgfSk7XHJcblxyXG4gIGlmIChvcHRzLnRhZ3MpIHtcclxuICAgIGNvbnN0IHRhZ1JvdyA9IGJ1aWxkVGFnUm93KG1ldGEsIGlzU21hbGwgPyAyIDogMyk7XHJcbiAgICBpZiAodGFnUm93KSBoZWFkLmFwcGVuZENoaWxkKHRhZ1Jvdyk7XHJcbiAgfVxyXG5cclxuICBpZiAob3B0cy5tZXRhKSB7XHJcbiAgICBjb25zdCBtZXRhUm93ID0gYnVpbGRNZXRhUm93KG1ldGEpO1xyXG4gICAgaWYgKG1ldGFSb3cpIGhlYWQuYXBwZW5kQ2hpbGQobWV0YVJvdyk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBhY3Rpb25zID0gaGVhZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9fYWN0aW9uc1wiIH0pO1xyXG5cclxuICBjb25zdCB0b2dnbGVCdG4gPSBhY3Rpb25zLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImFjLWJ0biBhYy1idG4tLXRvZ2dsZVwiIH0pO1xyXG4gIGNvbnN0IHRvZ2dsZUljb24gPSB0b2dnbGVCdG4uY3JlYXRlU3Bhbih7IGNsczogXCJhYy1idG5fX2ljb25cIiB9KTtcclxuICBjb25zdCB0b2dnbGVUZXh0ID0gdG9nZ2xlQnRuLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtYnRuX190ZXh0XCIsIHRleHQ6IFwiXHU1QzU1XHU1RjAwXCIgfSk7XHJcbiAgc2V0SWNvbih0b2dnbGVJY29uLCBcImNoZXZyb24tZG93blwiKTtcclxuXHJcbiAgaWYgKG9wdHMub3Blbikge1xyXG4gICAgY29uc3Qgb3BlbkJ0biA9IGFjdGlvbnMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiYWMtYnRuIGFjLWJ0bi0tb3BlblwiIH0pO1xyXG4gICAgY29uc3Qgb3Blbkljb24gPSBvcGVuQnRuLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtYnRuX19pY29uXCIgfSk7XHJcbiAgICBvcGVuQnRuLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtYnRuX190ZXh0XCIsIHRleHQ6IFwiXHU2MjUzXHU1RjAwXCIgfSk7XHJcbiAgICBzZXRJY29uKG9wZW5JY29uLCBcImFycm93LXVwLXJpZ2h0XCIpO1xyXG4gICAgb3BlbkJ0bi50aXRsZSA9IG1ldGEuZmlsZSA/IFwiXHU1NzI4XHU1MzlGXHU1OUNCXHU2NTg3XHU2ODYzXHU0RTJEXHU2MjUzXHU1RjAwXCIgOiBcIlx1NTIxQlx1NUVGQVx1OEZEOVx1N0JDN1x1NjU4N1x1Njg2M1wiO1xyXG4gICAgb3BlbkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHZvaWQgb3Blbk5vdGUoZW52LCBtZXRhLCBlKSk7XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NjQ1OFx1ODk4MVx1RkYwOFx1NEUyRFx1RkYwOSAtLS0tLS0tLS0tICovXHJcbiAgY2FyZC5jcmVhdGVEaXYoe1xyXG4gICAgY2xzOiBcImFjLWNhcmRfX3N1bW1hcnlcIixcclxuICAgIHRleHQ6IG1ldGEuc3VtbWFyeSB8fCAobWV0YS5maWxlID8gXCJcdUZGMDhcdTY2ODJcdTY1RTBcdTY0NThcdTg5ODFcdUZGMDlcIiA6IFwiXHU3MEI5XHU1MUZCXHU2ODA3XHU5ODk4XHU1MjFCXHU1RUZBXHU4RkQ5XHU3QkM3XHU1MzlGXHU1QjUwXHU2NTg3XHU2ODYzXCIpLFxyXG4gIH0pO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NkI2M1x1NjU4N1x1RkYwOFx1NkRGMVx1RkYwOSAtLS0tLS0tLS0tICovXHJcbiAgY2FyZC5hcHBlbmRDaGlsZChib2R5KTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTVDNTVcdTVGMDAgLyBcdTY1MzZcdThENzcgLS0tLS0tLS0tLSAqL1xyXG4gIGxldCBleHBhbmRlZCA9IGZhbHNlO1xyXG4gIGNvbnN0IHNldEV4cGFuZGVkID0gKG5leHQ6IGJvb2xlYW4pID0+IHtcclxuICAgIGV4cGFuZGVkID0gbmV4dDtcclxuICAgIGNhcmQuY2xhc3NMaXN0LnRvZ2dsZShcImlzLWV4cGFuZGVkXCIsIGV4cGFuZGVkKTtcclxuICAgIHRvZ2dsZVRleHQudGV4dENvbnRlbnQgPSBleHBhbmRlZCA/IFwiXHU2NTM2XHU4RDc3XCIgOiBcIlx1NUM1NVx1NUYwMFwiO1xyXG4gICAgc2V0SWNvbih0b2dnbGVJY29uLCBleHBhbmRlZCA/IFwiY2hldnJvbi11cFwiIDogXCJjaGV2cm9uLWRvd25cIik7XHJcbiAgICBib2R5LnN0eWxlLmRpc3BsYXkgPSBleHBhbmRlZCA/IFwiXCIgOiBcIm5vbmVcIjtcclxuICAgIGlmIChleHBhbmRlZCkgbG9hZEJvZHkoKTtcclxuICB9O1xyXG5cclxuICB0b2dnbGVCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHNldEV4cGFuZGVkKCFleHBhbmRlZCkpO1xyXG5cclxuICAvLyBcdTcwQjlcdTY4MDdcdTk4OThcdTY2MkZcdTYyOThcdTUzRTBcdTVGMDBcdTUxNzNcdUZGMUJcdTYzMDlcdTRGNEYgQ3RybC9DbWQgXHU2MjREXHU4REYzXHU1MjMwXHU1MzlGXHU2NTg3XHJcbiAgdGl0bGVFbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5IHx8IGUuYnV0dG9uID09PSAxKSB7XHJcbiAgICAgIHZvaWQgb3Blbk5vdGUoZW52LCBtZXRhLCBlKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgc2V0RXhwYW5kZWQoIWV4cGFuZGVkKTtcclxuICB9KTtcclxuXHJcbiAgLy8gXHU1OTM0XHU5MEU4XHU3QTdBXHU3NjdEXHU1OTA0XHU0RTVGXHU1M0VGXHU0RUU1XHU2Mjk4XHU1M0UwXHVGRjA4XHU2MzA5XHU5NEFFXHU1NDhDXHU5NEZFXHU2M0E1XHU4MUVBXHU1REYxXHU1OTA0XHU3NDA2XHVGRjBDXHU0RTBEXHU5MUNEXHU1OTBEXHU4OUU2XHU1M0QxXHVGRjA5XHJcbiAgaGVhZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcclxuICAgIGNvbnN0IGVsID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgaWYgKGVsPy5jbG9zZXN0KFwiYnV0dG9uLCBhXCIpKSByZXR1cm47XHJcbiAgICBzZXRFeHBhbmRlZCghZXhwYW5kZWQpO1xyXG4gIH0pO1xyXG5cclxuICBpZiAob3B0cy5leHBhbmRlZCkgc2V0RXhwYW5kZWQodHJ1ZSk7XHJcblxyXG4gIHJldHVybiBjYXJkO1xyXG59XHJcbiIsICJpbXBvcnQgeyBBcHAsIENhY2hlZE1ldGFkYXRhLCBDb21wb25lbnQsIEZyb250TWF0dGVyQ2FjaGUsIE1hcmtkb3duUmVuZGVyZXIsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVCYWRnZSB7XHJcbiAga2V5OiBzdHJpbmc7XHJcbiAgdmFsdWU6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBOb3RlTWV0YSB7XHJcbiAgZmlsZTogVEZpbGUgfCBudWxsO1xyXG4gIC8qKiBcdTUzOUZcdTU5Q0JcdTVGMTVcdTc1MjhcdUZGMDhcdTUzRUZcdTU0MkIgI1x1NjgwN1x1OTg5OCBcdTYyMTYgI15cdTU3NTdpZFx1RkYwOSAqL1xyXG4gIHRhcmdldDogc3RyaW5nO1xyXG4gIC8qKiAjIFx1NEU0Qlx1NTQwRVx1NzY4NFx1OTBFOFx1NTIwNlx1RkYwQ1x1NkNBMVx1NjcwOVx1NTIxOVx1NEUzQVx1N0E3QSAqL1xyXG4gIHJlZjogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgc3VtbWFyeTogc3RyaW5nO1xyXG4gIGNvdmVyOiBzdHJpbmcgfCBudWxsO1xyXG4gIHRhZ3M6IHN0cmluZ1tdO1xyXG4gIGJhZGdlczogTm90ZUJhZGdlW107XHJcbiAgdXBkYXRlZDogc3RyaW5nO1xyXG4gIHdvcmRDb3VudDogbnVtYmVyO1xyXG4gIC8qKiBcdTZCQjVcdTg0M0RcdTdFQTdcdTVGMTVcdTc1MjhcdUZGMDhbW1x1OTg3NSNcdTY4MDdcdTk4OThdXSAvIFtbXHU5ODc1I15cdTU3NTddXVx1RkYwOVx1NjVGNlx1RkYwQ1x1OEJFNVx1NkJCNVx1ODQzRFx1NzY4NFx1NkI2M1x1NjU4NyAqL1xyXG4gIGJsb2NrQ29udGVudD86IHN0cmluZztcclxufVxyXG5cclxuY29uc3QgY2FjaGUgPSBuZXcgTWFwPHN0cmluZywgTm90ZU1ldGE+KCk7XHJcblxyXG5mdW5jdGlvbiBzdHJpcEZyb250bWF0dGVyKHJhdzogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBtID0gcmF3Lm1hdGNoKC9eLS0tXFxyP1xcbltcXHNcXFNdKj9cXHI/XFxuLS0tXFxyP1xcbj8vKTtcclxuICByZXR1cm4gbSA/IHJhdy5zbGljZShtWzBdLmxlbmd0aCkgOiByYXc7XHJcbn1cclxuXHJcbi8qKiBcdTYyOEEgbWFya2Rvd24gXHU2QjYzXHU2NTg3XHU1MzhCXHU2MjEwXHU0RTAwXHU2QkI1XHU3RUFGXHU2NTg3XHU2NzJDXHU2NDU4XHU4OTgxICovXHJcbmV4cG9ydCBmdW5jdGlvbiB0b1BsYWluVGV4dChib2R5OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIHJldHVybiBzdHJpcEZyb250bWF0dGVyKGJvZHkpXHJcbiAgICAucmVwbGFjZSgvYGBgW1xcc1xcU10qP2BgYC9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHMqPlxccypcXFshXFx3K1teXFxdXSpcXF0uKiQvZ20sIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvIVxcW1xcW1teXFxdXSpcXF1cXF0vZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC8hXFxbW15cXF1dKlxcXVxcKFteKV0qXFwpL2csIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvXFxbXFxbKFteXFxdfF0rKVxcfD8oW15cXF1dKilcXF1cXF0vZywgKF9tLCBhOiBzdHJpbmcsIGI6IHN0cmluZykgPT4gYiB8fCBhKVxyXG4gICAgLnJlcGxhY2UoL1xcWyhbXlxcXV0qKVxcXVxcKFteKV0qXFwpL2csIFwiJDFcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzezAsM30jezEsNn1cXHMrLiokL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHN7MCwzfT5cXHM/L2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHMqWy0qK11cXHMrL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHMqXFxkK1xcLlxccysvZ20sIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvWypfYH49XS9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL1xccysvZywgXCIgXCIpXHJcbiAgICAudHJpbSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaXJzdFRleHQoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCB0ZXh0ID0gdG9QbGFpblRleHQoY29udGVudCk7XHJcbiAgcmV0dXJuIHRleHQubGVuZ3RoID4gMjQgPyBgJHt0ZXh0LnNsaWNlKDAsIDI0KX1cdTIwMjZgIDogdGV4dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFx1NEVDRVx1NjU4N1x1Njg2M1x1OTFDQ1x1NjIyQVx1NTNENlx1NEUwMFx1NEUyQVx1NkJCNVx1ODQzRFx1RkYwOFx1NzdFNVx1OEJDNlx1NzBCOVx1RkYwOVx1MzAwMlxyXG4gKiBcdTY1MkZcdTYzMDEgYFtbXHU5ODc1I1x1NjgwN1x1OTg5OF1dYCBcdTRFMEUgYFtbXHU5ODc1I15cdTU3NTdpZF1dYCBcdTRFMjRcdTc5Q0RcdTVGMTVcdTc1MjhcdTMwMDJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0QmxvY2soXHJcbiAgcmF3OiBzdHJpbmcsXHJcbiAgZmlsZUNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwsXHJcbiAgcmVmOiBzdHJpbmdcclxuKTogeyB0aXRsZTogc3RyaW5nOyBjb250ZW50OiBzdHJpbmcgfSB8IG51bGwge1xyXG4gIGNvbnN0IGxpbmVzID0gcmF3LnNwbGl0KC9cXHI/XFxuLyk7XHJcbiAgY29uc3Qgd2FudGVkID0gZGVjb2RlVVJJQ29tcG9uZW50KHJlZik7XHJcblxyXG4gIC8vIFx1NTc1N1x1NUYxNVx1NzUyOCBeYmxvY2tpZFxyXG4gIGlmICh3YW50ZWQuc3RhcnRzV2l0aChcIl5cIikpIHtcclxuICAgIGNvbnN0IGJsb2NrID0gZmlsZUNhY2hlPy5ibG9ja3M/Llt3YW50ZWQuc2xpY2UoMSldO1xyXG4gICAgaWYgKCFibG9jaykgcmV0dXJuIG51bGw7XHJcbiAgICBjb25zdCBjb250ZW50ID0gbGluZXNcclxuICAgICAgLnNsaWNlKGJsb2NrLnBvc2l0aW9uLnN0YXJ0LmxpbmUsIGJsb2NrLnBvc2l0aW9uLmVuZC5saW5lICsgMSlcclxuICAgICAgLmpvaW4oXCJcXG5cIik7XHJcbiAgICByZXR1cm4geyB0aXRsZTogZmlyc3RUZXh0KGNvbnRlbnQpIHx8IHdhbnRlZCwgY29udGVudCB9O1xyXG4gIH1cclxuXHJcbiAgLy8gXHU2ODA3XHU5ODk4XHU1RjE1XHU3NTI4ICNoZWFkaW5nXHJcbiAgY29uc3QgaGVhZGluZ3MgPSBmaWxlQ2FjaGU/LmhlYWRpbmdzID8/IFtdO1xyXG4gIGNvbnN0IGlkeCA9IGhlYWRpbmdzLmZpbmRJbmRleCgoaCkgPT4gaC5oZWFkaW5nID09PSB3YW50ZWQpO1xyXG4gIGlmIChpZHggPCAwKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgY29uc3QgaCA9IGhlYWRpbmdzW2lkeF07XHJcbiAgY29uc3Qgc3RhcnQgPSBoLnBvc2l0aW9uLnN0YXJ0LmxpbmU7XHJcbiAgbGV0IGVuZCA9IGxpbmVzLmxlbmd0aCAtIDE7XHJcbiAgZm9yIChsZXQgaSA9IGlkeCArIDE7IGkgPCBoZWFkaW5ncy5sZW5ndGg7IGkrKykge1xyXG4gICAgaWYgKGhlYWRpbmdzW2ldLmxldmVsIDw9IGgubGV2ZWwpIHtcclxuICAgICAgZW5kID0gaGVhZGluZ3NbaV0ucG9zaXRpb24uc3RhcnQubGluZSAtIDE7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4geyB0aXRsZTogaC5oZWFkaW5nLCBjb250ZW50OiBsaW5lcy5zbGljZShzdGFydCwgTWF0aC5tYXgoZW5kLCBzdGFydCkgKyAxKS5qb2luKFwiXFxuXCIpIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBpY2tGaWVsZChmbTogRnJvbnRNYXR0ZXJDYWNoZSB8IHVuZGVmaW5lZCwgZmllbGRzOiBzdHJpbmdbXSk6IHN0cmluZyB7XHJcbiAgaWYgKCFmbSkgcmV0dXJuIFwiXCI7XHJcbiAgZm9yIChjb25zdCBmIG9mIGZpZWxkcykge1xyXG4gICAgY29uc3QgdiA9IGZtW2ZdO1xyXG4gICAgaWYgKHR5cGVvZiB2ID09PSBcInN0cmluZ1wiICYmIHYudHJpbSgpKSByZXR1cm4gdi50cmltKCk7XHJcbiAgICBpZiAodHlwZW9mIHYgPT09IFwibnVtYmVyXCIpIHJldHVybiBTdHJpbmcodik7XHJcbiAgfVxyXG4gIHJldHVybiBcIlwiO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjb2xsZWN0VGFncyhhcHA6IEFwcCwgZmlsZTogVEZpbGUpOiBzdHJpbmdbXSB7XHJcbiAgY29uc3QgZm0gPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyO1xyXG4gIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXTtcclxuICBjb25zdCBwdXNoID0gKHY6IHVua25vd24pID0+IHtcclxuICAgIGlmICh0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIikgb3V0LnB1c2godi5yZXBsYWNlKC9eIy8sIFwiXCIpKTtcclxuICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodikpIHYuZm9yRWFjaChwdXNoKTtcclxuICB9O1xyXG4gIHB1c2goZm0/LnRhZ3MpO1xyXG4gIHB1c2goZm0/LnRhZyk7XHJcbiAgaWYgKCFvdXQubGVuZ3RoKSB7XHJcbiAgICBjb25zdCBjYWNoZVRhZ3MgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LnRhZ3MgPz8gW107XHJcbiAgICBmb3IgKGNvbnN0IHQgb2YgY2FjaGVUYWdzKSBvdXQucHVzaCh0LnRhZy5yZXBsYWNlKC9eIy8sIFwiXCIpKTtcclxuICB9XHJcbiAgcmV0dXJuIEFycmF5LmZyb20obmV3IFNldChvdXQpKS5zbGljZSgwLCA2KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZXh0cmFjdENvdmVyKGFwcDogQXBwLCBmaWxlOiBURmlsZSwgYm9keTogc3RyaW5nLCBmaWVsZHM6IHN0cmluZ1tdKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgY29uc3QgZm0gPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyO1xyXG4gIGNvbnN0IGRlY2xhcmVkID0gcGlja0ZpZWxkKGZtLCBmaWVsZHMpO1xyXG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBbZGVjbGFyZWRdO1xyXG5cclxuICBpZiAoIWRlY2xhcmVkKSB7XHJcbiAgICBjb25zdCB3aWtpSW1nID0gYm9keS5tYXRjaCgvIVxcW1xcWyhbXlxcXXxdKykvKTtcclxuICAgIGlmICh3aWtpSW1nKSBjYW5kaWRhdGVzLnB1c2god2lraUltZ1sxXSk7XHJcbiAgICBjb25zdCBtZEltZyA9IGJvZHkubWF0Y2goLyFcXFtbXlxcXV0qXFxdXFwoKFteKV0rKVxcKS8pO1xyXG4gICAgaWYgKG1kSW1nKSBjYW5kaWRhdGVzLnB1c2gobWRJbWdbMV0pO1xyXG4gIH1cclxuXHJcbiAgZm9yIChjb25zdCBjIG9mIGNhbmRpZGF0ZXMpIHtcclxuICAgIGlmICghYykgY29udGludWU7XHJcbiAgICBpZiAoL15odHRwcz86XFwvXFwvL2kudGVzdChjKSkgcmV0dXJuIGM7XHJcbiAgICBjb25zdCBmID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoYy5zcGxpdChcInxcIilbMF0udHJpbSgpLCBmaWxlLnBhdGgpO1xyXG4gICAgaWYgKGYpIHJldHVybiBhcHAudmF1bHQuZ2V0UmVzb3VyY2VQYXRoKGYpO1xyXG4gIH1cclxuICByZXR1cm4gbnVsbDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVGaWxlKGFwcDogQXBwLCB0YXJnZXQ6IHN0cmluZywgc291cmNlUGF0aDogc3RyaW5nKTogVEZpbGUgfCBudWxsIHtcclxuICBjb25zdCBjbGVhbiA9IHRhcmdldC5zcGxpdChcIiNcIilbMF0uc3BsaXQoXCJ8XCIpWzBdLnRyaW0oKTtcclxuICBpZiAoIWNsZWFuKSByZXR1cm4gbnVsbDtcclxuICByZXR1cm4gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoY2xlYW4sIHNvdXJjZVBhdGgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmb3JtYXREYXRlKHY6IHVua25vd24pOiBzdHJpbmcge1xyXG4gIGlmICghdikgcmV0dXJuIFwiXCI7XHJcbiAgaWYgKHR5cGVvZiB2ICE9PSBcInN0cmluZ1wiKSByZXR1cm4gXCJcIjtcclxuICByZXR1cm4gdi5sZW5ndGggPiAxMCA/IHYuc2xpY2UoMCwgMTApIDogdjtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWROb3RlTWV0YShcclxuICBhcHA6IEFwcCxcclxuICB0YXJnZXQ6IHN0cmluZyxcclxuICBzb3VyY2VQYXRoOiBzdHJpbmcsXHJcbiAgc2V0dGluZ3M6IHtcclxuICAgIHN1bW1hcnlGaWVsZHM6IHN0cmluZ1tdO1xyXG4gICAgY292ZXJGaWVsZHM6IHN0cmluZ1tdO1xyXG4gICAgbWV0YUZpZWxkczogc3RyaW5nW107XHJcbiAgICBzdW1tYXJ5TGVuZ3RoOiBudW1iZXI7XHJcbiAgfSxcclxuICBhbGlhcz86IHN0cmluZ1xyXG4pOiBQcm9taXNlPE5vdGVNZXRhPiB7XHJcbiAgY29uc3QgaGFzaElkeCA9IHRhcmdldC5pbmRleE9mKFwiI1wiKTtcclxuICBjb25zdCBwYXRoUGFydCA9IChoYXNoSWR4ID49IDAgPyB0YXJnZXQuc2xpY2UoMCwgaGFzaElkeCkgOiB0YXJnZXQpLnNwbGl0KFwifFwiKVswXS50cmltKCk7XHJcbiAgY29uc3QgcmVmID0gaGFzaElkeCA+PSAwID8gdGFyZ2V0LnNsaWNlKGhhc2hJZHggKyAxKS50cmltKCkgOiBcIlwiO1xyXG4gIGNvbnN0IGZpbGUgPSByZXNvbHZlRmlsZShhcHAsIHBhdGhQYXJ0LCBzb3VyY2VQYXRoKTtcclxuICBjb25zdCBmYWxsYmFja1RpdGxlID0gYWxpYXMgfHwgcmVmIHx8IHBhdGhQYXJ0LnNwbGl0KFwiL1wiKS5wb3AoKSB8fCB0YXJnZXQ7XHJcblxyXG4gIGlmICghZmlsZSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgZmlsZTogbnVsbCxcclxuICAgICAgdGFyZ2V0LFxyXG4gICAgICByZWYsXHJcbiAgICAgIHRpdGxlOiBmYWxsYmFja1RpdGxlLFxyXG4gICAgICBzdW1tYXJ5OiBcIlwiLFxyXG4gICAgICBjb3ZlcjogbnVsbCxcclxuICAgICAgdGFnczogW10sXHJcbiAgICAgIGJhZGdlczogW10sXHJcbiAgICAgIHVwZGF0ZWQ6IFwiXCIsXHJcbiAgICAgIHdvcmRDb3VudDogMCxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBjb25zdCBrZXkgPSBgJHtmaWxlLnBhdGh9IyR7cmVmfToke2ZpbGUuc3RhdC5tdGltZX06JHtzZXR0aW5ncy5zdW1tYXJ5TGVuZ3RofWA7XHJcbiAgY29uc3QgaGl0ID0gY2FjaGUuZ2V0KGtleSk7XHJcbiAgaWYgKGhpdCkgcmV0dXJuIGFsaWFzID8geyAuLi5oaXQsIHRpdGxlOiBhbGlhcyB9IDogaGl0O1xyXG5cclxuICBjb25zdCByYXcgPSBhd2FpdCBhcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcclxuICBjb25zdCBmaWxlQ2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSkgPz8gbnVsbDtcclxuICBjb25zdCBmbSA9IGZpbGVDYWNoZT8uZnJvbnRtYXR0ZXI7XHJcblxyXG4gIC8vIFx1NkJCNVx1ODQzRFx1N0VBN1x1NUYxNVx1NzUyOFx1RkYxQVx1NTNFQVx1NTNENlx1OEJFNVx1NkJCNVx1ODQzRFx1RkYwQ1x1ODAwQ1x1NEUwRFx1NjYyRlx1NjU3NFx1N0JDN1xyXG4gIGNvbnN0IGJsb2NrID0gcmVmID8gZXh0cmFjdEJsb2NrKHJhdywgZmlsZUNhY2hlLCByZWYpIDogbnVsbDtcclxuICBjb25zdCBjb250ZW50Qm9keSA9IGJsb2NrPy5jb250ZW50ID8/IHN0cmlwRnJvbnRtYXR0ZXIocmF3KTtcclxuXHJcbiAgY29uc3QgbWFudWFsID0gYmxvY2sgPyBcIlwiIDogcGlja0ZpZWxkKGZtLCBzZXR0aW5ncy5zdW1tYXJ5RmllbGRzKTtcclxuICBjb25zdCBwbGFpbiA9IHRvUGxhaW5UZXh0KGNvbnRlbnRCb2R5KTtcclxuICBjb25zdCBzdW1tYXJ5ID1cclxuICAgIG1hbnVhbCB8fFxyXG4gICAgcGxhaW4uc2xpY2UoMCwgc2V0dGluZ3Muc3VtbWFyeUxlbmd0aCkgKyAocGxhaW4ubGVuZ3RoID4gc2V0dGluZ3Muc3VtbWFyeUxlbmd0aCA/IFwiXHUyMDI2XCIgOiBcIlwiKTtcclxuXHJcbiAgY29uc3QgYmFkZ2VzOiBOb3RlQmFkZ2VbXSA9IFtdO1xyXG4gIGlmICghYmxvY2spIHtcclxuICAgIGZvciAoY29uc3Qga2V5IG9mIHNldHRpbmdzLm1ldGFGaWVsZHMpIHtcclxuICAgICAgY29uc3QgdiA9IGZtPy5ba2V5XTtcclxuICAgICAgaWYgKHYgPT09IHVuZGVmaW5lZCB8fCB2ID09PSBudWxsKSBjb250aW51ZTtcclxuICAgICAgY29uc3QgdGV4dCA9IEFycmF5LmlzQXJyYXkodikgPyB2LmpvaW4oXCIvXCIpIDogU3RyaW5nKHYpO1xyXG4gICAgICBpZiAodGV4dC50cmltKCkpIGJhZGdlcy5wdXNoKHsga2V5LCB2YWx1ZTogdGV4dC50cmltKCkgfSk7XHJcbiAgICB9XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIFx1NkJCNVx1ODQzRFx1NTM2MVx1NzI0N1x1NTNFQVx1NjgwN1x1Njc2NVx1NkU5MFx1NjU4N1x1Njg2M1x1N0M3Qlx1NTc4Qlx1RkYwQ1x1OTA3Rlx1NTE0RFx1NTQ4Q1x1NjU3NFx1N0JDN1x1NkRGN1x1NkRDNlxyXG4gICAgY29uc3QgdCA9IGZtPy50eXBlO1xyXG4gICAgaWYgKHR5cGVvZiB0ID09PSBcInN0cmluZ1wiICYmIHQudHJpbSgpKSBiYWRnZXMucHVzaCh7IGtleTogXCJ0eXBlXCIsIHZhbHVlOiB0LnRyaW0oKSB9KTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHRpdGxlID1cclxuICAgIGFsaWFzIHx8IChibG9jayA/IGJsb2NrLnRpdGxlIDogXCJcIikgfHwgU3RyaW5nKGZtPy50aXRsZSB8fCBmaWxlLmJhc2VuYW1lKTtcclxuXHJcbiAgY29uc3QgbWV0YTogTm90ZU1ldGEgPSB7XHJcbiAgICBmaWxlLFxyXG4gICAgdGFyZ2V0LFxyXG4gICAgcmVmLFxyXG4gICAgdGl0bGUsXHJcbiAgICBzdW1tYXJ5LFxyXG4gICAgY292ZXI6IGV4dHJhY3RDb3ZlcihhcHAsIGZpbGUsIGNvbnRlbnRCb2R5LCBzZXR0aW5ncy5jb3ZlckZpZWxkcyksXHJcbiAgICB0YWdzOiBibG9jayA/IFtdIDogY29sbGVjdFRhZ3MoYXBwLCBmaWxlKSxcclxuICAgIGJhZGdlcyxcclxuICAgIHVwZGF0ZWQ6IGJsb2NrID8gXCJcIiA6IGZvcm1hdERhdGUoZm0/LnVwZGF0ZWQpIHx8IGZvcm1hdERhdGUoZm0/Lm1vZGlmaWVkKSB8fCBmb3JtYXREYXRlKGZtPy5jcmVhdGVkKSxcclxuICAgIHdvcmRDb3VudDogcGxhaW4ubGVuZ3RoLFxyXG4gICAgYmxvY2tDb250ZW50OiBibG9jaz8uY29udGVudCxcclxuICB9O1xyXG5cclxuICBjYWNoZS5zZXQoa2V5LCBtZXRhKTtcclxuICBpZiAoY2FjaGUuc2l6ZSA+IDUwMCkgY2FjaGUuY2xlYXIoKTtcclxuICByZXR1cm4gbWV0YTtcclxufVxyXG5cclxuLyoqIFx1NTE3Q1x1NUJCOVx1NjVCMFx1NjVFN1x1NzI0OFx1NjcyQyBPYnNpZGlhbiBcdTc2ODQgbWFya2Rvd24gXHU2RTMyXHU2N0QzXHU1MTY1XHU1M0UzICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJNYXJrZG93bihcclxuICBhcHA6IEFwcCxcclxuICBtYXJrZG93bjogc3RyaW5nLFxyXG4gIGVsOiBIVE1MRWxlbWVudCxcclxuICBzb3VyY2VQYXRoOiBzdHJpbmcsXHJcbiAgY29tcG9uZW50OiBDb21wb25lbnRcclxuKTogdm9pZCB7XHJcbiAgY29uc3QgbWQgPSBNYXJrZG93blJlbmRlcmVyIGFzIHVua25vd24gYXMge1xyXG4gICAgcmVuZGVyPzogKGE6IEFwcCwgbTogc3RyaW5nLCBlOiBIVE1MRWxlbWVudCwgcDogc3RyaW5nLCBjOiBDb21wb25lbnQpID0+IHZvaWQ7XHJcbiAgICByZW5kZXJNYXJrZG93bj86IChtOiBzdHJpbmcsIGU6IEhUTUxFbGVtZW50LCBwOiBzdHJpbmcsIGM6IENvbXBvbmVudCkgPT4gdm9pZDtcclxuICB9O1xyXG4gIGlmICh0eXBlb2YgbWQucmVuZGVyTWFya2Rvd24gPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgbWQucmVuZGVyTWFya2Rvd24obWFya2Rvd24sIGVsLCBzb3VyY2VQYXRoLCBjb21wb25lbnQpO1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIG1kLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICBtZC5yZW5kZXIoYXBwLCBtYXJrZG93biwgZWwsIHNvdXJjZVBhdGgsIGNvbXBvbmVudCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIGVsLnNldFRleHQobWFya2Rvd24pO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgQ2FyZEVudHJ5LCBDYXJkT3B0aW9ucywgQ2FyZHNRdWVyeSwgU29ydEtleSB9IGZyb20gXCIuL3R5cGVzXCI7XHJcblxyXG5jb25zdCBTT1JUX0tFWVM6IFNvcnRLZXlbXSA9IFtcIm5hbWVcIiwgXCJ1cGRhdGVkXCIsIFwiY3JlYXRlZFwiLCBcIm5vbmVcIl07XHJcblxyXG5mdW5jdGlvbiBhcHBseU9wdGlvbihvcHRzOiBDYXJkT3B0aW9ucywgcmF3S2V5OiBzdHJpbmcsIHJhd1ZhbHVlOiBzdHJpbmcpIHtcclxuICBjb25zdCBrZXkgPSByYXdLZXkudG9Mb3dlckNhc2UoKTtcclxuICBjb25zdCB2YWx1ZSA9IHJhd1ZhbHVlLnRyaW0oKS5yZXBsYWNlKC9eW1wiJ118W1wiJ10kL2csIFwiXCIpO1xyXG5cclxuICBzd2l0Y2ggKGtleSkge1xyXG4gICAgY2FzZSBcImhlaWdodFwiOlxyXG4gICAgICBvcHRzLmhlaWdodCA9IE51bWJlcih2YWx1ZSkgfHwgMDtcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwic3VtbWFyeVwiOlxyXG4gICAgICBvcHRzLnN1bW1hcnkgPSBOdW1iZXIodmFsdWUpIHx8IDA7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImV4cGFuZGVkXCI6XHJcbiAgICBjYXNlIFwiZXhwYW5kXCI6XHJcbiAgICAgIG9wdHMuZXhwYW5kZWQgPSAvXih0cnVlfHllc3wxfG9uKSQvaS50ZXN0KHZhbHVlKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiY292ZXJcIjpcclxuICAgICAgb3B0cy5jb3ZlciA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJtZXRhXCI6XHJcbiAgICAgIG9wdHMubWV0YSA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJ0YWdzXCI6XHJcbiAgICAgIG9wdHMudGFncyA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJvcGVuXCI6XHJcbiAgICAgIG9wdHMub3BlbiA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJyZXZlcnNlXCI6XHJcbiAgICBjYXNlIFwiYmFja2xpbmtzXCI6XHJcbiAgICAgIG9wdHMucmV2ZXJzZSA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJkZW5zaXR5XCI6XHJcbiAgICAgIG9wdHMuZGVuc2l0eSA9IHZhbHVlID09PSBcImNvbXBhY3RcIiA/IFwiY29tcGFjdFwiIDogXCJjb21mb3J0YWJsZVwiO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJsYXlvdXRcIjpcclxuICAgIGNhc2UgXCJzdHlsZVwiOlxyXG4gICAgICBvcHRzLmxheW91dCA9IHZhbHVlID09PSBcImNhcmRcIiA/IFwiY2FyZFwiIDogXCJ3cmFwXCI7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcInNpemVcIjpcclxuICAgICAgb3B0cy5zaXplID0gdmFsdWUgPT09IFwic21hbGxcIiA/IFwic21hbGxcIiA6IFwibm9ybWFsXCI7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImZyb21cIjpcclxuICAgIGNhc2UgXCJmb2xkZXJcIjpcclxuICAgICAgb3B0cy5mcm9tID0gdmFsdWU7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcInRhZ1wiOlxyXG4gICAgICBvcHRzLnRhZyA9IHZhbHVlLnJlcGxhY2UoL14jLywgXCJcIik7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcInNvcnRcIjpcclxuICAgICAgb3B0cy5zb3J0ID0gKFNPUlRfS0VZUy5pbmNsdWRlcyh2YWx1ZSBhcyBTb3J0S2V5KSA/IHZhbHVlIDogXCJuYW1lXCIpIGFzIFNvcnRLZXk7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImxpbWl0XCI6XHJcbiAgICAgIG9wdHMubGltaXQgPSBOdW1iZXIodmFsdWUpIHx8IDA7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcInRpdGxlXCI6XHJcbiAgICAgIG9wdHMudGl0bGUgPSB2YWx1ZTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICBicmVhaztcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlRW50cnkobGluZTogc3RyaW5nKTogQ2FyZEVudHJ5IHwgbnVsbCB7XHJcbiAgbGV0IHRleHQgPSBsaW5lLnJlcGxhY2UoL15bLSorXVxccysvLCBcIlwiKS50cmltKCk7XHJcbiAgaWYgKCF0ZXh0KSByZXR1cm4gbnVsbDtcclxuICAvLyBcdTVCQjlcdTVGQ0QgIVtbLi4uXV0gXHU0RTBFIFtbLi4uXV0gXHU0RTI0XHU3OUNEXHU1MTk5XHU2Q0Q1XHJcbiAgdGV4dCA9IHRleHQucmVwbGFjZSgvXiFcXHMqLywgXCJcIik7XHJcblxyXG4gIGNvbnN0IHdpa2kgPSB0ZXh0Lm1hdGNoKC9eXFxbXFxbKFteXFxdXSspXFxdXFxdXFxzKiguKikkLyk7XHJcbiAgaWYgKHdpa2kpIHtcclxuICAgIGNvbnN0IFt0YXJnZXQsIGlubGluZUFsaWFzXSA9IHdpa2lbMV0uc3BsaXQoXCJ8XCIpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdGFyZ2V0OiB0YXJnZXQudHJpbSgpLFxyXG4gICAgICBhbGlhczogKGlubGluZUFsaWFzIHx8IFwiXCIpLnRyaW0oKSB8fCAod2lraVsyXSB8fCBcIlwiKS50cmltKCkgfHwgdW5kZWZpbmVkLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8vIFx1N0VBRlx1NjU4N1x1NjcyQyAvIFx1OERFRlx1NUY4NFxyXG4gIGlmICgvXls+I2BdLy50ZXN0KHRleHQpKSByZXR1cm4gbnVsbDtcclxuICBjb25zdCBiYXJlID0gdGV4dC5yZXBsYWNlKC9cXFtcXFt8XFxdXFxdL2csIFwiXCIpLnRyaW0oKTtcclxuICByZXR1cm4gYmFyZSA/IHsgdGFyZ2V0OiBiYXJlIH0gOiBudWxsO1xyXG59XHJcblxyXG4vKipcclxuICogXHU4OUUzXHU2NzkwIGNhcmRzIFx1NEVFM1x1NzgwMVx1NTc1N1x1NTE4NVx1NUJCOVx1MzAwMlxyXG4gKiBcdTY1MkZcdTYzMDFcdTVGNjJcdTU5ODJcdUZGMUFcclxuICogICB0aXRsZTogXHU2NzJDXHU3QUUwXHU1RjE1XHU3NTI4XHU3Njg0XHU1MzlGXHU1QjUwXHU2NTg3XHU2ODYzXHJcbiAqICAgLS0tXHJcbiAqICAgLSBbW1x1N0IxNFx1OEJCMEFdXVxyXG4gKiAgIC0gW1tcdTdCMTRcdThCQjBCfFx1ODFFQVx1NUI5QVx1NEU0OVx1NjgwN1x1OTg5OF1dXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDYXJkc0Jsb2NrKHNvdXJjZTogc3RyaW5nKTogQ2FyZHNRdWVyeSB7XHJcbiAgY29uc3Qgb3B0aW9uczogQ2FyZE9wdGlvbnMgPSB7fTtcclxuICBjb25zdCBlbnRyaWVzOiBDYXJkRW50cnlbXSA9IFtdO1xyXG5cclxuICBmb3IgKGNvbnN0IHJhd0xpbmUgb2Ygc291cmNlLnNwbGl0KC9cXHI/XFxuLykpIHtcclxuICAgIGNvbnN0IGxpbmUgPSByYXdMaW5lLnRyaW0oKTtcclxuICAgIGlmICghbGluZSB8fCBsaW5lID09PSBcIi0tLVwiIHx8IGxpbmUgPT09IFwiKioqXCIpIGNvbnRpbnVlO1xyXG5cclxuICAgIC8vIFx1OTAwOVx1OTg3OVx1ODg0Q1x1RkYxQWtleTogdmFsdWVcdUZGMDhcdTRFMERcdTY2MkZcdTUyMTdcdTg4NjhcdTk4NzlcdTMwMDFcdTRFMERcdTY2MkYgd2lraWxpbmtcdUZGMDlcclxuICAgIGNvbnN0IG9wdE1hdGNoID0gbGluZS5tYXRjaCgvXihbYS16QS1aXVthLXpBLVowLTlfLV0qKVxccyo6XFxzKiguKikkLyk7XHJcbiAgICBpZiAob3B0TWF0Y2ggJiYgIWxpbmUuc3RhcnRzV2l0aChcIi0gW1tcIikgJiYgIWxpbmUuc3RhcnRzV2l0aChcIiFbW1wiKSkge1xyXG4gICAgICBhcHBseU9wdGlvbihvcHRpb25zLCBvcHRNYXRjaFsxXSwgb3B0TWF0Y2hbMl0pO1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBlbnRyeSA9IHBhcnNlRW50cnkobGluZSk7XHJcbiAgICBpZiAoZW50cnkpIGVudHJpZXMucHVzaChlbnRyeSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4geyBvcHRpb25zLCBlbnRyaWVzIH07XHJcbn1cclxuIiwgImltcG9ydCBBdG9taWNDYXJkc1BsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcbmltcG9ydCB7IExheW91dCwgU2l6ZSB9IGZyb20gXCIuL3R5cGVzXCI7XHJcbmltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEF0b21pY0NhcmRzU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogQXRvbWljQ2FyZHNQbHVnaW4pIHtcclxuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICB9XHJcblxyXG4gIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG4gICAgY29uc3QgcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzO1xyXG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1NUUwM1x1NUM0MFwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1MzYxXHU3MjQ3XHU2NzAwXHU1OTI3XHU5QUQ4XHU1RUE2IChweClcIilcclxuICAgICAgLnNldERlc2MoXCIwID0gXHU0RTBEXHU5NjUwXHU1MjM2XHVGRjFCXHU4RDg1XHU4RkM3XHU1NDBFXHU1MzYxXHU3MjQ3XHU1MTg1XHU5MEU4XHU2RURBXHU1MkE4XCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKHMuY2FyZEhlaWdodCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLmNhcmRIZWlnaHQgPSBOdW1iZXIodikgfHwgMDtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1MzYxXHU3MjQ3XHU1RTAzXHU1QzQwXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU1MzA1XHU4OEY5XHU1MzYxXHU3MjQ3ID0gXHU2QTJBXHU1NDExXHU2MjQxXHU1RTczXHU3Njg0XHU1QkI5XHU1NjY4XHVGRjFCXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDID0gXHU0RjIwXHU3RURGXHU1MzYxXHU3MjQ3XHU1ODk5XHVGRjA4XHU5ODc2XHU5MEU4XHU1OTI3XHU1QzAxXHU5NzYyXHVGRjA5XCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZCkgPT5cclxuICAgICAgICBkXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwid3JhcFwiLCBcIlx1NTMwNVx1ODhGOVx1NTM2MVx1NzI0N1x1RkYwOFx1NkEyQVx1NTQxMVx1RkYwOVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImNhcmRcIiwgXCJcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNENcdUZGMDhcdTk4NzZcdTkwRThcdTVDMDFcdTk3NjJcdUZGMDlcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZShzLmxheW91dClcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICBzLmxheW91dCA9IHYgYXMgTGF5b3V0O1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1RDRDXHU1OTU3XHU1MzYxXHU3MjQ3XHU3Njg0XHU1QzNBXHU1QkY4XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU1MzYxXHU3MjQ3XHU5MUNDXHU1MThEXHU1OTU3XHU3Njg0XHU1MzYxXHU3MjQ3XHU1ODk5XHU5RUQ4XHU4QkE0XHU3NTI4XHU0RUMwXHU0RTQ4XHU1QzNBXHU1QkY4XHVGRjFCXHU1NzU3XHU1MTg1XHU1MTk5IHNpemU6IFx1NTNFRlx1NTM1NVx1NzJFQ1x1ODk4Nlx1NzZENlwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGQpID0+XHJcbiAgICAgICAgZFxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcInNtYWxsXCIsIFwiXHU3N0U1XHU4QkM2XHU3MEI5XHU1QzBGXHU1MzYxXHU3MjQ3XHVGRjA4XHU0RTAwXHU4ODRDXHU1OTFBXHU0RTJBXHVGRjA5XCIpXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwibm9ybWFsXCIsIFwiXHU1RTM4XHU4OUM0XHU1MzYxXHU3MjQ3XCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUocy5uZXN0ZWRTaXplKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICAgIHMubmVzdGVkU2l6ZSA9IHYgYXMgU2l6ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NUJDNlx1NUVBNlwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGQpID0+XHJcbiAgICAgICAgZFxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImNvbWZvcnRhYmxlXCIsIFwiXHU1QkJEXHU2NzdFXCIpXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiY29tcGFjdFwiLCBcIlx1N0QyN1x1NTFEMVwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHMuZGVuc2l0eSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICBzLmRlbnNpdHkgPSB2IGFzIFwiY29tcGFjdFwiIHwgXCJjb21mb3J0YWJsZVwiO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJcdTUzNjFcdTcyNDdcdTUxODVcdTVCQjlcIikuc2V0SGVhZGluZygpO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NjQ1OFx1ODk4MVx1OTU3Rlx1NUVBNlwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1ODFFQVx1NTJBOFx1NjQ1OFx1ODk4MVx1NjIyQVx1NTNENlx1NzY4NFx1NUI1N1x1N0IyNlx1NjU3MFx1RkYwOGZyb250bWF0dGVyIFx1NjcwOSBzdW1tYXJ5L2Rlc2NyaXB0aW9uIFx1NjVGNlx1NEYxOFx1NTE0OFx1NzUyOFx1RkYwOVwiKVxyXG4gICAgICAuYWRkVGV4dCgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKFN0cmluZyhzLnN1bW1hcnlMZW5ndGgpKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgcy5zdW1tYXJ5TGVuZ3RoID0gTnVtYmVyKHYpIHx8IDE4MDtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgY29uc3QgdG9nZ2xlID0gKG5hbWU6IHN0cmluZywgZGVzYzogc3RyaW5nLCBnZXQ6ICgpID0+IGJvb2xlYW4sIHNldDogKHY6IGJvb2xlYW4pID0+IHZvaWQpID0+XHJcbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKG5hbWUpLnNldERlc2MoZGVzYykuYWRkVG9nZ2xlKCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoZ2V0KCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzZXQodik7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIHRvZ2dsZShcIlx1NjYzRVx1NzkzQVx1NUMwMVx1OTc2MlwiLCBcIlx1OEJGQlx1NTNENiBmcm9udG1hdHRlciBcdTc2ODQgY292ZXIvaW1hZ2UvYmFubmVyIFx1NjIxNlx1NkI2M1x1NjU4N1x1N0IyQ1x1NEUwMFx1NUYyMFx1NTZGRVwiLCAoKSA9PiBzLnNob3dDb3ZlciwgKHYpID0+IChzLnNob3dDb3ZlciA9IHYpKTtcclxuICAgIHRvZ2dsZShcIlx1NjYzRVx1NzkzQVx1NTE0M1x1NEZFMVx1NjA2RlwiLCBcInR5cGUgLyBzdGF0dXMgLyBkb21haW4gLyBcdTY2RjRcdTY1QjBcdTY1RjZcdTk1RjQgLyBcdTVCNTdcdTY1NzBcIiwgKCkgPT4gcy5zaG93TWV0YSwgKHYpID0+IChzLnNob3dNZXRhID0gdikpO1xyXG4gICAgdG9nZ2xlKFwiXHU2NjNFXHU3OTNBXHU2ODA3XHU3QjdFXCIsIFwiXCIsICgpID0+IHMuc2hvd1RhZ3MsICh2KSA9PiAocy5zaG93VGFncyA9IHYpKTtcclxuICAgIHRvZ2dsZShcIlx1NjYzRVx1NzkzQVx1MzAwQ1x1NjI1M1x1NUYwMFx1MzAwRFx1NjMwOVx1OTRBRVwiLCBcIlwiLCAoKSA9PiBzLnNob3dPcGVuQnV0dG9uLCAodikgPT4gKHMuc2hvd09wZW5CdXR0b24gPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDBcdTZCNjNcdTY1ODdcIiwgXCJcdTYyNTNcdTVGMDBcdTY1ODdcdTY4NjNcdTY1RjZcdTUzNjFcdTcyNDdcdTc2RjRcdTYzQTVcdTY2M0VcdTc5M0FcdTVCOENcdTY1NzRcdTUxODVcdTVCQjlcdUZGMENcdTcwQjlcdTY4MDdcdTk4OThcdTUzRUZcdTYyOThcdTUzRTBcIiwgKCkgPT4gcy5kZWZhdWx0RXhwYW5kZWQsICh2KSA9PiAocy5kZWZhdWx0RXhwYW5kZWQgPSB2KSk7XHJcbiAgICB0b2dnbGUoXHJcbiAgICAgIFwiXHU1RDRDXHU1OTU3XHU1MzYxXHU3MjQ3XHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXCIsXHJcbiAgICAgIFwiXHU1MzYxXHU3MjQ3XHU5MUNDXHU1MThEXHU1OTU3XHU3Njg0XHU1MzYxXHU3MjQ3XHU1ODk5XHU2NjJGXHU1NDI2XHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXHVGRjFCXHU1MTczXHU5NUVEXHU2NUY2XHU1M0VBXHU2NjNFXHU3OTNBXHU2ODA3XHU5ODk4XHU1NDhDXHU2NDU4XHU4OTgxXCIsXHJcbiAgICAgICgpID0+IHMubmVzdGVkRXhwYW5kZWQsXHJcbiAgICAgICh2KSA9PiAocy5uZXN0ZWRFeHBhbmRlZCA9IHYpXHJcbiAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NjcwMFx1NTkyN1x1NUQ0Q1x1NTk1N1x1NkRGMVx1NUVBNlwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1NTM2MVx1NzI0N1x1OTFDQ1x1NTE4RFx1NjUzRSBjYXJkcyBcdTU3NTdcdTY1RjZcdTc2ODRcdTkwMTJcdTVGNTJcdTVDNDJcdTY1NzBcdTRFMEFcdTk2NTBcdUZGMENcdTk2MzJcdTZCNjJcdTVGQUFcdTczQUZcdTVGMTVcdTc1MjhcdTUzNjFcdTZCN0JcIilcclxuICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShTdHJpbmcocy5tYXhOZXN0RGVwdGgpKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgcy5tYXhOZXN0RGVwdGggPSBNYXRoLm1heCgxLCBOdW1iZXIodikgfHwgMyk7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiXHU1QjU3XHU2QkI1XHU2NjIwXHU1QzA0XCIpLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICBjb25zdCBsaXN0RmllbGQgPSAobmFtZTogc3RyaW5nLCBkZXNjOiBzdHJpbmcsIGdldDogKCkgPT4gc3RyaW5nW10sIHNldDogKHY6IHN0cmluZ1tdKSA9PiB2b2lkKSA9PlxyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShuYW1lKVxyXG4gICAgICAgIC5zZXREZXNjKGRlc2MpXHJcbiAgICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgICB0XHJcbiAgICAgICAgICAgIC5zZXRWYWx1ZShnZXQoKS5qb2luKFwiLCBcIikpXHJcbiAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcImEsIGIsIGNcIilcclxuICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICAgICAgc2V0KFxyXG4gICAgICAgICAgICAgICAgdlxyXG4gICAgICAgICAgICAgICAgICAuc3BsaXQoXCIsXCIpXHJcbiAgICAgICAgICAgICAgICAgIC5tYXAoKHgpID0+IHgudHJpbSgpKVxyXG4gICAgICAgICAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pXHJcbiAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgIGxpc3RGaWVsZChcIlx1NjQ1OFx1ODk4MVx1NUI1N1x1NkJCNVwiLCBcIlx1NjMwOVx1OTg3QVx1NUU4Rlx1NUMxRFx1OEJENVx1OEJGQlx1NTNENlx1NzY4NCBmcm9udG1hdHRlciBcdTVCNTdcdTZCQjVcIiwgKCkgPT4gcy5zdW1tYXJ5RmllbGRzLCAodikgPT4gKHMuc3VtbWFyeUZpZWxkcyA9IHYpKTtcclxuICAgIGxpc3RGaWVsZChcIlx1NUMwMVx1OTc2Mlx1NUI1N1x1NkJCNVwiLCBcIlwiLCAoKSA9PiBzLmNvdmVyRmllbGRzLCAodikgPT4gKHMuY292ZXJGaWVsZHMgPSB2KSk7XHJcbiAgICBsaXN0RmllbGQoXCJcdTUxNDNcdTRGRTFcdTYwNkZcdTVCNTdcdTZCQjVcIiwgXCJcdTRGMUFcdTRFRTVcdTVGQkRcdTdBRTBcdTVGNjJcdTVGMEZcdTY2M0VcdTc5M0FcdTU3MjhcdTUzNjFcdTcyNDdcdTRFMEFcIiwgKCkgPT4gcy5tZXRhRmllbGRzLCAodikgPT4gKHMubWV0YUZpZWxkcyA9IHYpKTtcclxuICB9XHJcbn1cclxuIiwgImV4cG9ydCB0eXBlIERlbnNpdHkgPSBcImNvbXBhY3RcIiB8IFwiY29tZm9ydGFibGVcIjtcclxuZXhwb3J0IHR5cGUgU29ydEtleSA9IFwibmFtZVwiIHwgXCJ1cGRhdGVkXCIgfCBcImNyZWF0ZWRcIiB8IFwibm9uZVwiO1xyXG4vKiogd3JhcCA9IFx1NjI0MVx1NUU3M1x1NTMwNVx1ODhGOVx1NTM2MVx1NzI0N1x1RkYwOFx1NkEyQVx1NTQxMVx1RkYwOVx1RkYxQmNhcmQgPSBcdTRGMjBcdTdFREZcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNENcdUZGMDhcdTk4NzZcdTkwRThcdTVDMDFcdTk3NjJcdUZGMDkgKi9cclxuZXhwb3J0IHR5cGUgTGF5b3V0ID0gXCJ3cmFwXCIgfCBcImNhcmRcIjtcclxuLyoqIG5vcm1hbCA9IFx1NUUzOFx1ODlDNFx1NjU4N1x1Njg2M1x1NTM2MVx1NzI0N1x1RkYxQnNtYWxsID0gXHU3N0U1XHU4QkM2XHU3MEI5IC8gXHU2QkI1XHU4NDNEXHU3RUE3XHU1QzBGXHU1MzYxXHU3MjQ3XHVGRjA4XHU2NkY0XHU3QTg0XHVGRjBDXHU0RTAwXHU4ODRDXHU2MzkyXHU1OTFBXHU0RTJBXHVGRjA5ICovXHJcbmV4cG9ydCB0eXBlIFNpemUgPSBcIm5vcm1hbFwiIHwgXCJzbWFsbFwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBdG9taWNDYXJkc1NldHRpbmdzIHtcclxuICBsYXlvdXQ6IExheW91dDtcclxuICAvKiogXHU1RDRDXHU1OTU3XHU1NzI4XHU1OTI3XHU1MzYxXHU3MjQ3XHU5MUNDXHU3Njg0XHU1MzYxXHU3MjQ3XHU1ODk5XHU5RUQ4XHU4QkE0XHU1QzNBXHU1QkY4ICovXHJcbiAgbmVzdGVkU2l6ZTogU2l6ZTtcclxuICBjYXJkSGVpZ2h0OiBudW1iZXI7XHJcbiAgc3VtbWFyeUxlbmd0aDogbnVtYmVyO1xyXG4gIHNob3dDb3ZlcjogYm9vbGVhbjtcclxuICBzaG93TWV0YTogYm9vbGVhbjtcclxuICBzaG93VGFnczogYm9vbGVhbjtcclxuICBzaG93T3BlbkJ1dHRvbjogYm9vbGVhbjtcclxuICAvKiogXHU1MzYxXHU3MjQ3XHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXHU2QjYzXHU2NTg3ICovXHJcbiAgZGVmYXVsdEV4cGFuZGVkOiBib29sZWFuO1xyXG4gIC8qKiBcdTVENENcdTU3MjhcdTUzNjFcdTcyNDdcdTkxQ0NcdTc2ODRcdTUzNjFcdTcyNDdcdTU4OTlcdTY2MkZcdTU0MjZcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDAgKi9cclxuICBuZXN0ZWRFeHBhbmRlZDogYm9vbGVhbjtcclxuICBtYXhOZXN0RGVwdGg6IG51bWJlcjtcclxuICBkZW5zaXR5OiBEZW5zaXR5O1xyXG4gIHN1bW1hcnlGaWVsZHM6IHN0cmluZ1tdO1xyXG4gIGNvdmVyRmllbGRzOiBzdHJpbmdbXTtcclxuICBtZXRhRmllbGRzOiBzdHJpbmdbXTtcclxuICB2ZXJib3NlOiBib29sZWFuO1xyXG4gIC8qKiBcdTVFMDNcdTVDNDBcdTlFRDhcdThCQTRcdTUwM0NcdTUzRDhcdTUzMTZcdTY1RjZcdTc1MjhcdTY3NjVcdThGQzFcdTc5RkJcdTY1RTdcdThCQkVcdTdGNkUgKi9cclxuICBzZXR0aW5nc1ZlcnNpb24/OiBudW1iZXI7XHJcbn1cclxuXHJcbi8qKiBcdTVFMDNcdTVDNDBcdTc2RjhcdTUxNzNcdTlFRDhcdThCQTRcdTUwM0NcdTUzRDhcdTY2RjRcdTY1RjYgKzFcdUZGMENcdTY1RTdcdThCQkVcdTdGNkVcdTRGMUFcdTg4QUJcdTY1QjBcdTlFRDhcdThCQTRcdTUwM0NcdTg5ODZcdTc2RDYgKi9cclxuZXhwb3J0IGNvbnN0IFNFVFRJTkdTX1ZFUlNJT04gPSAyO1xyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEF0b21pY0NhcmRzU2V0dGluZ3MgPSB7XHJcbiAgbGF5b3V0OiBcIndyYXBcIixcclxuICBuZXN0ZWRTaXplOiBcIm5vcm1hbFwiLFxyXG4gIGNhcmRIZWlnaHQ6IDAsXHJcbiAgc3VtbWFyeUxlbmd0aDogMTgwLFxyXG4gIHNob3dDb3ZlcjogdHJ1ZSxcclxuICBzaG93TWV0YTogdHJ1ZSxcclxuICBzaG93VGFnczogdHJ1ZSxcclxuICBzaG93T3BlbkJ1dHRvbjogdHJ1ZSxcclxuICBkZWZhdWx0RXhwYW5kZWQ6IHRydWUsXHJcbiAgbmVzdGVkRXhwYW5kZWQ6IHRydWUsXHJcbiAgbWF4TmVzdERlcHRoOiAzLFxyXG4gIGRlbnNpdHk6IFwiY29tZm9ydGFibGVcIixcclxuICBzdW1tYXJ5RmllbGRzOiBbXCJzdW1tYXJ5XCIsIFwiZGVzY3JpcHRpb25cIiwgXCJhYnN0cmFjdFwiLCBcImV4Y2VycHRcIiwgXCJcdTdCODBcdTRFQ0JcIiwgXCJcdTY0NThcdTg5ODFcIl0sXHJcbiAgY292ZXJGaWVsZHM6IFtcImNvdmVyXCIsIFwiaW1hZ2VcIiwgXCJiYW5uZXJcIiwgXCJ0aHVtYm5haWxcIiwgXCJpbWdcIiwgXCJcdTVDMDFcdTk3NjJcIl0sXHJcbiAgbWV0YUZpZWxkczogW1widHlwZVwiLCBcInN0YXR1c1wiLCBcImRvbWFpblwiLCBcImNvbXBsZXhpdHlcIl0sXHJcbiAgdmVyYm9zZTogZmFsc2UsXHJcbn07XHJcblxyXG4vKiogXHU1MzU1XHU0RTJBIGNhcmRzIFx1NEVFM1x1NzgwMVx1NTc1N1x1NTNFRlx1ODk4Nlx1NzZENlx1NzY4NFx1OTAwOVx1OTg3OSAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIENhcmRPcHRpb25zIHtcclxuICBoZWlnaHQ/OiBudW1iZXI7XHJcbiAgc3VtbWFyeT86IG51bWJlcjtcclxuICBleHBhbmRlZD86IGJvb2xlYW47XHJcbiAgY292ZXI/OiBib29sZWFuO1xyXG4gIG1ldGE/OiBib29sZWFuO1xyXG4gIHRhZ3M/OiBib29sZWFuO1xyXG4gIG9wZW4/OiBib29sZWFuO1xyXG4gIGRlbnNpdHk/OiBEZW5zaXR5O1xyXG4gIGxheW91dD86IExheW91dDtcclxuICBzaXplPzogU2l6ZTtcclxuICAvKiogXHU2MzA5XHU2NTg3XHU0RUY2XHU1OTM5XHU3QjVCXHU5MDA5XHVGRjBDXHU1OTgyIHdpa2kvY29uY2VwdHMgKi9cclxuICBmcm9tPzogc3RyaW5nO1xyXG4gIC8qKiBcdTYzMDlcdTY4MDdcdTdCN0VcdTdCNUJcdTkwMDlcdUZGMENcdTU5ODIgdHlwZS9jb25jZXB0IFx1NjIxNiAjdHlwZS9jb25jZXB0ICovXHJcbiAgdGFnPzogc3RyaW5nO1xyXG4gIHNvcnQ/OiBTb3J0S2V5O1xyXG4gIGxpbWl0PzogbnVtYmVyO1xyXG4gIC8qKiB0cnVlID0gXHU1M0NEXHU2N0U1XHVGRjFBXHU1MjE3XHU1MUZBXHU2MjQwXHU2NzA5XHU1RjE1XHU3NTI4XHU0RTg2XHU1RjUzXHU1MjREXHU2NTg3XHU2ODYzXHU3Njg0XHU3QjE0XHU4QkIwXHVGRjA4XHU0RTBBXHU1QzQyXHU3QUUwXHU4MjgyXHVGRjA5ICovXHJcbiAgcmV2ZXJzZT86IGJvb2xlYW47XHJcbiAgdGl0bGU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ2FyZEVudHJ5IHtcclxuICB0YXJnZXQ6IHN0cmluZztcclxuICBhbGlhcz86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYXJkc1F1ZXJ5IHtcclxuICBvcHRpb25zOiBDYXJkT3B0aW9ucztcclxuICBlbnRyaWVzOiBDYXJkRW50cnlbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNZXJnZWRPcHRpb25zIGV4dGVuZHMgUmVxdWlyZWQ8T21pdDxDYXJkT3B0aW9ucywgXCJmcm9tXCIgfCBcInRhZ1wiIHwgXCJ0aXRsZVwiIHwgXCJzb3J0XCI+PiB7XHJcbiAgZnJvbTogc3RyaW5nO1xyXG4gIHRhZzogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgc29ydDogU29ydEtleTtcclxuICBsaW1pdDogbnVtYmVyO1xyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFB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QUFJLEtBQUssTUFBTSxDQUFDLENBQUM7QUFBQSxJQUNuQjtBQUNBLFVBQU07QUFFTixRQUFJLENBQUMsV0FBVztBQUNkLFVBQUksd0JBQU8sOEVBQXVCO0FBQ2xDO0FBQUEsSUFDRjtBQUNBLFdBQU8sU0FBUyxJQUFJLEtBQUssSUFBSSxDQUFDO0FBQzlCLFFBQUksd0JBQU8sZ0JBQU0sU0FBUyx5REFBWTtBQUFBLEVBQ3hDO0FBQUE7QUFBQSxFQUdRLGFBQWEsUUFBc0I7QUFDekMsVUFBTSxNQUFNLE9BQU8sYUFBYTtBQUNoQyxRQUFJLENBQUMsSUFBSSxLQUFLLEdBQUc7QUFDZixVQUFJLHdCQUFPLDBFQUFtQjtBQUM5QjtBQUFBLElBQ0Y7QUFDQSxVQUFNLEtBQUs7QUFDWCxVQUFNLFFBQWtCLENBQUM7QUFDekIsUUFBSTtBQUNKLFlBQVEsSUFBSSxHQUFHLEtBQUssR0FBRyxPQUFPLE1BQU07QUFDbEMsWUFBTSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEtBQUs7QUFDcEIsVUFBSSxLQUFLLENBQUMsTUFBTSxTQUFTLENBQUMsRUFBRyxPQUFNLEtBQUssQ0FBQztBQUFBLElBQzNDO0FBQ0EsUUFBSSxDQUFDLE1BQU0sUUFBUTtBQUNqQixVQUFJLHdCQUFPLGlEQUFjO0FBQ3pCO0FBQUEsSUFDRjtBQUNBLFVBQU0sUUFBUTtBQUFBLEVBQWdCLE1BQU0sSUFBSSxDQUFDLE1BQU0sT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQztBQUFBO0FBQ3ZFLFdBQU8saUJBQWlCLEtBQUs7QUFDN0IsUUFBSSx3QkFBTyxzQkFBTyxNQUFNLE1BQU0scUJBQU07QUFBQSxFQUN0QztBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImgiLCAia2V5IiwgIl9hIiwgImltcG9ydF9vYnNpZGlhbiJdCn0K
