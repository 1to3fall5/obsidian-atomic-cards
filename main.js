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
  return stripFrontmatter(body).replace(/```[\s\S]*?```/g, "").replace(/^\s*>\s*\[!\w+[^\]]*\].*$/gm, "").replace(/!\[\[[^\]]*\]\]/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_m, a, b) => b || a).replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/^\s{0,3}#{1,6}\s+.*$/gm, "").replace(/^\s{0,3}>\s?/gm, "").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+\.\s+/gm, "").replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, "").replace(/\|/g, " ").replace(/[*_`~=]/g, "").replace(/\s+/g, " ").trim();
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
  if (typeof md.render === "function") {
    md.render(app, markdown, el, sourcePath, component);
  } else if (typeof md.renderMarkdown === "function") {
    md.renderMarkdown(markdown, el, sourcePath, component);
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
  head.draggable = true;
  head.addEventListener("dragstart", (e) => {
    var _a2;
    if (!meta.file) return;
    const name = meta.file.basename;
    const link = meta.ref ? `![[${name}#${meta.ref}]]` : `![[${name}]]`;
    (_a2 = e.dataTransfer) == null ? void 0 : _a2.setData("text/plain", link);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
    card.classList.add("is-dragging");
  });
  head.addEventListener("dragend", () => card.classList.remove("is-dragging"));
  if (opts.expanded) setExpanded(true);
  return card;
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
    new import_obsidian3.Setting(containerEl).setName("\u884C\u4E3A").setHeading();
    new import_obsidian3.Setting(containerEl).setName("\u63A5\u7BA1\u539F\u751F\u5D4C\u5165 ![[ ]]").setDesc("\u628A\u72EC\u5360\u4E00\u884C\u7684 ![[\u7B14\u8BB0]] \u5D4C\u5165\u6E32\u67D3\u6210\u53EF\u6298\u53E0\u5361\u7247\uFF1B\u5173\u95ED\u540E\u63D2\u4EF6\u5B8C\u5168\u4E0D\u4ECB\u5165\uFF0C\u5D4C\u5165\u4FDD\u6301 Obsidian \u9ED8\u8BA4\u6837\u5F0F").addToggle(
      (t) => t.setValue(s.upgradeEmbeds).onChange(async (v) => {
        s.upgradeEmbeds = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u62D6\u5165\u7B14\u8BB0\u65F6\u63D2\u5165\u5D4C\u5165 ![[ ]]").setDesc("\u4ECE\u6587\u4EF6\u5217\u8868\u628A\u7B14\u8BB0\u62D6\u8FDB\u7F16\u8F91\u5668\u65F6\u63D2\u5165 ![[ ]]\uFF08\u4F1A\u6E32\u67D3\u6210\u5361\u7247\uFF09\uFF1B\u5173\u95ED\u5219\u4FDD\u6301 Obsidian \u9ED8\u8BA4\u7684 [[ ]] \u94FE\u63A5").addToggle(
      (t) => t.setValue(s.embedOnDrop).onChange(async (v) => {
        s.embedOnDrop = v;
        await this.plugin.saveSettings();
      })
    );
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
    new import_obsidian3.Setting(containerEl).setName("\u5D4C\u5957\u5361\u7247\u7684\u5C3A\u5BF8").setDesc("\u5361\u7247\u91CC\u518D\u5957\u7684\u5D4C\u5165\u9ED8\u8BA4\u7528\u4EC0\u4E48\u5C3A\u5BF8").addDropdown(
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
    toggle(
      "\u8BE6\u7EC6\u65E5\u5FD7",
      "\u5728\u5F00\u53D1\u8005\u63A7\u5236\u53F0\uFF08Ctrl+Shift+I\uFF09\u8F93\u51FA\u8FD0\u884C\u65E5\u5FD7\uFF0C\u6392\u67E5\u7528\uFF1B\u5E73\u65F6\u53EF\u5173",
      () => s.verbose,
      (v) => s.verbose = v
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
var SETTINGS_VERSION = 3;
var DEFAULT_SETTINGS = {
  upgradeEmbeds: true,
  embedOnDrop: true,
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
var SKIP_EMBED_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|mp3|wav|ogg|flac|m4a|mp4|webm|mov|pdf|canvas|excalidraw)$/i;

// src/main.ts
var AtomicCardsPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
  }
  async onload() {
    try {
      await this.loadSettings();
      this.addSettingTab(new AtomicCardsSettingTab(this.app, this));
      this.registerMarkdownPostProcessor(
        (el, ctx) => {
          this.upgradeEmbeds(el, ctx);
          window.setTimeout(() => this.upgradeEmbeds(el, ctx), 60);
          window.setTimeout(() => this.upgradeEmbeds(el, ctx), 400);
        },
        1e3
      );
      this.registerCommands();
      this.registerDomEvent(document, "drop", (evt) => this.onDomDrop(evt), true);
      if (this.settings.verbose) {
        console.log("[atomic-cards] \u5DF2\u52A0\u8F7D\uFF0CupgradeEmbeds =", this.settings.upgradeEmbeds);
      }
    } catch (err) {
      console.error("[atomic-cards] onload \u5931\u8D25\uFF1A", err);
      new import_obsidian4.Notice(`Atomic Cards \u52A0\u8F7D\u5931\u8D25\uFF1A${String(err)}`);
    }
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
   * 渲染：接管原生嵌入
   * ===================================================================== */
  upgradeEmbeds(el, ctx) {
    try {
      this.doUpgradeEmbeds(el, ctx);
    } catch (err) {
      console.error("[atomic-cards] upgradeEmbeds \u51FA\u9519\uFF1A", err);
    }
  }
  doUpgradeEmbeds(el, ctx) {
    var _a, _b;
    if (!this.settings.upgradeEmbeds) return;
    if (getNest() >= this.settings.maxNestDepth) return;
    const nodes = Array.from(
      el.querySelectorAll(
        ".internal-embed:not(.media-embed), .markdown-embed:not(.media-embed)"
      )
    ).filter((n) => !n.dataset.acUpgraded);
    let taken = 0;
    for (const embed of nodes) {
      const first = embed.firstElementChild;
      if (first && /^(IMG|AUDIO|VIDEO|CANVAS|IFRAME)$/.test(first.tagName)) continue;
      const src = ((_b = (_a = embed.getAttribute("src")) != null ? _a : embed.getAttribute("alt")) != null ? _b : "").trim();
      if (!src) continue;
      if (SKIP_EMBED_EXT.test(src.split("#")[0])) continue;
      embed.dataset.acUpgraded = "1";
      taken++;
      void this.replaceWithCard(embed, src, ctx).catch(
        (err) => console.error("[atomic-cards] \u6E32\u67D3\u5361\u7247\u5931\u8D25\uFF1A", src, err)
      );
    }
    if (taken && this.settings.verbose) {
      console.log("[atomic-cards] \u5DF2\u63A5\u7BA1", taken, "\u5904\u5D4C\u5165");
    }
  }
  async replaceWithCard(embed, src, ctx) {
    var _a, _b;
    const depth = getNest();
    const size = depth > 0 ? this.settings.nestedSize : "normal";
    const isSmall = size === "small";
    const opts = {
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
      summary: isSmall ? 90 : this.settings.summaryLength
    };
    const holder = document.createElement("div");
    const component = new import_obsidian4.MarkdownRenderChild(holder);
    component.load();
    ctx.addChild(component);
    const env = {
      app: this.app,
      settings: this.settings,
      sourcePath: ctx.sourcePath,
      component,
      // +1：卡片正文里再渲染的内容属于下一层，递增后嵌套深度上限才有效
      depth: depth + 1
    };
    const placeholder = document.createElement("div");
    placeholder.className = "ac-card ac-card--pending";
    placeholder.dataset.acPath = src;
    placeholder.setText((_b = (_a = src.split("/").pop()) == null ? void 0 : _a.replace(/\.md$/i, "")) != null ? _b : src);
    embed.replaceWith(placeholder);
    const target = src.replace(/\.md(?=#|$)/i, "");
    const meta = await readNoteMeta(this.app, target, ctx.sourcePath, this.settings);
    const card = withNest(depth, () => renderCard(env, meta, opts));
    placeholder.replaceWith(card);
  }
  /* =======================================================================
   * 拖放：让"拖笔记进来"默认得到嵌入 ![[ ]]
   * ===================================================================== */
  onDomDrop(evt) {
    var _a, _b, _c;
    if (!this.settings.embedOnDrop) return;
    const t = evt.target;
    if (this.settings.verbose) {
      console.log("[atomic-cards] dom drop:", {
        target: t instanceof Element ? `${t.tagName}.${t.className}` : String(t),
        inEditor: !!(t instanceof Element && t.closest(".markdown-source-view, .cm-editor, .cm-content")),
        types: evt.dataTransfer ? Array.from(evt.dataTransfer.types) : null,
        text: (_b = (_a = evt.dataTransfer) == null ? void 0 : _a.getData("text/plain")) != null ? _b : ""
      });
    }
    const editor = (_c = this.editorFromDrop(evt)) != null ? _c : this.activeEditor();
    if (!editor) {
      if (this.settings.verbose) console.log("[atomic-cards] \u627E\u4E0D\u5230\u76EE\u6807\u7F16\u8F91\u5668");
      return;
    }
    for (const delay of [80, 250, 600]) {
      window.setTimeout(() => this.linkToEmbedAtCursor(editor), delay);
    }
  }
  /** 从拖放目标元素反查所属编辑器的 Editor 实例 */
  editorFromDrop(evt) {
    var _a, _b;
    const target = evt.target;
    if (!(target instanceof Element)) return null;
    const hits = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view instanceof import_obsidian4.MarkdownView && view.containerEl.contains(target)) hits.push(view);
    });
    return (_b = (_a = hits[0]) == null ? void 0 : _a.editor) != null ? _b : null;
  }
  /**
   * 把光标前刚插入的链接就地改写成 ![[笔记]]。
   * 拖 Obsidian 内部文件时，原生可能插入三种形态，都要认：
   *   ① [[笔记]]               （wikilink 设置）
   *   ② [标题](obsidian://…)   （实测默认走这种，dataTransfer 里是 obsidian:// URL）
   *   ③ obsidian://… 裸链接
   * 都不是就原样放过，避免误伤拖图片 / 外部文本。
   */
  linkToEmbedAtCursor(editor) {
    var _a;
    const cur = editor.getCursor();
    const line = (_a = editor.getLine(cur.line)) != null ? _a : "";
    const head = line.slice(0, cur.ch);
    if (this.settings.verbose) {
      console.log("[atomic-cards] \u5149\u6807\u524D\u6587\u672C\uFF1A", JSON.stringify(head.slice(-120)));
    }
    const replace = (matched, name) => {
      const from = { line: cur.line, ch: cur.ch - matched.length };
      editor.replaceRange(`![[${name}]]`, from, cur);
      if (this.settings.verbose) {
        console.log("[atomic-cards] \u94FE\u63A5\u6539\u5199\u4E3A\u5D4C\u5165\uFF1A", matched, "\u2192", `![[${name}]]`);
      }
    };
    const wiki = head.match(/(?:^|[^!])(\[\[[^\]]+\]\])$/);
    if (wiki) {
      const inner = wiki[1].slice(2, -2).split("|")[0].trim();
      if (inner) {
        replace(wiki[1], inner);
        return;
      }
    }
    const md = head.match(/\[[^\]]*\]\(([^)]+)\)$/);
    if (md) {
      const name = this.noteNameFromObsidianUrl(md[1]);
      if (name) {
        replace(md[0], name);
        return;
      }
      return;
    }
    const bare = head.match(/(obsidian:\/\/\S+)$/);
    if (bare) {
      const name = this.noteNameFromObsidianUrl(bare[1]);
      if (name) replace(bare[1], name);
    }
  }
  /** 从 obsidian://open?vault=X&file=<path> 里取出笔记名（去掉文件夹与 .md） */
  noteNameFromObsidianUrl(url) {
    var _a, _b;
    try {
      const u = new URL(url);
      const file = u.searchParams.get("file");
      if (!file) return null;
      const decoded = decodeURIComponent(file);
      const base = (_b = (_a = decoded.split("/").pop()) == null ? void 0 : _a.replace(/\.md$/i, "").trim()) != null ? _b : "";
      return base || null;
    } catch (e) {
      return null;
    }
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
      id: "links-to-embeds",
      name: "\u628A\u9009\u533A\u91CC\u7684 [[\u94FE\u63A5]] \u8F6C\u6210\u5D4C\u5165\u5217\u8868",
      editorCallback: (editor) => this.linksToEmbeds(editor)
    });
    this.addCommand({
      id: "insert-reverse-embeds",
      name: "\u63D2\u5165\u53CD\u67E5\u5217\u8868\uFF08\u5F15\u7528\u672C\u6587\u7684\u7B14\u8BB0\uFF0C\u751F\u6210\u4E3A\u5D4C\u5165\uFF09",
      editorCallback: (editor) => this.insertReverseEmbeds(editor)
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
  /** 选区里的 [[链接]] → 原生嵌入列表 `- ![[链接]]` */
  linksToEmbeds(editor) {
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
    editor.replaceSelection(found.map((t) => `- ![[${t}]]`).join("\n"));
    new import_obsidian4.Notice(`\u5DF2\u63D2\u5165 ${found.length} \u5904\u5D4C\u5165`);
  }
  /** 反查：把引用了本文的笔记以原生嵌入列表插入（静态结果，不是动态渲染） */
  insertReverseEmbeds(editor) {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new import_obsidian4.Notice("\u5F53\u524D\u6CA1\u6709\u6253\u5F00\u7684\u6587\u4EF6");
      return;
    }
    const links = this.app.metadataCache.resolvedLinks;
    const refs = Object.keys(links).filter((src) => {
      var _a;
      return (_a = links[src]) == null ? void 0 : _a[file.path];
    });
    if (!refs.length) {
      new import_obsidian4.Notice("\u6CA1\u6709\u7B14\u8BB0\u5F15\u7528\u672C\u6587");
      return;
    }
    const text = `\u88AB\u5F15\u7528\u5728\uFF1A

${refs.map((r) => `- ![[${r.replace(/\.md$/i, "")}]]`).join("\n")}
`;
    editor.replaceRange(text, editor.getCursor());
    new import_obsidian4.Notice(`\u5DF2\u63D2\u5165 ${refs.length} \u6761\u5F15\u7528`);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy9tYWluLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvY2FyZC50cyIsICIuLi8uLi8uLi8ucGx1Z2lucy9hdG9taWMtY2FyZHMvc3JjL21ldGFkYXRhLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvc2V0dGluZ3MudHMiLCAiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy90eXBlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcclxuICBFZGl0b3IsXHJcbiAgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcclxuICBNYXJrZG93blJlbmRlckNoaWxkLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBOb3RpY2UsXHJcbiAgUGx1Z2luLFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyByZW5kZXJDYXJkLCBnZXROZXN0LCB3aXRoTmVzdCB9IGZyb20gXCIuL2NhcmRcIjtcclxuaW1wb3J0IHsgcmVhZE5vdGVNZXRhIH0gZnJvbSBcIi4vbWV0YWRhdGFcIjtcclxuaW1wb3J0IHsgQXRvbWljQ2FyZHNTZXR0aW5nVGFiIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuaW1wb3J0IHtcclxuICBBdG9taWNDYXJkc1NldHRpbmdzLFxyXG4gIERFRkFVTFRfU0VUVElOR1MsXHJcbiAgUmVuZGVyT3B0aW9ucyxcclxuICBTRVRUSU5HU19WRVJTSU9OLFxyXG4gIFNpemUsXHJcbiAgU0tJUF9FTUJFRF9FWFQsXHJcbn0gZnJvbSBcIi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEF0b21pY0NhcmRzUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICBzZXR0aW5nczogQXRvbWljQ2FyZHNTZXR0aW5ncyA9IHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9O1xyXG5cclxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG4gICAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEF0b21pY0NhcmRzU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cclxuICAgICAgLy8gXHU2M0E1XHU3QkExIE9ic2lkaWFuIFx1NTM5Rlx1NzUxRiAhW1sgXV0gXHU1RDRDXHU1MTY1XHVGRjFBXHU4QkVEXHU2Q0Q1XHU0RkREXHU2MzAxXHU1MzlGXHU3NTFGXHVGRjBDXHU1M0VBXHU2MjhBXHU2RTMyXHU2N0QzXHU2NkZGXHU2MzYyXHU2MjEwXHU1MzYxXHU3MjQ3XHUzMDAyXHJcbiAgICAgIC8vIHNvcnRPcmRlciBcdTUzRDZcdTU5MjdcdTUwM0MgXHUyMTkyIFx1NjM5Mlx1NTcyOFx1NjI0MFx1NjcwOVx1NTE4NVx1N0Y2RVx1NTkwNFx1NzQwNlx1NTY2OFx1RkYwOFx1NTQyQlx1NUQ0Q1x1NTE2NVx1NkUzMlx1NjdEM1x1RkYwOVx1NEU0Qlx1NTQwRVx1OEZEMFx1ODg0Q1x1RkYwQ1xyXG4gICAgICAvLyBcdTU0MjZcdTUyMTkgcG9zdCBwcm9jZXNzb3IgXHU0RjFBXHU4REQxXHU1NzI4XHU1RDRDXHU1MTY1XHU3NTFGXHU2MjEwXHU0RTRCXHU1MjREXHVGRjBDXHU0RUMwXHU0RTQ4XHU0RTVGXHU1MzM5XHU5MTREXHU0RTBEXHU1MjMwXHUzMDAyXHJcbiAgICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93blBvc3RQcm9jZXNzb3IoXHJcbiAgICAgICAgKGVsLCBjdHgpID0+IHtcclxuICAgICAgICAgIHRoaXMudXBncmFkZUVtYmVkcyhlbCwgY3R4KTtcclxuICAgICAgICAgIC8vIFx1NUQ0Q1x1NTE2NVx1NzUzMSBPYnNpZGlhbiBcdTVGMDJcdTZCNjVcdTU4NkJcdTUxNDVcdUZGMENcdTg4NjVcdTRFMjRcdTZCMjFcdTYyNkJcdTYzQ0ZcdTUxNUNcdTVFOTVcdTMwMDJcclxuICAgICAgICAgIC8vIFx1NURGMlx1NjNBNVx1N0JBMVx1NzY4NFx1NTE0M1x1N0QyMFx1NUUyNiBkYXRhLWFjLXVwZ3JhZGVkXHVGRjBDXHU5MUNEXHU1OTBEXHU2MjZCXHU2M0NGXHU0RTBEXHU0RjFBXHU5MUNEXHU1OTBEXHU2RTMyXHU2N0QzXHUzMDAyXHJcbiAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0aGlzLnVwZ3JhZGVFbWJlZHMoZWwsIGN0eCksIDYwKTtcclxuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMudXBncmFkZUVtYmVkcyhlbCwgY3R4KSwgNDAwKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIDEwMDBcclxuICAgICAgKTtcclxuXHJcbiAgICAgIHRoaXMucmVnaXN0ZXJDb21tYW5kcygpO1xyXG5cclxuICAgICAgLy8gXHU2M0E1XHU3QkExXHU2MkQ2XHU2NTNFXHVGRjFBXHU0RUNFXHU2NTg3XHU0RUY2XHU1MjE3XHU4ODY4XHU2MkQ2XHU3QjE0XHU4QkIwXHU4RkRCXHU2NzY1IFx1MjE5MiBcdTYzRDJcdTUxNjUgIVtbIF1dIFx1ODAwQ1x1NEUwRFx1NjYyRlx1OUVEOFx1OEJBNFx1NzY4NCBbWyBdXVx1MzAwMlxyXG4gICAgICAvLyBcdTI2QTBcdUZFMEYgXHU0RTBEXHU4MEZEXHU3NTI4IHdvcmtzcGFjZSBcdTc2ODQgXCJlZGl0b3ItZHJvcFwiIFx1NEU4Qlx1NEVGNlx1RkYxQVx1NUI5RVx1NkQ0Qlx1NjJENiBPYnNpZGlhbiBcdTUxODVcdTkwRThcdTY1ODdcdTRFRjZcdTY1RjZcdTVCODNcdTRFMERcdTg5RTZcdTUzRDFcdTMwMDJcclxuICAgICAgLy8gXHU2NTM5XHU3NkQxXHU1NDJDIERPTSBcdTc2ODRcdTUzOUZcdTc1MUYgZHJvcFx1RkYwOGNhcHR1cmUgXHU5NjM2XHU2QkI1XHVGRjA5XHVGRjBDXHU0RTAwXHU1QjlBXHU4MEZEXHU2MkZGXHU1MjMwXHUzMDAyXHJcbiAgICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudChkb2N1bWVudCwgXCJkcm9wXCIsIChldnQ6IERyYWdFdmVudCkgPT4gdGhpcy5vbkRvbURyb3AoZXZ0KSwgdHJ1ZSk7XHJcblxyXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy52ZXJib3NlKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBcdTVERjJcdTUyQTBcdThGN0RcdUZGMEN1cGdyYWRlRW1iZWRzID1cIiwgdGhpcy5zZXR0aW5ncy51cGdyYWRlRW1iZWRzKTtcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbYXRvbWljLWNhcmRzXSBvbmxvYWQgXHU1OTMxXHU4RDI1XHVGRjFBXCIsIGVycik7XHJcbiAgICAgIG5ldyBOb3RpY2UoYEF0b21pYyBDYXJkcyBcdTUyQTBcdThGN0RcdTU5MzFcdThEMjVcdUZGMUEke1N0cmluZyhlcnIpfWApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb251bmxvYWQoKTogdm9pZCB7XHJcbiAgICAvKiBDb21wb25lbnQgXHU3NTFGXHU1NDdEXHU1NDY4XHU2NzFGXHU3NTMxIGN0eC5hZGRDaGlsZCBcdTYyNThcdTdCQTEgKi9cclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHNhdmVkID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpO1xyXG4gICAgaWYgKHNhdmVkICYmIHR5cGVvZiBzYXZlZCA9PT0gXCJvYmplY3RcIikge1xyXG4gICAgICAvLyBcdTVFMDNcdTVDNDBcdTlFRDhcdThCQTRcdTUwM0NcdTUzRDhcdTRFODZcdUZGMENcdTY1RTdcdTVCNThcdTY4NjNcdTg5ODFcdThGQzFcdTc5RkJcdUZGMENcdTU0MjZcdTUyMTlcdTc1MjhcdTYyMzdcdTdBRUZcdTc3MEJcdTUyMzBcdTc2ODRcdThGRDhcdTY2MkZcdTY1RTdcdTVFMDNcdTVDNDBcclxuICAgICAgaWYgKHNhdmVkLnNldHRpbmdzVmVyc2lvbiAhPT0gU0VUVElOR1NfVkVSU0lPTikge1xyXG4gICAgICAgIE9iamVjdC5hc3NpZ24oc2F2ZWQsIHtcclxuICAgICAgICAgIGxheW91dDogREVGQVVMVF9TRVRUSU5HUy5sYXlvdXQsXHJcbiAgICAgICAgICBuZXN0ZWRTaXplOiBERUZBVUxUX1NFVFRJTkdTLm5lc3RlZFNpemUsXHJcbiAgICAgICAgICBkZWZhdWx0RXhwYW5kZWQ6IERFRkFVTFRfU0VUVElOR1MuZGVmYXVsdEV4cGFuZGVkLFxyXG4gICAgICAgICAgbmVzdGVkRXhwYW5kZWQ6IERFRkFVTFRfU0VUVElOR1MubmVzdGVkRXhwYW5kZWQsXHJcbiAgICAgICAgICBzZXR0aW5nc1ZlcnNpb246IFNFVFRJTkdTX1ZFUlNJT04sXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YShzYXZlZCk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oeyAuLi5ERUZBVUxUX1NFVFRJTkdTIH0sIHNhdmVkKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MgfTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XHJcbiAgfVxyXG5cclxuICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAqIFx1NkUzMlx1NjdEM1x1RkYxQVx1NjNBNVx1N0JBMVx1NTM5Rlx1NzUxRlx1NUQ0Q1x1NTE2NVxyXG4gICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuICBwcml2YXRlIHVwZ3JhZGVFbWJlZHMoZWw6IEhUTUxFbGVtZW50LCBjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMuZG9VcGdyYWRlRW1iZWRzKGVsLCBjdHgpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbYXRvbWljLWNhcmRzXSB1cGdyYWRlRW1iZWRzIFx1NTFGQVx1OTUxOVx1RkYxQVwiLCBlcnIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkb1VwZ3JhZGVFbWJlZHMoZWw6IEhUTUxFbGVtZW50LCBjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5zZXR0aW5ncy51cGdyYWRlRW1iZWRzKSByZXR1cm47XHJcbiAgICAvLyBcdThGQkVcdTUyMzBcdTVENENcdTU5NTdcdTRFMEFcdTk2NTBcdTY1RjZcdTRFMERcdTUxOERcdTYzQTVcdTdCQTFcdUZGMENcdTkwN0ZcdTUxNERcdTVGQUFcdTczQUZcdTVGMTVcdTc1MjhcdTY1RTBcdTk2NTBcdTU5NTdcdTVBMDNcclxuICAgIGlmIChnZXROZXN0KCkgPj0gdGhpcy5zZXR0aW5ncy5tYXhOZXN0RGVwdGgpIHJldHVybjtcclxuXHJcbiAgICAvLyA6bm90KC5tZWRpYS1lbWJlZCkgXHU3NkY0XHU2M0E1XHU1NzI4XHU5MDA5XHU2MkU5XHU1NjY4XHU1QzQyXHU2MzkyXHU2Mzg5XHU1NkZFXHU3MjQ3L1x1OTdGM1x1ODlDNlx1OTg5MVx1NUQ0Q1x1NTE2NVx1RkYwQ1xyXG4gICAgLy8gXHU0RTBEXHU3NTI4XHU2MjhBXHU1QjgzXHU0RUVDXHU2MzVFXHU4RkRCXHU1RkFBXHU3M0FGXHU1MThEXHU4RkM3XHU2RUU0XHVGRjA4XHU2NzYxXHU3NkVFXHU2QjYzXHU2NTg3XHU5MUNDXHU1RTM4XHU2NzA5XHU1MUUwXHU1MzQxXHU1RjIwXHU1NkZFXHVGRjA5XHUzMDAyXHJcbiAgICBjb25zdCBub2RlcyA9IEFycmF5LmZyb20oXHJcbiAgICAgIGVsLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxyXG4gICAgICAgIFwiLmludGVybmFsLWVtYmVkOm5vdCgubWVkaWEtZW1iZWQpLCAubWFya2Rvd24tZW1iZWQ6bm90KC5tZWRpYS1lbWJlZClcIlxyXG4gICAgICApXHJcbiAgICApLmZpbHRlcigobikgPT4gIW4uZGF0YXNldC5hY1VwZ3JhZGVkKTtcclxuXHJcbiAgICBsZXQgdGFrZW4gPSAwO1xyXG4gICAgZm9yIChjb25zdCBlbWJlZCBvZiBub2Rlcykge1xyXG4gICAgICAvLyBcdTI2QTBcdUZFMEYgXHU1M0VBXHU1MjI0XHU2NUFEXCJcdTVENENcdTUxNjVcdTY3MkNcdThFQUJcIlx1NjYyRlx1NEUwRFx1NjYyRlx1NUE5Mlx1NEY1M1x1NTE0M1x1N0QyMFx1RkYwQ1x1NEUwRFx1ODBGRFx1NjdFNVx1NjI0MFx1NjcwOVx1NTQwRVx1NEVFM1x1RkYxQVxyXG4gICAgICAvLyBcdTdCMTRcdThCQjBcdTZCNjNcdTY1ODdcdTkxQ0NcdTY2NkVcdTkwNERcdTY3MDlcdTU2RkVcdTcyNDdcdUZGMENcdTc1MjggcXVlcnlTZWxlY3RvciBcdTRGMUFcdTYyOEFcdTY1NzRcdTdCQzdcdTVENENcdTUxNjVcdThCRUZcdTUyMjRcdTYyMTBcdTU2RkVcdTcyNDdcdTVENENcdTUxNjVcdTMwMDJcclxuICAgICAgY29uc3QgZmlyc3QgPSBlbWJlZC5maXJzdEVsZW1lbnRDaGlsZDtcclxuICAgICAgaWYgKGZpcnN0ICYmIC9eKElNR3xBVURJT3xWSURFT3xDQU5WQVN8SUZSQU1FKSQvLnRlc3QoZmlyc3QudGFnTmFtZSkpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgLy8gc3JjIFx1NEYxOFx1NTE0OFx1RkYwQ1x1NkNBMVx1NjcwOVx1NTIxOVx1NzUyOCBhbHQgXHU1MTVDXHU1RTk1XHJcbiAgICAgIGNvbnN0IHNyYyA9IChlbWJlZC5nZXRBdHRyaWJ1dGUoXCJzcmNcIikgPz8gZW1iZWQuZ2V0QXR0cmlidXRlKFwiYWx0XCIpID8/IFwiXCIpLnRyaW0oKTtcclxuICAgICAgaWYgKCFzcmMpIGNvbnRpbnVlO1xyXG4gICAgICAvLyBcdTU2RkVcdTcyNDcgLyBcdTk3RjNcdTg5QzZcdTk4OTEgLyBQREYgLyBcdTc1M0JcdTVFMDNcdTdCNDlcdTYzMDlcdTYyNjlcdTVDNTVcdTU0MERcdTYzOTJcdTk2NjRcclxuICAgICAgaWYgKFNLSVBfRU1CRURfRVhULnRlc3Qoc3JjLnNwbGl0KFwiI1wiKVswXSkpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgZW1iZWQuZGF0YXNldC5hY1VwZ3JhZGVkID0gXCIxXCI7XHJcbiAgICAgIHRha2VuKys7XHJcbiAgICAgIHZvaWQgdGhpcy5yZXBsYWNlV2l0aENhcmQoZW1iZWQsIHNyYywgY3R4KS5jYXRjaCgoZXJyKSA9PlxyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbYXRvbWljLWNhcmRzXSBcdTZFMzJcdTY3RDNcdTUzNjFcdTcyNDdcdTU5MzFcdThEMjVcdUZGMUFcIiwgc3JjLCBlcnIpXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvLyBcdTVFMzhcdTg5QzRcdThGRDBcdTg4NENcdTRFMERcdTYyNTNcdTUzNzBcdUZGMENcdTYzOTJcdTY3RTVcdTY1RjZcdTU3MjhcdThCQkVcdTdGNkVcdTkxQ0NcdTYyNTNcdTVGMDBcdTMwMENcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcdTMwMERcclxuICAgIGlmICh0YWtlbiAmJiB0aGlzLnNldHRpbmdzLnZlcmJvc2UpIHtcclxuICAgICAgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBcdTVERjJcdTYzQTVcdTdCQTFcIiwgdGFrZW4sIFwiXHU1OTA0XHU1RDRDXHU1MTY1XCIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyByZXBsYWNlV2l0aENhcmQoXHJcbiAgICBlbWJlZDogSFRNTEVsZW1lbnQsXHJcbiAgICBzcmM6IHN0cmluZyxcclxuICAgIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dFxyXG4gICk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgZGVwdGggPSBnZXROZXN0KCk7XHJcbiAgICBjb25zdCBzaXplOiBTaXplID0gZGVwdGggPiAwID8gdGhpcy5zZXR0aW5ncy5uZXN0ZWRTaXplIDogXCJub3JtYWxcIjtcclxuICAgIGNvbnN0IGlzU21hbGwgPSBzaXplID09PSBcInNtYWxsXCI7XHJcblxyXG4gICAgY29uc3Qgb3B0czogUmVuZGVyT3B0aW9ucyA9IHtcclxuICAgICAgc2l6ZSxcclxuICAgICAgZGVuc2l0eTogaXNTbWFsbCA/IFwiY29tcGFjdFwiIDogdGhpcy5zZXR0aW5ncy5kZW5zaXR5LFxyXG4gICAgICBsYXlvdXQ6IHRoaXMuc2V0dGluZ3MubGF5b3V0LFxyXG4gICAgICBjb3ZlcjogdGhpcy5zZXR0aW5ncy5zaG93Q292ZXIsXHJcbiAgICAgIG1ldGE6IGlzU21hbGwgPyBmYWxzZSA6IHRoaXMuc2V0dGluZ3Muc2hvd01ldGEsXHJcbiAgICAgIHRhZ3M6IGlzU21hbGwgPyBmYWxzZSA6IHRoaXMuc2V0dGluZ3Muc2hvd1RhZ3MsXHJcbiAgICAgIC8vIFx1NjgwN1x1OTg5OFx1NjYyRlx1NjI5OFx1NTNFMFx1NUYwMFx1NTE3M1x1RkYwQ1wiXHU2MjUzXHU1RjAwXCJcdTYzMDlcdTk0QUVcdTY2MkZcdTU1MkZcdTRFMDBcdTc2ODRcdThERjNcdThGNkNcdTUxNjVcdTUzRTNcclxuICAgICAgb3BlbjogaXNTbWFsbCA/IHRydWUgOiB0aGlzLnNldHRpbmdzLnNob3dPcGVuQnV0dG9uLFxyXG4gICAgICBleHBhbmRlZDogZGVwdGggPiAwID8gdGhpcy5zZXR0aW5ncy5uZXN0ZWRFeHBhbmRlZCA6IHRoaXMuc2V0dGluZ3MuZGVmYXVsdEV4cGFuZGVkLFxyXG4gICAgICBoZWlnaHQ6IHRoaXMuc2V0dGluZ3MuY2FyZEhlaWdodCxcclxuICAgICAgc3VtbWFyeTogaXNTbWFsbCA/IDkwIDogdGhpcy5zZXR0aW5ncy5zdW1tYXJ5TGVuZ3RoLFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBcdTYzMDJcdTU3MjhcdTZFMzhcdTc5QkJcdTgyODJcdTcwQjlcdTRFMEFcdUZGMUFcdTUzRUFcdTUwMUZcdTc1MjhcdTc1MUZcdTU0N0RcdTU0NjhcdTY3MUZcdUZGMENvbnVubG9hZCBcdTY1RjZcdTZFMDVcdTdBN0FcdTVCODNcdTRFMERcdTVGNzFcdTU0Q0RcdTY1ODdcdTY4NjNcclxuICAgIGNvbnN0IGhvbGRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgTWFya2Rvd25SZW5kZXJDaGlsZChob2xkZXIpO1xyXG4gICAgY29tcG9uZW50LmxvYWQoKTtcclxuICAgIGN0eC5hZGRDaGlsZChjb21wb25lbnQpO1xyXG5cclxuICAgIGNvbnN0IGVudiA9IHtcclxuICAgICAgYXBwOiB0aGlzLmFwcCxcclxuICAgICAgc2V0dGluZ3M6IHRoaXMuc2V0dGluZ3MsXHJcbiAgICAgIHNvdXJjZVBhdGg6IGN0eC5zb3VyY2VQYXRoLFxyXG4gICAgICBjb21wb25lbnQsXHJcbiAgICAgIC8vICsxXHVGRjFBXHU1MzYxXHU3MjQ3XHU2QjYzXHU2NTg3XHU5MUNDXHU1MThEXHU2RTMyXHU2N0QzXHU3Njg0XHU1MTg1XHU1QkI5XHU1QzVFXHU0RThFXHU0RTBCXHU0RTAwXHU1QzQyXHVGRjBDXHU5MDEyXHU1ODlFXHU1NDBFXHU1RDRDXHU1OTU3XHU2REYxXHU1RUE2XHU0RTBBXHU5NjUwXHU2MjREXHU2NzA5XHU2NTQ4XHJcbiAgICAgIGRlcHRoOiBkZXB0aCArIDEsXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFx1MjZBMFx1RkUwRiBcdTUxNDhcdTU0MENcdTZCNjVcdTUzNjBcdTRGNEZcdTRGNERcdTdGNkVcdUZGMENcdTUxOERcdTVGMDJcdTZCNjVcdTc1MUZcdTYyMTBcdTc3MUZcdTZCNjNcdTc2ODRcdTUzNjFcdTcyNDdcdTMwMDJcclxuICAgIC8vIFx1NEU0Qlx1NTI0RFx1NjYyRiBhd2FpdCBcdTRFNEJcdTU0MEVcdTUxOEQgcmVwbGFjZVdpdGhcdUZGMENcdTRGNDYgcmVhZE5vdGVNZXRhIFx1NjYyRlx1NUYwMlx1NkI2NVx1NzY4NFx1RkYwQ1xyXG4gICAgLy8gXHU3QjQ5XHU1QjgzXHU4RkQ0XHU1NkRFXHU2NUY2IE9ic2lkaWFuIFx1NTNFRlx1ODBGRFx1NURGMlx1N0VDRlx1OTFDRFx1NUVGQVx1OEZDN1x1ODI4Mlx1NzBCOSBcdTIxOTIgZW1iZWQuaXNDb25uZWN0ZWQgXHU0RTNBIGZhbHNlIFx1MjE5MiBcdTUzNjFcdTcyNDdcdTRFMjJcdTU5MzFcdTMwMDJcclxuICAgIC8vIFx1NTE0OFx1NjUzRVx1NTM2MFx1NEY0RFx1NTE0M1x1N0QyMFx1NUMzMVx1NEUwRFx1NUI1OFx1NTcyOFx1OEZEOVx1NEUyQVx1N0FERVx1NjAwMVx1RkYxQVx1NTM2MFx1NEY0RFx1NTE0M1x1N0QyMFx1OTY4Rlx1NzIzNlx1ODI4Mlx1NzBCOVx1NEUwMFx1OEQ3N1x1NzU1OVx1NTcyOFx1NjU4N1x1Njg2M1x1OTFDQ1x1MzAwMlxyXG4gICAgY29uc3QgcGxhY2Vob2xkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgcGxhY2Vob2xkZXIuY2xhc3NOYW1lID0gXCJhYy1jYXJkIGFjLWNhcmQtLXBlbmRpbmdcIjtcclxuICAgIHBsYWNlaG9sZGVyLmRhdGFzZXQuYWNQYXRoID0gc3JjO1xyXG4gICAgcGxhY2Vob2xkZXIuc2V0VGV4dChzcmMuc3BsaXQoXCIvXCIpLnBvcCgpPy5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIikgPz8gc3JjKTtcclxuICAgIGVtYmVkLnJlcGxhY2VXaXRoKHBsYWNlaG9sZGVyKTtcclxuXHJcbiAgICAvLyBzcmMgXHU1RjYyXHU1OTgyIFwiXHU3QjE0XHU4QkIwXCJcdTMwMDFcIlx1N0IxNFx1OEJCMC5tZFwiXHUzMDAxXCJcdTdCMTRcdThCQjAjXHU2ODA3XHU5ODk4XCJcdTMwMDFcIlx1N0IxNFx1OEJCMCNeXHU1NzU3aWRcIlxyXG4gICAgY29uc3QgdGFyZ2V0ID0gc3JjLnJlcGxhY2UoL1xcLm1kKD89I3wkKS9pLCBcIlwiKTtcclxuICAgIGNvbnN0IG1ldGEgPSBhd2FpdCByZWFkTm90ZU1ldGEodGhpcy5hcHAsIHRhcmdldCwgY3R4LnNvdXJjZVBhdGgsIHRoaXMuc2V0dGluZ3MpO1xyXG5cclxuICAgIGNvbnN0IGNhcmQgPSB3aXRoTmVzdChkZXB0aCwgKCkgPT4gcmVuZGVyQ2FyZChlbnYsIG1ldGEsIG9wdHMpKTtcclxuICAgIHBsYWNlaG9sZGVyLnJlcGxhY2VXaXRoKGNhcmQpO1xyXG4gIH1cclxuXHJcbiAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgKiBcdTYyRDZcdTY1M0VcdUZGMUFcdThCQTlcIlx1NjJENlx1N0IxNFx1OEJCMFx1OEZEQlx1Njc2NVwiXHU5RUQ4XHU4QkE0XHU1Rjk3XHU1MjMwXHU1RDRDXHU1MTY1ICFbWyBdXVxyXG4gICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuICBwcml2YXRlIG9uRG9tRHJvcChldnQ6IERyYWdFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLmVtYmVkT25Ecm9wKSByZXR1cm47XHJcblxyXG4gICAgLy8gXHU2NUU1XHU1RkQ3XHU1RkM1XHU5ODdCXHU2MjUzXHU1NzI4XHU2NzAwXHU1MjREXHU5NzYyXHVGRjFBXHU1NDI2XHU1MjE5XHU2NUUwXHU2Q0Q1XHU1MzNBXHU1MjA2XCJcdTRFOEJcdTRFRjZcdTZDQTFcdTg5RTZcdTUzRDFcIlx1NTQ4Q1wiXHU4OEFCXHU0RTBCXHU5NzYyXHU3Njg0XHU1MjI0XHU2NUFEXHU2MzIxXHU2Mzg5XHU0RTg2XCJcclxuICAgIGNvbnN0IHQgPSBldnQudGFyZ2V0O1xyXG4gICAgaWYgKHRoaXMuc2V0dGluZ3MudmVyYm9zZSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIGRvbSBkcm9wOlwiLCB7XHJcbiAgICAgICAgdGFyZ2V0OiB0IGluc3RhbmNlb2YgRWxlbWVudCA/IGAke3QudGFnTmFtZX0uJHt0LmNsYXNzTmFtZX1gIDogU3RyaW5nKHQpLFxyXG4gICAgICAgIGluRWRpdG9yOiAhISh0IGluc3RhbmNlb2YgRWxlbWVudCAmJiB0LmNsb3Nlc3QoXCIubWFya2Rvd24tc291cmNlLXZpZXcsIC5jbS1lZGl0b3IsIC5jbS1jb250ZW50XCIpKSxcclxuICAgICAgICB0eXBlczogZXZ0LmRhdGFUcmFuc2ZlciA/IEFycmF5LmZyb20oZXZ0LmRhdGFUcmFuc2Zlci50eXBlcykgOiBudWxsLFxyXG4gICAgICAgIHRleHQ6IGV2dC5kYXRhVHJhbnNmZXI/LmdldERhdGEoXCJ0ZXh0L3BsYWluXCIpID8/IFwiXCIsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFx1MjZBMFx1RkUwRiBcdTRFMERcdTgwRkRcdTc1MjggYWN0aXZlRWRpdG9yKClcdUZGMUFcdTYyRDZcdTYyRkRcdTY1RjZcdTZEM0JcdTUyQThcdTg5QzZcdTU2RkVcdTVGODBcdTVGODBcdThGRDhcdTUwNUNcdTU3MjhcdTY1ODdcdTRFRjZcdThENDRcdTZFOTBcdTdCQTFcdTc0MDZcdTU2NjhcdUZGMDhcdTYyRDZcdTYyRkRcdTZFOTBcdUZGMDlcdUZGMENcclxuICAgIC8vICAgIFx1NTNENlx1NEUwRFx1NTIzMFx1NzZFRVx1NjgwN1x1N0YxNlx1OEY5MVx1NTY2OFx1MzAwMlx1ODk4MVx1NEVDRSBkcm9wIFx1NzY4NFx1NzZFRVx1NjgwN1x1NTE0M1x1N0QyMFx1NTNDRFx1NjdFNVx1NUI4M1x1NUM1RVx1NEU4RVx1NTRFQVx1NEUyQVx1N0YxNlx1OEY5MVx1NTY2OFx1MzAwMlxyXG4gICAgY29uc3QgZWRpdG9yID0gdGhpcy5lZGl0b3JGcm9tRHJvcChldnQpID8/IHRoaXMuYWN0aXZlRWRpdG9yKCk7XHJcbiAgICBpZiAoIWVkaXRvcikge1xyXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy52ZXJib3NlKSBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIFx1NjI3RVx1NEUwRFx1NTIzMFx1NzZFRVx1NjgwN1x1N0YxNlx1OEY5MVx1NTY2OFwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFx1NEUwRFx1OTYzQlx1NkI2Mlx1OUVEOFx1OEJBNFx1ODg0Q1x1NEUzQVx1RkYxQVx1OEJBOSBPYnNpZGlhbiBcdTZCNjNcdTVFMzhcdTYzRDJcdTUxNjVcdTk0RkVcdTYzQTVcdUZGMENcdTdBMERcdTU0MEVcdTY1MzlcdTUxOTlcdTYyMTAgIVtbXHU3QjE0XHU4QkIwXV1cdTMwMDJcclxuICAgIC8vIE9ic2lkaWFuIFx1NjNEMlx1NTE2NVx1NTNFRlx1ODBGRFx1NjYyRlx1NUYwMlx1NkI2NVx1NzY4NFx1RkYwQ1x1NTIwNlx1NTFFMFx1NkIyMVx1OEJENVx1NjNBMlx1RkYwOFx1NjUzOVx1NTE5OVx1OEZDN1x1NUMzMVx1NEUwRFx1NEYxQVx1NTE4RFx1NTMzOVx1OTE0RFx1RkYwQ1x1NUI4OVx1NTE2OFx1RkYwOVx1MzAwMlxyXG4gICAgZm9yIChjb25zdCBkZWxheSBvZiBbODAsIDI1MCwgNjAwXSkge1xyXG4gICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0aGlzLmxpbmtUb0VtYmVkQXRDdXJzb3IoZWRpdG9yKSwgZGVsYXkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqIFx1NEVDRVx1NjJENlx1NjUzRVx1NzZFRVx1NjgwN1x1NTE0M1x1N0QyMFx1NTNDRFx1NjdFNVx1NjI0MFx1NUM1RVx1N0YxNlx1OEY5MVx1NTY2OFx1NzY4NCBFZGl0b3IgXHU1QjlFXHU0RjhCICovXHJcbiAgcHJpdmF0ZSBlZGl0b3JGcm9tRHJvcChldnQ6IERyYWdFdmVudCk6IEVkaXRvciB8IG51bGwge1xyXG4gICAgY29uc3QgdGFyZ2V0ID0gZXZ0LnRhcmdldDtcclxuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIEVsZW1lbnQpKSByZXR1cm4gbnVsbDtcclxuICAgIC8vIFx1NzUyOFx1NjU3MFx1N0VDNFx1NjUzNlx1OTZDNlx1RkYxQVx1OTVFRFx1NTMwNVx1OTFDQ1x1N0VEOSBsZXQgXHU1M0Q4XHU5MUNGXHU4RDRCXHU1MDNDXHU0RjFBXHU4OEFCIFRTIFx1NjUzNlx1N0E4NFx1NjIxMCBuZXZlclxyXG4gICAgY29uc3QgaGl0czogTWFya2Rvd25WaWV3W10gPSBbXTtcclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5pdGVyYXRlQWxsTGVhdmVzKChsZWFmKSA9PiB7XHJcbiAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XHJcbiAgICAgIGlmICh2aWV3IGluc3RhbmNlb2YgTWFya2Rvd25WaWV3ICYmIHZpZXcuY29udGFpbmVyRWwuY29udGFpbnModGFyZ2V0KSkgaGl0cy5wdXNoKHZpZXcpO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gaGl0c1swXT8uZWRpdG9yID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBcdTYyOEFcdTUxNDlcdTY4MDdcdTUyNERcdTUyMUFcdTYzRDJcdTUxNjVcdTc2ODRcdTk0RkVcdTYzQTVcdTVDMzFcdTU3MzBcdTY1MzlcdTUxOTlcdTYyMTAgIVtbXHU3QjE0XHU4QkIwXV1cdTMwMDJcclxuICAgKiBcdTYyRDYgT2JzaWRpYW4gXHU1MTg1XHU5MEU4XHU2NTg3XHU0RUY2XHU2NUY2XHVGRjBDXHU1MzlGXHU3NTFGXHU1M0VGXHU4MEZEXHU2M0QyXHU1MTY1XHU0RTA5XHU3OUNEXHU1RjYyXHU2MDAxXHVGRjBDXHU5MEZEXHU4OTgxXHU4QkE0XHVGRjFBXHJcbiAgICogICBcdTI0NjAgW1tcdTdCMTRcdThCQjBdXSAgICAgICAgICAgICAgIFx1RkYwOHdpa2lsaW5rIFx1OEJCRVx1N0Y2RVx1RkYwOVxyXG4gICAqICAgXHUyNDYxIFtcdTY4MDdcdTk4OThdKG9ic2lkaWFuOi8vXHUyMDI2KSAgIFx1RkYwOFx1NUI5RVx1NkQ0Qlx1OUVEOFx1OEJBNFx1OEQ3MFx1OEZEOVx1NzlDRFx1RkYwQ2RhdGFUcmFuc2ZlciBcdTkxQ0NcdTY2MkYgb2JzaWRpYW46Ly8gVVJMXHVGRjA5XHJcbiAgICogICBcdTI0NjIgb2JzaWRpYW46Ly9cdTIwMjYgXHU4OEY4XHU5NEZFXHU2M0E1XHJcbiAgICogXHU5MEZEXHU0RTBEXHU2NjJGXHU1QzMxXHU1MzlGXHU2ODM3XHU2NTNFXHU4RkM3XHVGRjBDXHU5MDdGXHU1MTREXHU4QkVGXHU0RjI0XHU2MkQ2XHU1NkZFXHU3MjQ3IC8gXHU1OTE2XHU5MEU4XHU2NTg3XHU2NzJDXHUzMDAyXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBsaW5rVG9FbWJlZEF0Q3Vyc29yKGVkaXRvcjogRWRpdG9yKTogdm9pZCB7XHJcbiAgICBjb25zdCBjdXIgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XHJcbiAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUoY3VyLmxpbmUpID8/IFwiXCI7XHJcbiAgICBjb25zdCBoZWFkID0gbGluZS5zbGljZSgwLCBjdXIuY2gpO1xyXG5cclxuICAgIGlmICh0aGlzLnNldHRpbmdzLnZlcmJvc2UpIHtcclxuICAgICAgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBcdTUxNDlcdTY4MDdcdTUyNERcdTY1ODdcdTY3MkNcdUZGMUFcIiwgSlNPTi5zdHJpbmdpZnkoaGVhZC5zbGljZSgtMTIwKSkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlcGxhY2UgPSAobWF0Y2hlZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcpID0+IHtcclxuICAgICAgY29uc3QgZnJvbSA9IHsgbGluZTogY3VyLmxpbmUsIGNoOiBjdXIuY2ggLSBtYXRjaGVkLmxlbmd0aCB9O1xyXG4gICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKGAhW1ske25hbWV9XV1gLCBmcm9tLCBjdXIpO1xyXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy52ZXJib3NlKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBcdTk0RkVcdTYzQTVcdTY1MzlcdTUxOTlcdTRFM0FcdTVENENcdTUxNjVcdUZGMUFcIiwgbWF0Y2hlZCwgXCJcdTIxOTJcIiwgYCFbWyR7bmFtZX1dXWApO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFx1MjQ2MCB3aWtpbGlua1x1RkYwOFx1NEUxNFx1NTI0RFx1OTc2Mlx1NEUwRFx1NjYyRiAhXHVGRjBDXHU5MDdGXHU1MTREXHU5MUNEXHU1OTBEXHU2NTM5XHU1MTk5XHVGRjA5XHJcbiAgICBjb25zdCB3aWtpID0gaGVhZC5tYXRjaCgvKD86XnxbXiFdKShcXFtcXFtbXlxcXV0rXFxdXFxdKSQvKTtcclxuICAgIGlmICh3aWtpKSB7XHJcbiAgICAgIGNvbnN0IGlubmVyID0gd2lraVsxXS5zbGljZSgyLCAtMikuc3BsaXQoXCJ8XCIpWzBdLnRyaW0oKTtcclxuICAgICAgaWYgKGlubmVyKSB7XHJcbiAgICAgICAgcmVwbGFjZSh3aWtpWzFdLCBpbm5lcik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHUyNDYxIG1hcmtkb3duIFx1OTRGRVx1NjNBNVx1RkYwQ2hyZWYgXHU2NjJGIG9ic2lkaWFuOi8vIFVSTFxyXG4gICAgY29uc3QgbWQgPSBoZWFkLm1hdGNoKC9cXFtbXlxcXV0qXFxdXFwoKFteKV0rKVxcKSQvKTtcclxuICAgIGlmIChtZCkge1xyXG4gICAgICBjb25zdCBuYW1lID0gdGhpcy5ub3RlTmFtZUZyb21PYnNpZGlhblVybChtZFsxXSk7XHJcbiAgICAgIGlmIChuYW1lKSB7XHJcbiAgICAgICAgcmVwbGFjZShtZFswXSwgbmFtZSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBcdTI0NjIgXHU4OEY4IG9ic2lkaWFuOi8vIFx1OTRGRVx1NjNBNVxyXG4gICAgY29uc3QgYmFyZSA9IGhlYWQubWF0Y2goLyhvYnNpZGlhbjpcXC9cXC9cXFMrKSQvKTtcclxuICAgIGlmIChiYXJlKSB7XHJcbiAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLm5vdGVOYW1lRnJvbU9ic2lkaWFuVXJsKGJhcmVbMV0pO1xyXG4gICAgICBpZiAobmFtZSkgcmVwbGFjZShiYXJlWzFdLCBuYW1lKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKiBcdTRFQ0Ugb2JzaWRpYW46Ly9vcGVuP3ZhdWx0PVgmZmlsZT08cGF0aD4gXHU5MUNDXHU1M0Q2XHU1MUZBXHU3QjE0XHU4QkIwXHU1NDBEXHVGRjA4XHU1M0JCXHU2Mzg5XHU2NTg3XHU0RUY2XHU1OTM5XHU0RTBFIC5tZFx1RkYwOSAqL1xyXG4gIHByaXZhdGUgbm90ZU5hbWVGcm9tT2JzaWRpYW5VcmwodXJsOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHUgPSBuZXcgVVJMKHVybCk7XHJcbiAgICAgIGNvbnN0IGZpbGUgPSB1LnNlYXJjaFBhcmFtcy5nZXQoXCJmaWxlXCIpO1xyXG4gICAgICBpZiAoIWZpbGUpIHJldHVybiBudWxsO1xyXG4gICAgICBjb25zdCBkZWNvZGVkID0gZGVjb2RlVVJJQ29tcG9uZW50KGZpbGUpO1xyXG4gICAgICBjb25zdCBiYXNlID0gZGVjb2RlZC5zcGxpdChcIi9cIikucG9wKCk/LnJlcGxhY2UoL1xcLm1kJC9pLCBcIlwiKS50cmltKCkgPz8gXCJcIjtcclxuICAgICAgcmV0dXJuIGJhc2UgfHwgbnVsbDtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICogXHU1NDdEXHU0RUU0XHJcbiAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG4gIHByaXZhdGUgYWN0aXZlRWRpdG9yKCk6IEVkaXRvciB8IG51bGwge1xyXG4gICAgY29uc3QgdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICByZXR1cm4gdmlldz8uZWRpdG9yID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZ2lzdGVyQ29tbWFuZHMoKTogdm9pZCB7XHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJsaW5rcy10by1lbWJlZHNcIixcclxuICAgICAgbmFtZTogXCJcdTYyOEFcdTkwMDlcdTUzM0FcdTkxQ0NcdTc2ODQgW1tcdTk0RkVcdTYzQTVdXSBcdThGNkNcdTYyMTBcdTVENENcdTUxNjVcdTUyMTdcdTg4NjhcIixcclxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4gdGhpcy5saW5rc1RvRW1iZWRzKGVkaXRvciksXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJpbnNlcnQtcmV2ZXJzZS1lbWJlZHNcIixcclxuICAgICAgbmFtZTogXCJcdTYzRDJcdTUxNjVcdTUzQ0RcdTY3RTVcdTUyMTdcdTg4NjhcdUZGMDhcdTVGMTVcdTc1MjhcdTY3MkNcdTY1ODdcdTc2ODRcdTdCMTRcdThCQjBcdUZGMENcdTc1MUZcdTYyMTBcdTRFM0FcdTVENENcdTUxNjVcdUZGMDlcIixcclxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4gdGhpcy5pbnNlcnRSZXZlcnNlRW1iZWRzKGVkaXRvciksXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJ0b2dnbGUtYWxsLWNhcmRzXCIsXHJcbiAgICAgIG5hbWU6IFwiXHU1QzU1XHU1RjAwIC8gXHU2NTM2XHU4RDc3XHU2NzJDXHU5ODc1XHU2MjQwXHU2NzA5XHU1MzYxXHU3MjQ3XCIsXHJcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgY2FyZHMgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiLmFjLWNhcmRcIikpO1xyXG4gICAgICAgIGlmICghY2FyZHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICBuZXcgTm90aWNlKFwiXHU1RjUzXHU1MjREXHU4OUM2XHU1NkZFXHU5MUNDXHU2Q0ExXHU2NzA5XHU1MzYxXHU3MjQ3XCIpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBjb2xsYXBzZWQgPSBjYXJkcy5maWx0ZXIoKGMpID0+ICFjLmNsYXNzTGlzdC5jb250YWlucyhcImlzLWV4cGFuZGVkXCIpKTtcclxuICAgICAgICBjb25zdCB0YXJnZXRzID0gY29sbGFwc2VkLmxlbmd0aCA/IGNvbGxhcHNlZCA6IGNhcmRzO1xyXG4gICAgICAgIGZvciAoY29uc3QgYyBvZiB0YXJnZXRzKSBjLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFwiLmFjLWJ0bi0tdG9nZ2xlXCIpPy5jbGljaygpO1xyXG4gICAgICAgIG5ldyBOb3RpY2UoY29sbGFwc2VkLmxlbmd0aCA/IGBcdTVERjJcdTVDNTVcdTVGMDAgJHt0YXJnZXRzLmxlbmd0aH0gXHU1RjIwXHU1MzYxXHU3MjQ3YCA6IGBcdTVERjJcdTY1MzZcdThENzcgJHt0YXJnZXRzLmxlbmd0aH0gXHU1RjIwXHU1MzYxXHU3MjQ3YCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKiBcdTkwMDlcdTUzM0FcdTkxQ0NcdTc2ODQgW1tcdTk0RkVcdTYzQTVdXSBcdTIxOTIgXHU1MzlGXHU3NTFGXHU1RDRDXHU1MTY1XHU1MjE3XHU4ODY4IGAtICFbW1x1OTRGRVx1NjNBNV1dYCAqL1xyXG4gIHByaXZhdGUgbGlua3NUb0VtYmVkcyhlZGl0b3I6IEVkaXRvcik6IHZvaWQge1xyXG4gICAgY29uc3Qgc2VsID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xyXG4gICAgaWYgKCFzZWwudHJpbSgpKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJcdThCRjdcdTUxNDhcdTkwMDlcdTRFMkRcdTUzMDVcdTU0MkIgW1tcdTk0RkVcdTYzQTVdXSBcdTc2ODRcdTY1ODdcdTY3MkNcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IHJlID0gL1xcW1xcWyhbXlxcXXwjXSspKD86I1teXFxdfF0qKT8oPzpcXHxbXlxcXV0qKT9cXF1cXF0vZztcclxuICAgIGNvbnN0IGZvdW5kOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgbGV0IG06IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XHJcbiAgICB3aGlsZSAoKG0gPSByZS5leGVjKHNlbCkpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHQgPSBtWzFdLnRyaW0oKTtcclxuICAgICAgaWYgKHQgJiYgIWZvdW5kLmluY2x1ZGVzKHQpKSBmb3VuZC5wdXNoKHQpO1xyXG4gICAgfVxyXG4gICAgaWYgKCFmb3VuZC5sZW5ndGgpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlx1OTAwOVx1NTMzQVx1OTFDQ1x1NkNBMVx1NjcwOSBbW1x1OTRGRVx1NjNBNV1dXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbihmb3VuZC5tYXAoKHQpID0+IGAtICFbWyR7dH1dXWApLmpvaW4oXCJcXG5cIikpO1xyXG4gICAgbmV3IE5vdGljZShgXHU1REYyXHU2M0QyXHU1MTY1ICR7Zm91bmQubGVuZ3RofSBcdTU5MDRcdTVENENcdTUxNjVgKTtcclxuICB9XHJcblxyXG4gIC8qKiBcdTUzQ0RcdTY3RTVcdUZGMUFcdTYyOEFcdTVGMTVcdTc1MjhcdTRFODZcdTY3MkNcdTY1ODdcdTc2ODRcdTdCMTRcdThCQjBcdTRFRTVcdTUzOUZcdTc1MUZcdTVENENcdTUxNjVcdTUyMTdcdTg4NjhcdTYzRDJcdTUxNjVcdUZGMDhcdTk3NTlcdTYwMDFcdTdFRDNcdTY3OUNcdUZGMENcdTRFMERcdTY2MkZcdTUyQThcdTYwMDFcdTZFMzJcdTY3RDNcdUZGMDkgKi9cclxuICBwcml2YXRlIGluc2VydFJldmVyc2VFbWJlZHMoZWRpdG9yOiBFZGl0b3IpOiB2b2lkIHtcclxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xyXG4gICAgaWYgKCFmaWxlKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJcdTVGNTNcdTUyNERcdTZDQTFcdTY3MDlcdTYyNTNcdTVGMDBcdTc2ODRcdTY1ODdcdTRFRjZcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IGxpbmtzID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5yZXNvbHZlZExpbmtzO1xyXG4gICAgY29uc3QgcmVmcyA9IE9iamVjdC5rZXlzKGxpbmtzKS5maWx0ZXIoKHNyYykgPT4gbGlua3Nbc3JjXT8uW2ZpbGUucGF0aF0pO1xyXG4gICAgaWYgKCFyZWZzLmxlbmd0aCkge1xyXG4gICAgICBuZXcgTm90aWNlKFwiXHU2Q0ExXHU2NzA5XHU3QjE0XHU4QkIwXHU1RjE1XHU3NTI4XHU2NzJDXHU2NTg3XCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCB0ZXh0ID0gYFx1ODhBQlx1NUYxNVx1NzUyOFx1NTcyOFx1RkYxQVxcblxcbiR7cmVmc1xyXG4gICAgICAubWFwKChyKSA9PiBgLSAhW1ske3IucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpfV1dYClcclxuICAgICAgLmpvaW4oXCJcXG5cIil9XFxuYDtcclxuICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UodGV4dCwgZWRpdG9yLmdldEN1cnNvcigpKTtcclxuICAgIG5ldyBOb3RpY2UoYFx1NURGMlx1NjNEMlx1NTE2NSAke3JlZnMubGVuZ3RofSBcdTY3NjFcdTVGMTVcdTc1MjhgKTtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCB7IEFwcCwgQ29tcG9uZW50LCBOb3RpY2UsIHNldEljb24gfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuaW1wb3J0IHsgTm90ZU1ldGEsIHJlbmRlck1hcmtkb3duIH0gZnJvbSBcIi4vbWV0YWRhdGFcIjtcclxuaW1wb3J0IHsgQXRvbWljQ2FyZHNTZXR0aW5ncywgUmVuZGVyT3B0aW9ucyB9IGZyb20gXCIuL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENhcmRFbnYge1xyXG4gIGFwcDogQXBwO1xyXG4gIHNldHRpbmdzOiBBdG9taWNDYXJkc1NldHRpbmdzO1xyXG4gIHNvdXJjZVBhdGg6IHN0cmluZztcclxuICBjb21wb25lbnQ6IENvbXBvbmVudDtcclxuICAvKiogXHU1RjUzXHU1MjREXHU1RDRDXHU1OTU3XHU1QzQyXHU3RUE3XHVGRjBDXHU3NTI4XHU0RThFXHU5MDEyXHU1RjUyXHU2RTMyXHU2N0QzXHU2NUY2XHU5NjUwXHU1MjM2XHU2REYxXHU1RUE2ICovXHJcbiAgZGVwdGg6IG51bWJlcjtcclxufVxyXG5cclxubGV0IG5lc3RNYXJrZXIgPSAwO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldE5lc3QoKTogbnVtYmVyIHtcclxuICByZXR1cm4gbmVzdE1hcmtlcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdpdGhOZXN0PFQ+KGRlcHRoOiBudW1iZXIsIGZuOiAoKSA9PiBUKTogVCB7XHJcbiAgY29uc3QgcHJldiA9IG5lc3RNYXJrZXI7XHJcbiAgbmVzdE1hcmtlciA9IGRlcHRoO1xyXG4gIHRyeSB7XHJcbiAgICByZXR1cm4gZm4oKTtcclxuICB9IGZpbmFsbHkge1xyXG4gICAgbmVzdE1hcmtlciA9IHByZXY7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBmbXRDb3VudChuOiBudW1iZXIpOiBzdHJpbmcge1xyXG4gIHJldHVybiBuID49IDEwMDAgPyBgJHsobiAvIDEwMDApLnRvRml4ZWQoMSl9ayBcdTVCNTdgIDogYCR7bn0gXHU1QjU3YDtcclxufVxyXG5cclxuLyoqIFx1NkNBMVx1NjcwOVx1NUMwMVx1OTc2Mlx1NjVGNlx1RkYwQ1x1NzUyOFx1N0M3Qlx1NTc4Qi9cdThERUZcdTVGODRcdTYzQThcdTY1QURcdTRFMDBcdTRFMkFcdTU2RkVcdTY4MDcgKi9cclxuZnVuY3Rpb24gaWNvbkZvcihtZXRhOiBOb3RlTWV0YSk6IHN0cmluZyB7XHJcbiAgLy8gXHU2QkI1XHU4NDNEIC8gXHU3N0U1XHU4QkM2XHU3MEI5XHU3RUE3XHU1RjE1XHU3NTI4XHJcbiAgaWYgKG1ldGEuYmxvY2tDb250ZW50KSByZXR1cm4gXCJxdW90ZVwiO1xyXG4gIGNvbnN0IHR5cGUgPSAobWV0YS5iYWRnZXMuZmluZCgoYikgPT4gYi5rZXkgPT09IFwidHlwZVwiKT8udmFsdWUgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcclxuICBjb25zdCBoYXkgPSBgJHt0eXBlfSAke21ldGEuZmlsZT8ucGF0aCA/PyBtZXRhLnRhcmdldH1gLnRvTG93ZXJDYXNlKCk7XHJcbiAgaWYgKC9jaGFwdGVyfFx1N0FFMFx1ODI4MnxcdTdFQzRcdTU0MDgvLnRlc3QoaGF5KSkgcmV0dXJuIFwibGF5ZXJzXCI7XHJcbiAgaWYgKC9jb25jZXB0fFx1Njk4Mlx1NUZGNS8udGVzdChoYXkpKSByZXR1cm4gXCJsaWdodGJ1bGJcIjtcclxuICBpZiAoL2VudGl0eXxcdTVCOUVcdTRGNTMvLnRlc3QoaGF5KSkgcmV0dXJuIFwidXNlclwiO1xyXG4gIGlmICgvcmVzb3VyY2V8XHU4RDQ0XHU2RTkwLy50ZXN0KGhheSkpIHJldHVybiBcInBhY2thZ2VcIjtcclxuICBpZiAoL2dvYWx8XHU3NkVFXHU2ODA3Ly50ZXN0KGhheSkpIHJldHVybiBcInRhcmdldFwiO1xyXG4gIGlmICgvbWV0YXxkYXNoYm9hcmR8aW5kZXgvLnRlc3QoaGF5KSkgcmV0dXJuIFwibGF5b3V0LWdyaWRcIjtcclxuICBpZiAoL2F0b218XHU1MzlGXHU1QjUwLy50ZXN0KGhheSkpIHJldHVybiBcImNpcmNsZS1kb3RcIjtcclxuICByZXR1cm4gXCJmaWxlLXRleHRcIjtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gb3Blbk5vdGUoZW52OiBDYXJkRW52LCBtZXRhOiBOb3RlTWV0YSwgZTogTW91c2VFdmVudCkge1xyXG4gIGlmICghbWV0YS5maWxlKSB7XHJcbiAgICBjb25zdCBuYW1lID0gbWV0YS50YXJnZXQuc3BsaXQoXCIjXCIpWzBdLnJlcGxhY2UoL1xcLm1kJC9pLCBcIlwiKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBlbnYuYXBwLnZhdWx0LmNyZWF0ZShcclxuICAgICAgICBgJHtuYW1lfS5tZGAsXHJcbiAgICAgICAgYC0tLVxcbnR5cGU6IGF0b21cXG50aXRsZTogXCIke21ldGEudGl0bGV9XCJcXG5jcmVhdGVkOiAke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCl9XFxuLS0tXFxuXFxuIyAke21ldGEudGl0bGV9XFxuXFxuYFxyXG4gICAgICApO1xyXG4gICAgICBhd2FpdCBlbnYuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCBlbnYuc291cmNlUGF0aCwgZmFsc2UpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoYFx1NTIxQlx1NUVGQVx1NTkzMVx1OEQyNVx1RkYxQSR7U3RyaW5nKGVycil9YCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIGNvbnN0IG5ld0xlYWYgPSBlLmN0cmxLZXkgfHwgZS5tZXRhS2V5IHx8IGUuYnV0dG9uID09PSAxO1xyXG4gIC8vIHRhcmdldCBcdTUzRUZcdTgwRkRcdTVFMjYgI1x1NjgwN1x1OTg5OCAvICNeXHU1NzU3aWRcdUZGMENcdTRFQTRcdTdFRDkgT2JzaWRpYW4gXHU1QjlBXHU0RjREXHU1MjMwXHU2QkI1XHU4NDNEXHJcbiAgYXdhaXQgZW52LmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KG1ldGEudGFyZ2V0IHx8IG1ldGEuZmlsZS5wYXRoLCBlbnYuc291cmNlUGF0aCwgbmV3TGVhZik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhyZWZPZihtZXRhOiBOb3RlTWV0YSk6IHN0cmluZyB7XHJcbiAgaWYgKCFtZXRhLmZpbGUpIHJldHVybiBcIiNcIjtcclxuICByZXR1cm4gbWV0YS5yZWYgPyBgJHttZXRhLmZpbGUucGF0aH0jJHttZXRhLnJlZn1gIDogbWV0YS5maWxlLnBhdGg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJ1aWxkTWV0YVJvdyhtZXRhOiBOb3RlTWV0YSk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XHJcbiAgaWYgKCFtZXRhLmJhZGdlcy5sZW5ndGggJiYgIW1ldGEudXBkYXRlZCAmJiAhbWV0YS53b3JkQ291bnQpIHJldHVybiBudWxsO1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgcm93LmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fbWV0YVwiO1xyXG4gIGZvciAoY29uc3QgYiBvZiBtZXRhLmJhZGdlcy5zbGljZSgwLCAyKSkge1xyXG4gICAgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IGBhYy1iYWRnZSBhYy1iYWRnZS0tJHtiLmtleX1gLCB0ZXh0OiBiLnZhbHVlIH0pO1xyXG4gIH1cclxuICBpZiAobWV0YS51cGRhdGVkKSByb3cuY3JlYXRlU3Bhbih7IGNsczogXCJhYy1tZXRhX19kYXRlXCIsIHRleHQ6IG1ldGEudXBkYXRlZCB9KTtcclxuICBpZiAobWV0YS53b3JkQ291bnQpIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLW1ldGFfX3dvcmRzXCIsIHRleHQ6IGZtdENvdW50KG1ldGEud29yZENvdW50KSB9KTtcclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZFRhZ1JvdyhtZXRhOiBOb3RlTWV0YSwgbGltaXQ6IG51bWJlcik6IEhUTUxFbGVtZW50IHwgbnVsbCB7XHJcbiAgaWYgKCFtZXRhLnRhZ3MubGVuZ3RoKSByZXR1cm4gbnVsbDtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSBcImFjLWNhcmRfX3RhZ3NcIjtcclxuICBmb3IgKGNvbnN0IHQgb2YgbWV0YS50YWdzLnNsaWNlKDAsIGxpbWl0KSkgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtdGFnXCIsIHRleHQ6IGAjJHt0fWAgfSk7XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckNhcmQoZW52OiBDYXJkRW52LCBtZXRhOiBOb3RlTWV0YSwgb3B0czogUmVuZGVyT3B0aW9ucyk6IEhUTUxFbGVtZW50IHtcclxuICBjb25zdCBpc1dyYXAgPSBvcHRzLmxheW91dCAhPT0gXCJjYXJkXCI7XHJcbiAgY29uc3QgaXNTbWFsbCA9IG9wdHMuc2l6ZSA9PT0gXCJzbWFsbFwiO1xyXG5cclxuICBjb25zdCBjYXJkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICBjYXJkLmNsYXNzTmFtZSA9IGBhYy1jYXJkIGFjLSR7b3B0cy5kZW5zaXR5fSBhYy1zaXplLSR7b3B0cy5zaXplfSBhYy0ke1xyXG4gICAgaXNXcmFwID8gXCJ3cmFwXCIgOiBcImNhcmRzdHlsZVwiXHJcbiAgfWA7XHJcbiAgY2FyZC5kYXRhc2V0LnBhdGggPSBtZXRhLmZpbGU/LnBhdGggPz8gbWV0YS50YXJnZXQ7XHJcbiAgaWYgKCFtZXRhLmZpbGUpIGNhcmQuY2xhc3NMaXN0LmFkZChcImlzLW1pc3NpbmdcIik7XHJcbiAgaWYgKG1ldGEuYmxvY2tDb250ZW50KSBjYXJkLmNsYXNzTGlzdC5hZGQoXCJpcy1ibG9ja1wiKTtcclxuICBpZiAob3B0cy5oZWlnaHQgPiAwKSBjYXJkLnN0eWxlLnNldFByb3BlcnR5KFwiLS1hYy1jYXJkLWhcIiwgYCR7b3B0cy5oZWlnaHR9cHhgKTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTZCNjNcdTY1ODdcdTVCQjlcdTU2NjhcdUZGMDhcdTUxNDhcdTVFRkFcdUZGMENcdTY3MDBcdTU0MEUgYXBwZW5kXHVGRjA5IC0tLS0tLS0tLS0gKi9cclxuICBjb25zdCBib2R5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICBib2R5LmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fYm9keVwiO1xyXG4gIGJvZHkuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gIGxldCBib2R5TG9hZGVkID0gZmFsc2U7XHJcblxyXG4gIGNvbnN0IGxvYWRCb2R5ID0gKCkgPT4ge1xyXG4gICAgaWYgKGJvZHlMb2FkZWQgfHwgIW1ldGEuZmlsZSkgcmV0dXJuO1xyXG4gICAgYm9keUxvYWRlZCA9IHRydWU7XHJcbiAgICBjb25zdCBmaWxlID0gbWV0YS5maWxlO1xyXG4gICAgdm9pZCBlbnYuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSkudGhlbigocmF3KSA9PiB7XHJcbiAgICAgIGNvbnN0IGZ1bGwgPSByYXcucmVwbGFjZSgvXi0tLVxccj9cXG5bXFxzXFxTXSo/XFxyP1xcbi0tLVxccj9cXG4/LywgXCJcIik7XHJcbiAgICAgIGNvbnN0IG1kID0gbWV0YS5ibG9ja0NvbnRlbnQgPz8gZnVsbDtcclxuICAgICAgYm9keS5lbXB0eSgpO1xyXG4gICAgICB3aXRoTmVzdChlbnYuZGVwdGgsICgpID0+IHtcclxuICAgICAgICByZW5kZXJNYXJrZG93bihlbnYuYXBwLCBtZCwgYm9keSwgZmlsZS5wYXRoLCBlbnYuY29tcG9uZW50KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1N0FENlx1NzI0OFx1NTM2MVx1NzI0Q1x1RkYxQVx1OTg3Nlx1OTBFOFx1NUMwMVx1OTc2MiAtLS0tLS0tLS0tICovXHJcbiAgaWYgKCFpc1dyYXAgJiYgb3B0cy5jb3ZlciAmJiBtZXRhLmNvdmVyKSB7XHJcbiAgICBjb25zdCBjb3ZlciA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWNhcmRfX2NvdmVyXCIgfSk7XHJcbiAgICBjb25zdCBpbWcgPSBjb3Zlci5jcmVhdGVFbChcImltZ1wiLCB7XHJcbiAgICAgIGF0dHI6IHsgc3JjOiBtZXRhLmNvdmVyLCBhbHQ6IG1ldGEudGl0bGUsIGxvYWRpbmc6IFwibGF6eVwiLCBkcmFnZ2FibGU6IFwiZmFsc2VcIiB9LFxyXG4gICAgfSk7XHJcbiAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsICgpID0+IGNvdmVyLnJlbW92ZSgpKTtcclxuICB9XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU1OTM0XHU5MEU4XHVGRjFBXHU1NkZFXHU2ODA3ICsgXHU2ODA3XHU5ODk4ICsgXHU2ODA3XHU3QjdFICsgXHU1RkJEXHU3QUUwICsgXHU2NENEXHU0RjVDXHVGRjBDXHU1MTY4XHU1NzI4XHU0RTAwXHU4ODRDIC0tLS0tLS0tLS0gKi9cclxuICBjb25zdCBoZWFkID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9faGVhZFwiIH0pO1xyXG5cclxuICBpZiAoaXNXcmFwKSB7XHJcbiAgICBjb25zdCB0aHVtYiA9IGhlYWQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWNhcmRfX3RodW1iXCIgfSk7XHJcbiAgICBpZiAob3B0cy5jb3ZlciAmJiBtZXRhLmNvdmVyKSB7XHJcbiAgICAgIGNvbnN0IGltZyA9IHRodW1iLmNyZWF0ZUVsKFwiaW1nXCIsIHtcclxuICAgICAgICBhdHRyOiB7IHNyYzogbWV0YS5jb3ZlciwgYWx0OiBtZXRhLnRpdGxlLCBsb2FkaW5nOiBcImxhenlcIiwgZHJhZ2dhYmxlOiBcImZhbHNlXCIgfSxcclxuICAgICAgfSk7XHJcbiAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4ge1xyXG4gICAgICAgIHRodW1iLmVtcHR5KCk7XHJcbiAgICAgICAgc2V0SWNvbih0aHVtYiwgaWNvbkZvcihtZXRhKSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgc2V0SWNvbih0aHVtYiwgaWNvbkZvcihtZXRhKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdCB0aXRsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XHJcbiAgdGl0bGVFbC5jbGFzc05hbWUgPSBcImFjLWNhcmRfX3RpdGxlXCI7XHJcbiAgdGl0bGVFbC5zZXRBdHRyKFwiaHJlZlwiLCBocmVmT2YobWV0YSkpO1xyXG4gIHRpdGxlRWwudGV4dENvbnRlbnQgPSBtZXRhLnRpdGxlO1xyXG4gIHRpdGxlRWwudGl0bGUgPSBtZXRhLmZpbGVcclxuICAgID8gYCR7aHJlZk9mKG1ldGEpfVx1RkYwOFx1NzBCOVx1NTFGQlx1NUM1NVx1NUYwMC9cdTY1MzZcdThENzdcdUZGMENDdHJsK1x1NzBCOVx1NTFGQlx1OERGM1x1NTIzMFx1NTM5Rlx1NjU4N1x1RkYwOWBcclxuICAgIDogYFx1NjVCMFx1NUVGQVx1RkYxQSR7bWV0YS50YXJnZXR9YDtcclxuICBoZWFkLmFwcGVuZENoaWxkKHRpdGxlRWwpO1xyXG5cclxuICBpZiAoIW1ldGEuZmlsZSkgaGVhZC5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWNhcmRfX21pc3NpbmdcIiwgdGV4dDogXCJcdTY3MkFcdTUyMUJcdTVFRkFcIiB9KTtcclxuXHJcbiAgaWYgKG9wdHMudGFncykge1xyXG4gICAgY29uc3QgdGFnUm93ID0gYnVpbGRUYWdSb3cobWV0YSwgaXNTbWFsbCA/IDIgOiAzKTtcclxuICAgIGlmICh0YWdSb3cpIGhlYWQuYXBwZW5kQ2hpbGQodGFnUm93KTtcclxuICB9XHJcblxyXG4gIGlmIChvcHRzLm1ldGEpIHtcclxuICAgIGNvbnN0IG1ldGFSb3cgPSBidWlsZE1ldGFSb3cobWV0YSk7XHJcbiAgICBpZiAobWV0YVJvdykgaGVhZC5hcHBlbmRDaGlsZChtZXRhUm93KTtcclxuICB9XHJcblxyXG4gIGNvbnN0IGFjdGlvbnMgPSBoZWFkLmNyZWF0ZURpdih7IGNsczogXCJhYy1jYXJkX19hY3Rpb25zXCIgfSk7XHJcblxyXG4gIGNvbnN0IHRvZ2dsZUJ0biA9IGFjdGlvbnMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiYWMtYnRuIGFjLWJ0bi0tdG9nZ2xlXCIgfSk7XHJcbiAgY29uc3QgdG9nZ2xlSWNvbiA9IHRvZ2dsZUJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9faWNvblwiIH0pO1xyXG4gIGNvbnN0IHRvZ2dsZVRleHQgPSB0b2dnbGVCdG4uY3JlYXRlU3Bhbih7IGNsczogXCJhYy1idG5fX3RleHRcIiwgdGV4dDogXCJcdTVDNTVcdTVGMDBcIiB9KTtcclxuICBzZXRJY29uKHRvZ2dsZUljb24sIFwiY2hldnJvbi1kb3duXCIpO1xyXG5cclxuICBpZiAob3B0cy5vcGVuKSB7XHJcbiAgICBjb25zdCBvcGVuQnRuID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJhYy1idG4gYWMtYnRuLS1vcGVuXCIgfSk7XHJcbiAgICBjb25zdCBvcGVuSWNvbiA9IG9wZW5CdG4uY3JlYXRlU3Bhbih7IGNsczogXCJhYy1idG5fX2ljb25cIiB9KTtcclxuICAgIG9wZW5CdG4uY3JlYXRlU3Bhbih7IGNsczogXCJhYy1idG5fX3RleHRcIiwgdGV4dDogXCJcdTYyNTNcdTVGMDBcIiB9KTtcclxuICAgIHNldEljb24ob3Blbkljb24sIFwiYXJyb3ctdXAtcmlnaHRcIik7XHJcbiAgICBvcGVuQnRuLnRpdGxlID0gbWV0YS5maWxlID8gXCJcdTU3MjhcdTUzOUZcdTU5Q0JcdTY1ODdcdTY4NjNcdTRFMkRcdTYyNTNcdTVGMDBcIiA6IFwiXHU1MjFCXHU1RUZBXHU4RkQ5XHU3QkM3XHU2NTg3XHU2ODYzXCI7XHJcbiAgICBvcGVuQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4gdm9pZCBvcGVuTm90ZShlbnYsIG1ldGEsIGUpKTtcclxuICB9XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU2NDU4XHU4OTgxXHVGRjA4XHU0RTJEXHVGRjA5IC0tLS0tLS0tLS0gKi9cclxuICBjYXJkLmNyZWF0ZURpdih7XHJcbiAgICBjbHM6IFwiYWMtY2FyZF9fc3VtbWFyeVwiLFxyXG4gICAgdGV4dDogbWV0YS5zdW1tYXJ5IHx8IChtZXRhLmZpbGUgPyBcIlx1RkYwOFx1NjY4Mlx1NjVFMFx1NjQ1OFx1ODk4MVx1RkYwOVwiIDogXCJcdTcwQjlcdTUxRkJcdTY4MDdcdTk4OThcdTUyMUJcdTVFRkFcdThGRDlcdTdCQzdcdTUzOUZcdTVCNTBcdTY1ODdcdTY4NjNcIiksXHJcbiAgfSk7XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU2QjYzXHU2NTg3XHVGRjA4XHU2REYxXHVGRjA5IC0tLS0tLS0tLS0gKi9cclxuICBjYXJkLmFwcGVuZENoaWxkKGJvZHkpO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NUM1NVx1NUYwMCAvIFx1NjUzNlx1OEQ3NyAtLS0tLS0tLS0tICovXHJcbiAgbGV0IGV4cGFuZGVkID0gZmFsc2U7XHJcbiAgY29uc3Qgc2V0RXhwYW5kZWQgPSAobmV4dDogYm9vbGVhbikgPT4ge1xyXG4gICAgZXhwYW5kZWQgPSBuZXh0O1xyXG4gICAgY2FyZC5jbGFzc0xpc3QudG9nZ2xlKFwiaXMtZXhwYW5kZWRcIiwgZXhwYW5kZWQpO1xyXG4gICAgdG9nZ2xlVGV4dC50ZXh0Q29udGVudCA9IGV4cGFuZGVkID8gXCJcdTY1MzZcdThENzdcIiA6IFwiXHU1QzU1XHU1RjAwXCI7XHJcbiAgICBzZXRJY29uKHRvZ2dsZUljb24sIGV4cGFuZGVkID8gXCJjaGV2cm9uLXVwXCIgOiBcImNoZXZyb24tZG93blwiKTtcclxuICAgIGJvZHkuc3R5bGUuZGlzcGxheSA9IGV4cGFuZGVkID8gXCJcIiA6IFwibm9uZVwiO1xyXG4gICAgaWYgKGV4cGFuZGVkKSBsb2FkQm9keSgpO1xyXG4gIH07XHJcblxyXG4gIHRvZ2dsZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gc2V0RXhwYW5kZWQoIWV4cGFuZGVkKSk7XHJcblxyXG4gIC8vIFx1NzBCOVx1NjgwN1x1OTg5OFx1NjYyRlx1NjI5OFx1NTNFMFx1NUYwMFx1NTE3M1x1RkYxQlx1NjMwOVx1NEY0RiBDdHJsL0NtZCBcdTYyNERcdThERjNcdTUyMzBcdTUzOUZcdTY1ODdcclxuICB0aXRsZUVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgaWYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkgfHwgZS5idXR0b24gPT09IDEpIHtcclxuICAgICAgdm9pZCBvcGVuTm90ZShlbnYsIG1ldGEsIGUpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBzZXRFeHBhbmRlZCghZXhwYW5kZWQpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBcdTU5MzRcdTkwRThcdTdBN0FcdTc2N0RcdTU5MDRcdTRFNUZcdTUzRUZcdTRFRTVcdTYyOThcdTUzRTBcdUZGMDhcdTYzMDlcdTk0QUVcdTU0OENcdTk0RkVcdTYzQTVcdTgxRUFcdTVERjFcdTU5MDRcdTc0MDZcdUZGMENcdTRFMERcdTkxQ0RcdTU5MERcdTg5RTZcdTUzRDFcdUZGMDlcclxuICBoZWFkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xyXG4gICAgY29uc3QgZWwgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICBpZiAoZWw/LmNsb3Nlc3QoXCJidXR0b24sIGFcIikpIHJldHVybjtcclxuICAgIHNldEV4cGFuZGVkKCFleHBhbmRlZCk7XHJcbiAgfSk7XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU2MkQ2XHU2MkZEXHVGRjFBXHU0RUNFXHU1MzYxXHU3MjQ3XHU1OTM0XHU5MEU4XHU2MkQ2XHU1MjMwXHU2QjYzXHU2NTg3XHVGRjBDXHU2M0QyXHU1MTY1ICFbWyBdXSBcdTVENENcdTUxNjUgLS0tLS0tLS0tLVxyXG4gICAgIE9ic2lkaWFuIFx1NTM5Rlx1NzUxRlx1NEVDRVx1NjU4N1x1NEVGNlx1NTIxN1x1ODg2OFx1NjJENlx1OEZEQlx1Njc2NVx1NTNFQVx1ODBGRFx1NUY5N1x1NTIzMCBbW1x1OTRGRVx1NjNBNV1dXHVGRjBDXHU1Rjk3XHU0RTBEXHU1MjMwXHU1RDRDXHU1MTY1XHUzMDAyXHJcbiAgICAgXHU4RkQ5XHU5MUNDXHU4QkE5XHU1MzYxXHU3MjQ3XHU4MUVBXHU1REYxXHU1M0VGXHU0RUU1XHU4OEFCXHU2MkQ2XHU4RDcwXHVGRjBDXHU2NTNFXHU1MjMwXHU3RjE2XHU4RjkxXHU1NjY4XHU1MzczXHU3NTFGXHU2MjEwICFbW1x1N0IxNFx1OEJCMF1dXHUzMDAyXHJcbiAgICAgXHU1M0VBXHU4QkE5XHU1OTM0XHU5MEU4XHU1M0VGXHU2MkQ2XHVGRjFBXHU2QjYzXHU2NTg3XHU1MzNBXHU4OTgxXHU3NTU5XHU3RUQ5XHU5MDA5XHU0RTJEXHU1OTBEXHU1MjM2XHU1NDhDXHU2Mjk4XHU1M0UwXHU3MEI5XHU1MUZCXHUzMDAyICovXHJcbiAgaGVhZC5kcmFnZ2FibGUgPSB0cnVlO1xyXG4gIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdzdGFydFwiLCAoZSkgPT4ge1xyXG4gICAgaWYgKCFtZXRhLmZpbGUpIHJldHVybjtcclxuICAgIGNvbnN0IG5hbWUgPSBtZXRhLmZpbGUuYmFzZW5hbWU7XHJcbiAgICAvLyBcdTZCQjVcdTg0M0RcdTdFQTdcdTVGMTVcdTc1MjhcdTRGRERcdTc1NTkgI1x1NjgwN1x1OTg5OCAvICNeXHU1NzU3aWRcclxuICAgIGNvbnN0IGxpbmsgPSBtZXRhLnJlZiA/IGAhW1ske25hbWV9IyR7bWV0YS5yZWZ9XV1gIDogYCFbWyR7bmFtZX1dXWA7XHJcbiAgICBlLmRhdGFUcmFuc2Zlcj8uc2V0RGF0YShcInRleHQvcGxhaW5cIiwgbGluayk7XHJcbiAgICBpZiAoZS5kYXRhVHJhbnNmZXIpIGUuZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSBcImNvcHlcIjtcclxuICAgIGNhcmQuY2xhc3NMaXN0LmFkZChcImlzLWRyYWdnaW5nXCIpO1xyXG4gIH0pO1xyXG4gIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4gY2FyZC5jbGFzc0xpc3QucmVtb3ZlKFwiaXMtZHJhZ2dpbmdcIikpO1xyXG5cclxuICBpZiAob3B0cy5leHBhbmRlZCkgc2V0RXhwYW5kZWQodHJ1ZSk7XHJcblxyXG4gIHJldHVybiBjYXJkO1xyXG59XHJcbiIsICJpbXBvcnQgeyBBcHAsIENhY2hlZE1ldGFkYXRhLCBDb21wb25lbnQsIEZyb250TWF0dGVyQ2FjaGUsIE1hcmtkb3duUmVuZGVyZXIsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVCYWRnZSB7XHJcbiAga2V5OiBzdHJpbmc7XHJcbiAgdmFsdWU6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBOb3RlTWV0YSB7XHJcbiAgZmlsZTogVEZpbGUgfCBudWxsO1xyXG4gIC8qKiBcdTUzOUZcdTU5Q0JcdTVGMTVcdTc1MjhcdUZGMDhcdTUzRUZcdTU0MkIgI1x1NjgwN1x1OTg5OCBcdTYyMTYgI15cdTU3NTdpZFx1RkYwOSAqL1xyXG4gIHRhcmdldDogc3RyaW5nO1xyXG4gIC8qKiAjIFx1NEU0Qlx1NTQwRVx1NzY4NFx1OTBFOFx1NTIwNlx1RkYwQ1x1NkNBMVx1NjcwOVx1NTIxOVx1NEUzQVx1N0E3QSAqL1xyXG4gIHJlZjogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgc3VtbWFyeTogc3RyaW5nO1xyXG4gIGNvdmVyOiBzdHJpbmcgfCBudWxsO1xyXG4gIHRhZ3M6IHN0cmluZ1tdO1xyXG4gIGJhZGdlczogTm90ZUJhZGdlW107XHJcbiAgdXBkYXRlZDogc3RyaW5nO1xyXG4gIHdvcmRDb3VudDogbnVtYmVyO1xyXG4gIC8qKiBcdTZCQjVcdTg0M0RcdTdFQTdcdTVGMTVcdTc1MjhcdUZGMDhbW1x1OTg3NSNcdTY4MDdcdTk4OThdXSAvIFtbXHU5ODc1I15cdTU3NTddXVx1RkYwOVx1NjVGNlx1RkYwQ1x1OEJFNVx1NkJCNVx1ODQzRFx1NzY4NFx1NkI2M1x1NjU4NyAqL1xyXG4gIGJsb2NrQ29udGVudD86IHN0cmluZztcclxufVxyXG5cclxuY29uc3QgY2FjaGUgPSBuZXcgTWFwPHN0cmluZywgTm90ZU1ldGE+KCk7XHJcblxyXG5mdW5jdGlvbiBzdHJpcEZyb250bWF0dGVyKHJhdzogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBtID0gcmF3Lm1hdGNoKC9eLS0tXFxyP1xcbltcXHNcXFNdKj9cXHI/XFxuLS0tXFxyP1xcbj8vKTtcclxuICByZXR1cm4gbSA/IHJhdy5zbGljZShtWzBdLmxlbmd0aCkgOiByYXc7XHJcbn1cclxuXHJcbi8qKiBcdTYyOEEgbWFya2Rvd24gXHU2QjYzXHU2NTg3XHU1MzhCXHU2MjEwXHU0RTAwXHU2QkI1XHU3RUFGXHU2NTg3XHU2NzJDXHU2NDU4XHU4OTgxICovXHJcbmV4cG9ydCBmdW5jdGlvbiB0b1BsYWluVGV4dChib2R5OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIHJldHVybiBzdHJpcEZyb250bWF0dGVyKGJvZHkpXHJcbiAgICAucmVwbGFjZSgvYGBgW1xcc1xcU10qP2BgYC9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHMqPlxccypcXFshXFx3K1teXFxdXSpcXF0uKiQvZ20sIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvIVxcW1xcW1teXFxdXSpcXF1cXF0vZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC8hXFxbW15cXF1dKlxcXVxcKFteKV0qXFwpL2csIFwiXCIpXHJcbiAgICAvLyBIVE1MIFx1NkNFOFx1OTFDQVx1RkYxQWlXaWtpIFx1NjI5M1x1NTNENlx1NzY4NFx1Njc2MVx1NzZFRVx1NjY2RVx1OTA0RFx1NUUyNiA8IS0tIFx1Njc2NVx1NkU5MCBpd2lraSBkb2NpZDp4eHggLS0+XHVGRjBDXHJcbiAgICAvLyBcdTRFMERcdTZFMDVcdTYzODlcdTc2ODRcdThCRERcdTVCODNcdTRGMUFcdTUzOUZcdTY4MzdcdTUxRkFcdTczQjBcdTU3MjhcdTUzNjFcdTcyNDdcdTY0NThcdTg5ODFcdTkxQ0NcdTMwMDJcclxuICAgIC5yZXBsYWNlKC88IS0tW1xcc1xcU10qPy0tPi9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL1xcW1xcWyhbXlxcXXxdKylcXHw/KFteXFxdXSopXFxdXFxdL2csIChfbSwgYTogc3RyaW5nLCBiOiBzdHJpbmcpID0+IGIgfHwgYSlcclxuICAgIC5yZXBsYWNlKC9cXFsoW15cXF1dKilcXF1cXChbXildKlxcKS9nLCBcIiQxXCIpXHJcbiAgICAucmVwbGFjZSgvXlxcc3swLDN9I3sxLDZ9XFxzKy4qJC9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzezAsM30+XFxzPy9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzKlstKitdXFxzKy9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzKlxcZCtcXC5cXHMrL2dtLCBcIlwiKVxyXG4gICAgLy8gXHU4ODY4XHU2ODNDXHVGRjFBXHU1MTQ4XHU1MjIwXHU2Mzg5IHwgLS0tIHwgXHU4RkQ5XHU3QzdCXHU1MjA2XHU5Njk0XHU4ODRDXHVGRjBDXHU1MThEXHU2MjhBXHU1MjY5XHU0RTBCXHU3Njg0XHU3QUQ2XHU3RUJGXHU1M0Q4XHU2MjEwXHU3QTdBXHU2ODNDXHVGRjBDXHJcbiAgICAvLyBcdTU0MjZcdTUyMTlcdTRFRTVcdTg4NjhcdTY4M0NcdTRFM0FcdTRFM0JcdTc2ODRcdTY3NjFcdTc2RUVcdTY0NThcdTg5ODFcdTRGMUFcdTUzRDhcdTYyMTBcdTRFMDBcdTRFMzJcdTdCQTFcdTkwNTNcdTdCMjZcdTMwMDJcclxuICAgIC5yZXBsYWNlKC9eXFxzKlxcfD9bXFxzOnwtXStcXHw/XFxzKiQvZ20sIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvXFx8L2csIFwiIFwiKVxyXG4gICAgLnJlcGxhY2UoL1sqX2B+PV0vZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKVxyXG4gICAgLnRyaW0oKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmlyc3RUZXh0KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgdGV4dCA9IHRvUGxhaW5UZXh0KGNvbnRlbnQpO1xyXG4gIHJldHVybiB0ZXh0Lmxlbmd0aCA+IDI0ID8gYCR7dGV4dC5zbGljZSgwLCAyNCl9XHUyMDI2YCA6IHRleHQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBcdTRFQ0VcdTY1ODdcdTY4NjNcdTkxQ0NcdTYyMkFcdTUzRDZcdTRFMDBcdTRFMkFcdTZCQjVcdTg0M0RcdUZGMDhcdTc3RTVcdThCQzZcdTcwQjlcdUZGMDlcdTMwMDJcclxuICogXHU2NTJGXHU2MzAxIGBbW1x1OTg3NSNcdTY4MDdcdTk4OThdXWAgXHU0RTBFIGBbW1x1OTg3NSNeXHU1NzU3aWRdXWAgXHU0RTI0XHU3OUNEXHU1RjE1XHU3NTI4XHUzMDAyXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEJsb2NrKFxyXG4gIHJhdzogc3RyaW5nLFxyXG4gIGZpbGVDYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsLFxyXG4gIHJlZjogc3RyaW5nXHJcbik6IHsgdGl0bGU6IHN0cmluZzsgY29udGVudDogc3RyaW5nIH0gfCBudWxsIHtcclxuICBjb25zdCBsaW5lcyA9IHJhdy5zcGxpdCgvXFxyP1xcbi8pO1xyXG4gIGNvbnN0IHdhbnRlZCA9IGRlY29kZVVSSUNvbXBvbmVudChyZWYpO1xyXG5cclxuICAvLyBcdTU3NTdcdTVGMTVcdTc1MjggXmJsb2NraWRcclxuICBpZiAod2FudGVkLnN0YXJ0c1dpdGgoXCJeXCIpKSB7XHJcbiAgICBjb25zdCBibG9jayA9IGZpbGVDYWNoZT8uYmxvY2tzPy5bd2FudGVkLnNsaWNlKDEpXTtcclxuICAgIGlmICghYmxvY2spIHJldHVybiBudWxsO1xyXG4gICAgY29uc3QgY29udGVudCA9IGxpbmVzXHJcbiAgICAgIC5zbGljZShibG9jay5wb3NpdGlvbi5zdGFydC5saW5lLCBibG9jay5wb3NpdGlvbi5lbmQubGluZSArIDEpXHJcbiAgICAgIC5qb2luKFwiXFxuXCIpO1xyXG4gICAgcmV0dXJuIHsgdGl0bGU6IGZpcnN0VGV4dChjb250ZW50KSB8fCB3YW50ZWQsIGNvbnRlbnQgfTtcclxuICB9XHJcblxyXG4gIC8vIFx1NjgwN1x1OTg5OFx1NUYxNVx1NzUyOCAjaGVhZGluZ1xyXG4gIGNvbnN0IGhlYWRpbmdzID0gZmlsZUNhY2hlPy5oZWFkaW5ncyA/PyBbXTtcclxuICBjb25zdCBpZHggPSBoZWFkaW5ncy5maW5kSW5kZXgoKGgpID0+IGguaGVhZGluZyA9PT0gd2FudGVkKTtcclxuICBpZiAoaWR4IDwgMCkgcmV0dXJuIG51bGw7XHJcblxyXG4gIGNvbnN0IGggPSBoZWFkaW5nc1tpZHhdO1xyXG4gIGNvbnN0IHN0YXJ0ID0gaC5wb3NpdGlvbi5zdGFydC5saW5lO1xyXG4gIGxldCBlbmQgPSBsaW5lcy5sZW5ndGggLSAxO1xyXG4gIGZvciAobGV0IGkgPSBpZHggKyAxOyBpIDwgaGVhZGluZ3MubGVuZ3RoOyBpKyspIHtcclxuICAgIGlmIChoZWFkaW5nc1tpXS5sZXZlbCA8PSBoLmxldmVsKSB7XHJcbiAgICAgIGVuZCA9IGhlYWRpbmdzW2ldLnBvc2l0aW9uLnN0YXJ0LmxpbmUgLSAxO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHsgdGl0bGU6IGguaGVhZGluZywgY29udGVudDogbGluZXMuc2xpY2Uoc3RhcnQsIE1hdGgubWF4KGVuZCwgc3RhcnQpICsgMSkuam9pbihcIlxcblwiKSB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBwaWNrRmllbGQoZm06IEZyb250TWF0dGVyQ2FjaGUgfCB1bmRlZmluZWQsIGZpZWxkczogc3RyaW5nW10pOiBzdHJpbmcge1xyXG4gIGlmICghZm0pIHJldHVybiBcIlwiO1xyXG4gIGZvciAoY29uc3QgZiBvZiBmaWVsZHMpIHtcclxuICAgIGNvbnN0IHYgPSBmbVtmXTtcclxuICAgIGlmICh0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiAmJiB2LnRyaW0oKSkgcmV0dXJuIHYudHJpbSgpO1xyXG4gICAgaWYgKHR5cGVvZiB2ID09PSBcIm51bWJlclwiKSByZXR1cm4gU3RyaW5nKHYpO1xyXG4gIH1cclxuICByZXR1cm4gXCJcIjtcclxufVxyXG5cclxuZnVuY3Rpb24gY29sbGVjdFRhZ3MoYXBwOiBBcHAsIGZpbGU6IFRGaWxlKTogc3RyaW5nW10ge1xyXG4gIGNvbnN0IGZtID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcjtcclxuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XHJcbiAgY29uc3QgcHVzaCA9ICh2OiB1bmtub3duKSA9PiB7XHJcbiAgICBpZiAodHlwZW9mIHYgPT09IFwic3RyaW5nXCIpIG91dC5wdXNoKHYucmVwbGFjZSgvXiMvLCBcIlwiKSk7XHJcbiAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KHYpKSB2LmZvckVhY2gocHVzaCk7XHJcbiAgfTtcclxuICBwdXNoKGZtPy50YWdzKTtcclxuICBwdXNoKGZtPy50YWcpO1xyXG4gIGlmICghb3V0Lmxlbmd0aCkge1xyXG4gICAgY29uc3QgY2FjaGVUYWdzID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy50YWdzID8/IFtdO1xyXG4gICAgZm9yIChjb25zdCB0IG9mIGNhY2hlVGFncykgb3V0LnB1c2godC50YWcucmVwbGFjZSgvXiMvLCBcIlwiKSk7XHJcbiAgfVxyXG4gIHJldHVybiBBcnJheS5mcm9tKG5ldyBTZXQob3V0KSkuc2xpY2UoMCwgNik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGV4dHJhY3RDb3ZlcihhcHA6IEFwcCwgZmlsZTogVEZpbGUsIGJvZHk6IHN0cmluZywgZmllbGRzOiBzdHJpbmdbXSk6IHN0cmluZyB8IG51bGwge1xyXG4gIGNvbnN0IGZtID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcjtcclxuICBjb25zdCBkZWNsYXJlZCA9IHBpY2tGaWVsZChmbSwgZmllbGRzKTtcclxuICBjb25zdCBjYW5kaWRhdGVzID0gW2RlY2xhcmVkXTtcclxuXHJcbiAgaWYgKCFkZWNsYXJlZCkge1xyXG4gICAgY29uc3Qgd2lraUltZyA9IGJvZHkubWF0Y2goLyFcXFtcXFsoW15cXF18XSspLyk7XHJcbiAgICBpZiAod2lraUltZykgY2FuZGlkYXRlcy5wdXNoKHdpa2lJbWdbMV0pO1xyXG4gICAgY29uc3QgbWRJbWcgPSBib2R5Lm1hdGNoKC8hXFxbW15cXF1dKlxcXVxcKChbXildKylcXCkvKTtcclxuICAgIGlmIChtZEltZykgY2FuZGlkYXRlcy5wdXNoKG1kSW1nWzFdKTtcclxuICB9XHJcblxyXG4gIGZvciAoY29uc3QgYyBvZiBjYW5kaWRhdGVzKSB7XHJcbiAgICBpZiAoIWMpIGNvbnRpbnVlO1xyXG4gICAgaWYgKC9eaHR0cHM/OlxcL1xcLy9pLnRlc3QoYykpIHJldHVybiBjO1xyXG4gICAgY29uc3QgZiA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGMuc3BsaXQoXCJ8XCIpWzBdLnRyaW0oKSwgZmlsZS5wYXRoKTtcclxuICAgIGlmIChmKSByZXR1cm4gYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmKTtcclxuICB9XHJcbiAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlRmlsZShhcHA6IEFwcCwgdGFyZ2V0OiBzdHJpbmcsIHNvdXJjZVBhdGg6IHN0cmluZyk6IFRGaWxlIHwgbnVsbCB7XHJcbiAgY29uc3QgY2xlYW4gPSB0YXJnZXQuc3BsaXQoXCIjXCIpWzBdLnNwbGl0KFwifFwiKVswXS50cmltKCk7XHJcbiAgaWYgKCFjbGVhbikgcmV0dXJuIG51bGw7XHJcbiAgcmV0dXJuIGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGNsZWFuLCBzb3VyY2VQYXRoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZm9ybWF0RGF0ZSh2OiB1bmtub3duKTogc3RyaW5nIHtcclxuICBpZiAoIXYpIHJldHVybiBcIlwiO1xyXG4gIGlmICh0eXBlb2YgdiAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIFwiXCI7XHJcbiAgcmV0dXJuIHYubGVuZ3RoID4gMTAgPyB2LnNsaWNlKDAsIDEwKSA6IHY7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkTm90ZU1ldGEoXHJcbiAgYXBwOiBBcHAsXHJcbiAgdGFyZ2V0OiBzdHJpbmcsXHJcbiAgc291cmNlUGF0aDogc3RyaW5nLFxyXG4gIHNldHRpbmdzOiB7XHJcbiAgICBzdW1tYXJ5RmllbGRzOiBzdHJpbmdbXTtcclxuICAgIGNvdmVyRmllbGRzOiBzdHJpbmdbXTtcclxuICAgIG1ldGFGaWVsZHM6IHN0cmluZ1tdO1xyXG4gICAgc3VtbWFyeUxlbmd0aDogbnVtYmVyO1xyXG4gIH0sXHJcbiAgYWxpYXM/OiBzdHJpbmdcclxuKTogUHJvbWlzZTxOb3RlTWV0YT4ge1xyXG4gIGNvbnN0IGhhc2hJZHggPSB0YXJnZXQuaW5kZXhPZihcIiNcIik7XHJcbiAgY29uc3QgcGF0aFBhcnQgPSAoaGFzaElkeCA+PSAwID8gdGFyZ2V0LnNsaWNlKDAsIGhhc2hJZHgpIDogdGFyZ2V0KS5zcGxpdChcInxcIilbMF0udHJpbSgpO1xyXG4gIGNvbnN0IHJlZiA9IGhhc2hJZHggPj0gMCA/IHRhcmdldC5zbGljZShoYXNoSWR4ICsgMSkudHJpbSgpIDogXCJcIjtcclxuICBjb25zdCBmaWxlID0gcmVzb2x2ZUZpbGUoYXBwLCBwYXRoUGFydCwgc291cmNlUGF0aCk7XHJcbiAgY29uc3QgZmFsbGJhY2tUaXRsZSA9IGFsaWFzIHx8IHJlZiB8fCBwYXRoUGFydC5zcGxpdChcIi9cIikucG9wKCkgfHwgdGFyZ2V0O1xyXG5cclxuICBpZiAoIWZpbGUpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGZpbGU6IG51bGwsXHJcbiAgICAgIHRhcmdldCxcclxuICAgICAgcmVmLFxyXG4gICAgICB0aXRsZTogZmFsbGJhY2tUaXRsZSxcclxuICAgICAgc3VtbWFyeTogXCJcIixcclxuICAgICAgY292ZXI6IG51bGwsXHJcbiAgICAgIHRhZ3M6IFtdLFxyXG4gICAgICBiYWRnZXM6IFtdLFxyXG4gICAgICB1cGRhdGVkOiBcIlwiLFxyXG4gICAgICB3b3JkQ291bnQ6IDAsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgY29uc3Qga2V5ID0gYCR7ZmlsZS5wYXRofSMke3JlZn06JHtmaWxlLnN0YXQubXRpbWV9OiR7c2V0dGluZ3Muc3VtbWFyeUxlbmd0aH1gO1xyXG4gIGNvbnN0IGhpdCA9IGNhY2hlLmdldChrZXkpO1xyXG4gIGlmIChoaXQpIHJldHVybiBhbGlhcyA/IHsgLi4uaGl0LCB0aXRsZTogYWxpYXMgfSA6IGhpdDtcclxuXHJcbiAgY29uc3QgcmF3ID0gYXdhaXQgYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XHJcbiAgY29uc3QgZmlsZUNhY2hlID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpID8/IG51bGw7XHJcbiAgY29uc3QgZm0gPSBmaWxlQ2FjaGU/LmZyb250bWF0dGVyO1xyXG5cclxuICAvLyBcdTZCQjVcdTg0M0RcdTdFQTdcdTVGMTVcdTc1MjhcdUZGMUFcdTUzRUFcdTUzRDZcdThCRTVcdTZCQjVcdTg0M0RcdUZGMENcdTgwMENcdTRFMERcdTY2MkZcdTY1NzRcdTdCQzdcclxuICBjb25zdCBibG9jayA9IHJlZiA/IGV4dHJhY3RCbG9jayhyYXcsIGZpbGVDYWNoZSwgcmVmKSA6IG51bGw7XHJcbiAgY29uc3QgY29udGVudEJvZHkgPSBibG9jaz8uY29udGVudCA/PyBzdHJpcEZyb250bWF0dGVyKHJhdyk7XHJcblxyXG4gIGNvbnN0IG1hbnVhbCA9IGJsb2NrID8gXCJcIiA6IHBpY2tGaWVsZChmbSwgc2V0dGluZ3Muc3VtbWFyeUZpZWxkcyk7XHJcbiAgY29uc3QgcGxhaW4gPSB0b1BsYWluVGV4dChjb250ZW50Qm9keSk7XHJcbiAgY29uc3Qgc3VtbWFyeSA9XHJcbiAgICBtYW51YWwgfHxcclxuICAgIHBsYWluLnNsaWNlKDAsIHNldHRpbmdzLnN1bW1hcnlMZW5ndGgpICsgKHBsYWluLmxlbmd0aCA+IHNldHRpbmdzLnN1bW1hcnlMZW5ndGggPyBcIlx1MjAyNlwiIDogXCJcIik7XHJcblxyXG4gIGNvbnN0IGJhZGdlczogTm90ZUJhZGdlW10gPSBbXTtcclxuICBpZiAoIWJsb2NrKSB7XHJcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBzZXR0aW5ncy5tZXRhRmllbGRzKSB7XHJcbiAgICAgIGNvbnN0IHYgPSBmbT8uW2tleV07XHJcbiAgICAgIGlmICh2ID09PSB1bmRlZmluZWQgfHwgdiA9PT0gbnVsbCkgY29udGludWU7XHJcbiAgICAgIGNvbnN0IHRleHQgPSBBcnJheS5pc0FycmF5KHYpID8gdi5qb2luKFwiL1wiKSA6IFN0cmluZyh2KTtcclxuICAgICAgaWYgKHRleHQudHJpbSgpKSBiYWRnZXMucHVzaCh7IGtleSwgdmFsdWU6IHRleHQudHJpbSgpIH0pO1xyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBcdTZCQjVcdTg0M0RcdTUzNjFcdTcyNDdcdTUzRUFcdTY4MDdcdTY3NjVcdTZFOTBcdTY1ODdcdTY4NjNcdTdDN0JcdTU3OEJcdUZGMENcdTkwN0ZcdTUxNERcdTU0OENcdTY1NzRcdTdCQzdcdTZERjdcdTZEQzZcclxuICAgIGNvbnN0IHQgPSBmbT8udHlwZTtcclxuICAgIGlmICh0eXBlb2YgdCA9PT0gXCJzdHJpbmdcIiAmJiB0LnRyaW0oKSkgYmFkZ2VzLnB1c2goeyBrZXk6IFwidHlwZVwiLCB2YWx1ZTogdC50cmltKCkgfSk7XHJcbiAgfVxyXG5cclxuICBjb25zdCB0aXRsZSA9XHJcbiAgICBhbGlhcyB8fCAoYmxvY2sgPyBibG9jay50aXRsZSA6IFwiXCIpIHx8IFN0cmluZyhmbT8udGl0bGUgfHwgZmlsZS5iYXNlbmFtZSk7XHJcblxyXG4gIGNvbnN0IG1ldGE6IE5vdGVNZXRhID0ge1xyXG4gICAgZmlsZSxcclxuICAgIHRhcmdldCxcclxuICAgIHJlZixcclxuICAgIHRpdGxlLFxyXG4gICAgc3VtbWFyeSxcclxuICAgIGNvdmVyOiBleHRyYWN0Q292ZXIoYXBwLCBmaWxlLCBjb250ZW50Qm9keSwgc2V0dGluZ3MuY292ZXJGaWVsZHMpLFxyXG4gICAgdGFnczogYmxvY2sgPyBbXSA6IGNvbGxlY3RUYWdzKGFwcCwgZmlsZSksXHJcbiAgICBiYWRnZXMsXHJcbiAgICB1cGRhdGVkOiBibG9jayA/IFwiXCIgOiBmb3JtYXREYXRlKGZtPy51cGRhdGVkKSB8fCBmb3JtYXREYXRlKGZtPy5tb2RpZmllZCkgfHwgZm9ybWF0RGF0ZShmbT8uY3JlYXRlZCksXHJcbiAgICB3b3JkQ291bnQ6IHBsYWluLmxlbmd0aCxcclxuICAgIGJsb2NrQ29udGVudDogYmxvY2s/LmNvbnRlbnQsXHJcbiAgfTtcclxuXHJcbiAgY2FjaGUuc2V0KGtleSwgbWV0YSk7XHJcbiAgaWYgKGNhY2hlLnNpemUgPiA1MDApIGNhY2hlLmNsZWFyKCk7XHJcbiAgcmV0dXJuIG1ldGE7XHJcbn1cclxuXHJcbi8qKiBcdTUxN0NcdTVCQjlcdTY1QjBcdTY1RTdcdTcyNDhcdTY3MkMgT2JzaWRpYW4gXHU3Njg0IG1hcmtkb3duIFx1NkUzMlx1NjdEM1x1NTE2NVx1NTNFMyAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyTWFya2Rvd24oXHJcbiAgYXBwOiBBcHAsXHJcbiAgbWFya2Rvd246IHN0cmluZyxcclxuICBlbDogSFRNTEVsZW1lbnQsXHJcbiAgc291cmNlUGF0aDogc3RyaW5nLFxyXG4gIGNvbXBvbmVudDogQ29tcG9uZW50XHJcbik6IHZvaWQge1xyXG4gIGNvbnN0IG1kID0gTWFya2Rvd25SZW5kZXJlciBhcyB1bmtub3duIGFzIHtcclxuICAgIHJlbmRlcj86IChhOiBBcHAsIG06IHN0cmluZywgZTogSFRNTEVsZW1lbnQsIHA6IHN0cmluZywgYzogQ29tcG9uZW50KSA9PiB2b2lkO1xyXG4gICAgcmVuZGVyTWFya2Rvd24/OiAobTogc3RyaW5nLCBlOiBIVE1MRWxlbWVudCwgcDogc3RyaW5nLCBjOiBDb21wb25lbnQpID0+IHZvaWQ7XHJcbiAgfTtcclxuICAvLyBcdTVGQzVcdTk4N0JcdTRGMThcdTUxNDhcdTc1MjggcmVuZGVyKClcdUZGMUFyZW5kZXJNYXJrZG93bigpIFx1NjYyRlx1N0I4MFx1NTMxNlx1NzI0OFx1RkYwQ1x1NEUwRFx1NEYxQVx1NjI4QVx1NzJFQ1x1NTM2MFx1NEUwMFx1ODg0Q1x1NzY4NCAhW1sgXV1cclxuICAvLyBcdTU5MDRcdTc0MDZcdTYyMTBcdTU3NTdcdTdFQTdcdTVENENcdTUxNjVcdUZGMENcdTUzRUFcdTc1NTlcdTRFMEJcdTRFMDBcdTRFMkEgPHNwYW4gY2xhc3M9XCJpbnRlcm5hbC1lbWJlZFwiPiBcdTUzNjBcdTRGNERcdTdCMjZcdUZGMENcclxuICAvLyBcdTVCRkNcdTgxRjRcdTUzNjFcdTcyNDdcdTZCNjNcdTY1ODdcdTkxQ0NcdTc2ODRcdTVENENcdTU5NTdcdTVENENcdTUxNjVcdTZDMzhcdThGRENcdTY1RTBcdTZDRDVcdTg4QUJcdTYzQTVcdTdCQTFcdTYyMTBcdTUzNjFcdTcyNDdcdTMwMDJcclxuICBpZiAodHlwZW9mIG1kLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICBtZC5yZW5kZXIoYXBwLCBtYXJrZG93biwgZWwsIHNvdXJjZVBhdGgsIGNvbXBvbmVudCk7XHJcbiAgfSBlbHNlIGlmICh0eXBlb2YgbWQucmVuZGVyTWFya2Rvd24gPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgbWQucmVuZGVyTWFya2Rvd24obWFya2Rvd24sIGVsLCBzb3VyY2VQYXRoLCBjb21wb25lbnQpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBlbC5zZXRUZXh0KG1hcmtkb3duKTtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCBBdG9taWNDYXJkc1BsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcbmltcG9ydCB7IExheW91dCwgU2l6ZSB9IGZyb20gXCIuL3R5cGVzXCI7XHJcbmltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEF0b21pY0NhcmRzU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogQXRvbWljQ2FyZHNQbHVnaW4pIHtcclxuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICB9XHJcblxyXG4gIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG4gICAgY29uc3QgcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzO1xyXG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1ODg0Q1x1NEUzQVwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU2M0E1XHU3QkExXHU1MzlGXHU3NTFGXHU1RDRDXHU1MTY1ICFbWyBdXVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1NjI4QVx1NzJFQ1x1NTM2MFx1NEUwMFx1ODg0Q1x1NzY4NCAhW1tcdTdCMTRcdThCQjBdXSBcdTVENENcdTUxNjVcdTZFMzJcdTY3RDNcdTYyMTBcdTUzRUZcdTYyOThcdTUzRTBcdTUzNjFcdTcyNDdcdUZGMUJcdTUxNzNcdTk1RURcdTU0MEVcdTYzRDJcdTRFRjZcdTVCOENcdTUxNjhcdTRFMERcdTRFQ0JcdTUxNjVcdUZGMENcdTVENENcdTUxNjVcdTRGRERcdTYzMDEgT2JzaWRpYW4gXHU5RUQ4XHU4QkE0XHU2ODM3XHU1RjBGXCIpXHJcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShzLnVwZ3JhZGVFbWJlZHMpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLnVwZ3JhZGVFbWJlZHMgPSB2O1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTYyRDZcdTUxNjVcdTdCMTRcdThCQjBcdTY1RjZcdTYzRDJcdTUxNjVcdTVENENcdTUxNjUgIVtbIF1dXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU0RUNFXHU2NTg3XHU0RUY2XHU1MjE3XHU4ODY4XHU2MjhBXHU3QjE0XHU4QkIwXHU2MkQ2XHU4RkRCXHU3RjE2XHU4RjkxXHU1NjY4XHU2NUY2XHU2M0QyXHU1MTY1ICFbWyBdXVx1RkYwOFx1NEYxQVx1NkUzMlx1NjdEM1x1NjIxMFx1NTM2MVx1NzI0N1x1RkYwOVx1RkYxQlx1NTE3M1x1OTVFRFx1NTIxOVx1NEZERFx1NjMwMSBPYnNpZGlhbiBcdTlFRDhcdThCQTRcdTc2ODQgW1sgXV0gXHU5NEZFXHU2M0E1XCIpXHJcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShzLmVtYmVkT25Ecm9wKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgcy5lbWJlZE9uRHJvcCA9IHY7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiXHU1RTAzXHU1QzQwXCIpLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTUzNjFcdTcyNDdcdTY3MDBcdTU5MjdcdTlBRDhcdTVFQTYgKHB4KVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIjAgPSBcdTRFMERcdTk2NTBcdTUyMzZcdUZGMUJcdThEODVcdThGQzdcdTU0MEVcdTUzNjFcdTcyNDdcdTUxODVcdTkwRThcdTZFREFcdTUyQThcIilcclxuICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShTdHJpbmcocy5jYXJkSGVpZ2h0KSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMuY2FyZEhlaWdodCA9IE51bWJlcih2KSB8fCAwO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTUzNjFcdTcyNDdcdTVFMDNcdTVDNDBcIilcclxuICAgICAgLnNldERlc2MoXCJcdTUzMDVcdTg4RjlcdTUzNjFcdTcyNDcgPSBcdTZBMkFcdTU0MTFcdTYyNDFcdTVFNzNcdTc2ODRcdTVCQjlcdTU2NjhcdUZGMUJcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNEMgPSBcdTRGMjBcdTdFREZcdTUzNjFcdTcyNDdcdTU4OTlcdUZGMDhcdTk4NzZcdTkwRThcdTU5MjdcdTVDMDFcdTk3NjJcdUZGMDlcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkKSA9PlxyXG4gICAgICAgIGRcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJ3cmFwXCIsIFwiXHU1MzA1XHU4OEY5XHU1MzYxXHU3MjQ3XHVGRjA4XHU2QTJBXHU1NDExXHVGRjA5XCIpXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiY2FyZFwiLCBcIlx1N0FENlx1NzI0OFx1NTM2MVx1NzI0Q1x1RkYwOFx1OTg3Nlx1OTBFOFx1NUMwMVx1OTc2Mlx1RkYwOVwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHMubGF5b3V0KVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICAgIHMubGF5b3V0ID0gdiBhcyBMYXlvdXQ7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTVENENcdTU5NTdcdTUzNjFcdTcyNDdcdTc2ODRcdTVDM0FcdTVCRjhcIilcclxuICAgICAgLnNldERlc2MoXCJcdTUzNjFcdTcyNDdcdTkxQ0NcdTUxOERcdTU5NTdcdTc2ODRcdTVENENcdTUxNjVcdTlFRDhcdThCQTRcdTc1MjhcdTRFQzBcdTRFNDhcdTVDM0FcdTVCRjhcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkKSA9PlxyXG4gICAgICAgIGRcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJzbWFsbFwiLCBcIlx1NzdFNVx1OEJDNlx1NzBCOVx1NUMwRlx1NTM2MVx1NzI0N1x1RkYwOFx1NEUwMFx1ODg0Q1x1NTkxQVx1NEUyQVx1RkYwOVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIm5vcm1hbFwiLCBcIlx1NUUzOFx1ODlDNFx1NTM2MVx1NzI0N1wiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHMubmVzdGVkU2l6ZSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICBzLm5lc3RlZFNpemUgPSB2IGFzIFNpemU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTVCQzZcdTVFQTZcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkKSA9PlxyXG4gICAgICAgIGRcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJjb21mb3J0YWJsZVwiLCBcIlx1NUJCRFx1Njc3RVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImNvbXBhY3RcIiwgXCJcdTdEMjdcdTUxRDFcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZShzLmRlbnNpdHkpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgICAgcy5kZW5zaXR5ID0gdiBhcyBcImNvbXBhY3RcIiB8IFwiY29tZm9ydGFibGVcIjtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiXHU1MzYxXHU3MjQ3XHU1MTg1XHU1QkI5XCIpLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTY0NThcdTg5ODFcdTk1N0ZcdTVFQTZcIilcclxuICAgICAgLnNldERlc2MoXCJcdTgxRUFcdTUyQThcdTY0NThcdTg5ODFcdTYyMkFcdTUzRDZcdTc2ODRcdTVCNTdcdTdCMjZcdTY1NzBcdUZGMDhmcm9udG1hdHRlciBcdTY3MDkgc3VtbWFyeS9kZXNjcmlwdGlvbiBcdTY1RjZcdTRGMThcdTUxNDhcdTc1MjhcdUZGMDlcIilcclxuICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShTdHJpbmcocy5zdW1tYXJ5TGVuZ3RoKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMuc3VtbWFyeUxlbmd0aCA9IE51bWJlcih2KSB8fCAxODA7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIGNvbnN0IHRvZ2dsZSA9IChuYW1lOiBzdHJpbmcsIGRlc2M6IHN0cmluZywgZ2V0OiAoKSA9PiBib29sZWFuLCBzZXQ6ICh2OiBib29sZWFuKSA9PiB2b2lkKSA9PlxyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShuYW1lKS5zZXREZXNjKGRlc2MpLmFkZFRvZ2dsZSgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKGdldCgpKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgc2V0KHYpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTVDMDFcdTk3NjJcIiwgXCJcdThCRkJcdTUzRDYgZnJvbnRtYXR0ZXIgXHU3Njg0IGNvdmVyL2ltYWdlL2Jhbm5lciBcdTYyMTZcdTZCNjNcdTY1ODdcdTdCMkNcdTRFMDBcdTVGMjBcdTU2RkVcIiwgKCkgPT4gcy5zaG93Q292ZXIsICh2KSA9PiAocy5zaG93Q292ZXIgPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTUxNDNcdTRGRTFcdTYwNkZcIiwgXCJ0eXBlIC8gc3RhdHVzIC8gZG9tYWluIC8gXHU2NkY0XHU2NUIwXHU2NUY2XHU5NUY0IC8gXHU1QjU3XHU2NTcwXCIsICgpID0+IHMuc2hvd01ldGEsICh2KSA9PiAocy5zaG93TWV0YSA9IHYpKTtcclxuICAgIHRvZ2dsZShcIlx1NjYzRVx1NzkzQVx1NjgwN1x1N0I3RVwiLCBcIlwiLCAoKSA9PiBzLnNob3dUYWdzLCAodikgPT4gKHMuc2hvd1RhZ3MgPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTMwMENcdTYyNTNcdTVGMDBcdTMwMERcdTYzMDlcdTk0QUVcIiwgXCJcIiwgKCkgPT4gcy5zaG93T3BlbkJ1dHRvbiwgKHYpID0+IChzLnNob3dPcGVuQnV0dG9uID0gdikpO1xyXG4gICAgdG9nZ2xlKFwiXHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXHU2QjYzXHU2NTg3XCIsIFwiXHU2MjUzXHU1RjAwXHU2NTg3XHU2ODYzXHU2NUY2XHU1MzYxXHU3MjQ3XHU3NkY0XHU2M0E1XHU2NjNFXHU3OTNBXHU1QjhDXHU2NTc0XHU1MTg1XHU1QkI5XHVGRjBDXHU3MEI5XHU2ODA3XHU5ODk4XHU1M0VGXHU2Mjk4XHU1M0UwXCIsICgpID0+IHMuZGVmYXVsdEV4cGFuZGVkLCAodikgPT4gKHMuZGVmYXVsdEV4cGFuZGVkID0gdikpO1xyXG4gICAgdG9nZ2xlKFxyXG4gICAgICBcIlx1NUQ0Q1x1NTk1N1x1NTM2MVx1NzI0N1x1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMFwiLFxyXG4gICAgICBcIlx1NTM2MVx1NzI0N1x1OTFDQ1x1NTE4RFx1NTk1N1x1NzY4NFx1NTM2MVx1NzI0N1x1NTg5OVx1NjYyRlx1NTQyNlx1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMFx1RkYxQlx1NTE3M1x1OTVFRFx1NjVGNlx1NTNFQVx1NjYzRVx1NzkzQVx1NjgwN1x1OTg5OFx1NTQ4Q1x1NjQ1OFx1ODk4MVwiLFxyXG4gICAgICAoKSA9PiBzLm5lc3RlZEV4cGFuZGVkLFxyXG4gICAgICAodikgPT4gKHMubmVzdGVkRXhwYW5kZWQgPSB2KVxyXG4gICAgKTtcclxuICAgIHRvZ2dsZShcclxuICAgICAgXCJcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcIixcclxuICAgICAgXCJcdTU3MjhcdTVGMDBcdTUzRDFcdTgwMDVcdTYzQTdcdTUyMzZcdTUzRjBcdUZGMDhDdHJsK1NoaWZ0K0lcdUZGMDlcdThGOTNcdTUxRkFcdThGRDBcdTg4NENcdTY1RTVcdTVGRDdcdUZGMENcdTYzOTJcdTY3RTVcdTc1MjhcdUZGMUJcdTVFNzNcdTY1RjZcdTUzRUZcdTUxNzNcIixcclxuICAgICAgKCkgPT4gcy52ZXJib3NlLFxyXG4gICAgICAodikgPT4gKHMudmVyYm9zZSA9IHYpXHJcbiAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NjcwMFx1NTkyN1x1NUQ0Q1x1NTk1N1x1NkRGMVx1NUVBNlwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1NTM2MVx1NzI0N1x1OTFDQ1x1NTE4RFx1NjUzRSBjYXJkcyBcdTU3NTdcdTY1RjZcdTc2ODRcdTkwMTJcdTVGNTJcdTVDNDJcdTY1NzBcdTRFMEFcdTk2NTBcdUZGMENcdTk2MzJcdTZCNjJcdTVGQUFcdTczQUZcdTVGMTVcdTc1MjhcdTUzNjFcdTZCN0JcIilcclxuICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShTdHJpbmcocy5tYXhOZXN0RGVwdGgpKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgcy5tYXhOZXN0RGVwdGggPSBNYXRoLm1heCgxLCBOdW1iZXIodikgfHwgMyk7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiXHU1QjU3XHU2QkI1XHU2NjIwXHU1QzA0XCIpLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICBjb25zdCBsaXN0RmllbGQgPSAobmFtZTogc3RyaW5nLCBkZXNjOiBzdHJpbmcsIGdldDogKCkgPT4gc3RyaW5nW10sIHNldDogKHY6IHN0cmluZ1tdKSA9PiB2b2lkKSA9PlxyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShuYW1lKVxyXG4gICAgICAgIC5zZXREZXNjKGRlc2MpXHJcbiAgICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgICB0XHJcbiAgICAgICAgICAgIC5zZXRWYWx1ZShnZXQoKS5qb2luKFwiLCBcIikpXHJcbiAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcImEsIGIsIGNcIilcclxuICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICAgICAgc2V0KFxyXG4gICAgICAgICAgICAgICAgdlxyXG4gICAgICAgICAgICAgICAgICAuc3BsaXQoXCIsXCIpXHJcbiAgICAgICAgICAgICAgICAgIC5tYXAoKHgpID0+IHgudHJpbSgpKVxyXG4gICAgICAgICAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pXHJcbiAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgIGxpc3RGaWVsZChcIlx1NjQ1OFx1ODk4MVx1NUI1N1x1NkJCNVwiLCBcIlx1NjMwOVx1OTg3QVx1NUU4Rlx1NUMxRFx1OEJENVx1OEJGQlx1NTNENlx1NzY4NCBmcm9udG1hdHRlciBcdTVCNTdcdTZCQjVcIiwgKCkgPT4gcy5zdW1tYXJ5RmllbGRzLCAodikgPT4gKHMuc3VtbWFyeUZpZWxkcyA9IHYpKTtcclxuICAgIGxpc3RGaWVsZChcIlx1NUMwMVx1OTc2Mlx1NUI1N1x1NkJCNVwiLCBcIlwiLCAoKSA9PiBzLmNvdmVyRmllbGRzLCAodikgPT4gKHMuY292ZXJGaWVsZHMgPSB2KSk7XHJcbiAgICBsaXN0RmllbGQoXCJcdTUxNDNcdTRGRTFcdTYwNkZcdTVCNTdcdTZCQjVcIiwgXCJcdTRGMUFcdTRFRTVcdTVGQkRcdTdBRTBcdTVGNjJcdTVGMEZcdTY2M0VcdTc5M0FcdTU3MjhcdTUzNjFcdTcyNDdcdTRFMEFcIiwgKCkgPT4gcy5tZXRhRmllbGRzLCAodikgPT4gKHMubWV0YUZpZWxkcyA9IHYpKTtcclxuICB9XHJcbn1cclxuIiwgImV4cG9ydCB0eXBlIERlbnNpdHkgPSBcImNvbXBhY3RcIiB8IFwiY29tZm9ydGFibGVcIjtcclxuLyoqIHdyYXAgPSBcdTYyNDFcdTVFNzNcdTUzMDVcdTg4RjlcdTUzNjFcdTcyNDdcdUZGMDhcdTZBMkFcdTU0MTFcdUZGMDlcdUZGMUJjYXJkID0gXHU0RjIwXHU3RURGXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDXHVGRjA4XHU5ODc2XHU5MEU4XHU1QzAxXHU5NzYyXHVGRjA5ICovXHJcbmV4cG9ydCB0eXBlIExheW91dCA9IFwid3JhcFwiIHwgXCJjYXJkXCI7XHJcbi8qKiBub3JtYWwgPSBcdTVFMzhcdTg5QzRcdTY1ODdcdTY4NjNcdTUzNjFcdTcyNDdcdUZGMUJzbWFsbCA9IFx1NzdFNVx1OEJDNlx1NzBCOSAvIFx1NkJCNVx1ODQzRFx1N0VBN1x1NUMwRlx1NTM2MVx1NzI0NyAqL1xyXG5leHBvcnQgdHlwZSBTaXplID0gXCJub3JtYWxcIiB8IFwic21hbGxcIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXRvbWljQ2FyZHNTZXR0aW5ncyB7XHJcbiAgLyoqIFx1NjI4QSBPYnNpZGlhbiBcdTUzOUZcdTc1MUYgIVtbIF1dIFx1NTc1N1x1N0VBN1x1NUQ0Q1x1NTE2NVx1NkUzMlx1NjdEM1x1NjIxMFx1NTM2MVx1NzI0N1x1RkYwOFx1NTE3M1x1OTVFRFx1NTIxOVx1NUI4Q1x1NTE2OFx1NEUwRFx1NEVDQlx1NTE2NVx1RkYwOSAqL1xyXG4gIHVwZ3JhZGVFbWJlZHM6IGJvb2xlYW47XHJcbiAgLyoqIFx1NEVDRVx1NjU4N1x1NEVGNlx1NTIxN1x1ODg2OFx1NjJENlx1N0IxNFx1OEJCMFx1NTIzMFx1N0YxNlx1OEY5MVx1NTY2OFx1NjVGNlx1NjNEMlx1NTE2NSAhW1sgXV0gXHU1RDRDXHU1MTY1XHVGRjBDXHU4MDBDXHU0RTBEXHU2NjJGXHU5RUQ4XHU4QkE0XHU3Njg0IFtbIF1dIFx1OTRGRVx1NjNBNSAqL1xyXG4gIGVtYmVkT25Ecm9wOiBib29sZWFuO1xyXG4gIGxheW91dDogTGF5b3V0O1xyXG4gIC8qKiBcdTVENENcdTU5NTdcdTU3MjhcdTU5MjdcdTUzNjFcdTcyNDdcdTkxQ0NcdTc2ODRcdTUzNjFcdTcyNDdcdTlFRDhcdThCQTRcdTVDM0FcdTVCRjggKi9cclxuICBuZXN0ZWRTaXplOiBTaXplO1xyXG4gIGNhcmRIZWlnaHQ6IG51bWJlcjtcclxuICBzdW1tYXJ5TGVuZ3RoOiBudW1iZXI7XHJcbiAgc2hvd0NvdmVyOiBib29sZWFuO1xyXG4gIHNob3dNZXRhOiBib29sZWFuO1xyXG4gIHNob3dUYWdzOiBib29sZWFuO1xyXG4gIHNob3dPcGVuQnV0dG9uOiBib29sZWFuO1xyXG4gIC8qKiBcdTUzNjFcdTcyNDdcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDBcdTZCNjNcdTY1ODcgKi9cclxuICBkZWZhdWx0RXhwYW5kZWQ6IGJvb2xlYW47XHJcbiAgLyoqIFx1NUQ0Q1x1NTcyOFx1NTM2MVx1NzI0N1x1OTFDQ1x1NzY4NFx1NUQ0Q1x1NTE2NVx1NjYyRlx1NTQyNlx1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMCAqL1xyXG4gIG5lc3RlZEV4cGFuZGVkOiBib29sZWFuO1xyXG4gIG1heE5lc3REZXB0aDogbnVtYmVyO1xyXG4gIGRlbnNpdHk6IERlbnNpdHk7XHJcbiAgc3VtbWFyeUZpZWxkczogc3RyaW5nW107XHJcbiAgY292ZXJGaWVsZHM6IHN0cmluZ1tdO1xyXG4gIG1ldGFGaWVsZHM6IHN0cmluZ1tdO1xyXG4gIHZlcmJvc2U6IGJvb2xlYW47XHJcbiAgLyoqIFx1NUUwM1x1NUM0MFx1OUVEOFx1OEJBNFx1NTAzQ1x1NTNEOFx1NTMxNlx1NjVGNlx1NzUyOFx1Njc2NVx1OEZDMVx1NzlGQlx1NjVFN1x1OEJCRVx1N0Y2RSAqL1xyXG4gIHNldHRpbmdzVmVyc2lvbj86IG51bWJlcjtcclxufVxyXG5cclxuLyoqIFx1NUUwM1x1NUM0MFx1NzZGOFx1NTE3M1x1OUVEOFx1OEJBNFx1NTAzQ1x1NTNEOFx1NjZGNFx1NjVGNiArMVx1RkYwQ1x1NjVFN1x1OEJCRVx1N0Y2RVx1NEYxQVx1ODhBQlx1NjVCMFx1OUVEOFx1OEJBNFx1NTAzQ1x1ODk4Nlx1NzZENiAqL1xyXG5leHBvcnQgY29uc3QgU0VUVElOR1NfVkVSU0lPTiA9IDM7XHJcblxyXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogQXRvbWljQ2FyZHNTZXR0aW5ncyA9IHtcclxuICB1cGdyYWRlRW1iZWRzOiB0cnVlLFxyXG4gIGVtYmVkT25Ecm9wOiB0cnVlLFxyXG4gIGxheW91dDogXCJ3cmFwXCIsXHJcbiAgbmVzdGVkU2l6ZTogXCJub3JtYWxcIixcclxuICBjYXJkSGVpZ2h0OiAwLFxyXG4gIHN1bW1hcnlMZW5ndGg6IDE4MCxcclxuICBzaG93Q292ZXI6IHRydWUsXHJcbiAgc2hvd01ldGE6IHRydWUsXHJcbiAgc2hvd1RhZ3M6IHRydWUsXHJcbiAgc2hvd09wZW5CdXR0b246IHRydWUsXHJcbiAgZGVmYXVsdEV4cGFuZGVkOiB0cnVlLFxyXG4gIG5lc3RlZEV4cGFuZGVkOiB0cnVlLFxyXG4gIG1heE5lc3REZXB0aDogMyxcclxuICBkZW5zaXR5OiBcImNvbWZvcnRhYmxlXCIsXHJcbiAgc3VtbWFyeUZpZWxkczogW1wic3VtbWFyeVwiLCBcImRlc2NyaXB0aW9uXCIsIFwiYWJzdHJhY3RcIiwgXCJleGNlcnB0XCIsIFwiXHU3QjgwXHU0RUNCXCIsIFwiXHU2NDU4XHU4OTgxXCJdLFxyXG4gIGNvdmVyRmllbGRzOiBbXCJjb3ZlclwiLCBcImltYWdlXCIsIFwiYmFubmVyXCIsIFwidGh1bWJuYWlsXCIsIFwiaW1nXCIsIFwiXHU1QzAxXHU5NzYyXCJdLFxyXG4gIG1ldGFGaWVsZHM6IFtcInR5cGVcIiwgXCJzdGF0dXNcIiwgXCJkb21haW5cIiwgXCJjb21wbGV4aXR5XCJdLFxyXG4gIHZlcmJvc2U6IGZhbHNlLFxyXG59O1xyXG5cclxuLyoqIFx1NkUzMlx1NjdEM1x1NTM1NVx1NUYyMFx1NTM2MVx1NzI0N1x1NjI0MFx1OTcwMFx1OTAwOVx1OTg3OVx1RkYwQ1x1NTE2OFx1OTBFOFx1Njc2NVx1ODFFQVx1NjNEMlx1NEVGNlx1OEJCRVx1N0Y2RVx1RkYwOFx1NkNBMVx1NjcwOVx1NTc1N1x1NTE4NVx1OTAwOVx1OTg3OVx1NEU4Nlx1RkYwOSAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlck9wdGlvbnMge1xyXG4gIHNpemU6IFNpemU7XHJcbiAgZGVuc2l0eTogRGVuc2l0eTtcclxuICBsYXlvdXQ6IExheW91dDtcclxuICBjb3ZlcjogYm9vbGVhbjtcclxuICBtZXRhOiBib29sZWFuO1xyXG4gIHRhZ3M6IGJvb2xlYW47XHJcbiAgb3BlbjogYm9vbGVhbjtcclxuICBleHBhbmRlZDogYm9vbGVhbjtcclxuICAvKiogXHU1MzYxXHU3MjQ3XHU2NzAwXHU1OTI3XHU5QUQ4XHU1RUE2XHVGRjBDMCA9IFx1NEUwRFx1OTY1MFx1NTIzNiAqL1xyXG4gIGhlaWdodDogbnVtYmVyO1xyXG4gIC8qKiBcdTgxRUFcdTUyQThcdTY0NThcdTg5ODFcdTVCNTdcdTdCMjZcdTY1NzAgKi9cclxuICBzdW1tYXJ5OiBudW1iZXI7XHJcbn1cclxuXHJcbi8qKiBcdTk3NUVcdTdCMTRcdThCQjBcdTc2ODRcdTVENENcdTUxNjVcdUZGMDhcdTU2RkVcdTcyNDcgLyBcdTk3RjNcdTg5QzZcdTk4OTEgLyBQREYgLyBcdTc1M0JcdTVFMDNcdTdCNDlcdUZGMDlcdTRFMERcdTUwNUFcdTUzNjFcdTcyNDdcdTUzMTYgKi9cclxuZXhwb3J0IGNvbnN0IFNLSVBfRU1CRURfRVhUID1cclxuICAvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxzdmd8Ym1wfGljb3xhdmlmfG1wM3x3YXZ8b2dnfGZsYWN8bTRhfG1wNHx3ZWJtfG1vdnxwZGZ8Y2FudmFzfGV4Y2FsaWRyYXcpJC9pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQU9POzs7QUNQUCxJQUFBQyxtQkFBZ0Q7OztBQ0FoRCxzQkFBMEY7QUF3QjFGLElBQU0sUUFBUSxvQkFBSSxJQUFzQjtBQUV4QyxTQUFTLGlCQUFpQixLQUFxQjtBQUM3QyxRQUFNLElBQUksSUFBSSxNQUFNLGlDQUFpQztBQUNyRCxTQUFPLElBQUksSUFBSSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sSUFBSTtBQUN0QztBQUdPLFNBQVMsWUFBWSxNQUFzQjtBQUNoRCxTQUFPLGlCQUFpQixJQUFJLEVBQ3pCLFFBQVEsbUJBQW1CLEVBQUUsRUFDN0IsUUFBUSwrQkFBK0IsRUFBRSxFQUN6QyxRQUFRLG9CQUFvQixFQUFFLEVBQzlCLFFBQVEseUJB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
