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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy9tYWluLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvY2FyZC50cyIsICIuLi8uLi8uLi8ucGx1Z2lucy9hdG9taWMtY2FyZHMvc3JjL21ldGFkYXRhLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvc2V0dGluZ3MudHMiLCAiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy90eXBlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcclxuICBFZGl0b3IsXHJcbiAgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcclxuICBNYXJrZG93blJlbmRlckNoaWxkLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBOb3RpY2UsXHJcbiAgUGx1Z2luLFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyByZW5kZXJDYXJkLCBnZXROZXN0LCB3aXRoTmVzdCB9IGZyb20gXCIuL2NhcmRcIjtcclxuaW1wb3J0IHsgcmVhZE5vdGVNZXRhIH0gZnJvbSBcIi4vbWV0YWRhdGFcIjtcclxuaW1wb3J0IHsgQXRvbWljQ2FyZHNTZXR0aW5nVGFiIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuaW1wb3J0IHtcclxuICBBdG9taWNDYXJkc1NldHRpbmdzLFxyXG4gIERFRkFVTFRfU0VUVElOR1MsXHJcbiAgUmVuZGVyT3B0aW9ucyxcclxuICBTRVRUSU5HU19WRVJTSU9OLFxyXG4gIFNpemUsXHJcbiAgU0tJUF9FTUJFRF9FWFQsXHJcbn0gZnJvbSBcIi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEF0b21pY0NhcmRzUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICBzZXR0aW5nczogQXRvbWljQ2FyZHNTZXR0aW5ncyA9IHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9O1xyXG5cclxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG4gICAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEF0b21pY0NhcmRzU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cclxuICAgICAgLy8gXHU2M0E1XHU3QkExIE9ic2lkaWFuIFx1NTM5Rlx1NzUxRiAhW1sgXV0gXHU1RDRDXHU1MTY1XHVGRjFBXHU4QkVEXHU2Q0Q1XHU0RkREXHU2MzAxXHU1MzlGXHU3NTFGXHVGRjBDXHU1M0VBXHU2MjhBXHU2RTMyXHU2N0QzXHU2NkZGXHU2MzYyXHU2MjEwXHU1MzYxXHU3MjQ3XHUzMDAyXHJcbiAgICAgIC8vIHNvcnRPcmRlciBcdTUzRDZcdTU5MjdcdTUwM0MgXHUyMTkyIFx1NjM5Mlx1NTcyOFx1NjI0MFx1NjcwOVx1NTE4NVx1N0Y2RVx1NTkwNFx1NzQwNlx1NTY2OFx1RkYwOFx1NTQyQlx1NUQ0Q1x1NTE2NVx1NkUzMlx1NjdEM1x1RkYwOVx1NEU0Qlx1NTQwRVx1OEZEMFx1ODg0Q1x1RkYwQ1xyXG4gICAgICAvLyBcdTU0MjZcdTUyMTkgcG9zdCBwcm9jZXNzb3IgXHU0RjFBXHU4REQxXHU1NzI4XHU1RDRDXHU1MTY1XHU3NTFGXHU2MjEwXHU0RTRCXHU1MjREXHVGRjBDXHU0RUMwXHU0RTQ4XHU0RTVGXHU1MzM5XHU5MTREXHU0RTBEXHU1MjMwXHUzMDAyXHJcbiAgICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93blBvc3RQcm9jZXNzb3IoXHJcbiAgICAgICAgKGVsLCBjdHgpID0+IHtcclxuICAgICAgICAgIHRoaXMudXBncmFkZUVtYmVkcyhlbCwgY3R4KTtcclxuICAgICAgICAgIC8vIFx1NUQ0Q1x1NTE2NVx1NzUzMSBPYnNpZGlhbiBcdTVGMDJcdTZCNjVcdTU4NkJcdTUxNDVcdUZGMENcdTg4NjVcdTRFMjRcdTZCMjFcdTYyNkJcdTYzQ0ZcdTUxNUNcdTVFOTVcdTMwMDJcclxuICAgICAgICAgIC8vIFx1NURGMlx1NjNBNVx1N0JBMVx1NzY4NFx1NTE0M1x1N0QyMFx1NUUyNiBkYXRhLWFjLXVwZ3JhZGVkXHVGRjBDXHU5MUNEXHU1OTBEXHU2MjZCXHU2M0NGXHU0RTBEXHU0RjFBXHU5MUNEXHU1OTBEXHU2RTMyXHU2N0QzXHUzMDAyXHJcbiAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0aGlzLnVwZ3JhZGVFbWJlZHMoZWwsIGN0eCksIDYwKTtcclxuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMudXBncmFkZUVtYmVkcyhlbCwgY3R4KSwgNDAwKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIDEwMDBcclxuICAgICAgKTtcclxuXHJcbiAgICAgIHRoaXMucmVnaXN0ZXJDb21tYW5kcygpO1xyXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy52ZXJib3NlKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBcdTVERjJcdTUyQTBcdThGN0RcdUZGMEN1cGdyYWRlRW1iZWRzID1cIiwgdGhpcy5zZXR0aW5ncy51cGdyYWRlRW1iZWRzKTtcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbYXRvbWljLWNhcmRzXSBvbmxvYWQgXHU1OTMxXHU4RDI1XHVGRjFBXCIsIGVycik7XHJcbiAgICAgIG5ldyBOb3RpY2UoYEF0b21pYyBDYXJkcyBcdTUyQTBcdThGN0RcdTU5MzFcdThEMjVcdUZGMUEke1N0cmluZyhlcnIpfWApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgb251bmxvYWQoKTogdm9pZCB7XHJcbiAgICAvKiBDb21wb25lbnQgXHU3NTFGXHU1NDdEXHU1NDY4XHU2NzFGXHU3NTMxIGN0eC5hZGRDaGlsZCBcdTYyNThcdTdCQTEgKi9cclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHNhdmVkID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpO1xyXG4gICAgaWYgKHNhdmVkICYmIHR5cGVvZiBzYXZlZCA9PT0gXCJvYmplY3RcIikge1xyXG4gICAgICAvLyBcdTVFMDNcdTVDNDBcdTlFRDhcdThCQTRcdTUwM0NcdTUzRDhcdTRFODZcdUZGMENcdTY1RTdcdTVCNThcdTY4NjNcdTg5ODFcdThGQzFcdTc5RkJcdUZGMENcdTU0MjZcdTUyMTlcdTc1MjhcdTYyMzdcdTdBRUZcdTc3MEJcdTUyMzBcdTc2ODRcdThGRDhcdTY2MkZcdTY1RTdcdTVFMDNcdTVDNDBcclxuICAgICAgaWYgKHNhdmVkLnNldHRpbmdzVmVyc2lvbiAhPT0gU0VUVElOR1NfVkVSU0lPTikge1xyXG4gICAgICAgIE9iamVjdC5hc3NpZ24oc2F2ZWQsIHtcclxuICAgICAgICAgIGxheW91dDogREVGQVVMVF9TRVRUSU5HUy5sYXlvdXQsXHJcbiAgICAgICAgICBuZXN0ZWRTaXplOiBERUZBVUxUX1NFVFRJTkdTLm5lc3RlZFNpemUsXHJcbiAgICAgICAgICBkZWZhdWx0RXhwYW5kZWQ6IERFRkFVTFRfU0VUVElOR1MuZGVmYXVsdEV4cGFuZGVkLFxyXG4gICAgICAgICAgbmVzdGVkRXhwYW5kZWQ6IERFRkFVTFRfU0VUVElOR1MubmVzdGVkRXhwYW5kZWQsXHJcbiAgICAgICAgICBzZXR0aW5nc1ZlcnNpb246IFNFVFRJTkdTX1ZFUlNJT04sXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YShzYXZlZCk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oeyAuLi5ERUZBVUxUX1NFVFRJTkdTIH0sIHNhdmVkKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MgfTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XHJcbiAgfVxyXG5cclxuICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAqIFx1NkUzMlx1NjdEM1x1RkYxQVx1NjNBNVx1N0JBMVx1NTM5Rlx1NzUxRlx1NUQ0Q1x1NTE2NVxyXG4gICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuICBwcml2YXRlIHVwZ3JhZGVFbWJlZHMoZWw6IEhUTUxFbGVtZW50LCBjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMuZG9VcGdyYWRlRW1iZWRzKGVsLCBjdHgpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbYXRvbWljLWNhcmRzXSB1cGdyYWRlRW1iZWRzIFx1NTFGQVx1OTUxOVx1RkYxQVwiLCBlcnIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkb1VwZ3JhZGVFbWJlZHMoZWw6IEhUTUxFbGVtZW50LCBjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5zZXR0aW5ncy51cGdyYWRlRW1iZWRzKSByZXR1cm47XHJcbiAgICAvLyBcdThGQkVcdTUyMzBcdTVENENcdTU5NTdcdTRFMEFcdTk2NTBcdTY1RjZcdTRFMERcdTUxOERcdTYzQTVcdTdCQTFcdUZGMENcdTkwN0ZcdTUxNERcdTVGQUFcdTczQUZcdTVGMTVcdTc1MjhcdTY1RTBcdTk2NTBcdTU5NTdcdTVBMDNcclxuICAgIGlmIChnZXROZXN0KCkgPj0gdGhpcy5zZXR0aW5ncy5tYXhOZXN0RGVwdGgpIHJldHVybjtcclxuXHJcbiAgICAvLyA6bm90KC5tZWRpYS1lbWJlZCkgXHU3NkY0XHU2M0E1XHU1NzI4XHU5MDA5XHU2MkU5XHU1NjY4XHU1QzQyXHU2MzkyXHU2Mzg5XHU1NkZFXHU3MjQ3L1x1OTdGM1x1ODlDNlx1OTg5MVx1NUQ0Q1x1NTE2NVx1RkYwQ1xyXG4gICAgLy8gXHU0RTBEXHU3NTI4XHU2MjhBXHU1QjgzXHU0RUVDXHU2MzVFXHU4RkRCXHU1RkFBXHU3M0FGXHU1MThEXHU4RkM3XHU2RUU0XHVGRjA4XHU2NzYxXHU3NkVFXHU2QjYzXHU2NTg3XHU5MUNDXHU1RTM4XHU2NzA5XHU1MUUwXHU1MzQxXHU1RjIwXHU1NkZFXHVGRjA5XHUzMDAyXHJcbiAgICBjb25zdCBub2RlcyA9IEFycmF5LmZyb20oXHJcbiAgICAgIGVsLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxyXG4gICAgICAgIFwiLmludGVybmFsLWVtYmVkOm5vdCgubWVkaWEtZW1iZWQpLCAubWFya2Rvd24tZW1iZWQ6bm90KC5tZWRpYS1lbWJlZClcIlxyXG4gICAgICApXHJcbiAgICApLmZpbHRlcigobikgPT4gIW4uZGF0YXNldC5hY1VwZ3JhZGVkKTtcclxuXHJcbiAgICBsZXQgdGFrZW4gPSAwO1xyXG4gICAgZm9yIChjb25zdCBlbWJlZCBvZiBub2Rlcykge1xyXG4gICAgICAvLyBcdTI2QTBcdUZFMEYgXHU1M0VBXHU1MjI0XHU2NUFEXCJcdTVENENcdTUxNjVcdTY3MkNcdThFQUJcIlx1NjYyRlx1NEUwRFx1NjYyRlx1NUE5Mlx1NEY1M1x1NTE0M1x1N0QyMFx1RkYwQ1x1NEUwRFx1ODBGRFx1NjdFNVx1NjI0MFx1NjcwOVx1NTQwRVx1NEVFM1x1RkYxQVxyXG4gICAgICAvLyBcdTdCMTRcdThCQjBcdTZCNjNcdTY1ODdcdTkxQ0NcdTY2NkVcdTkwNERcdTY3MDlcdTU2RkVcdTcyNDdcdUZGMENcdTc1MjggcXVlcnlTZWxlY3RvciBcdTRGMUFcdTYyOEFcdTY1NzRcdTdCQzdcdTVENENcdTUxNjVcdThCRUZcdTUyMjRcdTYyMTBcdTU2RkVcdTcyNDdcdTVENENcdTUxNjVcdTMwMDJcclxuICAgICAgY29uc3QgZmlyc3QgPSBlbWJlZC5maXJzdEVsZW1lbnRDaGlsZDtcclxuICAgICAgaWYgKGZpcnN0ICYmIC9eKElNR3xBVURJT3xWSURFT3xDQU5WQVN8SUZSQU1FKSQvLnRlc3QoZmlyc3QudGFnTmFtZSkpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgLy8gc3JjIFx1NEYxOFx1NTE0OFx1RkYwQ1x1NkNBMVx1NjcwOVx1NTIxOVx1NzUyOCBhbHQgXHU1MTVDXHU1RTk1XHJcbiAgICAgIGNvbnN0IHNyYyA9IChlbWJlZC5nZXRBdHRyaWJ1dGUoXCJzcmNcIikgPz8gZW1iZWQuZ2V0QXR0cmlidXRlKFwiYWx0XCIpID8/IFwiXCIpLnRyaW0oKTtcclxuICAgICAgaWYgKCFzcmMpIGNvbnRpbnVlO1xyXG4gICAgICAvLyBcdTU2RkVcdTcyNDcgLyBcdTk3RjNcdTg5QzZcdTk4OTEgLyBQREYgLyBcdTc1M0JcdTVFMDNcdTdCNDlcdTYzMDlcdTYyNjlcdTVDNTVcdTU0MERcdTYzOTJcdTk2NjRcclxuICAgICAgaWYgKFNLSVBfRU1CRURfRVhULnRlc3Qoc3JjLnNwbGl0KFwiI1wiKVswXSkpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgZW1iZWQuZGF0YXNldC5hY1VwZ3JhZGVkID0gXCIxXCI7XHJcbiAgICAgIHRha2VuKys7XHJcbiAgICAgIHZvaWQgdGhpcy5yZXBsYWNlV2l0aENhcmQoZW1iZWQsIHNyYywgY3R4KS5jYXRjaCgoZXJyKSA9PlxyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbYXRvbWljLWNhcmRzXSBcdTZFMzJcdTY3RDNcdTUzNjFcdTcyNDdcdTU5MzFcdThEMjVcdUZGMUFcIiwgc3JjLCBlcnIpXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvLyBcdTVFMzhcdTg5QzRcdThGRDBcdTg4NENcdTRFMERcdTYyNTNcdTUzNzBcdUZGMENcdTYzOTJcdTY3RTVcdTY1RjZcdTU3MjhcdThCQkVcdTdGNkVcdTkxQ0NcdTYyNTNcdTVGMDBcdTMwMENcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcdTMwMERcclxuICAgIGlmICh0YWtlbiAmJiB0aGlzLnNldHRpbmdzLnZlcmJvc2UpIHtcclxuICAgICAgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBcdTVERjJcdTYzQTVcdTdCQTFcIiwgdGFrZW4sIFwiXHU1OTA0XHU1RDRDXHU1MTY1XCIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyByZXBsYWNlV2l0aENhcmQoXHJcbiAgICBlbWJlZDogSFRNTEVsZW1lbnQsXHJcbiAgICBzcmM6IHN0cmluZyxcclxuICAgIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dFxyXG4gICk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgZGVwdGggPSBnZXROZXN0KCk7XHJcbiAgICBjb25zdCBzaXplOiBTaXplID0gZGVwdGggPiAwID8gdGhpcy5zZXR0aW5ncy5uZXN0ZWRTaXplIDogXCJub3JtYWxcIjtcclxuICAgIGNvbnN0IGlzU21hbGwgPSBzaXplID09PSBcInNtYWxsXCI7XHJcblxyXG4gICAgY29uc3Qgb3B0czogUmVuZGVyT3B0aW9ucyA9IHtcclxuICAgICAgc2l6ZSxcclxuICAgICAgZGVuc2l0eTogaXNTbWFsbCA/IFwiY29tcGFjdFwiIDogdGhpcy5zZXR0aW5ncy5kZW5zaXR5LFxyXG4gICAgICBsYXlvdXQ6IHRoaXMuc2V0dGluZ3MubGF5b3V0LFxyXG4gICAgICBjb3ZlcjogdGhpcy5zZXR0aW5ncy5zaG93Q292ZXIsXHJcbiAgICAgIG1ldGE6IGlzU21hbGwgPyBmYWxzZSA6IHRoaXMuc2V0dGluZ3Muc2hvd01ldGEsXHJcbiAgICAgIHRhZ3M6IGlzU21hbGwgPyBmYWxzZSA6IHRoaXMuc2V0dGluZ3Muc2hvd1RhZ3MsXHJcbiAgICAgIC8vIFx1NjgwN1x1OTg5OFx1NjYyRlx1NjI5OFx1NTNFMFx1NUYwMFx1NTE3M1x1RkYwQ1wiXHU2MjUzXHU1RjAwXCJcdTYzMDlcdTk0QUVcdTY2MkZcdTU1MkZcdTRFMDBcdTc2ODRcdThERjNcdThGNkNcdTUxNjVcdTUzRTNcclxuICAgICAgb3BlbjogaXNTbWFsbCA/IHRydWUgOiB0aGlzLnNldHRpbmdzLnNob3dPcGVuQnV0dG9uLFxyXG4gICAgICBleHBhbmRlZDogZGVwdGggPiAwID8gdGhpcy5zZXR0aW5ncy5uZXN0ZWRFeHBhbmRlZCA6IHRoaXMuc2V0dGluZ3MuZGVmYXVsdEV4cGFuZGVkLFxyXG4gICAgICBoZWlnaHQ6IHRoaXMuc2V0dGluZ3MuY2FyZEhlaWdodCxcclxuICAgICAgc3VtbWFyeTogaXNTbWFsbCA/IDkwIDogdGhpcy5zZXR0aW5ncy5zdW1tYXJ5TGVuZ3RoLFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBcdTYzMDJcdTU3MjhcdTZFMzhcdTc5QkJcdTgyODJcdTcwQjlcdTRFMEFcdUZGMUFcdTUzRUFcdTUwMUZcdTc1MjhcdTc1MUZcdTU0N0RcdTU0NjhcdTY3MUZcdUZGMENvbnVubG9hZCBcdTY1RjZcdTZFMDVcdTdBN0FcdTVCODNcdTRFMERcdTVGNzFcdTU0Q0RcdTY1ODdcdTY4NjNcclxuICAgIGNvbnN0IGhvbGRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgTWFya2Rvd25SZW5kZXJDaGlsZChob2xkZXIpO1xyXG4gICAgY29tcG9uZW50LmxvYWQoKTtcclxuICAgIGN0eC5hZGRDaGlsZChjb21wb25lbnQpO1xyXG5cclxuICAgIGNvbnN0IGVudiA9IHtcclxuICAgICAgYXBwOiB0aGlzLmFwcCxcclxuICAgICAgc2V0dGluZ3M6IHRoaXMuc2V0dGluZ3MsXHJcbiAgICAgIHNvdXJjZVBhdGg6IGN0eC5zb3VyY2VQYXRoLFxyXG4gICAgICBjb21wb25lbnQsXHJcbiAgICAgIC8vICsxXHVGRjFBXHU1MzYxXHU3MjQ3XHU2QjYzXHU2NTg3XHU5MUNDXHU1MThEXHU2RTMyXHU2N0QzXHU3Njg0XHU1MTg1XHU1QkI5XHU1QzVFXHU0RThFXHU0RTBCXHU0RTAwXHU1QzQyXHVGRjBDXHU5MDEyXHU1ODlFXHU1NDBFXHU1RDRDXHU1OTU3XHU2REYxXHU1RUE2XHU0RTBBXHU5NjUwXHU2MjREXHU2NzA5XHU2NTQ4XHJcbiAgICAgIGRlcHRoOiBkZXB0aCArIDEsXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFx1MjZBMFx1RkUwRiBcdTUxNDhcdTU0MENcdTZCNjVcdTUzNjBcdTRGNEZcdTRGNERcdTdGNkVcdUZGMENcdTUxOERcdTVGMDJcdTZCNjVcdTc1MUZcdTYyMTBcdTc3MUZcdTZCNjNcdTc2ODRcdTUzNjFcdTcyNDdcdTMwMDJcclxuICAgIC8vIFx1NEU0Qlx1NTI0RFx1NjYyRiBhd2FpdCBcdTRFNEJcdTU0MEVcdTUxOEQgcmVwbGFjZVdpdGhcdUZGMENcdTRGNDYgcmVhZE5vdGVNZXRhIFx1NjYyRlx1NUYwMlx1NkI2NVx1NzY4NFx1RkYwQ1xyXG4gICAgLy8gXHU3QjQ5XHU1QjgzXHU4RkQ0XHU1NkRFXHU2NUY2IE9ic2lkaWFuIFx1NTNFRlx1ODBGRFx1NURGMlx1N0VDRlx1OTFDRFx1NUVGQVx1OEZDN1x1ODI4Mlx1NzBCOSBcdTIxOTIgZW1iZWQuaXNDb25uZWN0ZWQgXHU0RTNBIGZhbHNlIFx1MjE5MiBcdTUzNjFcdTcyNDdcdTRFMjJcdTU5MzFcdTMwMDJcclxuICAgIC8vIFx1NTE0OFx1NjUzRVx1NTM2MFx1NEY0RFx1NTE0M1x1N0QyMFx1NUMzMVx1NEUwRFx1NUI1OFx1NTcyOFx1OEZEOVx1NEUyQVx1N0FERVx1NjAwMVx1RkYxQVx1NTM2MFx1NEY0RFx1NTE0M1x1N0QyMFx1OTY4Rlx1NzIzNlx1ODI4Mlx1NzBCOVx1NEUwMFx1OEQ3N1x1NzU1OVx1NTcyOFx1NjU4N1x1Njg2M1x1OTFDQ1x1MzAwMlxyXG4gICAgY29uc3QgcGxhY2Vob2xkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgcGxhY2Vob2xkZXIuY2xhc3NOYW1lID0gXCJhYy1jYXJkIGFjLWNhcmQtLXBlbmRpbmdcIjtcclxuICAgIHBsYWNlaG9sZGVyLmRhdGFzZXQuYWNQYXRoID0gc3JjO1xyXG4gICAgcGxhY2Vob2xkZXIuc2V0VGV4dChzcmMuc3BsaXQoXCIvXCIpLnBvcCgpPy5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIikgPz8gc3JjKTtcclxuICAgIGVtYmVkLnJlcGxhY2VXaXRoKHBsYWNlaG9sZGVyKTtcclxuXHJcbiAgICAvLyBzcmMgXHU1RjYyXHU1OTgyIFwiXHU3QjE0XHU4QkIwXCJcdTMwMDFcIlx1N0IxNFx1OEJCMC5tZFwiXHUzMDAxXCJcdTdCMTRcdThCQjAjXHU2ODA3XHU5ODk4XCJcdTMwMDFcIlx1N0IxNFx1OEJCMCNeXHU1NzU3aWRcIlxyXG4gICAgY29uc3QgdGFyZ2V0ID0gc3JjLnJlcGxhY2UoL1xcLm1kKD89I3wkKS9pLCBcIlwiKTtcclxuICAgIGNvbnN0IG1ldGEgPSBhd2FpdCByZWFkTm90ZU1ldGEodGhpcy5hcHAsIHRhcmdldCwgY3R4LnNvdXJjZVBhdGgsIHRoaXMuc2V0dGluZ3MpO1xyXG5cclxuICAgIGNvbnN0IGNhcmQgPSB3aXRoTmVzdChkZXB0aCwgKCkgPT4gcmVuZGVyQ2FyZChlbnYsIG1ldGEsIG9wdHMpKTtcclxuICAgIHBsYWNlaG9sZGVyLnJlcGxhY2VXaXRoKGNhcmQpO1xyXG4gIH1cclxuXHJcbiAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgKiBcdTU0N0RcdTRFRTRcclxuICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbiAgcHJpdmF0ZSBhY3RpdmVFZGl0b3IoKTogRWRpdG9yIHwgbnVsbCB7XHJcbiAgICBjb25zdCB2aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgIHJldHVybiB2aWV3Py5lZGl0b3IgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVnaXN0ZXJDb21tYW5kcygpOiB2b2lkIHtcclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImxpbmtzLXRvLWVtYmVkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NjI4QVx1OTAwOVx1NTMzQVx1OTFDQ1x1NzY4NCBbW1x1OTRGRVx1NjNBNV1dIFx1OEY2Q1x1NjIxMFx1NUQ0Q1x1NTE2NVx1NTIxN1x1ODg2OFwiLFxyXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB0aGlzLmxpbmtzVG9FbWJlZHMoZWRpdG9yKSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImluc2VydC1yZXZlcnNlLWVtYmVkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NjNEMlx1NTE2NVx1NTNDRFx1NjdFNVx1NTIxN1x1ODg2OFx1RkYwOFx1NUYxNVx1NzUyOFx1NjcyQ1x1NjU4N1x1NzY4NFx1N0IxNFx1OEJCMFx1RkYwQ1x1NzUxRlx1NjIxMFx1NEUzQVx1NUQ0Q1x1NTE2NVx1RkYwOVwiLFxyXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB0aGlzLmluc2VydFJldmVyc2VFbWJlZHMoZWRpdG9yKSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcInRvZ2dsZS1hbGwtY2FyZHNcIixcclxuICAgICAgbmFtZTogXCJcdTVDNTVcdTVGMDAgLyBcdTY1MzZcdThENzdcdTY3MkNcdTk4NzVcdTYyNDBcdTY3MDlcdTUzNjFcdTcyNDdcIixcclxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBjYXJkcyA9IEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIuYWMtY2FyZFwiKSk7XHJcbiAgICAgICAgaWYgKCFjYXJkcy5sZW5ndGgpIHtcclxuICAgICAgICAgIG5ldyBOb3RpY2UoXCJcdTVGNTNcdTUyNERcdTg5QzZcdTU2RkVcdTkxQ0NcdTZDQTFcdTY3MDlcdTUzNjFcdTcyNDdcIik7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IGNvbGxhcHNlZCA9IGNhcmRzLmZpbHRlcigoYykgPT4gIWMuY2xhc3NMaXN0LmNvbnRhaW5zKFwiaXMtZXhwYW5kZWRcIikpO1xyXG4gICAgICAgIGNvbnN0IHRhcmdldHMgPSBjb2xsYXBzZWQubGVuZ3RoID8gY29sbGFwc2VkIDogY2FyZHM7XHJcbiAgICAgICAgZm9yIChjb25zdCBjIG9mIHRhcmdldHMpIGMucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCIuYWMtYnRuLS10b2dnbGVcIik/LmNsaWNrKCk7XHJcbiAgICAgICAgbmV3IE5vdGljZShjb2xsYXBzZWQubGVuZ3RoID8gYFx1NURGMlx1NUM1NVx1NUYwMCAke3RhcmdldHMubGVuZ3RofSBcdTVGMjBcdTUzNjFcdTcyNDdgIDogYFx1NURGMlx1NjUzNlx1OEQ3NyAke3RhcmdldHMubGVuZ3RofSBcdTVGMjBcdTUzNjFcdTcyNDdgKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqIFx1OTAwOVx1NTMzQVx1OTFDQ1x1NzY4NCBbW1x1OTRGRVx1NjNBNV1dIFx1MjE5MiBcdTUzOUZcdTc1MUZcdTVENENcdTUxNjVcdTUyMTdcdTg4NjggYC0gIVtbXHU5NEZFXHU2M0E1XV1gICovXHJcbiAgcHJpdmF0ZSBsaW5rc1RvRW1iZWRzKGVkaXRvcjogRWRpdG9yKTogdm9pZCB7XHJcbiAgICBjb25zdCBzZWwgPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XHJcbiAgICBpZiAoIXNlbC50cmltKCkpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlx1OEJGN1x1NTE0OFx1OTAwOVx1NEUyRFx1NTMwNVx1NTQyQiBbW1x1OTRGRVx1NjNBNV1dIFx1NzY4NFx1NjU4N1x1NjcyQ1wiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcmUgPSAvXFxbXFxbKFteXFxdfCNdKykoPzojW15cXF18XSopPyg/OlxcfFteXFxdXSopP1xcXVxcXS9nO1xyXG4gICAgY29uc3QgZm91bmQ6IHN0cmluZ1tdID0gW107XHJcbiAgICBsZXQgbTogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcclxuICAgIHdoaWxlICgobSA9IHJlLmV4ZWMoc2VsKSkgIT09IG51bGwpIHtcclxuICAgICAgY29uc3QgdCA9IG1bMV0udHJpbSgpO1xyXG4gICAgICBpZiAodCAmJiAhZm91bmQuaW5jbHVkZXModCkpIGZvdW5kLnB1c2godCk7XHJcbiAgICB9XHJcbiAgICBpZiAoIWZvdW5kLmxlbmd0aCkge1xyXG4gICAgICBuZXcgTm90aWNlKFwiXHU5MDA5XHU1MzNBXHU5MUNDXHU2Q0ExXHU2NzA5IFtbXHU5NEZFXHU2M0E1XV1cIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKGZvdW5kLm1hcCgodCkgPT4gYC0gIVtbJHt0fV1dYCkuam9pbihcIlxcblwiKSk7XHJcbiAgICBuZXcgTm90aWNlKGBcdTVERjJcdTYzRDJcdTUxNjUgJHtmb3VuZC5sZW5ndGh9IFx1NTkwNFx1NUQ0Q1x1NTE2NWApO1xyXG4gIH1cclxuXHJcbiAgLyoqIFx1NTNDRFx1NjdFNVx1RkYxQVx1NjI4QVx1NUYxNVx1NzUyOFx1NEU4Nlx1NjcyQ1x1NjU4N1x1NzY4NFx1N0IxNFx1OEJCMFx1NEVFNVx1NTM5Rlx1NzUxRlx1NUQ0Q1x1NTE2NVx1NTIxN1x1ODg2OFx1NjNEMlx1NTE2NVx1RkYwOFx1OTc1OVx1NjAwMVx1N0VEM1x1Njc5Q1x1RkYwQ1x1NEUwRFx1NjYyRlx1NTJBOFx1NjAwMVx1NkUzMlx1NjdEM1x1RkYwOSAqL1xyXG4gIHByaXZhdGUgaW5zZXJ0UmV2ZXJzZUVtYmVkcyhlZGl0b3I6IEVkaXRvcik6IHZvaWQge1xyXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XHJcbiAgICBpZiAoIWZpbGUpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlx1NUY1M1x1NTI0RFx1NkNBMVx1NjcwOVx1NjI1M1x1NUYwMFx1NzY4NFx1NjU4N1x1NEVGNlwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbGlua3MgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLnJlc29sdmVkTGlua3M7XHJcbiAgICBjb25zdCByZWZzID0gT2JqZWN0LmtleXMobGlua3MpLmZpbHRlcigoc3JjKSA9PiBsaW5rc1tzcmNdPy5bZmlsZS5wYXRoXSk7XHJcbiAgICBpZiAoIXJlZnMubGVuZ3RoKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJcdTZDQTFcdTY3MDlcdTdCMTRcdThCQjBcdTVGMTVcdTc1MjhcdTY3MkNcdTY1ODdcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IHRleHQgPSBgXHU4OEFCXHU1RjE1XHU3NTI4XHU1NzI4XHVGRjFBXFxuXFxuJHtyZWZzXHJcbiAgICAgIC5tYXAoKHIpID0+IGAtICFbWyR7ci5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIil9XV1gKVxyXG4gICAgICAuam9pbihcIlxcblwiKX1cXG5gO1xyXG4gICAgZWRpdG9yLnJlcGxhY2VSYW5nZSh0ZXh0LCBlZGl0b3IuZ2V0Q3Vyc29yKCkpO1xyXG4gICAgbmV3IE5vdGljZShgXHU1REYyXHU2M0QyXHU1MTY1ICR7cmVmcy5sZW5ndGh9IFx1Njc2MVx1NUYxNVx1NzUyOGApO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgQXBwLCBDb21wb25lbnQsIE5vdGljZSwgc2V0SWNvbiB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBOb3RlTWV0YSwgcmVuZGVyTWFya2Rvd24gfSBmcm9tIFwiLi9tZXRhZGF0YVwiO1xyXG5pbXBvcnQgeyBBdG9taWNDYXJkc1NldHRpbmdzLCBSZW5kZXJPcHRpb25zIH0gZnJvbSBcIi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ2FyZEVudiB7XHJcbiAgYXBwOiBBcHA7XHJcbiAgc2V0dGluZ3M6IEF0b21pY0NhcmRzU2V0dGluZ3M7XHJcbiAgc291cmNlUGF0aDogc3RyaW5nO1xyXG4gIGNvbXBvbmVudDogQ29tcG9uZW50O1xyXG4gIC8qKiBcdTVGNTNcdTUyNERcdTVENENcdTU5NTdcdTVDNDJcdTdFQTdcdUZGMENcdTc1MjhcdTRFOEVcdTkwMTJcdTVGNTJcdTZFMzJcdTY3RDNcdTY1RjZcdTk2NTBcdTUyMzZcdTZERjFcdTVFQTYgKi9cclxuICBkZXB0aDogbnVtYmVyO1xyXG59XHJcblxyXG5sZXQgbmVzdE1hcmtlciA9IDA7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmVzdCgpOiBudW1iZXIge1xyXG4gIHJldHVybiBuZXN0TWFya2VyO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd2l0aE5lc3Q8VD4oZGVwdGg6IG51bWJlciwgZm46ICgpID0+IFQpOiBUIHtcclxuICBjb25zdCBwcmV2ID0gbmVzdE1hcmtlcjtcclxuICBuZXN0TWFya2VyID0gZGVwdGg7XHJcbiAgdHJ5IHtcclxuICAgIHJldHVybiBmbigpO1xyXG4gIH0gZmluYWxseSB7XHJcbiAgICBuZXN0TWFya2VyID0gcHJldjtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZtdENvdW50KG46IG51bWJlcik6IHN0cmluZyB7XHJcbiAgcmV0dXJuIG4gPj0gMTAwMCA/IGAkeyhuIC8gMTAwMCkudG9GaXhlZCgxKX1rIFx1NUI1N2AgOiBgJHtufSBcdTVCNTdgO1xyXG59XHJcblxyXG4vKiogXHU2Q0ExXHU2NzA5XHU1QzAxXHU5NzYyXHU2NUY2XHVGRjBDXHU3NTI4XHU3QzdCXHU1NzhCL1x1OERFRlx1NUY4NFx1NjNBOFx1NjVBRFx1NEUwMFx1NEUyQVx1NTZGRVx1NjgwNyAqL1xyXG5mdW5jdGlvbiBpY29uRm9yKG1ldGE6IE5vdGVNZXRhKTogc3RyaW5nIHtcclxuICAvLyBcdTZCQjVcdTg0M0QgLyBcdTc3RTVcdThCQzZcdTcwQjlcdTdFQTdcdTVGMTVcdTc1MjhcclxuICBpZiAobWV0YS5ibG9ja0NvbnRlbnQpIHJldHVybiBcInF1b3RlXCI7XHJcbiAgY29uc3QgdHlwZSA9IChtZXRhLmJhZGdlcy5maW5kKChiKSA9PiBiLmtleSA9PT0gXCJ0eXBlXCIpPy52YWx1ZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xyXG4gIGNvbnN0IGhheSA9IGAke3R5cGV9ICR7bWV0YS5maWxlPy5wYXRoID8/IG1ldGEudGFyZ2V0fWAudG9Mb3dlckNhc2UoKTtcclxuICBpZiAoL2NoYXB0ZXJ8XHU3QUUwXHU4MjgyfFx1N0VDNFx1NTQwOC8udGVzdChoYXkpKSByZXR1cm4gXCJsYXllcnNcIjtcclxuICBpZiAoL2NvbmNlcHR8XHU2OTgyXHU1RkY1Ly50ZXN0KGhheSkpIHJldHVybiBcImxpZ2h0YnVsYlwiO1xyXG4gIGlmICgvZW50aXR5fFx1NUI5RVx1NEY1My8udGVzdChoYXkpKSByZXR1cm4gXCJ1c2VyXCI7XHJcbiAgaWYgKC9yZXNvdXJjZXxcdThENDRcdTZFOTAvLnRlc3QoaGF5KSkgcmV0dXJuIFwicGFja2FnZVwiO1xyXG4gIGlmICgvZ29hbHxcdTc2RUVcdTY4MDcvLnRlc3QoaGF5KSkgcmV0dXJuIFwidGFyZ2V0XCI7XHJcbiAgaWYgKC9tZXRhfGRhc2hib2FyZHxpbmRleC8udGVzdChoYXkpKSByZXR1cm4gXCJsYXlvdXQtZ3JpZFwiO1xyXG4gIGlmICgvYXRvbXxcdTUzOUZcdTVCNTAvLnRlc3QoaGF5KSkgcmV0dXJuIFwiY2lyY2xlLWRvdFwiO1xyXG4gIHJldHVybiBcImZpbGUtdGV4dFwiO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBvcGVuTm90ZShlbnY6IENhcmRFbnYsIG1ldGE6IE5vdGVNZXRhLCBlOiBNb3VzZUV2ZW50KSB7XHJcbiAgaWYgKCFtZXRhLmZpbGUpIHtcclxuICAgIGNvbnN0IG5hbWUgPSBtZXRhLnRhcmdldC5zcGxpdChcIiNcIilbMF0ucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IGVudi5hcHAudmF1bHQuY3JlYXRlKFxyXG4gICAgICAgIGAke25hbWV9Lm1kYCxcclxuICAgICAgICBgLS0tXFxudHlwZTogYXRvbVxcbnRpdGxlOiBcIiR7bWV0YS50aXRsZX1cIlxcbmNyZWF0ZWQ6ICR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKX1cXG4tLS1cXG5cXG4jICR7bWV0YS50aXRsZX1cXG5cXG5gXHJcbiAgICAgICk7XHJcbiAgICAgIGF3YWl0IGVudi5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsIGVudi5zb3VyY2VQYXRoLCBmYWxzZSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgbmV3IE5vdGljZShgXHU1MjFCXHU1RUZBXHU1OTMxXHU4RDI1XHVGRjFBJHtTdHJpbmcoZXJyKX1gKTtcclxuICAgIH1cclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgY29uc3QgbmV3TGVhZiA9IGUuY3RybEtleSB8fCBlLm1ldGFLZXkgfHwgZS5idXR0b24gPT09IDE7XHJcbiAgLy8gdGFyZ2V0IFx1NTNFRlx1ODBGRFx1NUUyNiAjXHU2ODA3XHU5ODk4IC8gI15cdTU3NTdpZFx1RkYwQ1x1NEVBNFx1N0VEOSBPYnNpZGlhbiBcdTVCOUFcdTRGNERcdTUyMzBcdTZCQjVcdTg0M0RcclxuICBhd2FpdCBlbnYuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQobWV0YS50YXJnZXQgfHwgbWV0YS5maWxlLnBhdGgsIGVudi5zb3VyY2VQYXRoLCBuZXdMZWFmKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaHJlZk9mKG1ldGE6IE5vdGVNZXRhKTogc3RyaW5nIHtcclxuICBpZiAoIW1ldGEuZmlsZSkgcmV0dXJuIFwiI1wiO1xyXG4gIHJldHVybiBtZXRhLnJlZiA/IGAke21ldGEuZmlsZS5wYXRofSMke21ldGEucmVmfWAgOiBtZXRhLmZpbGUucGF0aDtcclxufVxyXG5cclxuZnVuY3Rpb24gYnVpbGRNZXRhUm93KG1ldGE6IE5vdGVNZXRhKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcclxuICBpZiAoIW1ldGEuYmFkZ2VzLmxlbmd0aCAmJiAhbWV0YS51cGRhdGVkICYmICFtZXRhLndvcmRDb3VudCkgcmV0dXJuIG51bGw7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICByb3cuY2xhc3NOYW1lID0gXCJhYy1jYXJkX19tZXRhXCI7XHJcbiAgZm9yIChjb25zdCBiIG9mIG1ldGEuYmFkZ2VzLnNsaWNlKDAsIDIpKSB7XHJcbiAgICByb3cuY3JlYXRlU3Bhbih7IGNsczogYGFjLWJhZGdlIGFjLWJhZGdlLS0ke2Iua2V5fWAsIHRleHQ6IGIudmFsdWUgfSk7XHJcbiAgfVxyXG4gIGlmIChtZXRhLnVwZGF0ZWQpIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLW1ldGFfX2RhdGVcIiwgdGV4dDogbWV0YS51cGRhdGVkIH0pO1xyXG4gIGlmIChtZXRhLndvcmRDb3VudCkgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtbWV0YV9fd29yZHNcIiwgdGV4dDogZm10Q291bnQobWV0YS53b3JkQ291bnQpIH0pO1xyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJ1aWxkVGFnUm93KG1ldGE6IE5vdGVNZXRhLCBsaW1pdDogbnVtYmVyKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcclxuICBpZiAoIW1ldGEudGFncy5sZW5ndGgpIHJldHVybiBudWxsO1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgcm93LmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fdGFnc1wiO1xyXG4gIGZvciAoY29uc3QgdCBvZiBtZXRhLnRhZ3Muc2xpY2UoMCwgbGltaXQpKSByb3cuY3JlYXRlU3Bhbih7IGNsczogXCJhYy10YWdcIiwgdGV4dDogYCMke3R9YCB9KTtcclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ2FyZChlbnY6IENhcmRFbnYsIG1ldGE6IE5vdGVNZXRhLCBvcHRzOiBSZW5kZXJPcHRpb25zKTogSFRNTEVsZW1lbnQge1xyXG4gIGNvbnN0IGlzV3JhcCA9IG9wdHMubGF5b3V0ICE9PSBcImNhcmRcIjtcclxuICBjb25zdCBpc1NtYWxsID0gb3B0cy5zaXplID09PSBcInNtYWxsXCI7XHJcblxyXG4gIGNvbnN0IGNhcmQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIGNhcmQuY2xhc3NOYW1lID0gYGFjLWNhcmQgYWMtJHtvcHRzLmRlbnNpdHl9IGFjLXNpemUtJHtvcHRzLnNpemV9IGFjLSR7XHJcbiAgICBpc1dyYXAgPyBcIndyYXBcIiA6IFwiY2FyZHN0eWxlXCJcclxuICB9YDtcclxuICBjYXJkLmRhdGFzZXQucGF0aCA9IG1ldGEuZmlsZT8ucGF0aCA/PyBtZXRhLnRhcmdldDtcclxuICBpZiAoIW1ldGEuZmlsZSkgY2FyZC5jbGFzc0xpc3QuYWRkKFwiaXMtbWlzc2luZ1wiKTtcclxuICBpZiAobWV0YS5ibG9ja0NvbnRlbnQpIGNhcmQuY2xhc3NMaXN0LmFkZChcImlzLWJsb2NrXCIpO1xyXG4gIGlmIChvcHRzLmhlaWdodCA+IDApIGNhcmQuc3R5bGUuc2V0UHJvcGVydHkoXCItLWFjLWNhcmQtaFwiLCBgJHtvcHRzLmhlaWdodH1weGApO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NkI2M1x1NjU4N1x1NUJCOVx1NTY2OFx1RkYwOFx1NTE0OFx1NUVGQVx1RkYwQ1x1NjcwMFx1NTQwRSBhcHBlbmRcdUZGMDkgLS0tLS0tLS0tLSAqL1xyXG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIGJvZHkuY2xhc3NOYW1lID0gXCJhYy1jYXJkX19ib2R5XCI7XHJcbiAgYm9keS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgbGV0IGJvZHlMb2FkZWQgPSBmYWxzZTtcclxuXHJcbiAgY29uc3QgbG9hZEJvZHkgPSAoKSA9PiB7XHJcbiAgICBpZiAoYm9keUxvYWRlZCB8fCAhbWV0YS5maWxlKSByZXR1cm47XHJcbiAgICBib2R5TG9hZGVkID0gdHJ1ZTtcclxuICAgIGNvbnN0IGZpbGUgPSBtZXRhLmZpbGU7XHJcbiAgICB2b2lkIGVudi5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKS50aGVuKChyYXcpID0+IHtcclxuICAgICAgY29uc3QgZnVsbCA9IHJhdy5yZXBsYWNlKC9eLS0tXFxyP1xcbltcXHNcXFNdKj9cXHI/XFxuLS0tXFxyP1xcbj8vLCBcIlwiKTtcclxuICAgICAgY29uc3QgbWQgPSBtZXRhLmJsb2NrQ29udGVudCA/PyBmdWxsO1xyXG4gICAgICBib2R5LmVtcHR5KCk7XHJcbiAgICAgIHdpdGhOZXN0KGVudi5kZXB0aCwgKCkgPT4ge1xyXG4gICAgICAgIHJlbmRlck1hcmtkb3duKGVudi5hcHAsIG1kLCBib2R5LCBmaWxlLnBhdGgsIGVudi5jb21wb25lbnQpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDXHVGRjFBXHU5ODc2XHU5MEU4XHU1QzAxXHU5NzYyIC0tLS0tLS0tLS0gKi9cclxuICBpZiAoIWlzV3JhcCAmJiBvcHRzLmNvdmVyICYmIG1ldGEuY292ZXIpIHtcclxuICAgIGNvbnN0IGNvdmVyID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9fY292ZXJcIiB9KTtcclxuICAgIGNvbnN0IGltZyA9IGNvdmVyLmNyZWF0ZUVsKFwiaW1nXCIsIHtcclxuICAgICAgYXR0cjogeyBzcmM6IG1ldGEuY292ZXIsIGFsdDogbWV0YS50aXRsZSwgbG9hZGluZzogXCJsYXp5XCIsIGRyYWdnYWJsZTogXCJmYWxzZVwiIH0sXHJcbiAgICB9KTtcclxuICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4gY292ZXIucmVtb3ZlKCkpO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTU5MzRcdTkwRThcdUZGMUFcdTU2RkVcdTY4MDcgKyBcdTY4MDdcdTk4OTggKyBcdTY4MDdcdTdCN0UgKyBcdTVGQkRcdTdBRTAgKyBcdTY0Q0RcdTRGNUNcdUZGMENcdTUxNjhcdTU3MjhcdTRFMDBcdTg4NEMgLS0tLS0tLS0tLSAqL1xyXG4gIGNvbnN0IGhlYWQgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJhYy1jYXJkX19oZWFkXCIgfSk7XHJcblxyXG4gIGlmIChpc1dyYXApIHtcclxuICAgIGNvbnN0IHRodW1iID0gaGVhZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9fdGh1bWJcIiB9KTtcclxuICAgIGlmIChvcHRzLmNvdmVyICYmIG1ldGEuY292ZXIpIHtcclxuICAgICAgY29uc3QgaW1nID0gdGh1bWIuY3JlYXRlRWwoXCJpbWdcIiwge1xyXG4gICAgICAgIGF0dHI6IHsgc3JjOiBtZXRhLmNvdmVyLCBhbHQ6IG1ldGEudGl0bGUsIGxvYWRpbmc6IFwibGF6eVwiLCBkcmFnZ2FibGU6IFwiZmFsc2VcIiB9LFxyXG4gICAgICB9KTtcclxuICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCAoKSA9PiB7XHJcbiAgICAgICAgdGh1bWIuZW1wdHkoKTtcclxuICAgICAgICBzZXRJY29uKHRodW1iLCBpY29uRm9yKG1ldGEpKTtcclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzZXRJY29uKHRodW1iLCBpY29uRm9yKG1ldGEpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNvbnN0IHRpdGxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcclxuICB0aXRsZUVsLmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fdGl0bGVcIjtcclxuICB0aXRsZUVsLnNldEF0dHIoXCJocmVmXCIsIGhyZWZPZihtZXRhKSk7XHJcbiAgdGl0bGVFbC50ZXh0Q29udGVudCA9IG1ldGEudGl0bGU7XHJcbiAgdGl0bGVFbC50aXRsZSA9IG1ldGEuZmlsZVxyXG4gICAgPyBgJHtocmVmT2YobWV0YSl9XHVGRjA4XHU3MEI5XHU1MUZCXHU1QzU1XHU1RjAwL1x1NjUzNlx1OEQ3N1x1RkYwQ0N0cmwrXHU3MEI5XHU1MUZCXHU4REYzXHU1MjMwXHU1MzlGXHU2NTg3XHVGRjA5YFxyXG4gICAgOiBgXHU2NUIwXHU1RUZBXHVGRjFBJHttZXRhLnRhcmdldH1gO1xyXG4gIGhlYWQuYXBwZW5kQ2hpbGQodGl0bGVFbCk7XHJcblxyXG4gIGlmICghbWV0YS5maWxlKSBoZWFkLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtY2FyZF9fbWlzc2luZ1wiLCB0ZXh0OiBcIlx1NjcyQVx1NTIxQlx1NUVGQVwiIH0pO1xyXG5cclxuICBpZiAob3B0cy50YWdzKSB7XHJcbiAgICBjb25zdCB0YWdSb3cgPSBidWlsZFRhZ1JvdyhtZXRhLCBpc1NtYWxsID8gMiA6IDMpO1xyXG4gICAgaWYgKHRhZ1JvdykgaGVhZC5hcHBlbmRDaGlsZCh0YWdSb3cpO1xyXG4gIH1cclxuXHJcbiAgaWYgKG9wdHMubWV0YSkge1xyXG4gICAgY29uc3QgbWV0YVJvdyA9IGJ1aWxkTWV0YVJvdyhtZXRhKTtcclxuICAgIGlmIChtZXRhUm93KSBoZWFkLmFwcGVuZENoaWxkKG1ldGFSb3cpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgYWN0aW9ucyA9IGhlYWQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWNhcmRfX2FjdGlvbnNcIiB9KTtcclxuXHJcbiAgY29uc3QgdG9nZ2xlQnRuID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJhYy1idG4gYWMtYnRuLS10b2dnbGVcIiB9KTtcclxuICBjb25zdCB0b2dnbGVJY29uID0gdG9nZ2xlQnRuLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtYnRuX19pY29uXCIgfSk7XHJcbiAgY29uc3QgdG9nZ2xlVGV4dCA9IHRvZ2dsZUJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9fdGV4dFwiLCB0ZXh0OiBcIlx1NUM1NVx1NUYwMFwiIH0pO1xyXG4gIHNldEljb24odG9nZ2xlSWNvbiwgXCJjaGV2cm9uLWRvd25cIik7XHJcblxyXG4gIGlmIChvcHRzLm9wZW4pIHtcclxuICAgIGNvbnN0IG9wZW5CdG4gPSBhY3Rpb25zLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImFjLWJ0biBhYy1idG4tLW9wZW5cIiB9KTtcclxuICAgIGNvbnN0IG9wZW5JY29uID0gb3BlbkJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9faWNvblwiIH0pO1xyXG4gICAgb3BlbkJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9fdGV4dFwiLCB0ZXh0OiBcIlx1NjI1M1x1NUYwMFwiIH0pO1xyXG4gICAgc2V0SWNvbihvcGVuSWNvbiwgXCJhcnJvdy11cC1yaWdodFwiKTtcclxuICAgIG9wZW5CdG4udGl0bGUgPSBtZXRhLmZpbGUgPyBcIlx1NTcyOFx1NTM5Rlx1NTlDQlx1NjU4N1x1Njg2M1x1NEUyRFx1NjI1M1x1NUYwMFwiIDogXCJcdTUyMUJcdTVFRkFcdThGRDlcdTdCQzdcdTY1ODdcdTY4NjNcIjtcclxuICAgIG9wZW5CdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB2b2lkIG9wZW5Ob3RlKGVudiwgbWV0YSwgZSkpO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTY0NThcdTg5ODFcdUZGMDhcdTRFMkRcdUZGMDkgLS0tLS0tLS0tLSAqL1xyXG4gIGNhcmQuY3JlYXRlRGl2KHtcclxuICAgIGNsczogXCJhYy1jYXJkX19zdW1tYXJ5XCIsXHJcbiAgICB0ZXh0OiBtZXRhLnN1bW1hcnkgfHwgKG1ldGEuZmlsZSA/IFwiXHVGRjA4XHU2NjgyXHU2NUUwXHU2NDU4XHU4OTgxXHVGRjA5XCIgOiBcIlx1NzBCOVx1NTFGQlx1NjgwN1x1OTg5OFx1NTIxQlx1NUVGQVx1OEZEOVx1N0JDN1x1NTM5Rlx1NUI1MFx1NjU4N1x1Njg2M1wiKSxcclxuICB9KTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTZCNjNcdTY1ODdcdUZGMDhcdTZERjFcdUZGMDkgLS0tLS0tLS0tLSAqL1xyXG4gIGNhcmQuYXBwZW5kQ2hpbGQoYm9keSk7XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU1QzU1XHU1RjAwIC8gXHU2NTM2XHU4RDc3IC0tLS0tLS0tLS0gKi9cclxuICBsZXQgZXhwYW5kZWQgPSBmYWxzZTtcclxuICBjb25zdCBzZXRFeHBhbmRlZCA9IChuZXh0OiBib29sZWFuKSA9PiB7XHJcbiAgICBleHBhbmRlZCA9IG5leHQ7XHJcbiAgICBjYXJkLmNsYXNzTGlzdC50b2dnbGUoXCJpcy1leHBhbmRlZFwiLCBleHBhbmRlZCk7XHJcbiAgICB0b2dnbGVUZXh0LnRleHRDb250ZW50ID0gZXhwYW5kZWQgPyBcIlx1NjUzNlx1OEQ3N1wiIDogXCJcdTVDNTVcdTVGMDBcIjtcclxuICAgIHNldEljb24odG9nZ2xlSWNvbiwgZXhwYW5kZWQgPyBcImNoZXZyb24tdXBcIiA6IFwiY2hldnJvbi1kb3duXCIpO1xyXG4gICAgYm9keS5zdHlsZS5kaXNwbGF5ID0gZXhwYW5kZWQgPyBcIlwiIDogXCJub25lXCI7XHJcbiAgICBpZiAoZXhwYW5kZWQpIGxvYWRCb2R5KCk7XHJcbiAgfTtcclxuXHJcbiAgdG9nZ2xlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBzZXRFeHBhbmRlZCghZXhwYW5kZWQpKTtcclxuXHJcbiAgLy8gXHU3MEI5XHU2ODA3XHU5ODk4XHU2NjJGXHU2Mjk4XHU1M0UwXHU1RjAwXHU1MTczXHVGRjFCXHU2MzA5XHU0RjRGIEN0cmwvQ21kIFx1NjI0RFx1OERGM1x1NTIzMFx1NTM5Rlx1NjU4N1xyXG4gIHRpdGxlRWwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSB8fCBlLmJ1dHRvbiA9PT0gMSkge1xyXG4gICAgICB2b2lkIG9wZW5Ob3RlKGVudiwgbWV0YSwgZSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHNldEV4cGFuZGVkKCFleHBhbmRlZCk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIFx1NTkzNFx1OTBFOFx1N0E3QVx1NzY3RFx1NTkwNFx1NEU1Rlx1NTNFRlx1NEVFNVx1NjI5OFx1NTNFMFx1RkYwOFx1NjMwOVx1OTRBRVx1NTQ4Q1x1OTRGRVx1NjNBNVx1ODFFQVx1NURGMVx1NTkwNFx1NzQwNlx1RkYwQ1x1NEUwRFx1OTFDRFx1NTkwRFx1ODlFNlx1NTNEMVx1RkYwOVxyXG4gIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XHJcbiAgICBjb25zdCBlbCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGlmIChlbD8uY2xvc2VzdChcImJ1dHRvbiwgYVwiKSkgcmV0dXJuO1xyXG4gICAgc2V0RXhwYW5kZWQoIWV4cGFuZGVkKTtcclxuICB9KTtcclxuXHJcbiAgaWYgKG9wdHMuZXhwYW5kZWQpIHNldEV4cGFuZGVkKHRydWUpO1xyXG5cclxuICByZXR1cm4gY2FyZDtcclxufVxyXG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgQ29tcG9uZW50LCBGcm9udE1hdHRlckNhY2hlLCBNYXJrZG93blJlbmRlcmVyLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBOb3RlQmFkZ2Uge1xyXG4gIGtleTogc3RyaW5nO1xyXG4gIHZhbHVlOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTm90ZU1ldGEge1xyXG4gIGZpbGU6IFRGaWxlIHwgbnVsbDtcclxuICAvKiogXHU1MzlGXHU1OUNCXHU1RjE1XHU3NTI4XHVGRjA4XHU1M0VGXHU1NDJCICNcdTY4MDdcdTk4OTggXHU2MjE2ICNeXHU1NzU3aWRcdUZGMDkgKi9cclxuICB0YXJnZXQ6IHN0cmluZztcclxuICAvKiogIyBcdTRFNEJcdTU0MEVcdTc2ODRcdTkwRThcdTUyMDZcdUZGMENcdTZDQTFcdTY3MDlcdTUyMTlcdTRFM0FcdTdBN0EgKi9cclxuICByZWY6IHN0cmluZztcclxuICB0aXRsZTogc3RyaW5nO1xyXG4gIHN1bW1hcnk6IHN0cmluZztcclxuICBjb3Zlcjogc3RyaW5nIHwgbnVsbDtcclxuICB0YWdzOiBzdHJpbmdbXTtcclxuICBiYWRnZXM6IE5vdGVCYWRnZVtdO1xyXG4gIHVwZGF0ZWQ6IHN0cmluZztcclxuICB3b3JkQ291bnQ6IG51bWJlcjtcclxuICAvKiogXHU2QkI1XHU4NDNEXHU3RUE3XHU1RjE1XHU3NTI4XHVGRjA4W1tcdTk4NzUjXHU2ODA3XHU5ODk4XV0gLyBbW1x1OTg3NSNeXHU1NzU3XV1cdUZGMDlcdTY1RjZcdUZGMENcdThCRTVcdTZCQjVcdTg0M0RcdTc2ODRcdTZCNjNcdTY1ODcgKi9cclxuICBibG9ja0NvbnRlbnQ/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmNvbnN0IGNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIE5vdGVNZXRhPigpO1xyXG5cclxuZnVuY3Rpb24gc3RyaXBGcm9udG1hdHRlcihyYXc6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgbSA9IHJhdy5tYXRjaCgvXi0tLVxccj9cXG5bXFxzXFxTXSo/XFxyP1xcbi0tLVxccj9cXG4/Lyk7XHJcbiAgcmV0dXJuIG0gPyByYXcuc2xpY2UobVswXS5sZW5ndGgpIDogcmF3O1xyXG59XHJcblxyXG4vKiogXHU2MjhBIG1hcmtkb3duIFx1NkI2M1x1NjU4N1x1NTM4Qlx1NjIxMFx1NEUwMFx1NkJCNVx1N0VBRlx1NjU4N1x1NjcyQ1x1NjQ1OFx1ODk4MSAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdG9QbGFpblRleHQoYm9keTogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gc3RyaXBGcm9udG1hdHRlcihib2R5KVxyXG4gICAgLnJlcGxhY2UoL2BgYFtcXHNcXFNdKj9gYGAvZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzKj5cXHMqXFxbIVxcdytbXlxcXV0qXFxdLiokL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoLyFcXFtcXFtbXlxcXV0qXFxdXFxdL2csIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvIVxcW1teXFxdXSpcXF1cXChbXildKlxcKS9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL1xcW1xcWyhbXlxcXXxdKylcXHw/KFteXFxdXSopXFxdXFxdL2csIChfbSwgYTogc3RyaW5nLCBiOiBzdHJpbmcpID0+IGIgfHwgYSlcclxuICAgIC5yZXBsYWNlKC9cXFsoW15cXF1dKilcXF1cXChbXildKlxcKS9nLCBcIiQxXCIpXHJcbiAgICAucmVwbGFjZSgvXlxcc3swLDN9I3sxLDZ9XFxzKy4qJC9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzezAsM30+XFxzPy9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzKlstKitdXFxzKy9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzKlxcZCtcXC5cXHMrL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL1sqX2B+PV0vZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKVxyXG4gICAgLnRyaW0oKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmlyc3RUZXh0KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgdGV4dCA9IHRvUGxhaW5UZXh0KGNvbnRlbnQpO1xyXG4gIHJldHVybiB0ZXh0Lmxlbmd0aCA+IDI0ID8gYCR7dGV4dC5zbGljZSgwLCAyNCl9XHUyMDI2YCA6IHRleHQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBcdTRFQ0VcdTY1ODdcdTY4NjNcdTkxQ0NcdTYyMkFcdTUzRDZcdTRFMDBcdTRFMkFcdTZCQjVcdTg0M0RcdUZGMDhcdTc3RTVcdThCQzZcdTcwQjlcdUZGMDlcdTMwMDJcclxuICogXHU2NTJGXHU2MzAxIGBbW1x1OTg3NSNcdTY4MDdcdTk4OThdXWAgXHU0RTBFIGBbW1x1OTg3NSNeXHU1NzU3aWRdXWAgXHU0RTI0XHU3OUNEXHU1RjE1XHU3NTI4XHUzMDAyXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEJsb2NrKFxyXG4gIHJhdzogc3RyaW5nLFxyXG4gIGZpbGVDYWNoZTogQ2FjaGVkTWV0YWRhdGEgfCBudWxsLFxyXG4gIHJlZjogc3RyaW5nXHJcbik6IHsgdGl0bGU6IHN0cmluZzsgY29udGVudDogc3RyaW5nIH0gfCBudWxsIHtcclxuICBjb25zdCBsaW5lcyA9IHJhdy5zcGxpdCgvXFxyP1xcbi8pO1xyXG4gIGNvbnN0IHdhbnRlZCA9IGRlY29kZVVSSUNvbXBvbmVudChyZWYpO1xyXG5cclxuICAvLyBcdTU3NTdcdTVGMTVcdTc1MjggXmJsb2NraWRcclxuICBpZiAod2FudGVkLnN0YXJ0c1dpdGgoXCJeXCIpKSB7XHJcbiAgICBjb25zdCBibG9jayA9IGZpbGVDYWNoZT8uYmxvY2tzPy5bd2FudGVkLnNsaWNlKDEpXTtcclxuICAgIGlmICghYmxvY2spIHJldHVybiBudWxsO1xyXG4gICAgY29uc3QgY29udGVudCA9IGxpbmVzXHJcbiAgICAgIC5zbGljZShibG9jay5wb3NpdGlvbi5zdGFydC5saW5lLCBibG9jay5wb3NpdGlvbi5lbmQubGluZSArIDEpXHJcbiAgICAgIC5qb2luKFwiXFxuXCIpO1xyXG4gICAgcmV0dXJuIHsgdGl0bGU6IGZpcnN0VGV4dChjb250ZW50KSB8fCB3YW50ZWQsIGNvbnRlbnQgfTtcclxuICB9XHJcblxyXG4gIC8vIFx1NjgwN1x1OTg5OFx1NUYxNVx1NzUyOCAjaGVhZGluZ1xyXG4gIGNvbnN0IGhlYWRpbmdzID0gZmlsZUNhY2hlPy5oZWFkaW5ncyA/PyBbXTtcclxuICBjb25zdCBpZHggPSBoZWFkaW5ncy5maW5kSW5kZXgoKGgpID0+IGguaGVhZGluZyA9PT0gd2FudGVkKTtcclxuICBpZiAoaWR4IDwgMCkgcmV0dXJuIG51bGw7XHJcblxyXG4gIGNvbnN0IGggPSBoZWFkaW5nc1tpZHhdO1xyXG4gIGNvbnN0IHN0YXJ0ID0gaC5wb3NpdGlvbi5zdGFydC5saW5lO1xyXG4gIGxldCBlbmQgPSBsaW5lcy5sZW5ndGggLSAxO1xyXG4gIGZvciAobGV0IGkgPSBpZHggKyAxOyBpIDwgaGVhZGluZ3MubGVuZ3RoOyBpKyspIHtcclxuICAgIGlmIChoZWFkaW5nc1tpXS5sZXZlbCA8PSBoLmxldmVsKSB7XHJcbiAgICAgIGVuZCA9IGhlYWRpbmdzW2ldLnBvc2l0aW9uLnN0YXJ0LmxpbmUgLSAxO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHsgdGl0bGU6IGguaGVhZGluZywgY29udGVudDogbGluZXMuc2xpY2Uoc3RhcnQsIE1hdGgubWF4KGVuZCwgc3RhcnQpICsgMSkuam9pbihcIlxcblwiKSB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBwaWNrRmllbGQoZm06IEZyb250TWF0dGVyQ2FjaGUgfCB1bmRlZmluZWQsIGZpZWxkczogc3RyaW5nW10pOiBzdHJpbmcge1xyXG4gIGlmICghZm0pIHJldHVybiBcIlwiO1xyXG4gIGZvciAoY29uc3QgZiBvZiBmaWVsZHMpIHtcclxuICAgIGNvbnN0IHYgPSBmbVtmXTtcclxuICAgIGlmICh0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiAmJiB2LnRyaW0oKSkgcmV0dXJuIHYudHJpbSgpO1xyXG4gICAgaWYgKHR5cGVvZiB2ID09PSBcIm51bWJlclwiKSByZXR1cm4gU3RyaW5nKHYpO1xyXG4gIH1cclxuICByZXR1cm4gXCJcIjtcclxufVxyXG5cclxuZnVuY3Rpb24gY29sbGVjdFRhZ3MoYXBwOiBBcHAsIGZpbGU6IFRGaWxlKTogc3RyaW5nW10ge1xyXG4gIGNvbnN0IGZtID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcjtcclxuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XHJcbiAgY29uc3QgcHVzaCA9ICh2OiB1bmtub3duKSA9PiB7XHJcbiAgICBpZiAodHlwZW9mIHYgPT09IFwic3RyaW5nXCIpIG91dC5wdXNoKHYucmVwbGFjZSgvXiMvLCBcIlwiKSk7XHJcbiAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KHYpKSB2LmZvckVhY2gocHVzaCk7XHJcbiAgfTtcclxuICBwdXNoKGZtPy50YWdzKTtcclxuICBwdXNoKGZtPy50YWcpO1xyXG4gIGlmICghb3V0Lmxlbmd0aCkge1xyXG4gICAgY29uc3QgY2FjaGVUYWdzID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy50YWdzID8/IFtdO1xyXG4gICAgZm9yIChjb25zdCB0IG9mIGNhY2hlVGFncykgb3V0LnB1c2godC50YWcucmVwbGFjZSgvXiMvLCBcIlwiKSk7XHJcbiAgfVxyXG4gIHJldHVybiBBcnJheS5mcm9tKG5ldyBTZXQob3V0KSkuc2xpY2UoMCwgNik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGV4dHJhY3RDb3ZlcihhcHA6IEFwcCwgZmlsZTogVEZpbGUsIGJvZHk6IHN0cmluZywgZmllbGRzOiBzdHJpbmdbXSk6IHN0cmluZyB8IG51bGwge1xyXG4gIGNvbnN0IGZtID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcjtcclxuICBjb25zdCBkZWNsYXJlZCA9IHBpY2tGaWVsZChmbSwgZmllbGRzKTtcclxuICBjb25zdCBjYW5kaWRhdGVzID0gW2RlY2xhcmVkXTtcclxuXHJcbiAgaWYgKCFkZWNsYXJlZCkge1xyXG4gICAgY29uc3Qgd2lraUltZyA9IGJvZHkubWF0Y2goLyFcXFtcXFsoW15cXF18XSspLyk7XHJcbiAgICBpZiAod2lraUltZykgY2FuZGlkYXRlcy5wdXNoKHdpa2lJbWdbMV0pO1xyXG4gICAgY29uc3QgbWRJbWcgPSBib2R5Lm1hdGNoKC8hXFxbW15cXF1dKlxcXVxcKChbXildKylcXCkvKTtcclxuICAgIGlmIChtZEltZykgY2FuZGlkYXRlcy5wdXNoKG1kSW1nWzFdKTtcclxuICB9XHJcblxyXG4gIGZvciAoY29uc3QgYyBvZiBjYW5kaWRhdGVzKSB7XHJcbiAgICBpZiAoIWMpIGNvbnRpbnVlO1xyXG4gICAgaWYgKC9eaHR0cHM/OlxcL1xcLy9pLnRlc3QoYykpIHJldHVybiBjO1xyXG4gICAgY29uc3QgZiA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGMuc3BsaXQoXCJ8XCIpWzBdLnRyaW0oKSwgZmlsZS5wYXRoKTtcclxuICAgIGlmIChmKSByZXR1cm4gYXBwLnZhdWx0LmdldFJlc291cmNlUGF0aChmKTtcclxuICB9XHJcbiAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlRmlsZShhcHA6IEFwcCwgdGFyZ2V0OiBzdHJpbmcsIHNvdXJjZVBhdGg6IHN0cmluZyk6IFRGaWxlIHwgbnVsbCB7XHJcbiAgY29uc3QgY2xlYW4gPSB0YXJnZXQuc3BsaXQoXCIjXCIpWzBdLnNwbGl0KFwifFwiKVswXS50cmltKCk7XHJcbiAgaWYgKCFjbGVhbikgcmV0dXJuIG51bGw7XHJcbiAgcmV0dXJuIGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGNsZWFuLCBzb3VyY2VQYXRoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZm9ybWF0RGF0ZSh2OiB1bmtub3duKTogc3RyaW5nIHtcclxuICBpZiAoIXYpIHJldHVybiBcIlwiO1xyXG4gIGlmICh0eXBlb2YgdiAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIFwiXCI7XHJcbiAgcmV0dXJuIHYubGVuZ3RoID4gMTAgPyB2LnNsaWNlKDAsIDEwKSA6IHY7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkTm90ZU1ldGEoXHJcbiAgYXBwOiBBcHAsXHJcbiAgdGFyZ2V0OiBzdHJpbmcsXHJcbiAgc291cmNlUGF0aDogc3RyaW5nLFxyXG4gIHNldHRpbmdzOiB7XHJcbiAgICBzdW1tYXJ5RmllbGRzOiBzdHJpbmdbXTtcclxuICAgIGNvdmVyRmllbGRzOiBzdHJpbmdbXTtcclxuICAgIG1ldGFGaWVsZHM6IHN0cmluZ1tdO1xyXG4gICAgc3VtbWFyeUxlbmd0aDogbnVtYmVyO1xyXG4gIH0sXHJcbiAgYWxpYXM/OiBzdHJpbmdcclxuKTogUHJvbWlzZTxOb3RlTWV0YT4ge1xyXG4gIGNvbnN0IGhhc2hJZHggPSB0YXJnZXQuaW5kZXhPZihcIiNcIik7XHJcbiAgY29uc3QgcGF0aFBhcnQgPSAoaGFzaElkeCA+PSAwID8gdGFyZ2V0LnNsaWNlKDAsIGhhc2hJZHgpIDogdGFyZ2V0KS5zcGxpdChcInxcIilbMF0udHJpbSgpO1xyXG4gIGNvbnN0IHJlZiA9IGhhc2hJZHggPj0gMCA/IHRhcmdldC5zbGljZShoYXNoSWR4ICsgMSkudHJpbSgpIDogXCJcIjtcclxuICBjb25zdCBmaWxlID0gcmVzb2x2ZUZpbGUoYXBwLCBwYXRoUGFydCwgc291cmNlUGF0aCk7XHJcbiAgY29uc3QgZmFsbGJhY2tUaXRsZSA9IGFsaWFzIHx8IHJlZiB8fCBwYXRoUGFydC5zcGxpdChcIi9cIikucG9wKCkgfHwgdGFyZ2V0O1xyXG5cclxuICBpZiAoIWZpbGUpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGZpbGU6IG51bGwsXHJcbiAgICAgIHRhcmdldCxcclxuICAgICAgcmVmLFxyXG4gICAgICB0aXRsZTogZmFsbGJhY2tUaXRsZSxcclxuICAgICAgc3VtbWFyeTogXCJcIixcclxuICAgICAgY292ZXI6IG51bGwsXHJcbiAgICAgIHRhZ3M6IFtdLFxyXG4gICAgICBiYWRnZXM6IFtdLFxyXG4gICAgICB1cGRhdGVkOiBcIlwiLFxyXG4gICAgICB3b3JkQ291bnQ6IDAsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgY29uc3Qga2V5ID0gYCR7ZmlsZS5wYXRofSMke3JlZn06JHtmaWxlLnN0YXQubXRpbWV9OiR7c2V0dGluZ3Muc3VtbWFyeUxlbmd0aH1gO1xyXG4gIGNvbnN0IGhpdCA9IGNhY2hlLmdldChrZXkpO1xyXG4gIGlmIChoaXQpIHJldHVybiBhbGlhcyA/IHsgLi4uaGl0LCB0aXRsZTogYWxpYXMgfSA6IGhpdDtcclxuXHJcbiAgY29uc3QgcmF3ID0gYXdhaXQgYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XHJcbiAgY29uc3QgZmlsZUNhY2hlID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpID8/IG51bGw7XHJcbiAgY29uc3QgZm0gPSBmaWxlQ2FjaGU/LmZyb250bWF0dGVyO1xyXG5cclxuICAvLyBcdTZCQjVcdTg0M0RcdTdFQTdcdTVGMTVcdTc1MjhcdUZGMUFcdTUzRUFcdTUzRDZcdThCRTVcdTZCQjVcdTg0M0RcdUZGMENcdTgwMENcdTRFMERcdTY2MkZcdTY1NzRcdTdCQzdcclxuICBjb25zdCBibG9jayA9IHJlZiA/IGV4dHJhY3RCbG9jayhyYXcsIGZpbGVDYWNoZSwgcmVmKSA6IG51bGw7XHJcbiAgY29uc3QgY29udGVudEJvZHkgPSBibG9jaz8uY29udGVudCA/PyBzdHJpcEZyb250bWF0dGVyKHJhdyk7XHJcblxyXG4gIGNvbnN0IG1hbnVhbCA9IGJsb2NrID8gXCJcIiA6IHBpY2tGaWVsZChmbSwgc2V0dGluZ3Muc3VtbWFyeUZpZWxkcyk7XHJcbiAgY29uc3QgcGxhaW4gPSB0b1BsYWluVGV4dChjb250ZW50Qm9keSk7XHJcbiAgY29uc3Qgc3VtbWFyeSA9XHJcbiAgICBtYW51YWwgfHxcclxuICAgIHBsYWluLnNsaWNlKDAsIHNldHRpbmdzLnN1bW1hcnlMZW5ndGgpICsgKHBsYWluLmxlbmd0aCA+IHNldHRpbmdzLnN1bW1hcnlMZW5ndGggPyBcIlx1MjAyNlwiIDogXCJcIik7XHJcblxyXG4gIGNvbnN0IGJhZGdlczogTm90ZUJhZGdlW10gPSBbXTtcclxuICBpZiAoIWJsb2NrKSB7XHJcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBzZXR0aW5ncy5tZXRhRmllbGRzKSB7XHJcbiAgICAgIGNvbnN0IHYgPSBmbT8uW2tleV07XHJcbiAgICAgIGlmICh2ID09PSB1bmRlZmluZWQgfHwgdiA9PT0gbnVsbCkgY29udGludWU7XHJcbiAgICAgIGNvbnN0IHRleHQgPSBBcnJheS5pc0FycmF5KHYpID8gdi5qb2luKFwiL1wiKSA6IFN0cmluZyh2KTtcclxuICAgICAgaWYgKHRleHQudHJpbSgpKSBiYWRnZXMucHVzaCh7IGtleSwgdmFsdWU6IHRleHQudHJpbSgpIH0pO1xyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBcdTZCQjVcdTg0M0RcdTUzNjFcdTcyNDdcdTUzRUFcdTY4MDdcdTY3NjVcdTZFOTBcdTY1ODdcdTY4NjNcdTdDN0JcdTU3OEJcdUZGMENcdTkwN0ZcdTUxNERcdTU0OENcdTY1NzRcdTdCQzdcdTZERjdcdTZEQzZcclxuICAgIGNvbnN0IHQgPSBmbT8udHlwZTtcclxuICAgIGlmICh0eXBlb2YgdCA9PT0gXCJzdHJpbmdcIiAmJiB0LnRyaW0oKSkgYmFkZ2VzLnB1c2goeyBrZXk6IFwidHlwZVwiLCB2YWx1ZTogdC50cmltKCkgfSk7XHJcbiAgfVxyXG5cclxuICBjb25zdCB0aXRsZSA9XHJcbiAgICBhbGlhcyB8fCAoYmxvY2sgPyBibG9jay50aXRsZSA6IFwiXCIpIHx8IFN0cmluZyhmbT8udGl0bGUgfHwgZmlsZS5iYXNlbmFtZSk7XHJcblxyXG4gIGNvbnN0IG1ldGE6IE5vdGVNZXRhID0ge1xyXG4gICAgZmlsZSxcclxuICAgIHRhcmdldCxcclxuICAgIHJlZixcclxuICAgIHRpdGxlLFxyXG4gICAgc3VtbWFyeSxcclxuICAgIGNvdmVyOiBleHRyYWN0Q292ZXIoYXBwLCBmaWxlLCBjb250ZW50Qm9keSwgc2V0dGluZ3MuY292ZXJGaWVsZHMpLFxyXG4gICAgdGFnczogYmxvY2sgPyBbXSA6IGNvbGxlY3RUYWdzKGFwcCwgZmlsZSksXHJcbiAgICBiYWRnZXMsXHJcbiAgICB1cGRhdGVkOiBibG9jayA/IFwiXCIgOiBmb3JtYXREYXRlKGZtPy51cGRhdGVkKSB8fCBmb3JtYXREYXRlKGZtPy5tb2RpZmllZCkgfHwgZm9ybWF0RGF0ZShmbT8uY3JlYXRlZCksXHJcbiAgICB3b3JkQ291bnQ6IHBsYWluLmxlbmd0aCxcclxuICAgIGJsb2NrQ29udGVudDogYmxvY2s/LmNvbnRlbnQsXHJcbiAgfTtcclxuXHJcbiAgY2FjaGUuc2V0KGtleSwgbWV0YSk7XHJcbiAgaWYgKGNhY2hlLnNpemUgPiA1MDApIGNhY2hlLmNsZWFyKCk7XHJcbiAgcmV0dXJuIG1ldGE7XHJcbn1cclxuXHJcbi8qKiBcdTUxN0NcdTVCQjlcdTY1QjBcdTY1RTdcdTcyNDhcdTY3MkMgT2JzaWRpYW4gXHU3Njg0IG1hcmtkb3duIFx1NkUzMlx1NjdEM1x1NTE2NVx1NTNFMyAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyTWFya2Rvd24oXHJcbiAgYXBwOiBBcHAsXHJcbiAgbWFya2Rvd246IHN0cmluZyxcclxuICBlbDogSFRNTEVsZW1lbnQsXHJcbiAgc291cmNlUGF0aDogc3RyaW5nLFxyXG4gIGNvbXBvbmVudDogQ29tcG9uZW50XHJcbik6IHZvaWQge1xyXG4gIGNvbnN0IG1kID0gTWFya2Rvd25SZW5kZXJlciBhcyB1bmtub3duIGFzIHtcclxuICAgIHJlbmRlcj86IChhOiBBcHAsIG06IHN0cmluZywgZTogSFRNTEVsZW1lbnQsIHA6IHN0cmluZywgYzogQ29tcG9uZW50KSA9PiB2b2lkO1xyXG4gICAgcmVuZGVyTWFya2Rvd24/OiAobTogc3RyaW5nLCBlOiBIVE1MRWxlbWVudCwgcDogc3RyaW5nLCBjOiBDb21wb25lbnQpID0+IHZvaWQ7XHJcbiAgfTtcclxuICAvLyBcdTVGQzVcdTk4N0JcdTRGMThcdTUxNDhcdTc1MjggcmVuZGVyKClcdUZGMUFyZW5kZXJNYXJrZG93bigpIFx1NjYyRlx1N0I4MFx1NTMxNlx1NzI0OFx1RkYwQ1x1NEUwRFx1NEYxQVx1NjI4QVx1NzJFQ1x1NTM2MFx1NEUwMFx1ODg0Q1x1NzY4NCAhW1sgXV1cclxuICAvLyBcdTU5MDRcdTc0MDZcdTYyMTBcdTU3NTdcdTdFQTdcdTVENENcdTUxNjVcdUZGMENcdTUzRUFcdTc1NTlcdTRFMEJcdTRFMDBcdTRFMkEgPHNwYW4gY2xhc3M9XCJpbnRlcm5hbC1lbWJlZFwiPiBcdTUzNjBcdTRGNERcdTdCMjZcdUZGMENcclxuICAvLyBcdTVCRkNcdTgxRjRcdTUzNjFcdTcyNDdcdTZCNjNcdTY1ODdcdTkxQ0NcdTc2ODRcdTVENENcdTU5NTdcdTVENENcdTUxNjVcdTZDMzhcdThGRENcdTY1RTBcdTZDRDVcdTg4QUJcdTYzQTVcdTdCQTFcdTYyMTBcdTUzNjFcdTcyNDdcdTMwMDJcclxuICBpZiAodHlwZW9mIG1kLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICBtZC5yZW5kZXIoYXBwLCBtYXJrZG93biwgZWwsIHNvdXJjZVBhdGgsIGNvbXBvbmVudCk7XHJcbiAgfSBlbHNlIGlmICh0eXBlb2YgbWQucmVuZGVyTWFya2Rvd24gPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgbWQucmVuZGVyTWFya2Rvd24obWFya2Rvd24sIGVsLCBzb3VyY2VQYXRoLCBjb21wb25lbnQpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBlbC5zZXRUZXh0KG1hcmtkb3duKTtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCBBdG9taWNDYXJkc1BsdWdpbiBmcm9tIFwiLi9tYWluXCI7XHJcbmltcG9ydCB7IExheW91dCwgU2l6ZSB9IGZyb20gXCIuL3R5cGVzXCI7XHJcbmltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEF0b21pY0NhcmRzU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogQXRvbWljQ2FyZHNQbHVnaW4pIHtcclxuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICB9XHJcblxyXG4gIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG4gICAgY29uc3QgcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzO1xyXG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1ODg0Q1x1NEUzQVwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU2M0E1XHU3QkExXHU1MzlGXHU3NTFGXHU1RDRDXHU1MTY1ICFbWyBdXVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1NjI4QVx1NzJFQ1x1NTM2MFx1NEUwMFx1ODg0Q1x1NzY4NCAhW1tcdTdCMTRcdThCQjBdXSBcdTVENENcdTUxNjVcdTZFMzJcdTY3RDNcdTYyMTBcdTUzRUZcdTYyOThcdTUzRTBcdTUzNjFcdTcyNDdcdUZGMUJcdTUxNzNcdTk1RURcdTU0MEVcdTYzRDJcdTRFRjZcdTVCOENcdTUxNjhcdTRFMERcdTRFQ0JcdTUxNjVcdUZGMENcdTVENENcdTUxNjVcdTRGRERcdTYzMDEgT2JzaWRpYW4gXHU5RUQ4XHU4QkE0XHU2ODM3XHU1RjBGXCIpXHJcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShzLnVwZ3JhZGVFbWJlZHMpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLnVwZ3JhZGVFbWJlZHMgPSB2O1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1NUUwM1x1NUM0MFwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1MzYxXHU3MjQ3XHU2NzAwXHU1OTI3XHU5QUQ4XHU1RUE2IChweClcIilcclxuICAgICAgLnNldERlc2MoXCIwID0gXHU0RTBEXHU5NjUwXHU1MjM2XHVGRjFCXHU4RDg1XHU4RkM3XHU1NDBFXHU1MzYxXHU3MjQ3XHU1MTg1XHU5MEU4XHU2RURBXHU1MkE4XCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKHMuY2FyZEhlaWdodCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLmNhcmRIZWlnaHQgPSBOdW1iZXIodikgfHwgMDtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1MzYxXHU3MjQ3XHU1RTAzXHU1QzQwXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU1MzA1XHU4OEY5XHU1MzYxXHU3MjQ3ID0gXHU2QTJBXHU1NDExXHU2MjQxXHU1RTczXHU3Njg0XHU1QkI5XHU1NjY4XHVGRjFCXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDID0gXHU0RjIwXHU3RURGXHU1MzYxXHU3MjQ3XHU1ODk5XHVGRjA4XHU5ODc2XHU5MEU4XHU1OTI3XHU1QzAxXHU5NzYyXHVGRjA5XCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZCkgPT5cclxuICAgICAgICBkXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwid3JhcFwiLCBcIlx1NTMwNVx1ODhGOVx1NTM2MVx1NzI0N1x1RkYwOFx1NkEyQVx1NTQxMVx1RkYwOVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImNhcmRcIiwgXCJcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNENcdUZGMDhcdTk4NzZcdTkwRThcdTVDMDFcdTk3NjJcdUZGMDlcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZShzLmxheW91dClcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICBzLmxheW91dCA9IHYgYXMgTGF5b3V0O1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1RDRDXHU1OTU3XHU1MzYxXHU3MjQ3XHU3Njg0XHU1QzNBXHU1QkY4XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU1MzYxXHU3MjQ3XHU5MUNDXHU1MThEXHU1OTU3XHU3Njg0XHU1RDRDXHU1MTY1XHU5RUQ4XHU4QkE0XHU3NTI4XHU0RUMwXHU0RTQ4XHU1QzNBXHU1QkY4XCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZCkgPT5cclxuICAgICAgICBkXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwic21hbGxcIiwgXCJcdTc3RTVcdThCQzZcdTcwQjlcdTVDMEZcdTUzNjFcdTcyNDdcdUZGMDhcdTRFMDBcdTg4NENcdTU5MUFcdTRFMkFcdUZGMDlcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJub3JtYWxcIiwgXCJcdTVFMzhcdTg5QzRcdTUzNjFcdTcyNDdcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZShzLm5lc3RlZFNpemUpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgICAgcy5uZXN0ZWRTaXplID0gdiBhcyBTaXplO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1QkM2XHU1RUE2XCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZCkgPT5cclxuICAgICAgICBkXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiY29tZm9ydGFibGVcIiwgXCJcdTVCQkRcdTY3N0VcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJjb21wYWN0XCIsIFwiXHU3RDI3XHU1MUQxXCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUocy5kZW5zaXR5KVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICAgIHMuZGVuc2l0eSA9IHYgYXMgXCJjb21wYWN0XCIgfCBcImNvbWZvcnRhYmxlXCI7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1NTM2MVx1NzI0N1x1NTE4NVx1NUJCOVwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU2NDU4XHU4OTgxXHU5NTdGXHU1RUE2XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU4MUVBXHU1MkE4XHU2NDU4XHU4OTgxXHU2MjJBXHU1M0Q2XHU3Njg0XHU1QjU3XHU3QjI2XHU2NTcwXHVGRjA4ZnJvbnRtYXR0ZXIgXHU2NzA5IHN1bW1hcnkvZGVzY3JpcHRpb24gXHU2NUY2XHU0RjE4XHU1MTQ4XHU3NTI4XHVGRjA5XCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKHMuc3VtbWFyeUxlbmd0aCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLnN1bW1hcnlMZW5ndGggPSBOdW1iZXIodikgfHwgMTgwO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBjb25zdCB0b2dnbGUgPSAobmFtZTogc3RyaW5nLCBkZXNjOiBzdHJpbmcsIGdldDogKCkgPT4gYm9vbGVhbiwgc2V0OiAodjogYm9vbGVhbikgPT4gdm9pZCkgPT5cclxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUobmFtZSkuc2V0RGVzYyhkZXNjKS5hZGRUb2dnbGUoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShnZXQoKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHNldCh2KTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgdG9nZ2xlKFwiXHU2NjNFXHU3OTNBXHU1QzAxXHU5NzYyXCIsIFwiXHU4QkZCXHU1M0Q2IGZyb250bWF0dGVyIFx1NzY4NCBjb3Zlci9pbWFnZS9iYW5uZXIgXHU2MjE2XHU2QjYzXHU2NTg3XHU3QjJDXHU0RTAwXHU1RjIwXHU1NkZFXCIsICgpID0+IHMuc2hvd0NvdmVyLCAodikgPT4gKHMuc2hvd0NvdmVyID0gdikpO1xyXG4gICAgdG9nZ2xlKFwiXHU2NjNFXHU3OTNBXHU1MTQzXHU0RkUxXHU2MDZGXCIsIFwidHlwZSAvIHN0YXR1cyAvIGRvbWFpbiAvIFx1NjZGNFx1NjVCMFx1NjVGNlx1OTVGNCAvIFx1NUI1N1x1NjU3MFwiLCAoKSA9PiBzLnNob3dNZXRhLCAodikgPT4gKHMuc2hvd01ldGEgPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTY4MDdcdTdCN0VcIiwgXCJcIiwgKCkgPT4gcy5zaG93VGFncywgKHYpID0+IChzLnNob3dUYWdzID0gdikpO1xyXG4gICAgdG9nZ2xlKFwiXHU2NjNFXHU3OTNBXHUzMDBDXHU2MjUzXHU1RjAwXHUzMDBEXHU2MzA5XHU5NEFFXCIsIFwiXCIsICgpID0+IHMuc2hvd09wZW5CdXR0b24sICh2KSA9PiAocy5zaG93T3BlbkJ1dHRvbiA9IHYpKTtcclxuICAgIHRvZ2dsZShcIlx1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMFx1NkI2M1x1NjU4N1wiLCBcIlx1NjI1M1x1NUYwMFx1NjU4N1x1Njg2M1x1NjVGNlx1NTM2MVx1NzI0N1x1NzZGNFx1NjNBNVx1NjYzRVx1NzkzQVx1NUI4Q1x1NjU3NFx1NTE4NVx1NUJCOVx1RkYwQ1x1NzBCOVx1NjgwN1x1OTg5OFx1NTNFRlx1NjI5OFx1NTNFMFwiLCAoKSA9PiBzLmRlZmF1bHRFeHBhbmRlZCwgKHYpID0+IChzLmRlZmF1bHRFeHBhbmRlZCA9IHYpKTtcclxuICAgIHRvZ2dsZShcclxuICAgICAgXCJcdTVENENcdTU5NTdcdTUzNjFcdTcyNDdcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDBcIixcclxuICAgICAgXCJcdTUzNjFcdTcyNDdcdTkxQ0NcdTUxOERcdTU5NTdcdTc2ODRcdTUzNjFcdTcyNDdcdTU4OTlcdTY2MkZcdTU0MjZcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDBcdUZGMUJcdTUxNzNcdTk1RURcdTY1RjZcdTUzRUFcdTY2M0VcdTc5M0FcdTY4MDdcdTk4OThcdTU0OENcdTY0NThcdTg5ODFcIixcclxuICAgICAgKCkgPT4gcy5uZXN0ZWRFeHBhbmRlZCxcclxuICAgICAgKHYpID0+IChzLm5lc3RlZEV4cGFuZGVkID0gdilcclxuICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU2NzAwXHU1OTI3XHU1RDRDXHU1OTU3XHU2REYxXHU1RUE2XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU1MzYxXHU3MjQ3XHU5MUNDXHU1MThEXHU2NTNFIGNhcmRzIFx1NTc1N1x1NjVGNlx1NzY4NFx1OTAxMlx1NUY1Mlx1NUM0Mlx1NjU3MFx1NEUwQVx1OTY1MFx1RkYwQ1x1OTYzMlx1NkI2Mlx1NUZBQVx1NzNBRlx1NUYxNVx1NzUyOFx1NTM2MVx1NkI3QlwiKVxyXG4gICAgICAuYWRkVGV4dCgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKFN0cmluZyhzLm1heE5lc3REZXB0aCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLm1heE5lc3REZXB0aCA9IE1hdGgubWF4KDEsIE51bWJlcih2KSB8fCAzKTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJcdTVCNTdcdTZCQjVcdTY2MjBcdTVDMDRcIikuc2V0SGVhZGluZygpO1xyXG5cclxuICAgIGNvbnN0IGxpc3RGaWVsZCA9IChuYW1lOiBzdHJpbmcsIGRlc2M6IHN0cmluZywgZ2V0OiAoKSA9PiBzdHJpbmdbXSwgc2V0OiAodjogc3RyaW5nW10pID0+IHZvaWQpID0+XHJcbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKG5hbWUpXHJcbiAgICAgICAgLnNldERlc2MoZGVzYylcclxuICAgICAgICAuYWRkVGV4dCgodCkgPT5cclxuICAgICAgICAgIHRcclxuICAgICAgICAgICAgLnNldFZhbHVlKGdldCgpLmpvaW4oXCIsIFwiKSlcclxuICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiYSwgYiwgY1wiKVxyXG4gICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgICAgICBzZXQoXHJcbiAgICAgICAgICAgICAgICB2XHJcbiAgICAgICAgICAgICAgICAgIC5zcGxpdChcIixcIilcclxuICAgICAgICAgICAgICAgICAgLm1hcCgoeCkgPT4geC50cmltKCkpXHJcbiAgICAgICAgICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbilcclxuICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgbGlzdEZpZWxkKFwiXHU2NDU4XHU4OTgxXHU1QjU3XHU2QkI1XCIsIFwiXHU2MzA5XHU5ODdBXHU1RThGXHU1QzFEXHU4QkQ1XHU4QkZCXHU1M0Q2XHU3Njg0IGZyb250bWF0dGVyIFx1NUI1N1x1NkJCNVwiLCAoKSA9PiBzLnN1bW1hcnlGaWVsZHMsICh2KSA9PiAocy5zdW1tYXJ5RmllbGRzID0gdikpO1xyXG4gICAgbGlzdEZpZWxkKFwiXHU1QzAxXHU5NzYyXHU1QjU3XHU2QkI1XCIsIFwiXCIsICgpID0+IHMuY292ZXJGaWVsZHMsICh2KSA9PiAocy5jb3ZlckZpZWxkcyA9IHYpKTtcclxuICAgIGxpc3RGaWVsZChcIlx1NTE0M1x1NEZFMVx1NjA2Rlx1NUI1N1x1NkJCNVwiLCBcIlx1NEYxQVx1NEVFNVx1NUZCRFx1N0FFMFx1NUY2Mlx1NUYwRlx1NjYzRVx1NzkzQVx1NTcyOFx1NTM2MVx1NzI0N1x1NEUwQVwiLCAoKSA9PiBzLm1ldGFGaWVsZHMsICh2KSA9PiAocy5tZXRhRmllbGRzID0gdikpO1xyXG4gIH1cclxufVxyXG4iLCAiZXhwb3J0IHR5cGUgRGVuc2l0eSA9IFwiY29tcGFjdFwiIHwgXCJjb21mb3J0YWJsZVwiO1xyXG4vKiogd3JhcCA9IFx1NjI0MVx1NUU3M1x1NTMwNVx1ODhGOVx1NTM2MVx1NzI0N1x1RkYwOFx1NkEyQVx1NTQxMVx1RkYwOVx1RkYxQmNhcmQgPSBcdTRGMjBcdTdFREZcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNENcdUZGMDhcdTk4NzZcdTkwRThcdTVDMDFcdTk3NjJcdUZGMDkgKi9cclxuZXhwb3J0IHR5cGUgTGF5b3V0ID0gXCJ3cmFwXCIgfCBcImNhcmRcIjtcclxuLyoqIG5vcm1hbCA9IFx1NUUzOFx1ODlDNFx1NjU4N1x1Njg2M1x1NTM2MVx1NzI0N1x1RkYxQnNtYWxsID0gXHU3N0U1XHU4QkM2XHU3MEI5IC8gXHU2QkI1XHU4NDNEXHU3RUE3XHU1QzBGXHU1MzYxXHU3MjQ3ICovXHJcbmV4cG9ydCB0eXBlIFNpemUgPSBcIm5vcm1hbFwiIHwgXCJzbWFsbFwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBdG9taWNDYXJkc1NldHRpbmdzIHtcclxuICAvKiogXHU2MjhBIE9ic2lkaWFuIFx1NTM5Rlx1NzUxRiAhW1sgXV0gXHU1NzU3XHU3RUE3XHU1RDRDXHU1MTY1XHU2RTMyXHU2N0QzXHU2MjEwXHU1MzYxXHU3MjQ3XHVGRjA4XHU1MTczXHU5NUVEXHU1MjE5XHU1QjhDXHU1MTY4XHU0RTBEXHU0RUNCXHU1MTY1XHVGRjA5ICovXHJcbiAgdXBncmFkZUVtYmVkczogYm9vbGVhbjtcclxuICBsYXlvdXQ6IExheW91dDtcclxuICAvKiogXHU1RDRDXHU1OTU3XHU1NzI4XHU1OTI3XHU1MzYxXHU3MjQ3XHU5MUNDXHU3Njg0XHU1MzYxXHU3MjQ3XHU5RUQ4XHU4QkE0XHU1QzNBXHU1QkY4ICovXHJcbiAgbmVzdGVkU2l6ZTogU2l6ZTtcclxuICBjYXJkSGVpZ2h0OiBudW1iZXI7XHJcbiAgc3VtbWFyeUxlbmd0aDogbnVtYmVyO1xyXG4gIHNob3dDb3ZlcjogYm9vbGVhbjtcclxuICBzaG93TWV0YTogYm9vbGVhbjtcclxuICBzaG93VGFnczogYm9vbGVhbjtcclxuICBzaG93T3BlbkJ1dHRvbjogYm9vbGVhbjtcclxuICAvKiogXHU1MzYxXHU3MjQ3XHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXHU2QjYzXHU2NTg3ICovXHJcbiAgZGVmYXVsdEV4cGFuZGVkOiBib29sZWFuO1xyXG4gIC8qKiBcdTVENENcdTU3MjhcdTUzNjFcdTcyNDdcdTkxQ0NcdTc2ODRcdTVENENcdTUxNjVcdTY2MkZcdTU0MjZcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDAgKi9cclxuICBuZXN0ZWRFeHBhbmRlZDogYm9vbGVhbjtcclxuICBtYXhOZXN0RGVwdGg6IG51bWJlcjtcclxuICBkZW5zaXR5OiBEZW5zaXR5O1xyXG4gIHN1bW1hcnlGaWVsZHM6IHN0cmluZ1tdO1xyXG4gIGNvdmVyRmllbGRzOiBzdHJpbmdbXTtcclxuICBtZXRhRmllbGRzOiBzdHJpbmdbXTtcclxuICB2ZXJib3NlOiBib29sZWFuO1xyXG4gIC8qKiBcdTVFMDNcdTVDNDBcdTlFRDhcdThCQTRcdTUwM0NcdTUzRDhcdTUzMTZcdTY1RjZcdTc1MjhcdTY3NjVcdThGQzFcdTc5RkJcdTY1RTdcdThCQkVcdTdGNkUgKi9cclxuICBzZXR0aW5nc1ZlcnNpb24/OiBudW1iZXI7XHJcbn1cclxuXHJcbi8qKiBcdTVFMDNcdTVDNDBcdTc2RjhcdTUxNzNcdTlFRDhcdThCQTRcdTUwM0NcdTUzRDhcdTY2RjRcdTY1RjYgKzFcdUZGMENcdTY1RTdcdThCQkVcdTdGNkVcdTRGMUFcdTg4QUJcdTY1QjBcdTlFRDhcdThCQTRcdTUwM0NcdTg5ODZcdTc2RDYgKi9cclxuZXhwb3J0IGNvbnN0IFNFVFRJTkdTX1ZFUlNJT04gPSAzO1xyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEF0b21pY0NhcmRzU2V0dGluZ3MgPSB7XHJcbiAgdXBncmFkZUVtYmVkczogdHJ1ZSxcclxuICBsYXlvdXQ6IFwid3JhcFwiLFxyXG4gIG5lc3RlZFNpemU6IFwibm9ybWFsXCIsXHJcbiAgY2FyZEhlaWdodDogMCxcclxuICBzdW1tYXJ5TGVuZ3RoOiAxODAsXHJcbiAgc2hvd0NvdmVyOiB0cnVlLFxyXG4gIHNob3dNZXRhOiB0cnVlLFxyXG4gIHNob3dUYWdzOiB0cnVlLFxyXG4gIHNob3dPcGVuQnV0dG9uOiB0cnVlLFxyXG4gIGRlZmF1bHRFeHBhbmRlZDogdHJ1ZSxcclxuICBuZXN0ZWRFeHBhbmRlZDogdHJ1ZSxcclxuICBtYXhOZXN0RGVwdGg6IDMsXHJcbiAgZGVuc2l0eTogXCJjb21mb3J0YWJsZVwiLFxyXG4gIHN1bW1hcnlGaWVsZHM6IFtcInN1bW1hcnlcIiwgXCJkZXNjcmlwdGlvblwiLCBcImFic3RyYWN0XCIsIFwiZXhjZXJwdFwiLCBcIlx1N0I4MFx1NEVDQlwiLCBcIlx1NjQ1OFx1ODk4MVwiXSxcclxuICBjb3ZlckZpZWxkczogW1wiY292ZXJcIiwgXCJpbWFnZVwiLCBcImJhbm5lclwiLCBcInRodW1ibmFpbFwiLCBcImltZ1wiLCBcIlx1NUMwMVx1OTc2MlwiXSxcclxuICBtZXRhRmllbGRzOiBbXCJ0eXBlXCIsIFwic3RhdHVzXCIsIFwiZG9tYWluXCIsIFwiY29tcGxleGl0eVwiXSxcclxuICB2ZXJib3NlOiBmYWxzZSxcclxufTtcclxuXHJcbi8qKiBcdTZFMzJcdTY3RDNcdTUzNTVcdTVGMjBcdTUzNjFcdTcyNDdcdTYyNDBcdTk3MDBcdTkwMDlcdTk4NzlcdUZGMENcdTUxNjhcdTkwRThcdTY3NjVcdTgxRUFcdTYzRDJcdTRFRjZcdThCQkVcdTdGNkVcdUZGMDhcdTZDQTFcdTY3MDlcdTU3NTdcdTUxODVcdTkwMDlcdTk4NzlcdTRFODZcdUZGMDkgKi9cclxuZXhwb3J0IGludGVyZmFjZSBSZW5kZXJPcHRpb25zIHtcclxuICBzaXplOiBTaXplO1xyXG4gIGRlbnNpdHk6IERlbnNpdHk7XHJcbiAgbGF5b3V0OiBMYXlvdXQ7XHJcbiAgY292ZXI6IGJvb2xlYW47XHJcbiAgbWV0YTogYm9vbGVhbjtcclxuICB0YWdzOiBib29sZWFuO1xyXG4gIG9wZW46IGJvb2xlYW47XHJcbiAgZXhwYW5kZWQ6IGJvb2xlYW47XHJcbiAgLyoqIFx1NTM2MVx1NzI0N1x1NjcwMFx1NTkyN1x1OUFEOFx1NUVBNlx1RkYwQzAgPSBcdTRFMERcdTk2NTBcdTUyMzYgKi9cclxuICBoZWlnaHQ6IG51bWJlcjtcclxuICAvKiogXHU4MUVBXHU1MkE4XHU2NDU4XHU4OTgxXHU1QjU3XHU3QjI2XHU2NTcwICovXHJcbiAgc3VtbWFyeTogbnVtYmVyO1xyXG59XHJcblxyXG4vKiogXHU5NzVFXHU3QjE0XHU4QkIwXHU3Njg0XHU1RDRDXHU1MTY1XHVGRjA4XHU1NkZFXHU3MjQ3IC8gXHU5N0YzXHU4OUM2XHU5ODkxIC8gUERGIC8gXHU3NTNCXHU1RTAzXHU3QjQ5XHVGRjA5XHU0RTBEXHU1MDVBXHU1MzYxXHU3MjQ3XHU1MzE2ICovXHJcbmV4cG9ydCBjb25zdCBTS0lQX0VNQkVEX0VYVCA9XHJcbiAgL1xcLihwbmd8anBlP2d8Z2lmfHdlYnB8c3ZnfGJtcHxpY298YXZpZnxtcDN8d2F2fG9nZ3xmbGFjfG00YXxtcDR8d2VibXxtb3Z8cGRmfGNhbnZhc3xleGNhbGlkcmF3KSQvaTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxtQkFPTzs7O0FDUFAsSUFBQUMsbUJBQWdEOzs7QUNBaEQsc0JBQTBGO0FBd0IxRixJQUFNLFFBQVEsb0JBQUksSUFBc0I7QUFFeEMsU0FBUyxpQkFBaUIsS0FBcUI7QUFDN0MsUUFBTSxJQUFJLElBQUksTUFBTSxpQ0FBaUM7QUFDckQsU0FBTyxJQUFJLElBQUksTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLElBQUk7QUFDdEM7QUFHTyxTQUFTLFlBQVksTUFBc0I7QUFDaEQsU0FBTyxpQkFBaUIsSUFBSSxFQUN6QixRQUFRLG1CQUFtQixFQUFFLEVBQzdCLFFBQVEsK0JBQStCLEVBQUUsRUFDekMsUUFBUSxvQkFBb0IsRUFBRSxFQUM5QixRQUFRLHlCQUF5QixFQUFFLEVBQ25DLFFBQVEsaUNBQWlDLENBQUMsSUFBSSxHQUFXLE1BQWMsS0FBSyxDQUFDLEVBQzdFLFFBQVEsMEJBQTBCLElBQUksRUFDdEMsUUFBUSwwQkFBMEIsRUFBRSxFQUNwQyxRQUFRLGtCQUFrQixFQUFFLEVBQzVCLFFBQVEsa0JBQWtCLEVBQUUsRUFDNUIsUUFBUSxrQkFBa0IsRUFBRSxFQUM1QixRQUFRLFlBQVksRUFBRSxFQUN0QixRQUFRLFFBQVEsR0FBRyxFQUNuQixLQUFLO0FBQ1Y7QUFFQSxTQUFTLFVBQVUsU0FBeUI7QUFDMUMsUUFBTSxPQUFPLFlBQVksT0FBTztBQUNoQyxTQUFPLEtBQUssU0FBUyxLQUFLLEdBQUcsS0FBSyxNQUFNLEdBQUcsRUFBRSxDQUFDLFdBQU07QUFDdEQ7QUFNTyxTQUFTLGFBQ2QsS0FDQSxXQUNBLEtBQzJDO0FBOUQ3QztBQStERSxRQUFNLFFBQVEsSUFBSSxNQUFNLE9BQU87QUFDL0IsUUFBTSxTQUFTLG1CQUFtQixHQUFHO0FBR3JDLE1B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LEVBR1EsY0FBYyxRQUFzQjtBQUMxQyxVQUFNLE1BQU0sT0FBTyxhQUFhO0FBQ2hDLFFBQUksQ0FBQyxJQUFJLEtBQUssR0FBRztBQUNmLFVBQUksd0JBQU8sMEVBQW1CO0FBQzlCO0FBQUEsSUFDRjtBQUNBLFVBQU0sS0FBSztBQUNYLFVBQU0sUUFBa0IsQ0FBQztBQUN6QixRQUFJO0FBQ0osWUFBUSxJQUFJLEdBQUcsS0FBSyxHQUFHLE9BQU8sTUFBTTtBQUNsQyxZQUFNLElBQUksRUFBRSxDQUFDLEVBQUUsS0FBSztBQUNwQixVQUFJLEtBQUssQ0FBQyxNQUFNLFNBQVMsQ0FBQyxFQUFHLE9BQU0sS0FBSyxDQUFDO0FBQUEsSUFDM0M7QUFDQSxRQUFJLENBQUMsTUFBTSxRQUFRO0FBQ2pCLFVBQUksd0JBQU8saURBQWM7QUFDekI7QUFBQSxJQUNGO0FBQ0EsV0FBTyxpQkFBaUIsTUFBTSxJQUFJLENBQUMsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxDQUFDO0FBQ2xFLFFBQUksd0JBQU8sc0JBQU8sTUFBTSxNQUFNLHFCQUFNO0FBQUEsRUFDdEM7QUFBQTtBQUFBLEVBR1Esb0JBQW9CLFFBQXNCO0FBQ2hELFVBQU0sT0FBTyxLQUFLLElBQUksVUFBVSxjQUFjO0FBQzlDLFFBQUksQ0FBQyxNQUFNO0FBQ1QsVUFBSSx3QkFBTyx3REFBVztBQUN0QjtBQUFBLElBQ0Y7QUFDQSxVQUFNLFFBQVEsS0FBSyxJQUFJLGNBQWM7QUFDckMsVUFBTSxPQUFPLE9BQU8sS0FBSyxLQUFLLEVBQUUsT0FBTyxDQUFDLFFBQUs7QUEvUGpEO0FBK1BvRCx5QkFBTSxHQUFHLE1BQVQsbUJBQWEsS0FBSztBQUFBLEtBQUs7QUFDdkUsUUFBSSxDQUFDLEtBQUssUUFBUTtBQUNoQixVQUFJLHdCQUFPLGtEQUFVO0FBQ3JCO0FBQUEsSUFDRjtBQUNBLFVBQU0sT0FBTztBQUFBO0FBQUEsRUFBWSxLQUN0QixJQUFJLENBQUMsTUFBTSxRQUFRLEVBQUUsUUFBUSxVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQzlDLEtBQUssSUFBSSxDQUFDO0FBQUE7QUFDYixXQUFPLGFBQWEsTUFBTSxPQUFPLFVBQVUsQ0FBQztBQUM1QyxRQUFJLHdCQUFPLHNCQUFPLEtBQUssTUFBTSxxQkFBTTtBQUFBLEVBQ3JDO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaCIsICJrZXkiLCAiX2EiLCAiaW1wb3J0X29ic2lkaWFuIl0KfQo=
