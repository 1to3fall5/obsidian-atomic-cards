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
    case "columns":
    case "cols":
      opts.columns = Number(value) || 0;
      break;
    case "width":
      opts.width = Number(value) || 0;
      break;
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
    new import_obsidian3.Setting(containerEl).setName("\u9ED8\u8BA4\u5217\u6570").setDesc("1 = \u6BCF\u5F20\u5361\u7247\u5360\u4E00\u6574\u884C\uFF08\u9ED8\u8BA4\uFF09\uFF1B0 = \u81EA\u9002\u5E94\u7F51\u683C\uFF1B\u5176\u4ED6\u6570\u5B57 = \u56FA\u5B9A\u5217\u6570").addText(
      (t) => t.setValue(String(s.columns)).onChange(async (v) => {
        s.columns = Number(v) || 0;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u6700\u5C0F\u5361\u7247\u5BBD\u5EA6 (px)").setDesc("\u81EA\u9002\u5E94\u6A21\u5F0F\u4E0B\u6BCF\u5F20\u5361\u7247\u7684\u6700\u5C0F\u5BBD\u5EA6").addText(
      (t) => t.setValue(String(s.minCardWidth)).onChange(async (v) => {
        s.minCardWidth = Number(v) || 260;
        await this.plugin.saveSettings();
      })
    );
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
  columns: 1,
  layout: "wrap",
  nestedSize: "normal",
  minCardWidth: 240,
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
          columns: DEFAULT_SETTINGS.columns,
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q;
    const s = this.settings;
    const size = (_a = o.size) != null ? _a : nested ? s.nestedSize : "normal";
    const isSmall = size === "small";
    return {
      // 所有层级默认一张卡片占一整行；要横排网格就写 columns: 0 或具体列数
      columns: (_b = o.columns) != null ? _b : s.columns,
      width: o.width || (isSmall ? 150 : s.minCardWidth),
      height: (_c = o.height) != null ? _c : s.cardHeight,
      summary: (_d = o.summary) != null ? _d : isSmall ? 90 : s.summaryLength,
      expanded: (_e = o.expanded) != null ? _e : nested ? s.nestedExpanded : s.defaultExpanded,
      cover: (_f = o.cover) != null ? _f : s.showCover,
      meta: (_g = o.meta) != null ? _g : isSmall ? false : s.showMeta,
      tags: (_h = o.tags) != null ? _h : isSmall ? false : s.showTags,
      // 标题不再跳转，"打开"按钮成了唯一跳转入口，小卡片也默认给
      open: (_i = o.open) != null ? _i : isSmall ? true : s.showOpenButton,
      density: (_j = o.density) != null ? _j : isSmall ? "compact" : s.density,
      layout: (_k = o.layout) != null ? _k : s.layout,
      size,
      reverse: (_l = o.reverse) != null ? _l : false,
      from: (_m = o.from) != null ? _m : "",
      tag: (_n = o.tag) != null ? _n : "",
      title: (_o = o.title) != null ? _o : "",
      sort: (_p = o.sort) != null ? _p : "name",
      limit: (_q = o.limit) != null ? _q : 0
    };
  }
  renderCardsBlock(source, el, ctx) {
    const depth = getNest();
    const { options, entries } = parseCardsBlock(source);
    const opts = this.mergeOptions(options, depth > 0);
    const root = el.createDiv({ cls: "ac-root" });
    if (opts.title) root.createDiv({ cls: "ac-root__title", text: opts.title });
    const grid = root.createDiv({ cls: `ac-grid ac-grid--${opts.size}` });
    grid.style.gridTemplateColumns = opts.columns > 0 ? `repeat(${opts.columns}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(${opts.width}px, 1fr))`;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy9tYWluLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvY2FyZC50cyIsICIuLi8uLi8uLi8ucGx1Z2lucy9hdG9taWMtY2FyZHMvc3JjL21ldGFkYXRhLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvcGFyc2VyLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvc2V0dGluZ3MudHMiLCAiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy90eXBlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcclxuICBFZGl0b3IsXHJcbiAgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcclxuICBNYXJrZG93blJlbmRlckNoaWxkLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBOb3RpY2UsXHJcbiAgUGx1Z2luLFxyXG4gIFRGaWxlLFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyByZW5kZXJDYXJkLCBnZXROZXN0LCB3aXRoTmVzdCB9IGZyb20gXCIuL2NhcmRcIjtcclxuaW1wb3J0IHsgcmVhZE5vdGVNZXRhLCByZXNvbHZlRmlsZSB9IGZyb20gXCIuL21ldGFkYXRhXCI7XHJcbmltcG9ydCB7IHBhcnNlQ2FyZHNCbG9jayB9IGZyb20gXCIuL3BhcnNlclwiO1xyXG5pbXBvcnQgeyBBdG9taWNDYXJkc1NldHRpbmdUYWIgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xyXG5pbXBvcnQge1xyXG4gIEF0b21pY0NhcmRzU2V0dGluZ3MsXHJcbiAgQ2FyZEVudHJ5LFxyXG4gIENhcmRPcHRpb25zLFxyXG4gIERFRkFVTFRfU0VUVElOR1MsXHJcbiAgTWVyZ2VkT3B0aW9ucyxcclxuICBTRVRUSU5HU19WRVJTSU9OLFxyXG4gIFNpemUsXHJcbn0gZnJvbSBcIi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEF0b21pY0NhcmRzUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICBzZXR0aW5nczogQXRvbWljQ2FyZHNTZXR0aW5ncyA9IHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9O1xyXG5cclxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBBdG9taWNDYXJkc1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICBjb25zdCBoYW5kbGVyID0gKHNvdXJjZTogc3RyaW5nLCBlbDogSFRNTEVsZW1lbnQsIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCkgPT5cclxuICAgICAgdGhpcy5yZW5kZXJDYXJkc0Jsb2NrKHNvdXJjZSwgZWwsIGN0eCk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFwiY2FyZHNcIiwgaGFuZGxlcik7XHJcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXCJhdG9taWMtY2FyZHNcIiwgaGFuZGxlcik7XHJcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXCJhY1wiLCBoYW5kbGVyKTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyQ29tbWFuZHMoKTtcclxuICB9XHJcblxyXG4gIG9udW5sb2FkKCk6IHZvaWQge1xyXG4gICAgLyogQ29tcG9uZW50IFx1NzUxRlx1NTQ3RFx1NTQ2OFx1NjcxRlx1NzUzMSBjdHguYWRkQ2hpbGQgXHU2MjU4XHU3QkExICovXHJcbiAgfVxyXG5cclxuICBhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcclxuICAgIGlmIChzYXZlZCAmJiB0eXBlb2Ygc2F2ZWQgPT09IFwib2JqZWN0XCIpIHtcclxuICAgICAgLy8gXHU1RTAzXHU1QzQwXHU5RUQ4XHU4QkE0XHU1MDNDXHU1M0Q4XHU0RTg2XHVGRjBDXHU2NUU3XHU1QjU4XHU2ODYzXHU4OTgxXHU4RkMxXHU3OUZCXHVGRjBDXHU1NDI2XHU1MjE5XHU3NTI4XHU2MjM3XHU3QUVGXHU3NzBCXHU1MjMwXHU3Njg0XHU4RkQ4XHU2NjJGXHU2NUU3XHU1RTAzXHU1QzQwXHJcbiAgICAgIGlmIChzYXZlZC5zZXR0aW5nc1ZlcnNpb24gIT09IFNFVFRJTkdTX1ZFUlNJT04pIHtcclxuICAgICAgICBPYmplY3QuYXNzaWduKHNhdmVkLCB7XHJcbiAgICAgICAgICBjb2x1bW5zOiBERUZBVUxUX1NFVFRJTkdTLmNvbHVtbnMsXHJcbiAgICAgICAgICBsYXlvdXQ6IERFRkFVTFRfU0VUVElOR1MubGF5b3V0LFxyXG4gICAgICAgICAgbmVzdGVkU2l6ZTogREVGQVVMVF9TRVRUSU5HUy5uZXN0ZWRTaXplLFxyXG4gICAgICAgICAgZGVmYXVsdEV4cGFuZGVkOiBERUZBVUxUX1NFVFRJTkdTLmRlZmF1bHRFeHBhbmRlZCxcclxuICAgICAgICAgIG5lc3RlZEV4cGFuZGVkOiBERUZBVUxUX1NFVFRJTkdTLm5lc3RlZEV4cGFuZGVkLFxyXG4gICAgICAgICAgc2V0dGluZ3NWZXJzaW9uOiBTRVRUSU5HU19WRVJTSU9OLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEoc2F2ZWQpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9LCBzYXZlZCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnNldHRpbmdzID0geyAuLi5ERUZBVUxUX1NFVFRJTkdTIH07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gIH1cclxuXHJcbiAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgKiBcdTZFMzJcdTY3RDNcclxuICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbiAgcHJpdmF0ZSBtZXJnZU9wdGlvbnMobzogQ2FyZE9wdGlvbnMsIG5lc3RlZCA9IGZhbHNlKTogTWVyZ2VkT3B0aW9ucyB7XHJcbiAgICBjb25zdCBzID0gdGhpcy5zZXR0aW5ncztcclxuICAgIGNvbnN0IHNpemU6IFNpemUgPSBvLnNpemUgPz8gKG5lc3RlZCA/IHMubmVzdGVkU2l6ZSA6IFwibm9ybWFsXCIpO1xyXG4gICAgY29uc3QgaXNTbWFsbCA9IHNpemUgPT09IFwic21hbGxcIjtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIC8vIFx1NjI0MFx1NjcwOVx1NUM0Mlx1N0VBN1x1OUVEOFx1OEJBNFx1NEUwMFx1NUYyMFx1NTM2MVx1NzI0N1x1NTM2MFx1NEUwMFx1NjU3NFx1ODg0Q1x1RkYxQlx1ODk4MVx1NkEyQVx1NjM5Mlx1N0Y1MVx1NjgzQ1x1NUMzMVx1NTE5OSBjb2x1bW5zOiAwIFx1NjIxNlx1NTE3N1x1NEY1M1x1NTIxN1x1NjU3MFxyXG4gICAgICBjb2x1bW5zOiBvLmNvbHVtbnMgPz8gcy5jb2x1bW5zLFxyXG4gICAgICB3aWR0aDogby53aWR0aCB8fCAoaXNTbWFsbCA/IDE1MCA6IHMubWluQ2FyZFdpZHRoKSxcclxuICAgICAgaGVpZ2h0OiBvLmhlaWdodCA/PyBzLmNhcmRIZWlnaHQsXHJcbiAgICAgIHN1bW1hcnk6IG8uc3VtbWFyeSA/PyAoaXNTbWFsbCA/IDkwIDogcy5zdW1tYXJ5TGVuZ3RoKSxcclxuICAgICAgZXhwYW5kZWQ6IG8uZXhwYW5kZWQgPz8gKG5lc3RlZCA/IHMubmVzdGVkRXhwYW5kZWQgOiBzLmRlZmF1bHRFeHBhbmRlZCksXHJcbiAgICAgIGNvdmVyOiBvLmNvdmVyID8/IHMuc2hvd0NvdmVyLFxyXG4gICAgICBtZXRhOiBvLm1ldGEgPz8gKGlzU21hbGwgPyBmYWxzZSA6IHMuc2hvd01ldGEpLFxyXG4gICAgICB0YWdzOiBvLnRhZ3MgPz8gKGlzU21hbGwgPyBmYWxzZSA6IHMuc2hvd1RhZ3MpLFxyXG4gICAgICAvLyBcdTY4MDdcdTk4OThcdTRFMERcdTUxOERcdThERjNcdThGNkNcdUZGMENcIlx1NjI1M1x1NUYwMFwiXHU2MzA5XHU5NEFFXHU2MjEwXHU0RTg2XHU1NTJGXHU0RTAwXHU4REYzXHU4RjZDXHU1MTY1XHU1M0UzXHVGRjBDXHU1QzBGXHU1MzYxXHU3MjQ3XHU0RTVGXHU5RUQ4XHU4QkE0XHU3RUQ5XHJcbiAgICAgIG9wZW46IG8ub3BlbiA/PyAoaXNTbWFsbCA/IHRydWUgOiBzLnNob3dPcGVuQnV0dG9uKSxcclxuICAgICAgZGVuc2l0eTogby5kZW5zaXR5ID8/IChpc1NtYWxsID8gXCJjb21wYWN0XCIgOiBzLmRlbnNpdHkpLFxyXG4gICAgICBsYXlvdXQ6IG8ubGF5b3V0ID8/IHMubGF5b3V0LFxyXG4gICAgICBzaXplLFxyXG4gICAgICByZXZlcnNlOiBvLnJldmVyc2UgPz8gZmFsc2UsXHJcbiAgICAgIGZyb206IG8uZnJvbSA/PyBcIlwiLFxyXG4gICAgICB0YWc6IG8udGFnID8/IFwiXCIsXHJcbiAgICAgIHRpdGxlOiBvLnRpdGxlID8/IFwiXCIsXHJcbiAgICAgIHNvcnQ6IG8uc29ydCA/PyBcIm5hbWVcIixcclxuICAgICAgbGltaXQ6IG8ubGltaXQgPz8gMCxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlckNhcmRzQmxvY2soc291cmNlOiBzdHJpbmcsIGVsOiBIVE1MRWxlbWVudCwgY3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogdm9pZCB7XHJcbiAgICBjb25zdCBkZXB0aCA9IGdldE5lc3QoKTtcclxuICAgIGNvbnN0IHsgb3B0aW9ucywgZW50cmllcyB9ID0gcGFyc2VDYXJkc0Jsb2NrKHNvdXJjZSk7XHJcbiAgICAvLyBcdTVENENcdTU3MjhcdTUyMkJcdTc2ODRcdTUzNjFcdTcyNDdcdTkxQ0NcdTY1RjZcdUZGMDhkZXB0aCA+IDBcdUZGMDlcdTlFRDhcdThCQTRcdTUyMDdcdTYyMTBcdTc3RTVcdThCQzZcdTcwQjlcdTVDMEZcdTUzNjFcdTcyNDdcclxuICAgIGNvbnN0IG9wdHMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zLCBkZXB0aCA+IDApO1xyXG5cclxuICAgIGNvbnN0IHJvb3QgPSBlbC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtcm9vdFwiIH0pO1xyXG4gICAgaWYgKG9wdHMudGl0bGUpIHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcImFjLXJvb3RfX3RpdGxlXCIsIHRleHQ6IG9wdHMudGl0bGUgfSk7XHJcblxyXG4gICAgY29uc3QgZ3JpZCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBgYWMtZ3JpZCBhYy1ncmlkLS0ke29wdHMuc2l6ZX1gIH0pO1xyXG4gICAgZ3JpZC5zdHlsZS5ncmlkVGVtcGxhdGVDb2x1bW5zID1cclxuICAgICAgb3B0cy5jb2x1bW5zID4gMFxyXG4gICAgICAgID8gYHJlcGVhdCgke29wdHMuY29sdW1uc30sIG1pbm1heCgwLCAxZnIpKWBcclxuICAgICAgICA6IGByZXBlYXQoYXV0by1maWxsLCBtaW5tYXgoJHtvcHRzLndpZHRofXB4LCAxZnIpKWA7XHJcblxyXG4gICAgaWYgKGRlcHRoID49IHRoaXMuc2V0dGluZ3MubWF4TmVzdERlcHRoKSB7XHJcbiAgICAgIGdyaWQuY3JlYXRlRGl2KHtcclxuICAgICAgICBjbHM6IFwiYWMtd2FyblwiLFxyXG4gICAgICAgIHRleHQ6IGBcdTVERjJcdThGQkVcdTUyMzBcdTY3MDBcdTU5MjdcdTVENENcdTU5NTdcdTZERjFcdTVFQTZcdUZGMDgke3RoaXMuc2V0dGluZ3MubWF4TmVzdERlcHRofVx1RkYwOVx1RkYwQ1x1NTA1Q1x1NkI2Mlx1OTAxMlx1NUY1Mlx1NkUzMlx1NjdEM1x1NEVFNVx1OTA3Rlx1NTE0RFx1NUZBQVx1NzNBRlx1NUYxNVx1NzUyOFx1MzAwMmAsXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdm9pZCB0aGlzLmZpbGxHcmlkKGdyaWQsIGVudHJpZXMsIG9wdHMsIGN0eCwgZGVwdGgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBmaWxsR3JpZChcclxuICAgIGdyaWQ6IEhUTUxFbGVtZW50LFxyXG4gICAgZW50cmllczogQ2FyZEVudHJ5W10sXHJcbiAgICBvcHRzOiBNZXJnZWRPcHRpb25zLFxyXG4gICAgY3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxyXG4gICAgZGVwdGg6IG51bWJlclxyXG4gICk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IE1hcmtkb3duUmVuZGVyQ2hpbGQoZ3JpZCk7XHJcbiAgICBjb21wb25lbnQubG9hZCgpO1xyXG4gICAgY3R4LmFkZENoaWxkKGNvbXBvbmVudCk7XHJcblxyXG4gICAgY29uc3QgZW52ID0ge1xyXG4gICAgICBhcHA6IHRoaXMuYXBwLFxyXG4gICAgICBzZXR0aW5nczogdGhpcy5zZXR0aW5ncyxcclxuICAgICAgc291cmNlUGF0aDogY3R4LnNvdXJjZVBhdGgsXHJcbiAgICAgIGNvbXBvbmVudCxcclxuICAgICAgZGVwdGg6IGRlcHRoICsgMSxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgbGlzdCA9IHRoaXMucmVzb2x2ZUVudHJpZXMoZW50cmllcywgb3B0cywgY3R4LnNvdXJjZVBhdGgpO1xyXG4gICAgaWYgKCFsaXN0Lmxlbmd0aCkge1xyXG4gICAgICBncmlkLmNyZWF0ZURpdih7IGNsczogXCJhYy1lbXB0eVwiLCB0ZXh0OiBcIlx1NkNBMVx1NjcwOVx1NTMzOVx1OTE0RFx1NzY4NFx1NTM5Rlx1NUI1MFx1NjU4N1x1Njg2M1wiIH0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHU5ODdBXHU1RThGXHU2RTMyXHU2N0QzXHVGRjBDXHU0RkREXHU4QkMxXHU1MzYxXHU3MjQ3XHU5ODdBXHU1RThGXHU3QTMzXHU1QjlBXHJcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGxpc3QpIHtcclxuICAgICAgY29uc3QgbWV0YSA9IGF3YWl0IHJlYWROb3RlTWV0YSh0aGlzLmFwcCwgZW50cnkudGFyZ2V0LCBjdHguc291cmNlUGF0aCwgdGhpcy5zZXR0aW5ncywgZW50cnkuYWxpYXMpO1xyXG4gICAgICBpZiAoIWdyaWQuaXNDb25uZWN0ZWQpIHJldHVybjtcclxuICAgICAgY29uc3QgY2FyZCA9IHdpdGhOZXN0KGVudi5kZXB0aCwgKCkgPT4gcmVuZGVyQ2FyZChlbnYsIG1ldGEsIG9wdHMpKTtcclxuICAgICAgZ3JpZC5hcHBlbmRDaGlsZChjYXJkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICogXHU2NTcwXHU2MzZFXHU2NzY1XHU2RTkwXHJcbiAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG4gIHByaXZhdGUgaGFzVGFnKGZpbGU6IFRGaWxlLCB0YWc6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgYyA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xyXG4gICAgY29uc3QgZm91bmQ6IHN0cmluZ1tdID0gW107XHJcbiAgICBjb25zdCBwdXNoID0gKHY6IHVua25vd24pID0+IHtcclxuICAgICAgaWYgKHR5cGVvZiB2ID09PSBcInN0cmluZ1wiKSBmb3VuZC5wdXNoKHYucmVwbGFjZSgvXiMvLCBcIlwiKSk7XHJcbiAgICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodikpIHYuZm9yRWFjaChwdXNoKTtcclxuICAgIH07XHJcbiAgICBwdXNoKGM/LmZyb250bWF0dGVyPy50YWdzKTtcclxuICAgIHB1c2goYz8uZnJvbnRtYXR0ZXI/LnRhZyk7XHJcbiAgICAoYz8udGFncyA/PyBbXSkuZm9yRWFjaCgodCkgPT4gZm91bmQucHVzaCh0LnRhZy5yZXBsYWNlKC9eIy8sIFwiXCIpKSk7XHJcbiAgICByZXR1cm4gZm91bmQuc29tZSgodCkgPT4gdCA9PT0gdGFnIHx8IHQuc3RhcnRzV2l0aChgJHt0YWd9L2ApKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc29ydEVudHJpZXMoZW50cmllczogQ2FyZEVudHJ5W10sIG9wdHM6IE1lcmdlZE9wdGlvbnMsIHNvdXJjZVBhdGg6IHN0cmluZyk6IENhcmRFbnRyeVtdIHtcclxuICAgIGNvbnN0IG91dCA9IFsuLi5lbnRyaWVzXTtcclxuICAgIGlmIChvcHRzLnNvcnQgPT09IFwibmFtZVwiKSB7XHJcbiAgICAgIG91dC5zb3J0KChhLCBiKSA9PiBhLnRhcmdldC5sb2NhbGVDb21wYXJlKGIudGFyZ2V0LCBcInpoLUhhbnMtQ05cIikpO1xyXG4gICAgfSBlbHNlIGlmIChvcHRzLnNvcnQgPT09IFwidXBkYXRlZFwiIHx8IG9wdHMuc29ydCA9PT0gXCJjcmVhdGVkXCIpIHtcclxuICAgICAgY29uc3Qga2V5ID0gb3B0cy5zb3J0ID09PSBcInVwZGF0ZWRcIiA/IFwibXRpbWVcIiA6IFwiY3RpbWVcIjtcclxuICAgICAgY29uc3QgdGltZU9mID0gKHQ6IHN0cmluZykgPT4ge1xyXG4gICAgICAgIGNvbnN0IGYgPSByZXNvbHZlRmlsZSh0aGlzLmFwcCwgdCwgc291cmNlUGF0aCk7XHJcbiAgICAgICAgcmV0dXJuIGYgPyAoZi5zdGF0IGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgbnVtYmVyPilba2V5XSA/PyAwIDogMDtcclxuICAgICAgfTtcclxuICAgICAgb3V0LnNvcnQoKGEsIGIpID0+IHRpbWVPZihiLnRhcmdldCkgLSB0aW1lT2YoYS50YXJnZXQpKTtcclxuICAgIH1cclxuICAgIHJldHVybiBvcHRzLmxpbWl0ID4gMCA/IG91dC5zbGljZSgwLCBvcHRzLmxpbWl0KSA6IG91dDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVzb2x2ZUVudHJpZXMoZW50cmllczogQ2FyZEVudHJ5W10sIG9wdHM6IE1lcmdlZE9wdGlvbnMsIHNvdXJjZVBhdGg6IHN0cmluZyk6IENhcmRFbnRyeVtdIHtcclxuICAgIGlmIChlbnRyaWVzLmxlbmd0aCkgcmV0dXJuIGVudHJpZXM7XHJcblxyXG4gICAgLy8gXHU1M0NEXHU2N0U1XHVGRjFBXHU1MjE3XHU1MUZBXHU2MjQwXHU2NzA5XHU1RjE1XHU3NTI4XHU0RTg2XHU1RjUzXHU1MjREXHU2NTg3XHU2ODYzXHU3Njg0XHU3QjE0XHU4QkIwXHVGRjA4XHU0RTBBXHU1QzQyXHU3QUUwXHU4MjgyXHVGRjA5XHJcbiAgICBpZiAob3B0cy5yZXZlcnNlKSB7XHJcbiAgICAgIGNvbnN0IGxpbmtzID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5yZXNvbHZlZExpbmtzO1xyXG4gICAgICBjb25zdCBvdXQ6IENhcmRFbnRyeVtdID0gW107XHJcbiAgICAgIGZvciAoY29uc3Qgc3JjIG9mIE9iamVjdC5rZXlzKGxpbmtzKSkge1xyXG4gICAgICAgIGlmIChsaW5rc1tzcmNdPy5bc291cmNlUGF0aF0pIG91dC5wdXNoKHsgdGFyZ2V0OiBzcmMucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpIH0pO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0aGlzLnNvcnRFbnRyaWVzKG91dCwgb3B0cywgc291cmNlUGF0aCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG9wdHMuZnJvbSB8fCBvcHRzLnRhZykge1xyXG4gICAgICBsZXQgZmlsZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XHJcbiAgICAgIGlmIChzb3VyY2VQYXRoKSBmaWxlcyA9IGZpbGVzLmZpbHRlcigoZikgPT4gZi5wYXRoICE9PSBzb3VyY2VQYXRoKTtcclxuICAgICAgaWYgKG9wdHMuZnJvbSkge1xyXG4gICAgICAgIGNvbnN0IGZvbGRlciA9IG9wdHMuZnJvbS5yZXBsYWNlKC9eXFwvfFxcLyQvZywgXCJcIik7XHJcbiAgICAgICAgZmlsZXMgPSBmaWxlcy5maWx0ZXIoKGYpID0+IGYucGF0aCA9PT0gYCR7Zm9sZGVyfS5tZGAgfHwgZi5wYXRoLnN0YXJ0c1dpdGgoYCR7Zm9sZGVyfS9gKSk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKG9wdHMudGFnKSB7XHJcbiAgICAgICAgY29uc3Qgd2FudCA9IG9wdHMudGFnLnJlcGxhY2UoL14jLywgXCJcIik7XHJcbiAgICAgICAgZmlsZXMgPSBmaWxlcy5maWx0ZXIoKGYpID0+IHRoaXMuaGFzVGFnKGYsIHdhbnQpKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdGhpcy5zb3J0RW50cmllcyhcclxuICAgICAgICBmaWxlcy5tYXAoKGYpID0+ICh7IHRhcmdldDogZi5wYXRoLnJlcGxhY2UoL1xcLm1kJC9pLCBcIlwiKSB9KSksXHJcbiAgICAgICAgb3B0cyxcclxuICAgICAgICBzb3VyY2VQYXRoXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGVudHJpZXM7XHJcbiAgfVxyXG5cclxuICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAqIFx1NTQ3RFx1NEVFNFxyXG4gICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuICBwcml2YXRlIGFjdGl2ZUVkaXRvcigpOiBFZGl0b3IgfCBudWxsIHtcclxuICAgIGNvbnN0IHZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgcmV0dXJuIHZpZXc/LmVkaXRvciA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWdpc3RlckNvbW1hbmRzKCk6IHZvaWQge1xyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiaW5zZXJ0LWNhcmRzLWJsb2NrXCIsXHJcbiAgICAgIG5hbWU6IFwiXHU2M0QyXHU1MTY1XHU1MzYxXHU3MjQ3XHU1NzU3XHU2QTIxXHU2NzdGXCIsXHJcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHtcclxuICAgICAgICBjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XHJcbiAgICAgICAgY29uc3QgYmxvY2sgPSBcImBgYGNhcmRzXFxuXFxuLSBbW11dXFxuYGBgXFxuXCI7XHJcbiAgICAgICAgZWRpdG9yLnJlcGxhY2VSYW5nZShibG9jaywgY3Vyc29yKTtcclxuICAgICAgICBlZGl0b3Iuc2V0Q3Vyc29yKHsgbGluZTogY3Vyc29yLmxpbmUgKyAyLCBjaDogNiB9KTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImVtYmVkcy10by1jYXJkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NjI4QVx1NUQ0Q1x1NTE2NSAhW1suLi5dXSBcdThGNkNcdTYyMTBcdTUzNjFcdTcyNDdcdTU4OTlcIixcclxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4gdGhpcy5lbWJlZHNUb0NhcmRzKGVkaXRvciksXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJsaW5rcy10by1jYXJkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NjI4QVx1OTAwOVx1NTMzQVx1OTFDQ1x1NzY4NCBbW1x1OTRGRVx1NjNBNV1dIFx1OEY2Q1x1NjIxMFx1NTM2MVx1NzI0N1x1NTg5OVwiLFxyXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB0aGlzLmxpbmtzVG9DYXJkcyhlZGl0b3IpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiaW5zZXJ0LXJldmVyc2UtY2FyZHNcIixcclxuICAgICAgbmFtZTogXCJcdTYzRDJcdTUxNjVcdTUzQ0RcdTY3RTVcdTUzNjFcdTcyNDdcdTU3NTdcdUZGMDhcdTUyMTdcdTUxRkFcdTVGMTVcdTc1MjhcdTY3MkNcdTY1ODdcdTc2ODRcdTdBRTBcdTgyODJcdUZGMDlcIixcclxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4ge1xyXG4gICAgICAgIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcclxuICAgICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKFwiYGBgY2FyZHNcXG5yZXZlcnNlOiB0cnVlXFxudGl0bGU6IFx1ODhBQlx1NUYxNVx1NzUyOFx1NTcyOFxcbmBgYFxcblwiLCBjdXJzb3IpO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwidG9nZ2xlLWFsbC1jYXJkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NUM1NVx1NUYwMCAvIFx1NjUzNlx1OEQ3N1x1NjcyQ1x1OTg3NVx1NjI0MFx1NjcwOVx1NTM2MVx1NzI0N1wiLFxyXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGNhcmRzID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5hYy1jYXJkXCIpKTtcclxuICAgICAgICBpZiAoIWNhcmRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgbmV3IE5vdGljZShcIlx1NUY1M1x1NTI0RFx1ODlDNlx1NTZGRVx1OTFDQ1x1NkNBMVx1NjcwOVx1NTM2MVx1NzI0N1wiKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgY29sbGFwc2VkID0gY2FyZHMuZmlsdGVyKChjKSA9PiAhYy5jbGFzc0xpc3QuY29udGFpbnMoXCJpcy1leHBhbmRlZFwiKSk7XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0cyA9IGNvbGxhcHNlZC5sZW5ndGggPyBjb2xsYXBzZWQgOiBjYXJkcztcclxuICAgICAgICBmb3IgKGNvbnN0IGMgb2YgdGFyZ2V0cykgYy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcIi5hYy1idG4tLXRvZ2dsZVwiKT8uY2xpY2soKTtcclxuICAgICAgICBuZXcgTm90aWNlKGNvbGxhcHNlZC5sZW5ndGggPyBgXHU1REYyXHU1QzU1XHU1RjAwICR7dGFyZ2V0cy5sZW5ndGh9IFx1NUYyMFx1NTM2MVx1NzI0N2AgOiBgXHU1REYyXHU2NTM2XHU4RDc3ICR7dGFyZ2V0cy5sZW5ndGh9IFx1NUYyMFx1NTM2MVx1NzI0N2ApO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNlbGVjdGlvbkxpbmVSYW5nZShlZGl0b3I6IEVkaXRvcik6IFtudW1iZXIsIG51bWJlcl0ge1xyXG4gICAgaWYgKCFlZGl0b3Iuc29tZXRoaW5nU2VsZWN0ZWQoKSkgcmV0dXJuIFswLCBlZGl0b3IubGluZUNvdW50KCkgLSAxXTtcclxuICAgIGNvbnN0IGZyb20gPSBlZGl0b3IuZ2V0Q3Vyc29yKFwiZnJvbVwiKTtcclxuICAgIGNvbnN0IHRvID0gZWRpdG9yLmdldEN1cnNvcihcInRvXCIpO1xyXG4gICAgY29uc3QgZW5kTGluZSA9IHRvLmNoID09PSAwICYmIHRvLmxpbmUgPiBmcm9tLmxpbmUgPyB0by5saW5lIC0gMSA6IHRvLmxpbmU7XHJcbiAgICByZXR1cm4gW2Zyb20ubGluZSwgTWF0aC5tYXgoZW5kTGluZSwgZnJvbS5saW5lKV07XHJcbiAgfVxyXG5cclxuICAvKiogXHU2MjhBXHU2QjYzXHU2NTg3XHU5MUNDXHU4RkRFXHU3RUVEXHU3Njg0ICFbW1x1N0IxNFx1OEJCMF1dIFx1ODg0Q1x1NTQwOFx1NUU3Nlx1NjIxMFx1NEUwMFx1NEUyQSBjYXJkcyBcdTU3NTcgKi9cclxuICBwcml2YXRlIGVtYmVkc1RvQ2FyZHMoZWRpdG9yOiBFZGl0b3IpOiB2b2lkIHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBlZGl0b3IuZ2V0VmFsdWUoKTtcclxuICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcclxuICAgIGNvbnN0IFtmcm9tLCB0b10gPSB0aGlzLnNlbGVjdGlvbkxpbmVSYW5nZShlZGl0b3IpO1xyXG5cclxuICAgIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXTtcclxuICAgIGxldCBidWZmZXI6IHN0cmluZ1tdID0gW107XHJcbiAgICBsZXQgY29udmVydGVkID0gMDtcclxuICAgIGNvbnN0IGZsdXNoID0gKCkgPT4ge1xyXG4gICAgICBpZiAoIWJ1ZmZlci5sZW5ndGgpIHJldHVybjtcclxuICAgICAgb3V0LnB1c2goXCJgYGBjYXJkc1wiKTtcclxuICAgICAgZm9yIChjb25zdCB0IG9mIGJ1ZmZlcikgb3V0LnB1c2goYC0gW1ske3R9XV1gKTtcclxuICAgICAgb3V0LnB1c2goXCJgYGBcIik7XHJcbiAgICAgIGNvbnZlcnRlZCArPSBidWZmZXIubGVuZ3RoO1xyXG4gICAgICBidWZmZXIgPSBbXTtcclxuICAgIH07XHJcblxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZiAoaSA8IGZyb20gfHwgaSA+IHRvKSB7XHJcbiAgICAgICAgb3V0LnB1c2gobGluZXNbaV0pO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IG0gPSBsaW5lc1tpXS5tYXRjaCgvXihcXHMqKSg/OlstKitdXFxzKik/IVxcW1xcWyhbXlxcXV0rKVxcXVxcXVxccyokLyk7XHJcbiAgICAgIGlmIChtKSB7XHJcbiAgICAgICAgYnVmZmVyLnB1c2gobVsyXSk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgZmx1c2goKTtcclxuICAgICAgb3V0LnB1c2gobGluZXNbaV0pO1xyXG4gICAgfVxyXG4gICAgZmx1c2goKTtcclxuXHJcbiAgICBpZiAoIWNvbnZlcnRlZCkge1xyXG4gICAgICBuZXcgTm90aWNlKFwiXHU2Q0ExXHU2NzA5XHU2MjdFXHU1MjMwXHU3MkVDXHU1MzYwXHU0RTAwXHU4ODRDXHU3Njg0ICFbWy4uLl1dIFx1NUQ0Q1x1NTE2NVwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgZWRpdG9yLnNldFZhbHVlKG91dC5qb2luKFwiXFxuXCIpKTtcclxuICAgIG5ldyBOb3RpY2UoYFx1NURGMlx1NjI4QSAke2NvbnZlcnRlZH0gXHU1OTA0XHU1RDRDXHU1MTY1XHU1NDA4XHU1RTc2XHU0RTNBXHU1MzYxXHU3MjQ3XHU1ODk5YCk7XHJcbiAgfVxyXG5cclxuICAvKiogXHU5MDA5XHU1MzNBXHU5MUNDXHU3Njg0IFtbXHU5NEZFXHU2M0E1XV1cdUZGMDhcdTUyMTdcdTg4NjhcdTYyMTZcdTZCNjNcdTY1ODdcdUZGMDlcdTIxOTIgY2FyZHMgXHU1NzU3ICovXHJcbiAgcHJpdmF0ZSBsaW5rc1RvQ2FyZHMoZWRpdG9yOiBFZGl0b3IpOiB2b2lkIHtcclxuICAgIGNvbnN0IHNlbCA9IGVkaXRvci5nZXRTZWxlY3Rpb24oKTtcclxuICAgIGlmICghc2VsLnRyaW0oKSkge1xyXG4gICAgICBuZXcgTm90aWNlKFwiXHU4QkY3XHU1MTQ4XHU5MDA5XHU0RTJEXHU1MzA1XHU1NDJCIFtbXHU5NEZFXHU2M0E1XV0gXHU3Njg0XHU2NTg3XHU2NzJDXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCByZSA9IC9cXFtcXFsoW15cXF18I10rKSg/OiNbXlxcXXxdKik/KD86XFx8W15cXF1dKik/XFxdXFxdL2c7XHJcbiAgICBjb25zdCBmb3VuZDogc3RyaW5nW10gPSBbXTtcclxuICAgIGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xyXG4gICAgd2hpbGUgKChtID0gcmUuZXhlYyhzZWwpKSAhPT0gbnVsbCkge1xyXG4gICAgICBjb25zdCB0ID0gbVsxXS50cmltKCk7XHJcbiAgICAgIGlmICh0ICYmICFmb3VuZC5pbmNsdWRlcyh0KSkgZm91bmQucHVzaCh0KTtcclxuICAgIH1cclxuICAgIGlmICghZm91bmQubGVuZ3RoKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJcdTkwMDlcdTUzM0FcdTkxQ0NcdTZDQTFcdTY3MDkgW1tcdTk0RkVcdTYzQTVdXVwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgYmxvY2sgPSBgXFxgXFxgXFxgY2FyZHNcXG4ke2ZvdW5kLm1hcCgodCkgPT4gYC0gW1ske3R9XV1gKS5qb2luKFwiXFxuXCIpfVxcblxcYFxcYFxcYGA7XHJcbiAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbihibG9jayk7XHJcbiAgICBuZXcgTm90aWNlKGBcdTVERjJcdTc1MUZcdTYyMTAgJHtmb3VuZC5sZW5ndGh9IFx1NUYyMFx1NTM2MVx1NzI0N2ApO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgQXBwLCBDb21wb25lbnQsIE5vdGljZSwgc2V0SWNvbiB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBOb3RlTWV0YSwgcmVuZGVyTWFya2Rvd24gfSBmcm9tIFwiLi9tZXRhZGF0YVwiO1xyXG5pbXBvcnQgeyBBdG9taWNDYXJkc1NldHRpbmdzLCBNZXJnZWRPcHRpb25zIH0gZnJvbSBcIi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ2FyZEVudiB7XHJcbiAgYXBwOiBBcHA7XHJcbiAgc2V0dGluZ3M6IEF0b21pY0NhcmRzU2V0dGluZ3M7XHJcbiAgc291cmNlUGF0aDogc3RyaW5nO1xyXG4gIGNvbXBvbmVudDogQ29tcG9uZW50O1xyXG4gIC8qKiBcdTVGNTNcdTUyNERcdTVENENcdTU5NTdcdTVDNDJcdTdFQTdcdUZGMENcdTc1MjhcdTRFOEVcdTkwMTJcdTVGNTJcdTZFMzJcdTY3RDNcdTY1RjZcdTk2NTBcdTUyMzZcdTZERjFcdTVFQTYgKi9cclxuICBkZXB0aDogbnVtYmVyO1xyXG59XHJcblxyXG5sZXQgbmVzdE1hcmtlciA9IDA7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmVzdCgpOiBudW1iZXIge1xyXG4gIHJldHVybiBuZXN0TWFya2VyO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd2l0aE5lc3Q8VD4oZGVwdGg6IG51bWJlciwgZm46ICgpID0+IFQpOiBUIHtcclxuICBjb25zdCBwcmV2ID0gbmVzdE1hcmtlcjtcclxuICBuZXN0TWFya2VyID0gZGVwdGg7XHJcbiAgdHJ5IHtcclxuICAgIHJldHVybiBmbigpO1xyXG4gIH0gZmluYWxseSB7XHJcbiAgICBuZXN0TWFya2VyID0gcHJldjtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZtdENvdW50KG46IG51bWJlcik6IHN0cmluZyB7XHJcbiAgcmV0dXJuIG4gPj0gMTAwMCA/IGAkeyhuIC8gMTAwMCkudG9GaXhlZCgxKX1rIFx1NUI1N2AgOiBgJHtufSBcdTVCNTdgO1xyXG59XHJcblxyXG4vKiogXHU2Q0ExXHU2NzA5XHU1QzAxXHU5NzYyXHU2NUY2XHVGRjBDXHU3NTI4XHU3QzdCXHU1NzhCL1x1OERFRlx1NUY4NFx1NjNBOFx1NjVBRFx1NEUwMFx1NEUyQVx1NTZGRVx1NjgwNyAqL1xyXG5mdW5jdGlvbiBpY29uRm9yKG1ldGE6IE5vdGVNZXRhKTogc3RyaW5nIHtcclxuICAvLyBcdTZCQjVcdTg0M0QgLyBcdTc3RTVcdThCQzZcdTcwQjlcdTdFQTdcdTVGMTVcdTc1MjhcclxuICBpZiAobWV0YS5ibG9ja0NvbnRlbnQpIHJldHVybiBcInF1b3RlXCI7XHJcbiAgY29uc3QgdHlwZSA9IChtZXRhLmJhZGdlcy5maW5kKChiKSA9PiBiLmtleSA9PT0gXCJ0eXBlXCIpPy52YWx1ZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xyXG4gIGNvbnN0IGhheSA9IGAke3R5cGV9ICR7bWV0YS5maWxlPy5wYXRoID8/IG1ldGEudGFyZ2V0fWAudG9Mb3dlckNhc2UoKTtcclxuICBpZiAoL2NoYXB0ZXJ8XHU3QUUwXHU4MjgyfFx1N0VDNFx1NTQwOC8udGVzdChoYXkpKSByZXR1cm4gXCJsYXllcnNcIjtcclxuICBpZiAoL2NvbmNlcHR8XHU2OTgyXHU1RkY1Ly50ZXN0KGhheSkpIHJldHVybiBcImxpZ2h0YnVsYlwiO1xyXG4gIGlmICgvZW50aXR5fFx1NUI5RVx1NEY1My8udGVzdChoYXkpKSByZXR1cm4gXCJ1c2VyXCI7XHJcbiAgaWYgKC9yZXNvdXJjZXxcdThENDRcdTZFOTAvLnRlc3QoaGF5KSkgcmV0dXJuIFwicGFja2FnZVwiO1xyXG4gIGlmICgvZ29hbHxcdTc2RUVcdTY4MDcvLnRlc3QoaGF5KSkgcmV0dXJuIFwidGFyZ2V0XCI7XHJcbiAgaWYgKC9tZXRhfGRhc2hib2FyZHxpbmRleC8udGVzdChoYXkpKSByZXR1cm4gXCJsYXlvdXQtZ3JpZFwiO1xyXG4gIGlmICgvYXRvbXxcdTUzOUZcdTVCNTAvLnRlc3QoaGF5KSkgcmV0dXJuIFwiY2lyY2xlLWRvdFwiO1xyXG4gIHJldHVybiBcImZpbGUtdGV4dFwiO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBvcGVuTm90ZShlbnY6IENhcmRFbnYsIG1ldGE6IE5vdGVNZXRhLCBlOiBNb3VzZUV2ZW50KSB7XHJcbiAgaWYgKCFtZXRhLmZpbGUpIHtcclxuICAgIGNvbnN0IG5hbWUgPSBtZXRhLnRhcmdldC5zcGxpdChcIiNcIilbMF0ucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IGVudi5hcHAudmF1bHQuY3JlYXRlKFxyXG4gICAgICAgIGAke25hbWV9Lm1kYCxcclxuICAgICAgICBgLS0tXFxudHlwZTogYXRvbVxcbnRpdGxlOiBcIiR7bWV0YS50aXRsZX1cIlxcbmNyZWF0ZWQ6ICR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKX1cXG4tLS1cXG5cXG4jICR7bWV0YS50aXRsZX1cXG5cXG5gXHJcbiAgICAgICk7XHJcbiAgICAgIGF3YWl0IGVudi5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsIGVudi5zb3VyY2VQYXRoLCBmYWxzZSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgbmV3IE5vdGljZShgXHU1MjFCXHU1RUZBXHU1OTMxXHU4RDI1XHVGRjFBJHtTdHJpbmcoZXJyKX1gKTtcclxuICAgIH1cclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgY29uc3QgbmV3TGVhZiA9IGUuY3RybEtleSB8fCBlLm1ldGFLZXkgfHwgZS5idXR0b24gPT09IDE7XHJcbiAgLy8gdGFyZ2V0IFx1NTNFRlx1ODBGRFx1NUUyNiAjXHU2ODA3XHU5ODk4IC8gI15cdTU3NTdpZFx1RkYwQ1x1NEVBNFx1N0VEOSBPYnNpZGlhbiBcdTVCOUFcdTRGNERcdTUyMzBcdTZCQjVcdTg0M0RcclxuICBhd2FpdCBlbnYuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQobWV0YS50YXJnZXQgfHwgbWV0YS5maWxlLnBhdGgsIGVudi5zb3VyY2VQYXRoLCBuZXdMZWFmKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaHJlZk9mKG1ldGE6IE5vdGVNZXRhKTogc3RyaW5nIHtcclxuICBpZiAoIW1ldGEuZmlsZSkgcmV0dXJuIFwiI1wiO1xyXG4gIHJldHVybiBtZXRhLnJlZiA/IGAke21ldGEuZmlsZS5wYXRofSMke21ldGEucmVmfWAgOiBtZXRhLmZpbGUucGF0aDtcclxufVxyXG5cclxuZnVuY3Rpb24gYnVpbGRNZXRhUm93KG1ldGE6IE5vdGVNZXRhKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcclxuICBpZiAoIW1ldGEuYmFkZ2VzLmxlbmd0aCAmJiAhbWV0YS51cGRhdGVkICYmICFtZXRhLndvcmRDb3VudCkgcmV0dXJuIG51bGw7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICByb3cuY2xhc3NOYW1lID0gXCJhYy1jYXJkX19tZXRhXCI7XHJcbiAgZm9yIChjb25zdCBiIG9mIG1ldGEuYmFkZ2VzLnNsaWNlKDAsIDIpKSB7XHJcbiAgICByb3cuY3JlYXRlU3Bhbih7IGNsczogYGFjLWJhZGdlIGFjLWJhZGdlLS0ke2Iua2V5fWAsIHRleHQ6IGIudmFsdWUgfSk7XHJcbiAgfVxyXG4gIGlmIChtZXRhLnVwZGF0ZWQpIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLW1ldGFfX2RhdGVcIiwgdGV4dDogbWV0YS51cGRhdGVkIH0pO1xyXG4gIGlmIChtZXRhLndvcmRDb3VudCkgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtbWV0YV9fd29yZHNcIiwgdGV4dDogZm10Q291bnQobWV0YS53b3JkQ291bnQpIH0pO1xyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJ1aWxkVGFnUm93KG1ldGE6IE5vdGVNZXRhLCBsaW1pdDogbnVtYmVyKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcclxuICBpZiAoIW1ldGEudGFncy5sZW5ndGgpIHJldHVybiBudWxsO1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgcm93LmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fdGFnc1wiO1xyXG4gIGZvciAoY29uc3QgdCBvZiBtZXRhLnRhZ3Muc2xpY2UoMCwgbGltaXQpKSByb3cuY3JlYXRlU3Bhbih7IGNsczogXCJhYy10YWdcIiwgdGV4dDogYCMke3R9YCB9KTtcclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ2FyZChlbnY6IENhcmRFbnYsIG1ldGE6IE5vdGVNZXRhLCBvcHRzOiBNZXJnZWRPcHRpb25zKTogSFRNTEVsZW1lbnQge1xyXG4gIGNvbnN0IGlzV3JhcCA9IG9wdHMubGF5b3V0ICE9PSBcImNhcmRcIjtcclxuICBjb25zdCBpc1NtYWxsID0gb3B0cy5zaXplID09PSBcInNtYWxsXCI7XHJcblxyXG4gIGNvbnN0IGNhcmQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIGNhcmQuY2xhc3NOYW1lID0gYGFjLWNhcmQgYWMtJHtvcHRzLmRlbnNpdHl9IGFjLXNpemUtJHtvcHRzLnNpemV9IGFjLSR7XHJcbiAgICBpc1dyYXAgPyBcIndyYXBcIiA6IFwiY2FyZHN0eWxlXCJcclxuICB9YDtcclxuICBjYXJkLmRhdGFzZXQucGF0aCA9IG1ldGEuZmlsZT8ucGF0aCA/PyBtZXRhLnRhcmdldDtcclxuICBpZiAoIW1ldGEuZmlsZSkgY2FyZC5jbGFzc0xpc3QuYWRkKFwiaXMtbWlzc2luZ1wiKTtcclxuICBpZiAobWV0YS5ibG9ja0NvbnRlbnQpIGNhcmQuY2xhc3NMaXN0LmFkZChcImlzLWJsb2NrXCIpO1xyXG4gIGlmIChvcHRzLmhlaWdodCA+IDApIGNhcmQuc3R5bGUuc2V0UHJvcGVydHkoXCItLWFjLWNhcmQtaFwiLCBgJHtvcHRzLmhlaWdodH1weGApO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NkI2M1x1NjU4N1x1NUJCOVx1NTY2OFx1RkYwOFx1NTE0OFx1NUVGQVx1RkYwQ1x1NjcwMFx1NTQwRSBhcHBlbmRcdUZGMDkgLS0tLS0tLS0tLSAqL1xyXG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIGJvZHkuY2xhc3NOYW1lID0gXCJhYy1jYXJkX19ib2R5XCI7XHJcbiAgYm9keS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgbGV0IGJvZHlMb2FkZWQgPSBmYWxzZTtcclxuXHJcbiAgY29uc3QgbG9hZEJvZHkgPSAoKSA9PiB7XHJcbiAgICBpZiAoYm9keUxvYWRlZCB8fCAhbWV0YS5maWxlKSByZXR1cm47XHJcbiAgICBib2R5TG9hZGVkID0gdHJ1ZTtcclxuICAgIGNvbnN0IGZpbGUgPSBtZXRhLmZpbGU7XHJcbiAgICB2b2lkIGVudi5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKS50aGVuKChyYXcpID0+IHtcclxuICAgICAgY29uc3QgZnVsbCA9IHJhdy5yZXBsYWNlKC9eLS0tXFxyP1xcbltcXHNcXFNdKj9cXHI/XFxuLS0tXFxyP1xcbj8vLCBcIlwiKTtcclxuICAgICAgY29uc3QgbWQgPSBtZXRhLmJsb2NrQ29udGVudCA/PyBmdWxsO1xyXG4gICAgICBib2R5LmVtcHR5KCk7XHJcbiAgICAgIHdpdGhOZXN0KGVudi5kZXB0aCwgKCkgPT4ge1xyXG4gICAgICAgIHJlbmRlck1hcmtkb3duKGVudi5hcHAsIG1kLCBib2R5LCBmaWxlLnBhdGgsIGVudi5jb21wb25lbnQpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDXHVGRjFBXHU5ODc2XHU5MEU4XHU1QzAxXHU5NzYyIC0tLS0tLS0tLS0gKi9cclxuICBpZiAoIWlzV3JhcCAmJiBvcHRzLmNvdmVyICYmIG1ldGEuY292ZXIpIHtcclxuICAgIGNvbnN0IGNvdmVyID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9fY292ZXJcIiB9KTtcclxuICAgIGNvbnN0IGltZyA9IGNvdmVyLmNyZWF0ZUVsKFwiaW1nXCIsIHtcclxuICAgICAgYXR0cjogeyBzcmM6IG1ldGEuY292ZXIsIGFsdDogbWV0YS50aXRsZSwgbG9hZGluZzogXCJsYXp5XCIsIGRyYWdnYWJsZTogXCJmYWxzZVwiIH0sXHJcbiAgICB9KTtcclxuICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4gY292ZXIucmVtb3ZlKCkpO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTU5MzRcdTkwRThcdUZGMUFcdTU2RkVcdTY4MDcgKyBcdTY4MDdcdTk4OTggKyBcdTY4MDdcdTdCN0UgKyBcdTVGQkRcdTdBRTAgKyBcdTY0Q0RcdTRGNUNcdUZGMENcdTUxNjhcdTU3MjhcdTRFMDBcdTg4NEMgLS0tLS0tLS0tLSAqL1xyXG4gIGNvbnN0IGhlYWQgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJhYy1jYXJkX19oZWFkXCIgfSk7XHJcblxyXG4gIGlmIChpc1dyYXApIHtcclxuICAgIGNvbnN0IHRodW1iID0gaGVhZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9fdGh1bWJcIiB9KTtcclxuICAgIGlmIChvcHRzLmNvdmVyICYmIG1ldGEuY292ZXIpIHtcclxuICAgICAgY29uc3QgaW1nID0gdGh1bWIuY3JlYXRlRWwoXCJpbWdcIiwge1xyXG4gICAgICAgIGF0dHI6IHsgc3JjOiBtZXRhLmNvdmVyLCBhbHQ6IG1ldGEudGl0bGUsIGxvYWRpbmc6IFwibGF6eVwiLCBkcmFnZ2FibGU6IFwiZmFsc2VcIiB9LFxyXG4gICAgICB9KTtcclxuICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCAoKSA9PiB7XHJcbiAgICAgICAgdGh1bWIuZW1wdHkoKTtcclxuICAgICAgICBzZXRJY29uKHRodW1iLCBpY29uRm9yKG1ldGEpKTtcclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzZXRJY29uKHRodW1iLCBpY29uRm9yKG1ldGEpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNvbnN0IHRpdGxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcclxuICB0aXRsZUVsLmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fdGl0bGVcIjtcclxuICB0aXRsZUVsLnNldEF0dHIoXCJocmVmXCIsIGhyZWZPZihtZXRhKSk7XHJcbiAgdGl0bGVFbC50ZXh0Q29udGVudCA9IG1ldGEudGl0bGU7XHJcbiAgdGl0bGVFbC50aXRsZSA9IG1ldGEuZmlsZVxyXG4gICAgPyBgJHtocmVmT2YobWV0YSl9XHVGRjA4XHU3MEI5XHU1MUZCXHU1QzU1XHU1RjAwL1x1NjUzNlx1OEQ3N1x1RkYwQ0N0cmwrXHU3MEI5XHU1MUZCXHU4REYzXHU1MjMwXHU1MzlGXHU2NTg3XHVGRjA5YFxyXG4gICAgOiBgXHU2NUIwXHU1RUZBXHVGRjFBJHttZXRhLnRhcmdldH1gO1xyXG4gIGhlYWQuYXBwZW5kQ2hpbGQodGl0bGVFbCk7XHJcblxyXG4gIGlmICghbWV0YS5maWxlKSBoZWFkLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtY2FyZF9fbWlzc2luZ1wiLCB0ZXh0OiBcIlx1NjcyQVx1NTIxQlx1NUVGQVwiIH0pO1xyXG5cclxuICBpZiAob3B0cy50YWdzKSB7XHJcbiAgICBjb25zdCB0YWdSb3cgPSBidWlsZFRhZ1JvdyhtZXRhLCBpc1NtYWxsID8gMiA6IDMpO1xyXG4gICAgaWYgKHRhZ1JvdykgaGVhZC5hcHBlbmRDaGlsZCh0YWdSb3cpO1xyXG4gIH1cclxuXHJcbiAgaWYgKG9wdHMubWV0YSkge1xyXG4gICAgY29uc3QgbWV0YVJvdyA9IGJ1aWxkTWV0YVJvdyhtZXRhKTtcclxuICAgIGlmIChtZXRhUm93KSBoZWFkLmFwcGVuZENoaWxkKG1ldGFSb3cpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgYWN0aW9ucyA9IGhlYWQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWNhcmRfX2FjdGlvbnNcIiB9KTtcclxuXHJcbiAgY29uc3QgdG9nZ2xlQnRuID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJhYy1idG4gYWMtYnRuLS10b2dnbGVcIiB9KTtcclxuICBjb25zdCB0b2dnbGVJY29uID0gdG9nZ2xlQnRuLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtYnRuX19pY29uXCIgfSk7XHJcbiAgY29uc3QgdG9nZ2xlVGV4dCA9IHRvZ2dsZUJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9fdGV4dFwiLCB0ZXh0OiBcIlx1NUM1NVx1NUYwMFwiIH0pO1xyXG4gIHNldEljb24odG9nZ2xlSWNvbiwgXCJjaGV2cm9uLWRvd25cIik7XHJcblxyXG4gIGlmIChvcHRzLm9wZW4pIHtcclxuICAgIGNvbnN0IG9wZW5CdG4gPSBhY3Rpb25zLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImFjLWJ0biBhYy1idG4tLW9wZW5cIiB9KTtcclxuICAgIGNvbnN0IG9wZW5JY29uID0gb3BlbkJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9faWNvblwiIH0pO1xyXG4gICAgb3BlbkJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9fdGV4dFwiLCB0ZXh0OiBcIlx1NjI1M1x1NUYwMFwiIH0pO1xyXG4gICAgc2V0SWNvbihvcGVuSWNvbiwgXCJhcnJvdy11cC1yaWdodFwiKTtcclxuICAgIG9wZW5CdG4udGl0bGUgPSBtZXRhLmZpbGUgPyBcIlx1NTcyOFx1NTM5Rlx1NTlDQlx1NjU4N1x1Njg2M1x1NEUyRFx1NjI1M1x1NUYwMFwiIDogXCJcdTUyMUJcdTVFRkFcdThGRDlcdTdCQzdcdTY1ODdcdTY4NjNcIjtcclxuICAgIG9wZW5CdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB2b2lkIG9wZW5Ob3RlKGVudiwgbWV0YSwgZSkpO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTY0NThcdTg5ODFcdUZGMDhcdTRFMkRcdUZGMDkgLS0tLS0tLS0tLSAqL1xyXG4gIGNhcmQuY3JlYXRlRGl2KHtcclxuICAgIGNsczogXCJhYy1jYXJkX19zdW1tYXJ5XCIsXHJcbiAgICB0ZXh0OiBtZXRhLnN1bW1hcnkgfHwgKG1ldGEuZmlsZSA/IFwiXHVGRjA4XHU2NjgyXHU2NUUwXHU2NDU4XHU4OTgxXHVGRjA5XCIgOiBcIlx1NzBCOVx1NTFGQlx1NjgwN1x1OTg5OFx1NTIxQlx1NUVGQVx1OEZEOVx1N0JDN1x1NTM5Rlx1NUI1MFx1NjU4N1x1Njg2M1wiKSxcclxuICB9KTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTZCNjNcdTY1ODdcdUZGMDhcdTZERjFcdUZGMDkgLS0tLS0tLS0tLSAqL1xyXG4gIGNhcmQuYXBwZW5kQ2hpbGQoYm9keSk7XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU1QzU1XHU1RjAwIC8gXHU2NTM2XHU4RDc3IC0tLS0tLS0tLS0gKi9cclxuICBsZXQgZXhwYW5kZWQgPSBmYWxzZTtcclxuICBjb25zdCBzZXRFeHBhbmRlZCA9IChuZXh0OiBib29sZWFuKSA9PiB7XHJcbiAgICBleHBhbmRlZCA9IG5leHQ7XHJcbiAgICBjYXJkLmNsYXNzTGlzdC50b2dnbGUoXCJpcy1leHBhbmRlZFwiLCBleHBhbmRlZCk7XHJcbiAgICB0b2dnbGVUZXh0LnRleHRDb250ZW50ID0gZXhwYW5kZWQgPyBcIlx1NjUzNlx1OEQ3N1wiIDogXCJcdTVDNTVcdTVGMDBcIjtcclxuICAgIHNldEljb24odG9nZ2xlSWNvbiwgZXhwYW5kZWQgPyBcImNoZXZyb24tdXBcIiA6IFwiY2hldnJvbi1kb3duXCIpO1xyXG4gICAgYm9keS5zdHlsZS5kaXNwbGF5ID0gZXhwYW5kZWQgPyBcIlwiIDogXCJub25lXCI7XHJcbiAgICBpZiAoZXhwYW5kZWQpIGxvYWRCb2R5KCk7XHJcbiAgfTtcclxuXHJcbiAgdG9nZ2xlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBzZXRFeHBhbmRlZCghZXhwYW5kZWQpKTtcclxuXHJcbiAgLy8gXHU3MEI5XHU2ODA3XHU5ODk4XHU2NjJGXHU2Mjk4XHU1M0UwXHU1RjAwXHU1MTczXHVGRjFCXHU2MzA5XHU0RjRGIEN0cmwvQ21kIFx1NjI0RFx1OERGM1x1NTIzMFx1NTM5Rlx1NjU4N1xyXG4gIHRpdGxlRWwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSB8fCBlLmJ1dHRvbiA9PT0gMSkge1xyXG4gICAgICB2b2lkIG9wZW5Ob3RlKGVudiwgbWV0YSwgZSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHNldEV4cGFuZGVkKCFleHBhbmRlZCk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIFx1NTkzNFx1OTBFOFx1N0E3QVx1NzY3RFx1NTkwNFx1NEU1Rlx1NTNFRlx1NEVFNVx1NjI5OFx1NTNFMFx1RkYwOFx1NjMwOVx1OTRBRVx1NTQ4Q1x1OTRGRVx1NjNBNVx1ODFFQVx1NURGMVx1NTkwNFx1NzQwNlx1RkYwQ1x1NEUwRFx1OTFDRFx1NTkwRFx1ODlFNlx1NTNEMVx1RkYwOVxyXG4gIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XHJcbiAgICBjb25zdCBlbCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGlmIChlbD8uY2xvc2VzdChcImJ1dHRvbiwgYVwiKSkgcmV0dXJuO1xyXG4gICAgc2V0RXhwYW5kZWQoIWV4cGFuZGVkKTtcclxuICB9KTtcclxuXHJcbiAgaWYgKG9wdHMuZXhwYW5kZWQpIHNldEV4cGFuZGVkKHRydWUpO1xyXG5cclxuICByZXR1cm4gY2FyZDtcclxufVxyXG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgQ29tcG9uZW50LCBGcm9udE1hdHRlckNhY2hlLCBNYXJrZG93blJlbmRlcmVyLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBOb3RlQmFkZ2Uge1xyXG4gIGtleTogc3RyaW5nO1xyXG4gIHZhbHVlOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTm90ZU1ldGEge1xyXG4gIGZpbGU6IFRGaWxlIHwgbnVsbDtcclxuICAvKiogXHU1MzlGXHU1OUNCXHU1RjE1XHU3NTI4XHVGRjA4XHU1M0VGXHU1NDJCICNcdTY4MDdcdTk4OTggXHU2MjE2ICNeXHU1NzU3aWRcdUZGMDkgKi9cclxuICB0YXJnZXQ6IHN0cmluZztcclxuICAvKiogIyBcdTRFNEJcdTU0MEVcdTc2ODRcdTkwRThcdTUyMDZcdUZGMENcdTZDQTFcdTY3MDlcdTUyMTlcdTRFM0FcdTdBN0EgKi9cclxuICByZWY6IHN0cmluZztcclxuICB0aXRsZTogc3RyaW5nO1xyXG4gIHN1bW1hcnk6IHN0cmluZztcclxuICBjb3Zlcjogc3RyaW5nIHwgbnVsbDtcclxuICB0YWdzOiBzdHJpbmdbXTtcclxuICBiYWRnZXM6IE5vdGVCYWRnZVtdO1xyXG4gIHVwZGF0ZWQ6IHN0cmluZztcclxuICB3b3JkQ291bnQ6IG51bWJlcjtcclxuICAvKiogXHU2QkI1XHU4NDNEXHU3RUE3XHU1RjE1XHU3NTI4XHVGRjA4W1tcdTk4NzUjXHU2ODA3XHU5ODk4XV0gLyBbW1x1OTg3NSNeXHU1NzU3XV1cdUZGMDlcdTY1RjZcdUZGMENcdThCRTVcdTZCQjVcdTg0M0RcdTc2ODRcdTZCNjNcdTY1ODcgKi9cclxuICBibG9ja0NvbnRlbnQ/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmNvbnN0IGNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIE5vdGVNZXRhPigpO1xyXG5cclxuZnVuY3Rpb24gc3RyaXBGcm9udG1hdHRlcihyYXc6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgbSA9IHJhdy5tYXRjaCgvXi0tLVxccj9cXG5bXFxzXFxTXSo/XFxyP1xcbi0tLVxccj9cXG4/Lyk7XHJcbiAgcmV0dXJuIG0gPyByYXcuc2xpY2UobVswXS5sZW5ndGgpIDogcmF3O1xyXG59XHJcblxyXG4vKiogXHU2MjhBIG1hcmtkb3duIFx1NkI2M1x1NjU4N1x1NTM4Qlx1NjIxMFx1NEUwMFx1NkJCNVx1N0VBRlx1NjU4N1x1NjcyQ1x1NjQ1OFx1ODk4MSAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdG9QbGFpblRleHQoYm9keTogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gc3RyaXBGcm9udG1hdHRlcihib2R5KVxyXG4gICAgLnJlcGxhY2UoL2BgYFtcXHNcXFNdKj9gYGAvZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzKj5cXHMqXFxbIVxcdytbXlxcXV0qXFxdLiokL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoLyFcXFtcXFtbXlxcXV0qXFxdXFxdL2csIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvIVxcW1teXFxdXSpcXF1cXChbXildKlxcKS9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL1xcW1xcWyhbXlxcXXxdKylcXHw/KFteXFxdXSopXFxdXFxdL2csIChfbSwgYTogc3RyaW5nLCBiOiBzdHJpbmcpID0+IGIgfHwgYSlcclxuICAgIC5yZXBsYWNlKC9cXFsoW15cXF1dKilcXF1cXChbXildKlxcKS9nLCBcIiQxXCIpXHJcbiAgICAucmVwbGFjZSgvXlxcc3swLDN9I3sxLDZ9XFxzKy4qJC9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzezAsM30+XFxzPy9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzKlstKitdXFxzKy9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzKlxcZCtcXC5cXHMrL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL1sqX2B+PV0vZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKVxyXG4gICAgLnRyaW0oKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmlyc3RUZXh0KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgdGV4dCA9IHRvUGxhaW5UZXh0KGNvbnRlbnQpO1xyXG4gIHJldHVybiB0ZXh0Lmxlbmd0aCA+IDI0ID8gYCR7dGV4dC5zbGljZSgwLCAyNCl9XHUyMDI2YCA6IHRleHQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBcdTRFQ0VcdTY1ODdcdTY4NjNcdTkxQ0NcdTYyMkFcdTUzRDZcdTRFMDBcdTRFMkFcdTZCQjVcdTg0M0RcdUZGMDhcdTc3RTVcdThCQzZcdTcwQjlcdUZGMDlcdTMwMDJcclxuICogXHU2NTJGXHU2MzAxIGBbW1x1OTg3NSNcdTY4MDdcdTk4OThdXWAgXHU0RTBFIGBbW1x1OTg3NSNeXHU1NzU3aWRdXWAgXHU0RTI0XHU3OUNEXHU1RjE1XHU3NTI4XHUzMDAyXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEJsb2NrKFxyXG4gIHJhdzogc3RyaW5nLFxyXG4gIGZpbGVDYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsLFxyXG4gIHJlZjogc3RyaW5nXHJcbik6IHsgdGl0bGU6IHN0cmluZzsgY29udGVudDogc3RyaW5nIH0gfCBudWxsIHtcclxuICBjb25zdCBsaW5lcyA9IHJhdy5zcGxpdCgvXFxyP1xcbi8pO1xyXG4gIGNvbnN0IHdhbnRlZCA9IGRlY29kZVVSSUNvbXBvbmVudChyZWYpO1xyXG5cclxuICAvLyBcdTU3NTdcdTVGMTVcdTc1MjggXmJsb2NraWRcclxuICBpZiAod2FudGVkLnN0YXJ0c1dpdGgoXCJeXCIpKSB7XHJcbiAgICBjb25zdCBibG9jayA9IGZpbGVDYWNoZT8uYmxvY2tzPy5bd2FudGVkLnNsaWNlKDEpXTtcclxuICAgIGlmICghYmxvY2spIHJldHVybiBudWxsO1xyXG4gICAgY29uc3QgY29udGVudCA9IGxpbmVzXHJcbiAgICAgIC5zbGljZShibG9jay5wb3NpdGlvbi5zdGFydC5saW5lLCBibG9jay5wb3NpdGlvbi5lbmQubGluZSArIDEpXHJcbiAgICAgIC5qb2luKFwiXFxuXCIpO1xyXG4gICAgcmV0dXJuIHsgdGl0bGU6IGZpcnN0VGV4dChjb250ZW50KSB8fCB3YW50ZWQsIGNvbnRlbnQgfTtcclxuICB9XHJcblxyXG4gIC8vIFx1NjgwN1x1OTg5OFx1NUYxNVx1NzUyOCAjaGVhZGluZ1xyXG4gIGNvbnN0IGhlYWRpbmdzID0gZmlsZUNhY2hlPy5oZWFkaW5ncyA/PyBbXTtcclxuICBjb25zdCBpZHggPSBoZWFkaW5ncy5maW5kSW5kZXgoKGgpID0+IGguaGVhZGluZyA9PT0gd2FudGVkKTtcclxuICBpZiAoaWR4IDwgMCkgcmV0dXJuIG51bGw7XHJcblxyXG4gIGNvbnN0IGggPSBoZWFkaW5nc1tpZHhdO1xyXG4gIGNvbnN0IHN0YXJ0ID0gaC5wb3NpdGlvbi5zdGFydC5saW5lO1xyXG4gIGxldCBlbmQgPSBsaW5lcy5sZW5ndGggLSAxO1xyXG4gIGZvciAobGV0IGkgPSBpZHggKyAxOyBpIDwgaGVhZGluZ3MubGVuZ3RoOyBpKyspIHtcclxuICAgIGlmIChoZWFkaW5nc1tpXS5sZXZlbCA8PSBoLmxldmVsKSB7XHJcbiAgICAgIGVuZCA9IGhlYWRpbmdzW2ldLnBvc2l0aW9uLnN0YXJ0LmxpbmUgLSAxO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHsgdGl0bGU6IGguaGVhZGluZywgY29udGVudDogbGluZXMuc2xpY2Uoc3RhcnQsIE1hdGgubWF4KGVuZCwgc3RhcnQpICsgMSkuam9pbihcIlxcblwiKSB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBwaWNrRmllbGQoZm06IEZyb250TWF0dGVyQ2FjaGUgfCB1bmRlZmluZWQsIGZpZWxkczogc3RyaW5nW10pOiBzdHJpbmcge1xyXG4gIGlmICghZm0pIHJldHVybiBcIlwiO1xyXG4gIGZvciAoY29uc3QgZiBvZiBmaWVsZHMpIHtcclxuICAgIGNvbnN0IHYgPSBmbVtmXTtcclxuICAgIGlmICh0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiAmJiB2LnRyaW0oKSkgcmV0dXJuIHYudHJpbSgpO1xyXG4gICAgaWYgKHR5cGVvZiB2ID09PSBcIm51bWJlclwiKSByZXR1cm4gU3RyaW5nKHYpO1xyXG4gIH1cclxuICByZXR1cm4gXCJcIjtcclxufVxyXG5cclxuZnVuY3Rpb24gY29sbGVjdFRhZ3MoYXBwOiBBcHAsIGZpbGU6IFRGaWxlKTogc3RyaW5nW10ge1xyXG4gIGNvbnN0IGZtID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcjtcclxuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XHJcbiAgY29uc3QgcHVzaCA9ICh2OiB1bmtub3duKSA9PiB7XHJcbiAgICBpZiAodHlwZW9mIHYgPT09IFwic3RyaW5nXCIpIG91dC5wdXNoKHYucmVwbGFjZSgvXiMvLCBcIlwiKSk7XHJcbiAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KHYpKSB2LmZvckVhY2gocHVzaCk7XHJcbiAgfTtcclxuICBwdXNoKGZtPy50YWdzKTtcclxuICBwdXNoKGZtPy50YWcpO1xyXG4gIGlmICghb3V0Lmxlbmd0aCkge1xyXG4gICAgY29uc3QgY2FjaGVUYWdzID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy50YWdzID8/IFtdO1xyXG4gICAgZm9yIChjb25zdCB0IG9mIGNhY2hlVGFncykgb3V0LnB1c2godC50YWcucmVwbGFjZSgvXiMvLCBcIlwiKSk7XHJcbiAgfVxyXG4gIHJldHVybiBBcnJheS5mcm9tKG5ldyBTZXQob3V0KSkuc2xpY2UoMCwgNik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGV4dHJhY3RDb3ZlcihhcHA6IEFwcCwgZmlsZTogVEZpbGUsIGJvZHk6IHN0cmluZywgZmllbGRzOiBzdHJpbmdbXSk6IHN0cmluZyB8IG51bGwge1xyXG4gIGNvbnN0IGZtID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcjtcclxuICBjb25zdCBkZWNsYXJlZCA9IHBpY2tGaWVsZChmbSwgZmllbGRzKTtcclxuICBjb25zdCBjYW5kaWRhdGVzID0gW2RlY2xhcmVkXTtcclxuXHJcbiAgaWYgKCFkZWNsYXJlZCkge1xyXG4gICAgY29uc3Qgd2lraUltZyA9IGJvZHkubWF0Y2goLyFcXFtcXFsoW15cXF18XSspLyk7XHJcbiAgICBpZiAod2lraUltZykgY2FuZGlkYXRlcy5wdXNoKHdpa2lJbWdbMV0pO1xyXG4gICAgY29uc3QgbWRJbWcgPSBib2R5Lm1hdGNoKC8hXFxbW15cXF1dKlxcXVxcKChbXildKylcXCkvKTtcclxuICAgIGlmIChtZEltZykgY2FuZGlkYXRlcy5wdXNoKG1kSW1nWzFdKTtcclxuICB9XHJcblxyXG4gIGZvciAoY29uc3QgYyBvZiBjYW5kaWRhdGVzKSB7XHJcbiAgICBpZiAoIWMpIGNvbnRpbnVlO1xyXG4gICAgaWYgKC9eaHR0cHM/OlxcL1xcLy9pLnRlc3QoYykpIHJldHVybiBjO1xyXG4gICAgY29uc3QgZiA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGMuc3BsaXQoXCJ8XCIpWzBdLnRyaW0oKSwgZmlsZS5wYXRoKTtcclxuICAgIGlmIChmKSByZXR1cm4gYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmKTtcclxuICB9XHJcbiAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlRmlsZShhcHA6IEFwcCwgdGFyZ2V0OiBzdHJpbmcsIHNvdXJjZVBhdGg6IHN0cmluZyk6IFRGaWxlIHwgbnVsbCB7XHJcbiAgY29uc3QgY2xlYW4gPSB0YXJnZXQuc3BsaXQoXCIjXCIpWzBdLnNwbGl0KFwifFwiKVswXS50cmltKCk7XHJcbiAgaWYgKCFjbGVhbikgcmV0dXJuIG51bGw7XHJcbiAgcmV0dXJuIGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGNsZWFuLCBzb3VyY2VQYXRoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZm9ybWF0RGF0ZSh2OiB1bmtub3duKTogc3RyaW5nIHtcclxuICBpZiAoIXYpIHJldHVybiBcIlwiO1xyXG4gIGlmICh0eXBlb2YgdiAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIFwiXCI7XHJcbiAgcmV0dXJuIHYubGVuZ3RoID4gMTAgPyB2LnNsaWNlKDAsIDEwKSA6IHY7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkTm90ZU1ldGEoXHJcbiAgYXBwOiBBcHAsXHJcbiAgdGFyZ2V0OiBzdHJpbmcsXHJcbiAgc291cmNlUGF0aDogc3RyaW5nLFxyXG4gIHNldHRpbmdzOiB7XHJcbiAgICBzdW1tYXJ5RmllbGRzOiBzdHJpbmdbXTtcclxuICAgIGNvdmVyRmllbGRzOiBzdHJpbmdbXTtcclxuICAgIG1ldGFGaWVsZHM6IHN0cmluZ1tdO1xyXG4gICAgc3VtbWFyeUxlbmd0aDogbnVtYmVyO1xyXG4gIH0sXHJcbiAgYWxpYXM/OiBzdHJpbmdcclxuKTogUHJvbWlzZTxOb3RlTWV0YT4ge1xyXG4gIGNvbnN0IGhhc2hJZHggPSB0YXJnZXQuaW5kZXhPZihcIiNcIik7XHJcbiAgY29uc3QgcGF0aFBhcnQgPSAoaGFzaElkeCA+PSAwID8gdGFyZ2V0LnNsaWNlKDAsIGhhc2hJZHgpIDogdGFyZ2V0KS5zcGxpdChcInxcIilbMF0udHJpbSgpO1xyXG4gIGNvbnN0IHJlZiA9IGhhc2hJZHggPj0gMCA/IHRhcmdldC5zbGljZShoYXNoSWR4ICsgMSkudHJpbSgpIDogXCJcIjtcclxuICBjb25zdCBmaWxlID0gcmVzb2x2ZUZpbGUoYXBwLCBwYXRoUGFydCwgc291cmNlUGF0aCk7XHJcbiAgY29uc3QgZmFsbGJhY2tUaXRsZSA9IGFsaWFzIHx8IHJlZiB8fCBwYXRoUGFydC5zcGxpdChcIi9cIikucG9wKCkgfHwgdGFyZ2V0O1xyXG5cclxuICBpZiAoIWZpbGUpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGZpbGU6IG51bGwsXHJcbiAgICAgIHRhcmdldCxcclxuICAgICAgcmVmLFxyXG4gICAgICB0aXRsZTogZmFsbGJhY2tUaXRsZSxcclxuICAgICAgc3VtbWFyeTogXCJcIixcclxuICAgICAgY292ZXI6IG51bGwsXHJcbiAgICAgIHRhZ3M6IFtdLFxyXG4gICAgICBiYWRnZXM6IFtdLFxyXG4gICAgICB1cGRhdGVkOiBcIlwiLFxyXG4gICAgICB3b3JkQ291bnQ6IDAsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgY29uc3Qga2V5ID0gYCR7ZmlsZS5wYXRofSMke3JlZn06JHtmaWxlLnN0YXQubXRpbWV9OiR7c2V0dGluZ3Muc3VtbWFyeUxlbmd0aH1gO1xyXG4gIGNvbnN0IGhpdCA9IGNhY2hlLmdldChrZXkpO1xyXG4gIGlmIChoaXQpIHJldHVybiBhbGlhcyA/IHsgLi4uaGl0LCB0aXRsZTogYWxpYXMgfSA6IGhpdDtcclxuXHJcbiAgY29uc3QgcmF3ID0gYXdhaXQgYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XHJcbiAgY29uc3QgZmlsZUNhY2hlID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpID8/IG51bGw7XHJcbiAgY29uc3QgZm0gPSBmaWxlQ2FjaGU/LmZyb250bWF0dGVyO1xyXG5cclxuICAvLyBcdTZCQjVcdTg0M0RcdTdFQTdcdTVGMTVcdTc1MjhcdUZGMUFcdTUzRUFcdTUzRDZcdThCRTVcdTZCQjVcdTg0M0RcdUZGMENcdTgwMENcdTRFMERcdTY2MkZcdTY1NzRcdTdCQzdcclxuICBjb25zdCBibG9jayA9IHJlZiA/IGV4dHJhY3RCbG9jayhyYXcsIGZpbGVDYWNoZSwgcmVmKSA6IG51bGw7XHJcbiAgY29uc3QgY29udGVudEJvZHkgPSBibG9jaz8uY29udGVudCA/PyBzdHJpcEZyb250bWF0dGVyKHJhdyk7XHJcblxyXG4gIGNvbnN0IG1hbnVhbCA9IGJsb2NrID8gXCJcIiA6IHBpY2tGaWVsZChmbSwgc2V0dGluZ3Muc3VtbWFyeUZpZWxkcyk7XHJcbiAgY29uc3QgcGxhaW4gPSB0b1BsYWluVGV4dChjb250ZW50Qm9keSk7XHJcbiAgY29uc3Qgc3VtbWFyeSA9XHJcbiAgICBtYW51YWwgfHxcclxuICAgIHBsYWluLnNsaWNlKDAsIHNldHRpbmdzLnN1bW1hcnlMZW5ndGgpICsgKHBsYWluLmxlbmd0aCA+IHNldHRpbmdzLnN1bW1hcnlMZW5ndGggPyBcIlx1MjAyNlwiIDogXCJcIik7XHJcblxyXG4gIGNvbnN0IGJhZGdlczogTm90ZUJhZGdlW10gPSBbXTtcclxuICBpZiAoIWJsb2NrKSB7XHJcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBzZXR0aW5ncy5tZXRhRmllbGRzKSB7XHJcbiAgICAgIGNvbnN0IHYgPSBmbT8uW2tleV07XHJcbiAgICAgIGlmICh2ID09PSB1bmRlZmluZWQgfHwgdiA9PT0gbnVsbCkgY29udGludWU7XHJcbiAgICAgIGNvbnN0IHRleHQgPSBBcnJheS5pc0FycmF5KHYpID8gdi5qb2luKFwiL1wiKSA6IFN0cmluZyh2KTtcclxuICAgICAgaWYgKHRleHQudHJpbSgpKSBiYWRnZXMucHVzaCh7IGtleSwgdmFsdWU6IHRleHQudHJpbSgpIH0pO1xyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBcdTZCQjVcdTg0M0RcdTUzNjFcdTcyNDdcdTUzRUFcdTY4MDdcdTY3NjVcdTZFOTBcdTY1ODdcdTY4NjNcdTdDN0JcdTU3OEJcdUZGMENcdTkwN0ZcdTUxNERcdTU0OENcdTY1NzRcdTdCQzdcdTZERjdcdTZEQzZcclxuICAgIGNvbnN0IHQgPSBmbT8udHlwZTtcclxuICAgIGlmICh0eXBlb2YgdCA9PT0gXCJzdHJpbmdcIiAmJiB0LnRyaW0oKSkgYmFkZ2VzLnB1c2goeyBrZXk6IFwidHlwZVwiLCB2YWx1ZTogdC50cmltKCkgfSk7XHJcbiAgfVxyXG5cclxuICBjb25zdCB0aXRsZSA9XHJcbiAgICBhbGlhcyB8fCAoYmxvY2sgPyBibG9jay50aXRsZSA6IFwiXCIpIHx8IFN0cmluZyhmbT8udGl0bGUgfHwgZmlsZS5iYXNlbmFtZSk7XHJcblxyXG4gIGNvbnN0IG1ldGE6IE5vdGVNZXRhID0ge1xyXG4gICAgZmlsZSxcclxuICAgIHRhcmdldCxcclxuICAgIHJlZixcclxuICAgIHRpdGxlLFxyXG4gICAgc3VtbWFyeSxcclxuICAgIGNvdmVyOiBleHRyYWN0Q292ZXIoYXBwLCBmaWxlLCBjb250ZW50Qm9keSwgc2V0dGluZ3MuY292ZXJGaWVsZHMpLFxyXG4gICAgdGFnczogYmxvY2sgPyBbXSA6IGNvbGxlY3RUYWdzKGFwcCwgZmlsZSksXHJcbiAgICBiYWRnZXMsXHJcbiAgICB1cGRhdGVkOiBibG9jayA/IFwiXCIgOiBmb3JtYXREYXRlKGZtPy51cGRhdGVkKSB8fCBmb3JtYXREYXRlKGZtPy5tb2RpZmllZCkgfHwgZm9ybWF0RGF0ZShmbT8uY3JlYXRlZCksXHJcbiAgICB3b3JkQ291bnQ6IHBsYWluLmxlbmd0aCxcclxuICAgIGJsb2NrQ29udGVudDogYmxvY2s/LmNvbnRlbnQsXHJcbiAgfTtcclxuXHJcbiAgY2FjaGUuc2V0KGtleSwgbWV0YSk7XHJcbiAgaWYgKGNhY2hlLnNpemUgPiA1MDApIGNhY2hlLmNsZWFyKCk7XHJcbiAgcmV0dXJuIG1ldGE7XHJcbn1cclxuXHJcbi8qKiBcdTUxN0NcdTVCQjlcdTY1QjBcdTY1RTdcdTcyNDhcdTY3MkMgT2JzaWRpYW4gXHU3Njg0IG1hcmtkb3duIFx1NkUzMlx1NjdEM1x1NTE2NVx1NTNFMyAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyTWFya2Rvd24oXHJcbiAgYXBwOiBBcHAsXHJcbiAgbWFya2Rvd246IHN0cmluZyxcclxuICBlbDogSFRNTEVsZW1lbnQsXHJcbiAgc291cmNlUGF0aDogc3RyaW5nLFxyXG4gIGNvbXBvbmVudDogQ29tcG9uZW50XHJcbik6IHZvaWQge1xyXG4gIGNvbnN0IG1kID0gTWFya2Rvd25SZW5kZXJlciBhcyB1bmtub3duIGFzIHtcclxuICAgIHJlbmRlcj86IChhOiBBcHAsIG06IHN0cmluZywgZTogSFRNTEVsZW1lbnQsIHA6IHN0cmluZywgYzogQ29tcG9uZW50KSA9PiB2b2lkO1xyXG4gICAgcmVuZGVyTWFya2Rvd24/OiAobTogc3RyaW5nLCBlOiBIVE1MRWxlbWVudCwgcDogc3RyaW5nLCBjOiBDb21wb25lbnQpID0+IHZvaWQ7XHJcbiAgfTtcclxuICBpZiAodHlwZW9mIG1kLnJlbmRlck1hcmtkb3duID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgIG1kLnJlbmRlck1hcmtkb3duKG1hcmtkb3duLCBlbCwgc291cmNlUGF0aCwgY29tcG9uZW50KTtcclxuICB9IGVsc2UgaWYgKHR5cGVvZiBtZC5yZW5kZXIgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgbWQucmVuZGVyKGFwcCwgbWFya2Rvd24sIGVsLCBzb3VyY2VQYXRoLCBjb21wb25lbnQpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBlbC5zZXRUZXh0KG1hcmtkb3duKTtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCB7IENhcmRFbnRyeSwgQ2FyZE9wdGlvbnMsIENhcmRzUXVlcnksIFNvcnRLZXkgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgU09SVF9LRVlTOiBTb3J0S2V5W10gPSBbXCJuYW1lXCIsIFwidXBkYXRlZFwiLCBcImNyZWF0ZWRcIiwgXCJub25lXCJdO1xyXG5cclxuZnVuY3Rpb24gYXBwbHlPcHRpb24ob3B0czogQ2FyZE9wdGlvbnMsIHJhd0tleTogc3RyaW5nLCByYXdWYWx1ZTogc3RyaW5nKSB7XHJcbiAgY29uc3Qga2V5ID0gcmF3S2V5LnRvTG93ZXJDYXNlKCk7XHJcbiAgY29uc3QgdmFsdWUgPSByYXdWYWx1ZS50cmltKCkucmVwbGFjZSgvXltcIiddfFtcIiddJC9nLCBcIlwiKTtcclxuXHJcbiAgc3dpdGNoIChrZXkpIHtcclxuICAgIGNhc2UgXCJjb2x1bW5zXCI6XHJcbiAgICBjYXNlIFwiY29sc1wiOlxyXG4gICAgICBvcHRzLmNvbHVtbnMgPSBOdW1iZXIodmFsdWUpIHx8IDA7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcIndpZHRoXCI6XHJcbiAgICAgIG9wdHMud2lkdGggPSBOdW1iZXIodmFsdWUpIHx8IDA7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImhlaWdodFwiOlxyXG4gICAgICBvcHRzLmhlaWdodCA9IE51bWJlcih2YWx1ZSkgfHwgMDtcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwic3VtbWFyeVwiOlxyXG4gICAgICBvcHRzLnN1bW1hcnkgPSBOdW1iZXIodmFsdWUpIHx8IDA7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImV4cGFuZGVkXCI6XHJcbiAgICBjYXNlIFwiZXhwYW5kXCI6XHJcbiAgICAgIG9wdHMuZXhwYW5kZWQgPSAvXih0cnVlfHllc3wxfG9uKSQvaS50ZXN0KHZhbHVlKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiY292ZXJcIjpcclxuICAgICAgb3B0cy5jb3ZlciA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJtZXRhXCI6XHJcbiAgICAgIG9wdHMubWV0YSA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJ0YWdzXCI6XHJcbiAgICAgIG9wdHMudGFncyA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJvcGVuXCI6XHJcbiAgICAgIG9wdHMub3BlbiA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJyZXZlcnNlXCI6XHJcbiAgICBjYXNlIFwiYmFja2xpbmtzXCI6XHJcbiAgICAgIG9wdHMucmV2ZXJzZSA9IC9eKHRydWV8eWVzfDF8b24pJC9pLnRlc3QodmFsdWUpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJkZW5zaXR5XCI6XHJcbiAgICAgIG9wdHMuZGVuc2l0eSA9IHZhbHVlID09PSBcImNvbXBhY3RcIiA/IFwiY29tcGFjdFwiIDogXCJjb21mb3J0YWJsZVwiO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJsYXlvdXRcIjpcclxuICAgIGNhc2UgXCJzdHlsZVwiOlxyXG4gICAgICBvcHRzLmxheW91dCA9IHZhbHVlID09PSBcImNhcmRcIiA/IFwiY2FyZFwiIDogXCJ3cmFwXCI7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcInNpemVcIjpcclxuICAgICAgb3B0cy5zaXplID0gdmFsdWUgPT09IFwic21hbGxcIiA/IFwic21hbGxcIiA6IFwibm9ybWFsXCI7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImZyb21cIjpcclxuICAgIGNhc2UgXCJmb2xkZXJcIjpcclxuICAgICAgb3B0cy5mcm9tID0gdmFsdWU7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcInRhZ1wiOlxyXG4gICAgICBvcHRzLnRhZyA9IHZhbHVlLnJlcGxhY2UoL14jLywgXCJcIik7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcInNvcnRcIjpcclxuICAgICAgb3B0cy5zb3J0ID0gKFNPUlRfS0VZUy5pbmNsdWRlcyh2YWx1ZSBhcyBTb3J0S2V5KSA/IHZhbHVlIDogXCJuYW1lXCIpIGFzIFNvcnRLZXk7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImxpbWl0XCI6XHJcbiAgICAgIG9wdHMubGltaXQgPSBOdW1iZXIodmFsdWUpIHx8IDA7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcInRpdGxlXCI6XHJcbiAgICAgIG9wdHMudGl0bGUgPSB2YWx1ZTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICBicmVhaztcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlRW50cnkobGluZTogc3RyaW5nKTogQ2FyZEVudHJ5IHwgbnVsbCB7XHJcbiAgbGV0IHRleHQgPSBsaW5lLnJlcGxhY2UoL15bLSorXVxccysvLCBcIlwiKS50cmltKCk7XHJcbiAgaWYgKCF0ZXh0KSByZXR1cm4gbnVsbDtcclxuICAvLyBcdTVCQjlcdTVGQ0QgIVtbLi4uXV0gXHU0RTBFIFtbLi4uXV0gXHU0RTI0XHU3OUNEXHU1MTk5XHU2Q0Q1XHJcbiAgdGV4dCA9IHRleHQucmVwbGFjZSgvXiFcXHMqLywgXCJcIik7XHJcblxyXG4gIGNvbnN0IHdpa2kgPSB0ZXh0Lm1hdGNoKC9eXFxbXFxbKFteXFxdXSspXFxdXFxdXFxzKiguKikkLyk7XHJcbiAgaWYgKHdpa2kpIHtcclxuICAgIGNvbnN0IFt0YXJnZXQsIGlubGluZUFsaWFzXSA9IHdpa2lbMV0uc3BsaXQoXCJ8XCIpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdGFyZ2V0OiB0YXJnZXQudHJpbSgpLFxyXG4gICAgICBhbGlhczogKGlubGluZUFsaWFzIHx8IFwiXCIpLnRyaW0oKSB8fCAod2lraVsyXSB8fCBcIlwiKS50cmltKCkgfHwgdW5kZWZpbmVkLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8vIFx1N0VBRlx1NjU4N1x1NjcyQyAvIFx1OERFRlx1NUY4NFxyXG4gIGlmICgvXls+I2BdLy50ZXN0KHRleHQpKSByZXR1cm4gbnVsbDtcclxuICBjb25zdCBiYXJlID0gdGV4dC5yZXBsYWNlKC9cXFtcXFt8XFxdXFxdL2csIFwiXCIpLnRyaW0oKTtcclxuICByZXR1cm4gYmFyZSA/IHsgdGFyZ2V0OiBiYXJlIH0gOiBudWxsO1xyXG59XHJcblxyXG4vKipcclxuICogXHU4OUUzXHU2NzkwIGNhcmRzIFx1NEVFM1x1NzgwMVx1NTc1N1x1NTE4NVx1NUJCOVx1MzAwMlxyXG4gKiBcdTY1MkZcdTYzMDFcdTVGNjJcdTU5ODJcdUZGMUFcclxuICogICBjb2x1bW5zOiAzXHJcbiAqICAgLS0tXHJcbiAqICAgLSBbW1x1N0IxNFx1OEJCMEFdXVxyXG4gKiAgIC0gW1tcdTdCMTRcdThCQjBCfFx1ODFFQVx1NUI5QVx1NEU0OVx1NjgwN1x1OTg5OF1dXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDYXJkc0Jsb2NrKHNvdXJjZTogc3RyaW5nKTogQ2FyZHNRdWVyeSB7XHJcbiAgY29uc3Qgb3B0aW9uczogQ2FyZE9wdGlvbnMgPSB7fTtcclxuICBjb25zdCBlbnRyaWVzOiBDYXJkRW50cnlbXSA9IFtdO1xyXG5cclxuICBmb3IgKGNvbnN0IHJhd0xpbmUgb2Ygc291cmNlLnNwbGl0KC9cXHI/XFxuLykpIHtcclxuICAgIGNvbnN0IGxpbmUgPSByYXdMaW5lLnRyaW0oKTtcclxuICAgIGlmICghbGluZSB8fCBsaW5lID09PSBcIi0tLVwiIHx8IGxpbmUgPT09IFwiKioqXCIpIGNvbnRpbnVlO1xyXG5cclxuICAgIC8vIFx1OTAwOVx1OTg3OVx1ODg0Q1x1RkYxQWtleTogdmFsdWVcdUZGMDhcdTRFMERcdTY2MkZcdTUyMTdcdTg4NjhcdTk4NzlcdTMwMDFcdTRFMERcdTY2MkYgd2lraWxpbmtcdUZGMDlcclxuICAgIGNvbnN0IG9wdE1hdGNoID0gbGluZS5tYXRjaCgvXihbYS16QS1aXVthLXpBLVowLTlfLV0qKVxccyo6XFxzKiguKikkLyk7XHJcbiAgICBpZiAob3B0TWF0Y2ggJiYgIWxpbmUuc3RhcnRzV2l0aChcIi0gW1tcIikgJiYgIWxpbmUuc3RhcnRzV2l0aChcIiFbW1wiKSkge1xyXG4gICAgICBhcHBseU9wdGlvbihvcHRpb25zLCBvcHRNYXRjaFsxXSwgb3B0TWF0Y2hbMl0pO1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBlbnRyeSA9IHBhcnNlRW50cnkobGluZSk7XHJcbiAgICBpZiAoZW50cnkpIGVudHJpZXMucHVzaChlbnRyeSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4geyBvcHRpb25zLCBlbnRyaWVzIH07XHJcbn1cclxuIiwgImltcG9ydCBBdG9taWNDYXJkc1BsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcbmltcG9ydCB7IExheW91dCwgU2l6ZSB9IGZyb20gXCIuL3R5cGVzXCI7XHJcbmltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEF0b21pY0NhcmRzU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogQXRvbWljQ2FyZHNQbHVnaW4pIHtcclxuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICB9XHJcblxyXG4gIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG4gICAgY29uc3QgcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzO1xyXG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1NUUwM1x1NUM0MFwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU5RUQ4XHU4QkE0XHU1MjE3XHU2NTcwXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiMSA9IFx1NkJDRlx1NUYyMFx1NTM2MVx1NzI0N1x1NTM2MFx1NEUwMFx1NjU3NFx1ODg0Q1x1RkYwOFx1OUVEOFx1OEJBNFx1RkYwOVx1RkYxQjAgPSBcdTgxRUFcdTkwMDJcdTVFOTRcdTdGNTFcdTY4M0NcdUZGMUJcdTUxNzZcdTRFRDZcdTY1NzBcdTVCNTcgPSBcdTU2RkFcdTVCOUFcdTUyMTdcdTY1NzBcIilcclxuICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShTdHJpbmcocy5jb2x1bW5zKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMuY29sdW1ucyA9IE51bWJlcih2KSB8fCAwO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTY3MDBcdTVDMEZcdTUzNjFcdTcyNDdcdTVCQkRcdTVFQTYgKHB4KVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1ODFFQVx1OTAwMlx1NUU5NFx1NkEyMVx1NUYwRlx1NEUwQlx1NkJDRlx1NUYyMFx1NTM2MVx1NzI0N1x1NzY4NFx1NjcwMFx1NUMwRlx1NUJCRFx1NUVBNlwiKVxyXG4gICAgICAuYWRkVGV4dCgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKFN0cmluZyhzLm1pbkNhcmRXaWR0aCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLm1pbkNhcmRXaWR0aCA9IE51bWJlcih2KSB8fCAyNjA7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NTM2MVx1NzI0N1x1NjcwMFx1NTkyN1x1OUFEOFx1NUVBNiAocHgpXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiMCA9IFx1NEUwRFx1OTY1MFx1NTIzNlx1RkYxQlx1OEQ4NVx1OEZDN1x1NTQwRVx1NTM2MVx1NzI0N1x1NTE4NVx1OTBFOFx1NkVEQVx1NTJBOFwiKVxyXG4gICAgICAuYWRkVGV4dCgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKFN0cmluZyhzLmNhcmRIZWlnaHQpKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgcy5jYXJkSGVpZ2h0ID0gTnVtYmVyKHYpIHx8IDA7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NTM2MVx1NzI0N1x1NUUwM1x1NUM0MFwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1NTMwNVx1ODhGOVx1NTM2MVx1NzI0NyA9IFx1NkEyQVx1NTQxMVx1NjI0MVx1NUU3M1x1NzY4NFx1NUJCOVx1NTY2OFx1RkYxQlx1N0FENlx1NzI0OFx1NTM2MVx1NzI0QyA9IFx1NEYyMFx1N0VERlx1NTM2MVx1NzI0N1x1NTg5OVx1RkYwOFx1OTg3Nlx1OTBFOFx1NTkyN1x1NUMwMVx1OTc2Mlx1RkYwOVwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGQpID0+XHJcbiAgICAgICAgZFxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIndyYXBcIiwgXCJcdTUzMDVcdTg4RjlcdTUzNjFcdTcyNDdcdUZGMDhcdTZBMkFcdTU0MTFcdUZGMDlcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJjYXJkXCIsIFwiXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDXHVGRjA4XHU5ODc2XHU5MEU4XHU1QzAxXHU5NzYyXHVGRjA5XCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUocy5sYXlvdXQpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgICAgcy5sYXlvdXQgPSB2IGFzIExheW91dDtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NUQ0Q1x1NTk1N1x1NTM2MVx1NzI0N1x1NzY4NFx1NUMzQVx1NUJGOFwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1NTM2MVx1NzI0N1x1OTFDQ1x1NTE4RFx1NTk1N1x1NzY4NFx1NTM2MVx1NzI0N1x1NTg5OVx1OUVEOFx1OEJBNFx1NzUyOFx1NEVDMFx1NEU0OFx1NUMzQVx1NUJGOFx1RkYxQlx1NTc1N1x1NTE4NVx1NTE5OSBzaXplOiBcdTUzRUZcdTUzNTVcdTcyRUNcdTg5ODZcdTc2RDZcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkKSA9PlxyXG4gICAgICAgIGRcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJzbWFsbFwiLCBcIlx1NzdFNVx1OEJDNlx1NzBCOVx1NUMwRlx1NTM2MVx1NzI0N1x1RkYwOFx1NEUwMFx1ODg0Q1x1NTkxQVx1NEUyQVx1RkYwOVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIm5vcm1hbFwiLCBcIlx1NUUzOFx1ODlDNFx1NTM2MVx1NzI0N1wiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHMubmVzdGVkU2l6ZSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICBzLm5lc3RlZFNpemUgPSB2IGFzIFNpemU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTVCQzZcdTVFQTZcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkKSA9PlxyXG4gICAgICAgIGRcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJjb21mb3J0YWJsZVwiLCBcIlx1NUJCRFx1Njc3RVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImNvbXBhY3RcIiwgXCJcdTdEMjdcdTUxRDFcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZShzLmRlbnNpdHkpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgICAgcy5kZW5zaXR5ID0gdiBhcyBcImNvbXBhY3RcIiB8IFwiY29tZm9ydGFibGVcIjtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiXHU1MzYxXHU3MjQ3XHU1MTg1XHU1QkI5XCIpLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTY0NThcdTg5ODFcdTk1N0ZcdTVFQTZcIilcclxuICAgICAgLnNldERlc2MoXCJcdTgxRUFcdTUyQThcdTY0NThcdTg5ODFcdTYyMkFcdTUzRDZcdTc2ODRcdTVCNTdcdTdCMjZcdTY1NzBcdUZGMDhmcm9udG1hdHRlciBcdTY3MDkgc3VtbWFyeS9kZXNjcmlwdGlvbiBcdTY1RjZcdTRGMThcdTUxNDhcdTc1MjhcdUZGMDlcIilcclxuICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShTdHJpbmcocy5zdW1tYXJ5TGVuZ3RoKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMuc3VtbWFyeUxlbmd0aCA9IE51bWJlcih2KSB8fCAxODA7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIGNvbnN0IHRvZ2dsZSA9IChuYW1lOiBzdHJpbmcsIGRlc2M6IHN0cmluZywgZ2V0OiAoKSA9PiBib29sZWFuLCBzZXQ6ICh2OiBib29sZWFuKSA9PiB2b2lkKSA9PlxyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShuYW1lKS5zZXREZXNjKGRlc2MpLmFkZFRvZ2dsZSgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKGdldCgpKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgc2V0KHYpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTVDMDFcdTk3NjJcIiwgXCJcdThCRkJcdTUzRDYgZnJvbnRtYXR0ZXIgXHU3Njg0IGNvdmVyL2ltYWdlL2Jhbm5lciBcdTYyMTZcdTZCNjNcdTY1ODdcdTdCMkNcdTRFMDBcdTVGMjBcdTU2RkVcIiwgKCkgPT4gcy5zaG93Q292ZXIsICh2KSA9PiAocy5zaG93Q292ZXIgPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTUxNDNcdTRGRTFcdTYwNkZcIiwgXCJ0eXBlIC8gc3RhdHVzIC8gZG9tYWluIC8gXHU2NkY0XHU2NUIwXHU2NUY2XHU5NUY0IC8gXHU1QjU3XHU2NTcwXCIsICgpID0+IHMuc2hvd01ldGEsICh2KSA9PiAocy5zaG93TWV0YSA9IHYpKTtcclxuICAgIHRvZ2dsZShcIlx1NjYzRVx1NzkzQVx1NjgwN1x1N0I3RVwiLCBcIlwiLCAoKSA9PiBzLnNob3dUYWdzLCAodikgPT4gKHMuc2hvd1RhZ3MgPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTMwMENcdTYyNTNcdTVGMDBcdTMwMERcdTYzMDlcdTk0QUVcIiwgXCJcIiwgKCkgPT4gcy5zaG93T3BlbkJ1dHRvbiwgKHYpID0+IChzLnNob3dPcGVuQnV0dG9uID0gdikpO1xyXG4gICAgdG9nZ2xlKFwiXHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXHU2QjYzXHU2NTg3XCIsIFwiXHU2MjUzXHU1RjAwXHU2NTg3XHU2ODYzXHU2NUY2XHU1MzYxXHU3MjQ3XHU3NkY0XHU2M0E1XHU2NjNFXHU3OTNBXHU1QjhDXHU2NTc0XHU1MTg1XHU1QkI5XHVGRjBDXHU3MEI5XHU2ODA3XHU5ODk4XHU1M0VGXHU2Mjk4XHU1M0UwXCIsICgpID0+IHMuZGVmYXVsdEV4cGFuZGVkLCAodikgPT4gKHMuZGVmYXVsdEV4cGFuZGVkID0gdikpO1xyXG4gICAgdG9nZ2xlKFxyXG4gICAgICBcIlx1NUQ0Q1x1NTk1N1x1NTM2MVx1NzI0N1x1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMFwiLFxyXG4gICAgICBcIlx1NTM2MVx1NzI0N1x1OTFDQ1x1NTE4RFx1NTk1N1x1NzY4NFx1NTM2MVx1NzI0N1x1NTg5OVx1NjYyRlx1NTQyNlx1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMFx1RkYxQlx1NTE3M1x1OTVFRFx1NjVGNlx1NTNFQVx1NjYzRVx1NzkzQVx1NjgwN1x1OTg5OFx1NTQ4Q1x1NjQ1OFx1ODk4MVwiLFxyXG4gICAgICAoKSA9PiBzLm5lc3RlZEV4cGFuZGVkLFxyXG4gICAgICAodikgPT4gKHMubmVzdGVkRXhwYW5kZWQgPSB2KVxyXG4gICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTY3MDBcdTU5MjdcdTVENENcdTU5NTdcdTZERjFcdTVFQTZcIilcclxuICAgICAgLnNldERlc2MoXCJcdTUzNjFcdTcyNDdcdTkxQ0NcdTUxOERcdTY1M0UgY2FyZHMgXHU1NzU3XHU2NUY2XHU3Njg0XHU5MDEyXHU1RjUyXHU1QzQyXHU2NTcwXHU0RTBBXHU5NjUwXHVGRjBDXHU5NjMyXHU2QjYyXHU1RkFBXHU3M0FGXHU1RjE1XHU3NTI4XHU1MzYxXHU2QjdCXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKHMubWF4TmVzdERlcHRoKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMubWF4TmVzdERlcHRoID0gTWF0aC5tYXgoMSwgTnVtYmVyKHYpIHx8IDMpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1NUI1N1x1NkJCNVx1NjYyMFx1NUMwNFwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgY29uc3QgbGlzdEZpZWxkID0gKG5hbWU6IHN0cmluZywgZGVzYzogc3RyaW5nLCBnZXQ6ICgpID0+IHN0cmluZ1tdLCBzZXQ6ICh2OiBzdHJpbmdbXSkgPT4gdm9pZCkgPT5cclxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUobmFtZSlcclxuICAgICAgICAuc2V0RGVzYyhkZXNjKVxyXG4gICAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgICAgdFxyXG4gICAgICAgICAgICAuc2V0VmFsdWUoZ2V0KCkuam9pbihcIiwgXCIpKVxyXG4gICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJhLCBiLCBjXCIpXHJcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICAgIHNldChcclxuICAgICAgICAgICAgICAgIHZcclxuICAgICAgICAgICAgICAgICAgLnNwbGl0KFwiLFwiKVxyXG4gICAgICAgICAgICAgICAgICAubWFwKCh4KSA9PiB4LnRyaW0oKSlcclxuICAgICAgICAgICAgICAgICAgLmZpbHRlcihCb29sZWFuKVxyXG4gICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICBsaXN0RmllbGQoXCJcdTY0NThcdTg5ODFcdTVCNTdcdTZCQjVcIiwgXCJcdTYzMDlcdTk4N0FcdTVFOEZcdTVDMURcdThCRDVcdThCRkJcdTUzRDZcdTc2ODQgZnJvbnRtYXR0ZXIgXHU1QjU3XHU2QkI1XCIsICgpID0+IHMuc3VtbWFyeUZpZWxkcywgKHYpID0+IChzLnN1bW1hcnlGaWVsZHMgPSB2KSk7XHJcbiAgICBsaXN0RmllbGQoXCJcdTVDMDFcdTk3NjJcdTVCNTdcdTZCQjVcIiwgXCJcIiwgKCkgPT4gcy5jb3ZlckZpZWxkcywgKHYpID0+IChzLmNvdmVyRmllbGRzID0gdikpO1xyXG4gICAgbGlzdEZpZWxkKFwiXHU1MTQzXHU0RkUxXHU2MDZGXHU1QjU3XHU2QkI1XCIsIFwiXHU0RjFBXHU0RUU1XHU1RkJEXHU3QUUwXHU1RjYyXHU1RjBGXHU2NjNFXHU3OTNBXHU1NzI4XHU1MzYxXHU3MjQ3XHU0RTBBXCIsICgpID0+IHMubWV0YUZpZWxkcywgKHYpID0+IChzLm1ldGFGaWVsZHMgPSB2KSk7XHJcbiAgfVxyXG59XHJcbiIsICJleHBvcnQgdHlwZSBEZW5zaXR5ID0gXCJjb21wYWN0XCIgfCBcImNvbWZvcnRhYmxlXCI7XHJcbmV4cG9ydCB0eXBlIFNvcnRLZXkgPSBcIm5hbWVcIiB8IFwidXBkYXRlZFwiIHwgXCJjcmVhdGVkXCIgfCBcIm5vbmVcIjtcclxuLyoqIHdyYXAgPSBcdTYyNDFcdTVFNzNcdTUzMDVcdTg4RjlcdTUzNjFcdTcyNDdcdUZGMDhcdTZBMkFcdTU0MTFcdUZGMDlcdUZGMUJjYXJkID0gXHU0RjIwXHU3RURGXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDXHVGRjA4XHU5ODc2XHU5MEU4XHU1QzAxXHU5NzYyXHVGRjA5ICovXHJcbmV4cG9ydCB0eXBlIExheW91dCA9IFwid3JhcFwiIHwgXCJjYXJkXCI7XHJcbi8qKiBub3JtYWwgPSBcdTVFMzhcdTg5QzRcdTY1ODdcdTY4NjNcdTUzNjFcdTcyNDdcdUZGMUJzbWFsbCA9IFx1NzdFNVx1OEJDNlx1NzBCOSAvIFx1NkJCNVx1ODQzRFx1N0VBN1x1NUMwRlx1NTM2MVx1NzI0N1x1RkYwOFx1NjZGNFx1N0E4NFx1RkYwQ1x1NEUwMFx1ODg0Q1x1NjM5Mlx1NTkxQVx1NEUyQVx1RkYwOSAqL1xyXG5leHBvcnQgdHlwZSBTaXplID0gXCJub3JtYWxcIiB8IFwic21hbGxcIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXRvbWljQ2FyZHNTZXR0aW5ncyB7XHJcbiAgLyoqIFx1NTIxN1x1NjU3MFx1RkYxQTEgPSBcdTZCQ0ZcdTVGMjBcdTUzNjFcdTcyNDdcdTUzNjBcdTRFMDBcdTY1NzRcdTg4NENcdUZGMUIwID0gXHU4MUVBXHU5MDAyXHU1RTk0XHU3RjUxXHU2ODNDICovXHJcbiAgY29sdW1uczogbnVtYmVyO1xyXG4gIGxheW91dDogTGF5b3V0O1xyXG4gIC8qKiBcdTVENENcdTU5NTdcdTU3MjhcdTU5MjdcdTUzNjFcdTcyNDdcdTkxQ0NcdTc2ODRcdTUzNjFcdTcyNDdcdTU4OTlcdTlFRDhcdThCQTRcdTVDM0FcdTVCRjggKi9cclxuICBuZXN0ZWRTaXplOiBTaXplO1xyXG4gIG1pbkNhcmRXaWR0aDogbnVtYmVyO1xyXG4gIGNhcmRIZWlnaHQ6IG51bWJlcjtcclxuICBzdW1tYXJ5TGVuZ3RoOiBudW1iZXI7XHJcbiAgc2hvd0NvdmVyOiBib29sZWFuO1xyXG4gIHNob3dNZXRhOiBib29sZWFuO1xyXG4gIHNob3dUYWdzOiBib29sZWFuO1xyXG4gIHNob3dPcGVuQnV0dG9uOiBib29sZWFuO1xyXG4gIC8qKiBcdTUzNjFcdTcyNDdcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDBcdTZCNjNcdTY1ODcgKi9cclxuICBkZWZhdWx0RXhwYW5kZWQ6IGJvb2xlYW47XHJcbiAgLyoqIFx1NUQ0Q1x1NTcyOFx1NTM2MVx1NzI0N1x1OTFDQ1x1NzY4NFx1NTM2MVx1NzI0N1x1NTg5OVx1NjYyRlx1NTQyNlx1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMCAqL1xyXG4gIG5lc3RlZEV4cGFuZGVkOiBib29sZWFuO1xyXG4gIG1heE5lc3REZXB0aDogbnVtYmVyO1xyXG4gIGRlbnNpdHk6IERlbnNpdHk7XHJcbiAgc3VtbWFyeUZpZWxkczogc3RyaW5nW107XHJcbiAgY292ZXJGaWVsZHM6IHN0cmluZ1tdO1xyXG4gIG1ldGFGaWVsZHM6IHN0cmluZ1tdO1xyXG4gIHZlcmJvc2U6IGJvb2xlYW47XHJcbiAgLyoqIFx1NUUwM1x1NUM0MFx1OUVEOFx1OEJBNFx1NTAzQ1x1NTNEOFx1NTMxNlx1NjVGNlx1NzUyOFx1Njc2NVx1OEZDMVx1NzlGQlx1NjVFN1x1OEJCRVx1N0Y2RSAqL1xyXG4gIHNldHRpbmdzVmVyc2lvbj86IG51bWJlcjtcclxufVxyXG5cclxuLyoqIFx1NUUwM1x1NUM0MFx1NzZGOFx1NTE3M1x1OUVEOFx1OEJBNFx1NTAzQ1x1NTNEOFx1NjZGNFx1NjVGNiArMVx1RkYwQ1x1NjVFN1x1OEJCRVx1N0Y2RVx1NEYxQVx1ODhBQlx1NjVCMFx1OUVEOFx1OEJBNFx1NTAzQ1x1ODk4Nlx1NzZENiAqL1xyXG5leHBvcnQgY29uc3QgU0VUVElOR1NfVkVSU0lPTiA9IDI7XHJcblxyXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogQXRvbWljQ2FyZHNTZXR0aW5ncyA9IHtcclxuICBjb2x1bW5zOiAxLFxyXG4gIGxheW91dDogXCJ3cmFwXCIsXHJcbiAgbmVzdGVkU2l6ZTogXCJub3JtYWxcIixcclxuICBtaW5DYXJkV2lkdGg6IDI0MCxcclxuICBjYXJkSGVpZ2h0OiAwLFxyXG4gIHN1bW1hcnlMZW5ndGg6IDE4MCxcclxuICBzaG93Q292ZXI6IHRydWUsXHJcbiAgc2hvd01ldGE6IHRydWUsXHJcbiAgc2hvd1RhZ3M6IHRydWUsXHJcbiAgc2hvd09wZW5CdXR0b246IHRydWUsXHJcbiAgZGVmYXVsdEV4cGFuZGVkOiB0cnVlLFxyXG4gIG5lc3RlZEV4cGFuZGVkOiB0cnVlLFxyXG4gIG1heE5lc3REZXB0aDogMyxcclxuICBkZW5zaXR5OiBcImNvbWZvcnRhYmxlXCIsXHJcbiAgc3VtbWFyeUZpZWxkczogW1wic3VtbWFyeVwiLCBcImRlc2NyaXB0aW9uXCIsIFwiYWJzdHJhY3RcIiwgXCJleGNlcnB0XCIsIFwiXHU3QjgwXHU0RUNCXCIsIFwiXHU2NDU4XHU4OTgxXCJdLFxyXG4gIGNvdmVyRmllbGRzOiBbXCJjb3ZlclwiLCBcImltYWdlXCIsIFwiYmFubmVyXCIsIFwidGh1bWJuYWlsXCIsIFwiaW1nXCIsIFwiXHU1QzAxXHU5NzYyXCJdLFxyXG4gIG1ldGFGaWVsZHM6IFtcInR5cGVcIiwgXCJzdGF0dXNcIiwgXCJkb21haW5cIiwgXCJjb21wbGV4aXR5XCJdLFxyXG4gIHZlcmJvc2U6IGZhbHNlLFxyXG59O1xyXG5cclxuLyoqIFx1NTM1NVx1NEUyQSBjYXJkcyBcdTRFRTNcdTc4MDFcdTU3NTdcdTUzRUZcdTg5ODZcdTc2RDZcdTc2ODRcdTkwMDlcdTk4NzkgKi9cclxuZXhwb3J0IGludGVyZmFjZSBDYXJkT3B0aW9ucyB7XHJcbiAgY29sdW1ucz86IG51bWJlcjtcclxuICB3aWR0aD86IG51bWJlcjtcclxuICBoZWlnaHQ/OiBudW1iZXI7XHJcbiAgc3VtbWFyeT86IG51bWJlcjtcclxuICBleHBhbmRlZD86IGJvb2xlYW47XHJcbiAgY292ZXI/OiBib29sZWFuO1xyXG4gIG1ldGE/OiBib29sZWFuO1xyXG4gIHRhZ3M/OiBib29sZWFuO1xyXG4gIG9wZW4/OiBib29sZWFuO1xyXG4gIGRlbnNpdHk/OiBEZW5zaXR5O1xyXG4gIGxheW91dD86IExheW91dDtcclxuICBzaXplPzogU2l6ZTtcclxuICAvKiogXHU2MzA5XHU2NTg3XHU0RUY2XHU1OTM5XHU3QjVCXHU5MDA5XHVGRjBDXHU1OTgyIHdpa2kvY29uY2VwdHMgKi9cclxuICBmcm9tPzogc3RyaW5nO1xyXG4gIC8qKiBcdTYzMDlcdTY4MDdcdTdCN0VcdTdCNUJcdTkwMDlcdUZGMENcdTU5ODIgdHlwZS9jb25jZXB0IFx1NjIxNiAjdHlwZS9jb25jZXB0ICovXHJcbiAgdGFnPzogc3RyaW5nO1xyXG4gIHNvcnQ/OiBTb3J0S2V5O1xyXG4gIGxpbWl0PzogbnVtYmVyO1xyXG4gIC8qKiB0cnVlID0gXHU1M0NEXHU2N0U1XHVGRjFBXHU1MjE3XHU1MUZBXHU2MjQwXHU2NzA5XHU1RjE1XHU3NTI4XHU0RTg2XHU1RjUzXHU1MjREXHU2NTg3XHU2ODYzXHU3Njg0XHU3QjE0XHU4QkIwXHVGRjA4XHU0RTBBXHU1QzQyXHU3QUUwXHU4MjgyXHVGRjA5ICovXHJcbiAgcmV2ZXJzZT86IGJvb2xlYW47XHJcbiAgdGl0bGU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ2FyZEVudHJ5IHtcclxuICB0YXJnZXQ6IHN0cmluZztcclxuICBhbGlhcz86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYXJkc1F1ZXJ5IHtcclxuICBvcHRpb25zOiBDYXJkT3B0aW9ucztcclxuICBlbnRyaWVzOiBDYXJkRW50cnlbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNZXJnZWRPcHRpb25zIGV4dGVuZHMgUmVxdWlyZWQ8T21pdDxDYXJkT3B0aW9ucywgXCJmcm9tXCIgfCBcInRhZ1wiIHwgXCJ0aXRsZVwiIHwgXCJzb3J0XCI+PiB7XHJcbiAgZnJvbTogc3RyaW5nO1xyXG4gIHRhZzogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgc29ydDogU29ydEtleTtcclxuICBsaW1pdDogbnVtYmVyO1xyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBUU87OztBQ1JQLElBQUFDLG1CQUFnRDs7O0FDQWhELHNCQUEwRjtBQXdCMUYsSUFBTSxRQUFRLG9CQUFJLElBQXNCO0FBRXhDLFNBQVMsaUJBQWlCLEtBQXFCO0FBQzdDLFFBQU0sSUFBSSxJQUFJLE1BQU0s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RjtBQUNBLFVBQU0sS0FBSztBQUNYLFVBQU0sUUFBa0IsQ0FBQztBQUN6QixRQUFJO0FBQ0osWUFBUSxJQUFJLEdBQUcsS0FBSyxHQUFHLE9BQU8sTUFBTTtBQUNsQyxZQUFNLElBQUksRUFBRSxDQUFDLEVBQUUsS0FBSztBQUNwQixVQUFJLEtBQUssQ0FBQyxNQUFNLFNBQVMsQ0FBQyxFQUFHLE9BQU0sS0FBSyxDQUFDO0FBQUEsSUFDM0M7QUFDQSxRQUFJLENBQUMsTUFBTSxRQUFRO0FBQ2pCLFVBQUksd0JBQU8saURBQWM7QUFDekI7QUFBQSxJQUNGO0FBQ0EsVUFBTSxRQUFRO0FBQUEsRUFBZ0IsTUFBTSxJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxDQUFDO0FBQUE7QUFDdkUsV0FBTyxpQkFBaUIsS0FBSztBQUM3QixRQUFJLHdCQUFPLHNCQUFPLE1BQU0sTUFBTSxxQkFBTTtBQUFBLEVBQ3RDO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaCIsICJrZXkiLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIl0KfQo=
