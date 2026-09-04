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
    await this.loadSettings();
    this.addSettingTab(new AtomicCardsSettingTab(this.app, this));
    this.registerMarkdownPostProcessor((el, ctx) => this.upgradeEmbeds(el, ctx));
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
   * 渲染：接管原生嵌入
   * ===================================================================== */
  upgradeEmbeds(el, ctx) {
    var _a;
    if (!this.settings.upgradeEmbeds) return;
    if (getNest() >= this.settings.maxNestDepth) return;
    for (const embed of Array.from(el.querySelectorAll(".internal-embed"))) {
      if (embed.tagName !== "DIV") continue;
      if (embed.dataset.acUpgraded) continue;
      const src = ((_a = embed.getAttribute("src")) != null ? _a : "").trim();
      if (!src) continue;
      if (SKIP_EMBED_EXT.test(src.split("#")[0])) continue;
      if (embed.querySelector("img, audio, video, canvas")) continue;
      embed.dataset.acUpgraded = "1";
      void this.replaceWithCard(embed, src, ctx);
    }
  }
  async replaceWithCard(embed, src, ctx) {
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
      depth
    };
    const target = src.replace(/\.md(?=#|$)/i, "");
    const meta = await readNoteMeta(this.app, target, ctx.sourcePath, this.settings);
    if (!embed.isConnected) return;
    const card = withNest(depth, () => renderCard(env, meta, opts));
    embed.replaceWith(card);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy9tYWluLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvY2FyZC50cyIsICIuLi8uLi8uLi8ucGx1Z2lucy9hdG9taWMtY2FyZHMvc3JjL21ldGFkYXRhLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvc2V0dGluZ3MudHMiLCAiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy90eXBlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcclxuICBFZGl0b3IsXHJcbiAgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcclxuICBNYXJrZG93blJlbmRlckNoaWxkLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBOb3RpY2UsXHJcbiAgUGx1Z2luLFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyByZW5kZXJDYXJkLCBnZXROZXN0LCB3aXRoTmVzdCB9IGZyb20gXCIuL2NhcmRcIjtcclxuaW1wb3J0IHsgcmVhZE5vdGVNZXRhIH0gZnJvbSBcIi4vbWV0YWRhdGFcIjtcclxuaW1wb3J0IHsgQXRvbWljQ2FyZHNTZXR0aW5nVGFiIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuaW1wb3J0IHtcclxuICBBdG9taWNDYXJkc1NldHRpbmdzLFxyXG4gIERFRkFVTFRfU0VUVElOR1MsXHJcbiAgUmVuZGVyT3B0aW9ucyxcclxuICBTRVRUSU5HU19WRVJTSU9OLFxyXG4gIFNpemUsXHJcbiAgU0tJUF9FTUJFRF9FWFQsXHJcbn0gZnJvbSBcIi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEF0b21pY0NhcmRzUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICBzZXR0aW5nczogQXRvbWljQ2FyZHNTZXR0aW5ncyA9IHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9O1xyXG5cclxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBBdG9taWNDYXJkc1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICAvLyBcdTYzQTVcdTdCQTEgT2JzaWRpYW4gXHU1MzlGXHU3NTFGICFbWyBdXSBcdTVENENcdTUxNjVcdUZGMUFcdThCRURcdTZDRDVcdTRGRERcdTYzMDFcdTUzOUZcdTc1MUZcdUZGMENcdTUzRUFcdTYyOEFcdTZFMzJcdTY3RDNcdTY2RkZcdTYzNjJcdTYyMTBcdTUzNjFcdTcyNDdcclxuICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93blBvc3RQcm9jZXNzb3IoKGVsLCBjdHgpID0+IHRoaXMudXBncmFkZUVtYmVkcyhlbCwgY3R4KSk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlckNvbW1hbmRzKCk7XHJcbiAgfVxyXG5cclxuICBvbnVubG9hZCgpOiB2b2lkIHtcclxuICAgIC8qIENvbXBvbmVudCBcdTc1MUZcdTU0N0RcdTU0NjhcdTY3MUZcdTc1MzEgY3R4LmFkZENoaWxkIFx1NjI1OFx1N0JBMSAqL1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3Qgc2F2ZWQgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCk7XHJcbiAgICBpZiAoc2F2ZWQgJiYgdHlwZW9mIHNhdmVkID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgIC8vIFx1NUUwM1x1NUM0MFx1OUVEOFx1OEJBNFx1NTAzQ1x1NTNEOFx1NEU4Nlx1RkYwQ1x1NjVFN1x1NUI1OFx1Njg2M1x1ODk4MVx1OEZDMVx1NzlGQlx1RkYwQ1x1NTQyNlx1NTIxOVx1NzUyOFx1NjIzN1x1N0FFRlx1NzcwQlx1NTIzMFx1NzY4NFx1OEZEOFx1NjYyRlx1NjVFN1x1NUUwM1x1NUM0MFxyXG4gICAgICBpZiAoc2F2ZWQuc2V0dGluZ3NWZXJzaW9uICE9PSBTRVRUSU5HU19WRVJTSU9OKSB7XHJcbiAgICAgICAgT2JqZWN0LmFzc2lnbihzYXZlZCwge1xyXG4gICAgICAgICAgbGF5b3V0OiBERUZBVUxUX1NFVFRJTkdTLmxheW91dCxcclxuICAgICAgICAgIG5lc3RlZFNpemU6IERFRkFVTFRfU0VUVElOR1MubmVzdGVkU2l6ZSxcclxuICAgICAgICAgIGRlZmF1bHRFeHBhbmRlZDogREVGQVVMVF9TRVRUSU5HUy5kZWZhdWx0RXhwYW5kZWQsXHJcbiAgICAgICAgICBuZXN0ZWRFeHBhbmRlZDogREVGQVVMVF9TRVRUSU5HUy5uZXN0ZWRFeHBhbmRlZCxcclxuICAgICAgICAgIHNldHRpbmdzVmVyc2lvbjogU0VUVElOR1NfVkVSU0lPTixcclxuICAgICAgICB9KTtcclxuICAgICAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHNhdmVkKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7IC4uLkRFRkFVTFRfU0VUVElOR1MgfSwgc2F2ZWQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zZXR0aW5ncyA9IHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICB9XHJcblxyXG4gIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICogXHU2RTMyXHU2N0QzXHVGRjFBXHU2M0E1XHU3QkExXHU1MzlGXHU3NTFGXHU1RDRDXHU1MTY1XHJcbiAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG4gIHByaXZhdGUgdXBncmFkZUVtYmVkcyhlbDogSFRNTEVsZW1lbnQsIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLnVwZ3JhZGVFbWJlZHMpIHJldHVybjtcclxuICAgIC8vIFx1OEZCRVx1NTIzMFx1NUQ0Q1x1NTk1N1x1NEUwQVx1OTY1MFx1NjVGNlx1NEUwRFx1NTE4RFx1NjNBNVx1N0JBMVx1RkYwQ1x1OTA3Rlx1NTE0RFx1NUZBQVx1NzNBRlx1NUYxNVx1NzUyOFx1NjVFMFx1OTY1MFx1NTk1N1x1NUEwM1xyXG4gICAgaWYgKGdldE5lc3QoKSA+PSB0aGlzLnNldHRpbmdzLm1heE5lc3REZXB0aCkgcmV0dXJuO1xyXG5cclxuICAgIGZvciAoY29uc3QgZW1iZWQgb2YgQXJyYXkuZnJvbShlbC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5pbnRlcm5hbC1lbWJlZFwiKSkpIHtcclxuICAgICAgLy8gXHU1M0VBXHU2M0E1XHU3QkExXHU1NzU3XHU3RUE3XHU1RDRDXHU1MTY1XHVGRjA4XHU3MkVDXHU1MzYwXHU0RTAwXHU4ODRDXHVGRjA5XHVGRjFCXHU4ODRDXHU1MTg1XHU1RDRDXHU1MTY1ICFbW3hdXSBcdTRGRERcdTYzMDFcdTUzOUZcdTY4MzdcclxuICAgICAgaWYgKGVtYmVkLnRhZ05hbWUgIT09IFwiRElWXCIpIGNvbnRpbnVlO1xyXG4gICAgICAvLyBcdTU0MENcdTRFMDBcdTRFMkFcdTUxNDNcdTdEMjBcdTUzRUFcdTU5MDRcdTc0MDZcdTRFMDBcdTZCMjFcclxuICAgICAgaWYgKGVtYmVkLmRhdGFzZXQuYWNVcGdyYWRlZCkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCBzcmMgPSAoZW1iZWQuZ2V0QXR0cmlidXRlKFwic3JjXCIpID8/IFwiXCIpLnRyaW0oKTtcclxuICAgICAgaWYgKCFzcmMpIGNvbnRpbnVlO1xyXG4gICAgICAvLyBcdTU2RkVcdTcyNDcgLyBcdTk3RjNcdTg5QzZcdTk4OTEgLyBQREYgLyBcdTc1M0JcdTVFMDNcdTdCNDlcdTRFMERcdTY2MkZcdTdCMTRcdThCQjBcdUZGMENcdThERjNcdThGQzdcclxuICAgICAgaWYgKFNLSVBfRU1CRURfRVhULnRlc3Qoc3JjLnNwbGl0KFwiI1wiKVswXSkpIGNvbnRpbnVlO1xyXG4gICAgICAvLyBcdTVERjJcdTdFQ0ZcdTZFMzJcdTY3RDNcdTYyMTBcdTVBOTJcdTRGNTNcdTUxNDNcdTdEMjBcdTc2ODRcdUZGMENcdThERjNcdThGQzdcclxuICAgICAgaWYgKGVtYmVkLnF1ZXJ5U2VsZWN0b3IoXCJpbWcsIGF1ZGlvLCB2aWRlbywgY2FudmFzXCIpKSBjb250aW51ZTtcclxuXHJcbiAgICAgIGVtYmVkLmRhdGFzZXQuYWNVcGdyYWRlZCA9IFwiMVwiO1xyXG4gICAgICB2b2lkIHRoaXMucmVwbGFjZVdpdGhDYXJkKGVtYmVkLCBzcmMsIGN0eCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHJlcGxhY2VXaXRoQ2FyZChcclxuICAgIGVtYmVkOiBIVE1MRWxlbWVudCxcclxuICAgIHNyYzogc3RyaW5nLFxyXG4gICAgY3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0XHJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBkZXB0aCA9IGdldE5lc3QoKTtcclxuICAgIGNvbnN0IHNpemU6IFNpemUgPSBkZXB0aCA+IDAgPyB0aGlzLnNldHRpbmdzLm5lc3RlZFNpemUgOiBcIm5vcm1hbFwiO1xyXG4gICAgY29uc3QgaXNTbWFsbCA9IHNpemUgPT09IFwic21hbGxcIjtcclxuXHJcbiAgICBjb25zdCBvcHRzOiBSZW5kZXJPcHRpb25zID0ge1xyXG4gICAgICBzaXplLFxyXG4gICAgICBkZW5zaXR5OiBpc1NtYWxsID8gXCJjb21wYWN0XCIgOiB0aGlzLnNldHRpbmdzLmRlbnNpdHksXHJcbiAgICAgIGxheW91dDogdGhpcy5zZXR0aW5ncy5sYXlvdXQsXHJcbiAgICAgIGNvdmVyOiB0aGlzLnNldHRpbmdzLnNob3dDb3ZlcixcclxuICAgICAgbWV0YTogaXNTbWFsbCA/IGZhbHNlIDogdGhpcy5zZXR0aW5ncy5zaG93TWV0YSxcclxuICAgICAgdGFnczogaXNTbWFsbCA/IGZhbHNlIDogdGhpcy5zZXR0aW5ncy5zaG93VGFncyxcclxuICAgICAgLy8gXHU2ODA3XHU5ODk4XHU2NjJGXHU2Mjk4XHU1M0UwXHU1RjAwXHU1MTczXHVGRjBDXCJcdTYyNTNcdTVGMDBcIlx1NjMwOVx1OTRBRVx1NjYyRlx1NTUyRlx1NEUwMFx1NzY4NFx1OERGM1x1OEY2Q1x1NTE2NVx1NTNFM1xyXG4gICAgICBvcGVuOiBpc1NtYWxsID8gdHJ1ZSA6IHRoaXMuc2V0dGluZ3Muc2hvd09wZW5CdXR0b24sXHJcbiAgICAgIGV4cGFuZGVkOiBkZXB0aCA+IDAgPyB0aGlzLnNldHRpbmdzLm5lc3RlZEV4cGFuZGVkIDogdGhpcy5zZXR0aW5ncy5kZWZhdWx0RXhwYW5kZWQsXHJcbiAgICAgIGhlaWdodDogdGhpcy5zZXR0aW5ncy5jYXJkSGVpZ2h0LFxyXG4gICAgICBzdW1tYXJ5OiBpc1NtYWxsID8gOTAgOiB0aGlzLnNldHRpbmdzLnN1bW1hcnlMZW5ndGgsXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFx1NjMwMlx1NTcyOFx1NkUzOFx1NzlCQlx1ODI4Mlx1NzBCOVx1NEUwQVx1RkYxQVx1NTNFQVx1NTAxRlx1NzUyOFx1NzUxRlx1NTQ3RFx1NTQ2OFx1NjcxRlx1RkYwQ29udW5sb2FkIFx1NjVGNlx1NkUwNVx1N0E3QVx1NUI4M1x1NEUwRFx1NUY3MVx1NTRDRFx1NjU4N1x1Njg2M1xyXG4gICAgY29uc3QgaG9sZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBNYXJrZG93blJlbmRlckNoaWxkKGhvbGRlcik7XHJcbiAgICBjb21wb25lbnQubG9hZCgpO1xyXG4gICAgY3R4LmFkZENoaWxkKGNvbXBvbmVudCk7XHJcblxyXG4gICAgY29uc3QgZW52ID0ge1xyXG4gICAgICBhcHA6IHRoaXMuYXBwLFxyXG4gICAgICBzZXR0aW5nczogdGhpcy5zZXR0aW5ncyxcclxuICAgICAgc291cmNlUGF0aDogY3R4LnNvdXJjZVBhdGgsXHJcbiAgICAgIGNvbXBvbmVudCxcclxuICAgICAgZGVwdGgsXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIHNyYyBcdTVGNjJcdTU5ODIgXCJcdTdCMTRcdThCQjBcIlx1MzAwMVwiXHU3QjE0XHU4QkIwLm1kXCJcdTMwMDFcIlx1N0IxNFx1OEJCMCNcdTY4MDdcdTk4OThcIlx1MzAwMVwiXHU3QjE0XHU4QkIwI15cdTU3NTdpZFwiXHJcbiAgICBjb25zdCB0YXJnZXQgPSBzcmMucmVwbGFjZSgvXFwubWQoPz0jfCQpL2ksIFwiXCIpO1xyXG4gICAgY29uc3QgbWV0YSA9IGF3YWl0IHJlYWROb3RlTWV0YSh0aGlzLmFwcCwgdGFyZ2V0LCBjdHguc291cmNlUGF0aCwgdGhpcy5zZXR0aW5ncyk7XHJcbiAgICBpZiAoIWVtYmVkLmlzQ29ubmVjdGVkKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgY2FyZCA9IHdpdGhOZXN0KGRlcHRoLCAoKSA9PiByZW5kZXJDYXJkKGVudiwgbWV0YSwgb3B0cykpO1xyXG4gICAgZW1iZWQucmVwbGFjZVdpdGgoY2FyZCk7XHJcbiAgfVxyXG5cclxuICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAqIFx1NTQ3RFx1NEVFNFxyXG4gICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuICBwcml2YXRlIGFjdGl2ZUVkaXRvcigpOiBFZGl0b3IgfCBudWxsIHtcclxuICAgIGNvbnN0IHZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgcmV0dXJuIHZpZXc/LmVkaXRvciA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWdpc3RlckNvbW1hbmRzKCk6IHZvaWQge1xyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwibGlua3MtdG8tZW1iZWRzXCIsXHJcbiAgICAgIG5hbWU6IFwiXHU2MjhBXHU5MDA5XHU1MzNBXHU5MUNDXHU3Njg0IFtbXHU5NEZFXHU2M0E1XV0gXHU4RjZDXHU2MjEwXHU1RDRDXHU1MTY1XHU1MjE3XHU4ODY4XCIsXHJcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHRoaXMubGlua3NUb0VtYmVkcyhlZGl0b3IpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiaW5zZXJ0LXJldmVyc2UtZW1iZWRzXCIsXHJcbiAgICAgIG5hbWU6IFwiXHU2M0QyXHU1MTY1XHU1M0NEXHU2N0U1XHU1MjE3XHU4ODY4XHVGRjA4XHU1RjE1XHU3NTI4XHU2NzJDXHU2NTg3XHU3Njg0XHU3QjE0XHU4QkIwXHVGRjBDXHU3NTFGXHU2MjEwXHU0RTNBXHU1RDRDXHU1MTY1XHVGRjA5XCIsXHJcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHRoaXMuaW5zZXJ0UmV2ZXJzZUVtYmVkcyhlZGl0b3IpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwidG9nZ2xlLWFsbC1jYXJkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NUM1NVx1NUYwMCAvIFx1NjUzNlx1OEQ3N1x1NjcyQ1x1OTg3NVx1NjI0MFx1NjcwOVx1NTM2MVx1NzI0N1wiLFxyXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGNhcmRzID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5hYy1jYXJkXCIpKTtcclxuICAgICAgICBpZiAoIWNhcmRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgbmV3IE5vdGljZShcIlx1NUY1M1x1NTI0RFx1ODlDNlx1NTZGRVx1OTFDQ1x1NkNBMVx1NjcwOVx1NTM2MVx1NzI0N1wiKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgY29sbGFwc2VkID0gY2FyZHMuZmlsdGVyKChjKSA9PiAhYy5jbGFzc0xpc3QuY29udGFpbnMoXCJpcy1leHBhbmRlZFwiKSk7XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0cyA9IGNvbGxhcHNlZC5sZW5ndGggPyBjb2xsYXBzZWQgOiBjYXJkcztcclxuICAgICAgICBmb3IgKGNvbnN0IGMgb2YgdGFyZ2V0cykgYy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcIi5hYy1idG4tLXRvZ2dsZVwiKT8uY2xpY2soKTtcclxuICAgICAgICBuZXcgTm90aWNlKGNvbGxhcHNlZC5sZW5ndGggPyBgXHU1REYyXHU1QzU1XHU1RjAwICR7dGFyZ2V0cy5sZW5ndGh9IFx1NUYyMFx1NTM2MVx1NzI0N2AgOiBgXHU1REYyXHU2NTM2XHU4RDc3ICR7dGFyZ2V0cy5sZW5ndGh9IFx1NUYyMFx1NTM2MVx1NzI0N2ApO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKiogXHU5MDA5XHU1MzNBXHU5MUNDXHU3Njg0IFtbXHU5NEZFXHU2M0E1XV0gXHUyMTkyIFx1NTM5Rlx1NzUxRlx1NUQ0Q1x1NTE2NVx1NTIxN1x1ODg2OCBgLSAhW1tcdTk0RkVcdTYzQTVdXWAgKi9cclxuICBwcml2YXRlIGxpbmtzVG9FbWJlZHMoZWRpdG9yOiBFZGl0b3IpOiB2b2lkIHtcclxuICAgIGNvbnN0IHNlbCA9IGVkaXRvci5nZXRTZWxlY3Rpb24oKTtcclxuICAgIGlmICghc2VsLnRyaW0oKSkge1xyXG4gICAgICBuZXcgTm90aWNlKFwiXHU4QkY3XHU1MTQ4XHU5MDA5XHU0RTJEXHU1MzA1XHU1NDJCIFtbXHU5NEZFXHU2M0E1XV0gXHU3Njg0XHU2NTg3XHU2NzJDXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCByZSA9IC9cXFtcXFsoW15cXF18I10rKSg/OiNbXlxcXXxdKik/KD86XFx8W15cXF1dKik/XFxdXFxdL2c7XHJcbiAgICBjb25zdCBmb3VuZDogc3RyaW5nW10gPSBbXTtcclxuICAgIGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xyXG4gICAgd2hpbGUgKChtID0gcmUuZXhlYyhzZWwpKSAhPT0gbnVsbCkge1xyXG4gICAgICBjb25zdCB0ID0gbVsxXS50cmltKCk7XHJcbiAgICAgIGlmICh0ICYmICFmb3VuZC5pbmNsdWRlcyh0KSkgZm91bmQucHVzaCh0KTtcclxuICAgIH1cclxuICAgIGlmICghZm91bmQubGVuZ3RoKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJcdTkwMDlcdTUzM0FcdTkxQ0NcdTZDQTFcdTY3MDkgW1tcdTk0RkVcdTYzQTVdXVwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgZWRpdG9yLnJlcGxhY2VTZWxlY3Rpb24oZm91bmQubWFwKCh0KSA9PiBgLSAhW1ske3R9XV1gKS5qb2luKFwiXFxuXCIpKTtcclxuICAgIG5ldyBOb3RpY2UoYFx1NURGMlx1NjNEMlx1NTE2NSAke2ZvdW5kLmxlbmd0aH0gXHU1OTA0XHU1RDRDXHU1MTY1YCk7XHJcbiAgfVxyXG5cclxuICAvKiogXHU1M0NEXHU2N0U1XHVGRjFBXHU2MjhBXHU1RjE1XHU3NTI4XHU0RTg2XHU2NzJDXHU2NTg3XHU3Njg0XHU3QjE0XHU4QkIwXHU0RUU1XHU1MzlGXHU3NTFGXHU1RDRDXHU1MTY1XHU1MjE3XHU4ODY4XHU2M0QyXHU1MTY1XHVGRjA4XHU5NzU5XHU2MDAxXHU3RUQzXHU2NzlDXHVGRjBDXHU0RTBEXHU2NjJGXHU1MkE4XHU2MDAxXHU2RTMyXHU2N0QzXHVGRjA5ICovXHJcbiAgcHJpdmF0ZSBpbnNlcnRSZXZlcnNlRW1iZWRzKGVkaXRvcjogRWRpdG9yKTogdm9pZCB7XHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcclxuICAgIGlmICghZmlsZSkge1xyXG4gICAgICBuZXcgTm90aWNlKFwiXHU1RjUzXHU1MjREXHU2Q0ExXHU2NzA5XHU2MjUzXHU1RjAwXHU3Njg0XHU2NTg3XHU0RUY2XCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBsaW5rcyA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUucmVzb2x2ZWRMaW5rcztcclxuICAgIGNvbnN0IHJlZnMgPSBPYmplY3Qua2V5cyhsaW5rcykuZmlsdGVyKChzcmMpID0+IGxpbmtzW3NyY10/LltmaWxlLnBhdGhdKTtcclxuICAgIGlmICghcmVmcy5sZW5ndGgpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlx1NkNBMVx1NjcwOVx1N0IxNFx1OEJCMFx1NUYxNVx1NzUyOFx1NjcyQ1x1NjU4N1wiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgdGV4dCA9IGBcdTg4QUJcdTVGMTVcdTc1MjhcdTU3MjhcdUZGMUFcXG5cXG4ke3JlZnNcclxuICAgICAgLm1hcCgocikgPT4gYC0gIVtbJHtyLnJlcGxhY2UoL1xcLm1kJC9pLCBcIlwiKX1dXWApXHJcbiAgICAgIC5qb2luKFwiXFxuXCIpfVxcbmA7XHJcbiAgICBlZGl0b3IucmVwbGFjZVJhbmdlKHRleHQsIGVkaXRvci5nZXRDdXJzb3IoKSk7XHJcbiAgICBuZXcgTm90aWNlKGBcdTVERjJcdTYzRDJcdTUxNjUgJHtyZWZzLmxlbmd0aH0gXHU2NzYxXHU1RjE1XHU3NTI4YCk7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBBcHAsIENvbXBvbmVudCwgTm90aWNlLCBzZXRJY29uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IE5vdGVNZXRhLCByZW5kZXJNYXJrZG93biB9IGZyb20gXCIuL21ldGFkYXRhXCI7XHJcbmltcG9ydCB7IEF0b21pY0NhcmRzU2V0dGluZ3MsIFJlbmRlck9wdGlvbnMgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYXJkRW52IHtcclxuICBhcHA6IEFwcDtcclxuICBzZXR0aW5nczogQXRvbWljQ2FyZHNTZXR0aW5ncztcclxuICBzb3VyY2VQYXRoOiBzdHJpbmc7XHJcbiAgY29tcG9uZW50OiBDb21wb25lbnQ7XHJcbiAgLyoqIFx1NUY1M1x1NTI0RFx1NUQ0Q1x1NTk1N1x1NUM0Mlx1N0VBN1x1RkYwQ1x1NzUyOFx1NEU4RVx1OTAxMlx1NUY1Mlx1NkUzMlx1NjdEM1x1NjVGNlx1OTY1MFx1NTIzNlx1NkRGMVx1NUVBNiAqL1xyXG4gIGRlcHRoOiBudW1iZXI7XHJcbn1cclxuXHJcbmxldCBuZXN0TWFya2VyID0gMDtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXROZXN0KCk6IG51bWJlciB7XHJcbiAgcmV0dXJuIG5lc3RNYXJrZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3aXRoTmVzdDxUPihkZXB0aDogbnVtYmVyLCBmbjogKCkgPT4gVCk6IFQge1xyXG4gIGNvbnN0IHByZXYgPSBuZXN0TWFya2VyO1xyXG4gIG5lc3RNYXJrZXIgPSBkZXB0aDtcclxuICB0cnkge1xyXG4gICAgcmV0dXJuIGZuKCk7XHJcbiAgfSBmaW5hbGx5IHtcclxuICAgIG5lc3RNYXJrZXIgPSBwcmV2O1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gZm10Q291bnQobjogbnVtYmVyKTogc3RyaW5nIHtcclxuICByZXR1cm4gbiA+PSAxMDAwID8gYCR7KG4gLyAxMDAwKS50b0ZpeGVkKDEpfWsgXHU1QjU3YCA6IGAke259IFx1NUI1N2A7XHJcbn1cclxuXHJcbi8qKiBcdTZDQTFcdTY3MDlcdTVDMDFcdTk3NjJcdTY1RjZcdUZGMENcdTc1MjhcdTdDN0JcdTU3OEIvXHU4REVGXHU1Rjg0XHU2M0E4XHU2NUFEXHU0RTAwXHU0RTJBXHU1NkZFXHU2ODA3ICovXHJcbmZ1bmN0aW9uIGljb25Gb3IobWV0YTogTm90ZU1ldGEpOiBzdHJpbmcge1xyXG4gIC8vIFx1NkJCNVx1ODQzRCAvIFx1NzdFNVx1OEJDNlx1NzBCOVx1N0VBN1x1NUYxNVx1NzUyOFxyXG4gIGlmIChtZXRhLmJsb2NrQ29udGVudCkgcmV0dXJuIFwicXVvdGVcIjtcclxuICBjb25zdCB0eXBlID0gKG1ldGEuYmFkZ2VzLmZpbmQoKGIpID0+IGIua2V5ID09PSBcInR5cGVcIik/LnZhbHVlIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XHJcbiAgY29uc3QgaGF5ID0gYCR7dHlwZX0gJHttZXRhLmZpbGU/LnBhdGggPz8gbWV0YS50YXJnZXR9YC50b0xvd2VyQ2FzZSgpO1xyXG4gIGlmICgvY2hhcHRlcnxcdTdBRTBcdTgyODJ8XHU3RUM0XHU1NDA4Ly50ZXN0KGhheSkpIHJldHVybiBcImxheWVyc1wiO1xyXG4gIGlmICgvY29uY2VwdHxcdTY5ODJcdTVGRjUvLnRlc3QoaGF5KSkgcmV0dXJuIFwibGlnaHRidWxiXCI7XHJcbiAgaWYgKC9lbnRpdHl8XHU1QjlFXHU0RjUzLy50ZXN0KGhheSkpIHJldHVybiBcInVzZXJcIjtcclxuICBpZiAoL3Jlc291cmNlfFx1OEQ0NFx1NkU5MC8udGVzdChoYXkpKSByZXR1cm4gXCJwYWNrYWdlXCI7XHJcbiAgaWYgKC9nb2FsfFx1NzZFRVx1NjgwNy8udGVzdChoYXkpKSByZXR1cm4gXCJ0YXJnZXRcIjtcclxuICBpZiAoL21ldGF8ZGFzaGJvYXJkfGluZGV4Ly50ZXN0KGhheSkpIHJldHVybiBcImxheW91dC1ncmlkXCI7XHJcbiAgaWYgKC9hdG9tfFx1NTM5Rlx1NUI1MC8udGVzdChoYXkpKSByZXR1cm4gXCJjaXJjbGUtZG90XCI7XHJcbiAgcmV0dXJuIFwiZmlsZS10ZXh0XCI7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIG9wZW5Ob3RlKGVudjogQ2FyZEVudiwgbWV0YTogTm90ZU1ldGEsIGU6IE1vdXNlRXZlbnQpIHtcclxuICBpZiAoIW1ldGEuZmlsZSkge1xyXG4gICAgY29uc3QgbmFtZSA9IG1ldGEudGFyZ2V0LnNwbGl0KFwiI1wiKVswXS5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIik7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBmaWxlID0gYXdhaXQgZW52LmFwcC52YXVsdC5jcmVhdGUoXHJcbiAgICAgICAgYCR7bmFtZX0ubWRgLFxyXG4gICAgICAgIGAtLS1cXG50eXBlOiBhdG9tXFxudGl0bGU6IFwiJHttZXRhLnRpdGxlfVwiXFxuY3JlYXRlZDogJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApfVxcbi0tLVxcblxcbiMgJHttZXRhLnRpdGxlfVxcblxcbmBcclxuICAgICAgKTtcclxuICAgICAgYXdhaXQgZW52LmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KGZpbGUucGF0aCwgZW52LnNvdXJjZVBhdGgsIGZhbHNlKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBuZXcgTm90aWNlKGBcdTUyMUJcdTVFRkFcdTU5MzFcdThEMjVcdUZGMUEke1N0cmluZyhlcnIpfWApO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBjb25zdCBuZXdMZWFmID0gZS5jdHJsS2V5IHx8IGUubWV0YUtleSB8fCBlLmJ1dHRvbiA9PT0gMTtcclxuICAvLyB0YXJnZXQgXHU1M0VGXHU4MEZEXHU1RTI2ICNcdTY4MDdcdTk4OTggLyAjXlx1NTc1N2lkXHVGRjBDXHU0RUE0XHU3RUQ5IE9ic2lkaWFuIFx1NUI5QVx1NEY0RFx1NTIzMFx1NkJCNVx1ODQzRFxyXG4gIGF3YWl0IGVudi5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChtZXRhLnRhcmdldCB8fCBtZXRhLmZpbGUucGF0aCwgZW52LnNvdXJjZVBhdGgsIG5ld0xlYWYpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBocmVmT2YobWV0YTogTm90ZU1ldGEpOiBzdHJpbmcge1xyXG4gIGlmICghbWV0YS5maWxlKSByZXR1cm4gXCIjXCI7XHJcbiAgcmV0dXJuIG1ldGEucmVmID8gYCR7bWV0YS5maWxlLnBhdGh9IyR7bWV0YS5yZWZ9YCA6IG1ldGEuZmlsZS5wYXRoO1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZE1ldGFSb3cobWV0YTogTm90ZU1ldGEpOiBIVE1MRWxlbWVudCB8IG51bGwge1xyXG4gIGlmICghbWV0YS5iYWRnZXMubGVuZ3RoICYmICFtZXRhLnVwZGF0ZWQgJiYgIW1ldGEud29yZENvdW50KSByZXR1cm4gbnVsbDtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSBcImFjLWNhcmRfX21ldGFcIjtcclxuICBmb3IgKGNvbnN0IGIgb2YgbWV0YS5iYWRnZXMuc2xpY2UoMCwgMikpIHtcclxuICAgIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBgYWMtYmFkZ2UgYWMtYmFkZ2UtLSR7Yi5rZXl9YCwgdGV4dDogYi52YWx1ZSB9KTtcclxuICB9XHJcbiAgaWYgKG1ldGEudXBkYXRlZCkgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtbWV0YV9fZGF0ZVwiLCB0ZXh0OiBtZXRhLnVwZGF0ZWQgfSk7XHJcbiAgaWYgKG1ldGEud29yZENvdW50KSByb3cuY3JlYXRlU3Bhbih7IGNsczogXCJhYy1tZXRhX193b3Jkc1wiLCB0ZXh0OiBmbXRDb3VudChtZXRhLndvcmRDb3VudCkgfSk7XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuZnVuY3Rpb24gYnVpbGRUYWdSb3cobWV0YTogTm90ZU1ldGEsIGxpbWl0OiBudW1iZXIpOiBIVE1MRWxlbWVudCB8IG51bGwge1xyXG4gIGlmICghbWV0YS50YWdzLmxlbmd0aCkgcmV0dXJuIG51bGw7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICByb3cuY2xhc3NOYW1lID0gXCJhYy1jYXJkX190YWdzXCI7XHJcbiAgZm9yIChjb25zdCB0IG9mIG1ldGEudGFncy5zbGljZSgwLCBsaW1pdCkpIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLXRhZ1wiLCB0ZXh0OiBgIyR7dH1gIH0pO1xyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJDYXJkKGVudjogQ2FyZEVudiwgbWV0YTogTm90ZU1ldGEsIG9wdHM6IFJlbmRlck9wdGlvbnMpOiBIVE1MRWxlbWVudCB7XHJcbiAgY29uc3QgaXNXcmFwID0gb3B0cy5sYXlvdXQgIT09IFwiY2FyZFwiO1xyXG4gIGNvbnN0IGlzU21hbGwgPSBvcHRzLnNpemUgPT09IFwic21hbGxcIjtcclxuXHJcbiAgY29uc3QgY2FyZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgY2FyZC5jbGFzc05hbWUgPSBgYWMtY2FyZCBhYy0ke29wdHMuZGVuc2l0eX0gYWMtc2l6ZS0ke29wdHMuc2l6ZX0gYWMtJHtcclxuICAgIGlzV3JhcCA/IFwid3JhcFwiIDogXCJjYXJkc3R5bGVcIlxyXG4gIH1gO1xyXG4gIGNhcmQuZGF0YXNldC5wYXRoID0gbWV0YS5maWxlPy5wYXRoID8/IG1ldGEudGFyZ2V0O1xyXG4gIGlmICghbWV0YS5maWxlKSBjYXJkLmNsYXNzTGlzdC5hZGQoXCJpcy1taXNzaW5nXCIpO1xyXG4gIGlmIChtZXRhLmJsb2NrQ29udGVudCkgY2FyZC5jbGFzc0xpc3QuYWRkKFwiaXMtYmxvY2tcIik7XHJcbiAgaWYgKG9wdHMuaGVpZ2h0ID4gMCkgY2FyZC5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tYWMtY2FyZC1oXCIsIGAke29wdHMuaGVpZ2h0fXB4YCk7XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU2QjYzXHU2NTg3XHU1QkI5XHU1NjY4XHVGRjA4XHU1MTQ4XHU1RUZBXHVGRjBDXHU2NzAwXHU1NDBFIGFwcGVuZFx1RkYwOSAtLS0tLS0tLS0tICovXHJcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgYm9keS5jbGFzc05hbWUgPSBcImFjLWNhcmRfX2JvZHlcIjtcclxuICBib2R5LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICBsZXQgYm9keUxvYWRlZCA9IGZhbHNlO1xyXG5cclxuICBjb25zdCBsb2FkQm9keSA9ICgpID0+IHtcclxuICAgIGlmIChib2R5TG9hZGVkIHx8ICFtZXRhLmZpbGUpIHJldHVybjtcclxuICAgIGJvZHlMb2FkZWQgPSB0cnVlO1xyXG4gICAgY29uc3QgZmlsZSA9IG1ldGEuZmlsZTtcclxuICAgIHZvaWQgZW52LmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpLnRoZW4oKHJhdykgPT4ge1xyXG4gICAgICBjb25zdCBmdWxsID0gcmF3LnJlcGxhY2UoL14tLS1cXHI/XFxuW1xcc1xcU10qP1xccj9cXG4tLS1cXHI/XFxuPy8sIFwiXCIpO1xyXG4gICAgICBjb25zdCBtZCA9IG1ldGEuYmxvY2tDb250ZW50ID8/IGZ1bGw7XHJcbiAgICAgIGJvZHkuZW1wdHkoKTtcclxuICAgICAgd2l0aE5lc3QoZW52LmRlcHRoLCAoKSA9PiB7XHJcbiAgICAgICAgcmVuZGVyTWFya2Rvd24oZW52LmFwcCwgbWQsIGJvZHksIGZpbGUucGF0aCwgZW52LmNvbXBvbmVudCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNENcdUZGMUFcdTk4NzZcdTkwRThcdTVDMDFcdTk3NjIgLS0tLS0tLS0tLSAqL1xyXG4gIGlmICghaXNXcmFwICYmIG9wdHMuY292ZXIgJiYgbWV0YS5jb3Zlcikge1xyXG4gICAgY29uc3QgY292ZXIgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJhYy1jYXJkX19jb3ZlclwiIH0pO1xyXG4gICAgY29uc3QgaW1nID0gY292ZXIuY3JlYXRlRWwoXCJpbWdcIiwge1xyXG4gICAgICBhdHRyOiB7IHNyYzogbWV0YS5jb3ZlciwgYWx0OiBtZXRhLnRpdGxlLCBsb2FkaW5nOiBcImxhenlcIiwgZHJhZ2dhYmxlOiBcImZhbHNlXCIgfSxcclxuICAgIH0pO1xyXG4gICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCAoKSA9PiBjb3Zlci5yZW1vdmUoKSk7XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NTkzNFx1OTBFOFx1RkYxQVx1NTZGRVx1NjgwNyArIFx1NjgwN1x1OTg5OCArIFx1NjgwN1x1N0I3RSArIFx1NUZCRFx1N0FFMCArIFx1NjRDRFx1NEY1Q1x1RkYwQ1x1NTE2OFx1NTcyOFx1NEUwMFx1ODg0QyAtLS0tLS0tLS0tICovXHJcbiAgY29uc3QgaGVhZCA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWNhcmRfX2hlYWRcIiB9KTtcclxuXHJcbiAgaWYgKGlzV3JhcCkge1xyXG4gICAgY29uc3QgdGh1bWIgPSBoZWFkLmNyZWF0ZURpdih7IGNsczogXCJhYy1jYXJkX190aHVtYlwiIH0pO1xyXG4gICAgaWYgKG9wdHMuY292ZXIgJiYgbWV0YS5jb3Zlcikge1xyXG4gICAgICBjb25zdCBpbWcgPSB0aHVtYi5jcmVhdGVFbChcImltZ1wiLCB7XHJcbiAgICAgICAgYXR0cjogeyBzcmM6IG1ldGEuY292ZXIsIGFsdDogbWV0YS50aXRsZSwgbG9hZGluZzogXCJsYXp5XCIsIGRyYWdnYWJsZTogXCJmYWxzZVwiIH0sXHJcbiAgICAgIH0pO1xyXG4gICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsICgpID0+IHtcclxuICAgICAgICB0aHVtYi5lbXB0eSgpO1xyXG4gICAgICAgIHNldEljb24odGh1bWIsIGljb25Gb3IobWV0YSkpO1xyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHNldEljb24odGh1bWIsIGljb25Gb3IobWV0YSkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY29uc3QgdGl0bGVFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xyXG4gIHRpdGxlRWwuY2xhc3NOYW1lID0gXCJhYy1jYXJkX190aXRsZVwiO1xyXG4gIHRpdGxlRWwuc2V0QXR0cihcImhyZWZcIiwgaHJlZk9mKG1ldGEpKTtcclxuICB0aXRsZUVsLnRleHRDb250ZW50ID0gbWV0YS50aXRsZTtcclxuICB0aXRsZUVsLnRpdGxlID0gbWV0YS5maWxlXHJcbiAgICA/IGAke2hyZWZPZihtZXRhKX1cdUZGMDhcdTcwQjlcdTUxRkJcdTVDNTVcdTVGMDAvXHU2NTM2XHU4RDc3XHVGRjBDQ3RybCtcdTcwQjlcdTUxRkJcdThERjNcdTUyMzBcdTUzOUZcdTY1ODdcdUZGMDlgXHJcbiAgICA6IGBcdTY1QjBcdTVFRkFcdUZGMUEke21ldGEudGFyZ2V0fWA7XHJcbiAgaGVhZC5hcHBlbmRDaGlsZCh0aXRsZUVsKTtcclxuXHJcbiAgaWYgKCFtZXRhLmZpbGUpIGhlYWQuY3JlYXRlU3Bhbih7IGNsczogXCJhYy1jYXJkX19taXNzaW5nXCIsIHRleHQ6IFwiXHU2NzJBXHU1MjFCXHU1RUZBXCIgfSk7XHJcblxyXG4gIGlmIChvcHRzLnRhZ3MpIHtcclxuICAgIGNvbnN0IHRhZ1JvdyA9IGJ1aWxkVGFnUm93KG1ldGEsIGlzU21hbGwgPyAyIDogMyk7XHJcbiAgICBpZiAodGFnUm93KSBoZWFkLmFwcGVuZENoaWxkKHRhZ1Jvdyk7XHJcbiAgfVxyXG5cclxuICBpZiAob3B0cy5tZXRhKSB7XHJcbiAgICBjb25zdCBtZXRhUm93ID0gYnVpbGRNZXRhUm93KG1ldGEpO1xyXG4gICAgaWYgKG1ldGFSb3cpIGhlYWQuYXBwZW5kQ2hpbGQobWV0YVJvdyk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBhY3Rpb25zID0gaGVhZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9fYWN0aW9uc1wiIH0pO1xyXG5cclxuICBjb25zdCB0b2dnbGVCdG4gPSBhY3Rpb25zLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImFjLWJ0biBhYy1idG4tLXRvZ2dsZVwiIH0pO1xyXG4gIGNvbnN0IHRvZ2dsZUljb24gPSB0b2dnbGVCdG4uY3JlYXRlU3Bhbih7IGNsczogXCJhYy1idG5fX2ljb25cIiB9KTtcclxuICBjb25zdCB0b2dnbGVUZXh0ID0gdG9nZ2xlQnRuLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtYnRuX190ZXh0XCIsIHRleHQ6IFwiXHU1QzU1XHU1RjAwXCIgfSk7XHJcbiAgc2V0SWNvbih0b2dnbGVJY29uLCBcImNoZXZyb24tZG93blwiKTtcclxuXHJcbiAgaWYgKG9wdHMub3Blbikge1xyXG4gICAgY29uc3Qgb3BlbkJ0biA9IGFjdGlvbnMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiYWMtYnRuIGFjLWJ0bi0tb3BlblwiIH0pO1xyXG4gICAgY29uc3Qgb3Blbkljb24gPSBvcGVuQnRuLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtYnRuX19pY29uXCIgfSk7XHJcbiAgICBvcGVuQnRuLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtYnRuX190ZXh0XCIsIHRleHQ6IFwiXHU2MjUzXHU1RjAwXCIgfSk7XHJcbiAgICBzZXRJY29uKG9wZW5JY29uLCBcImFycm93LXVwLXJpZ2h0XCIpO1xyXG4gICAgb3BlbkJ0bi50aXRsZSA9IG1ldGEuZmlsZSA/IFwiXHU1NzI4XHU1MzlGXHU1OUNCXHU2NTg3XHU2ODYzXHU0RTJEXHU2MjUzXHU1RjAwXCIgOiBcIlx1NTIxQlx1NUVGQVx1OEZEOVx1N0JDN1x1NjU4N1x1Njg2M1wiO1xyXG4gICAgb3BlbkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHZvaWQgb3Blbk5vdGUoZW52LCBtZXRhLCBlKSk7XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NjQ1OFx1ODk4MVx1RkYwOFx1NEUyRFx1RkYwOSAtLS0tLS0tLS0tICovXHJcbiAgY2FyZC5jcmVhdGVEaXYoe1xyXG4gICAgY2xzOiBcImFjLWNhcmRfX3N1bW1hcnlcIixcclxuICAgIHRleHQ6IG1ldGEuc3VtbWFyeSB8fCAobWV0YS5maWxlID8gXCJcdUZGMDhcdTY2ODJcdTY1RTBcdTY0NThcdTg5ODFcdUZGMDlcIiA6IFwiXHU3MEI5XHU1MUZCXHU2ODA3XHU5ODk4XHU1MjFCXHU1RUZBXHU4RkQ5XHU3QkM3XHU1MzlGXHU1QjUwXHU2NTg3XHU2ODYzXCIpLFxyXG4gIH0pO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NkI2M1x1NjU4N1x1RkYwOFx1NkRGMVx1RkYwOSAtLS0tLS0tLS0tICovXHJcbiAgY2FyZC5hcHBlbmRDaGlsZChib2R5KTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTVDNTVcdTVGMDAgLyBcdTY1MzZcdThENzcgLS0tLS0tLS0tLSAqL1xyXG4gIGxldCBleHBhbmRlZCA9IGZhbHNlO1xyXG4gIGNvbnN0IHNldEV4cGFuZGVkID0gKG5leHQ6IGJvb2xlYW4pID0+IHtcclxuICAgIGV4cGFuZGVkID0gbmV4dDtcclxuICAgIGNhcmQuY2xhc3NMaXN0LnRvZ2dsZShcImlzLWV4cGFuZGVkXCIsIGV4cGFuZGVkKTtcclxuICAgIHRvZ2dsZVRleHQudGV4dENvbnRlbnQgPSBleHBhbmRlZCA/IFwiXHU2NTM2XHU4RDc3XCIgOiBcIlx1NUM1NVx1NUYwMFwiO1xyXG4gICAgc2V0SWNvbih0b2dnbGVJY29uLCBleHBhbmRlZCA/IFwiY2hldnJvbi11cFwiIDogXCJjaGV2cm9uLWRvd25cIik7XHJcbiAgICBib2R5LnN0eWxlLmRpc3BsYXkgPSBleHBhbmRlZCA/IFwiXCIgOiBcIm5vbmVcIjtcclxuICAgIGlmIChleHBhbmRlZCkgbG9hZEJvZHkoKTtcclxuICB9O1xyXG5cclxuICB0b2dnbGVCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHNldEV4cGFuZGVkKCFleHBhbmRlZCkpO1xyXG5cclxuICAvLyBcdTcwQjlcdTY4MDdcdTk4OThcdTY2MkZcdTYyOThcdTUzRTBcdTVGMDBcdTUxNzNcdUZGMUJcdTYzMDlcdTRGNEYgQ3RybC9DbWQgXHU2MjREXHU4REYzXHU1MjMwXHU1MzlGXHU2NTg3XHJcbiAgdGl0bGVFbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5IHx8IGUuYnV0dG9uID09PSAxKSB7XHJcbiAgICAgIHZvaWQgb3Blbk5vdGUoZW52LCBtZXRhLCBlKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgc2V0RXhwYW5kZWQoIWV4cGFuZGVkKTtcclxuICB9KTtcclxuXHJcbiAgLy8gXHU1OTM0XHU5MEU4XHU3QTdBXHU3NjdEXHU1OTA0XHU0RTVGXHU1M0VGXHU0RUU1XHU2Mjk4XHU1M0UwXHVGRjA4XHU2MzA5XHU5NEFFXHU1NDhDXHU5NEZFXHU2M0E1XHU4MUVBXHU1REYxXHU1OTA0XHU3NDA2XHVGRjBDXHU0RTBEXHU5MUNEXHU1OTBEXHU4OUU2XHU1M0QxXHVGRjA5XHJcbiAgaGVhZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcclxuICAgIGNvbnN0IGVsID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgaWYgKGVsPy5jbG9zZXN0KFwiYnV0dG9uLCBhXCIpKSByZXR1cm47XHJcbiAgICBzZXRFeHBhbmRlZCghZXhwYW5kZWQpO1xyXG4gIH0pO1xyXG5cclxuICBpZiAob3B0cy5leHBhbmRlZCkgc2V0RXhwYW5kZWQodHJ1ZSk7XHJcblxyXG4gIHJldHVybiBjYXJkO1xyXG59XHJcbiIsICJpbXBvcnQgeyBBcHAsIENhY2hlZE1ldGFkYXRhLCBDb21wb25lbnQsIEZyb250TWF0dGVyQ2FjaGUsIE1hcmtkb3duUmVuZGVyZXIsIFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVCYWRnZSB7XHJcbiAga2V5OiBzdHJpbmc7XHJcbiAgdmFsdWU6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBOb3RlTWV0YSB7XHJcbiAgZmlsZTogVEZpbGUgfCBudWxsO1xyXG4gIC8qKiBcdTUzOUZcdTU5Q0JcdTVGMTVcdTc1MjhcdUZGMDhcdTUzRUZcdTU0MkIgI1x1NjgwN1x1OTg5OCBcdTYyMTYgI15cdTU3NTdpZFx1RkYwOSAqL1xyXG4gIHRhcmdldDogc3RyaW5nO1xyXG4gIC8qKiAjIFx1NEU0Qlx1NTQwRVx1NzY4NFx1OTBFOFx1NTIwNlx1RkYwQ1x1NkNBMVx1NjcwOVx1NTIxOVx1NEUzQVx1N0E3QSAqL1xyXG4gIHJlZjogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgc3VtbWFyeTogc3RyaW5nO1xyXG4gIGNvdmVyOiBzdHJpbmcgfCBudWxsO1xyXG4gIHRhZ3M6IHN0cmluZ1tdO1xyXG4gIGJhZGdlczogTm90ZUJhZGdlW107XHJcbiAgdXBkYXRlZDogc3RyaW5nO1xyXG4gIHdvcmRDb3VudDogbnVtYmVyO1xyXG4gIC8qKiBcdTZCQjVcdTg0M0RcdTdFQTdcdTVGMTVcdTc1MjhcdUZGMDhbW1x1OTg3NSNcdTY4MDdcdTk4OThdXSAvIFtbXHU5ODc1I15cdTU3NTddXVx1RkYwOVx1NjVGNlx1RkYwQ1x1OEJFNVx1NkJCNVx1ODQzRFx1NzY4NFx1NkI2M1x1NjU4NyAqL1xyXG4gIGJsb2NrQ29udGVudD86IHN0cmluZztcclxufVxyXG5cclxuY29uc3QgY2FjaGUgPSBuZXcgTWFwPHN0cmluZywgTm90ZU1ldGE+KCk7XHJcblxyXG5mdW5jdGlvbiBzdHJpcEZyb250bWF0dGVyKHJhdzogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBtID0gcmF3Lm1hdGNoKC9eLS0tXFxyP1xcbltcXHNcXFNdKj9cXHI/XFxuLS0tXFxyP1xcbj8vKTtcclxuICByZXR1cm4gbSA/IHJhdy5zbGljZShtWzBdLmxlbmd0aCkgOiByYXc7XHJcbn1cclxuXHJcbi8qKiBcdTYyOEEgbWFya2Rvd24gXHU2QjYzXHU2NTg3XHU1MzhCXHU2MjEwXHU0RTAwXHU2QkI1XHU3RUFGXHU2NTg3XHU2NzJDXHU2NDU4XHU4OTgxICovXHJcbmV4cG9ydCBmdW5jdGlvbiB0b1BsYWluVGV4dChib2R5OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIHJldHVybiBzdHJpcEZyb250bWF0dGVyKGJvZHkpXHJcbiAgICAucmVwbGFjZSgvYGBgW1xcc1xcU10qP2BgYC9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHMqPlxccypcXFshXFx3K1teXFxdXSpcXF0uKiQvZ20sIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvIVxcW1xcW1teXFxdXSpcXF1cXF0vZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC8hXFxbW15cXF1dKlxcXVxcKFteKV0qXFwpL2csIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvXFxbXFxbKFteXFxdfF0rKVxcfD8oW15cXF1dKilcXF1cXF0vZywgKF9tLCBhOiBzdHJpbmcsIGI6IHN0cmluZykgPT4gYiB8fCBhKVxyXG4gICAgLnJlcGxhY2UoL1xcWyhbXlxcXV0qKVxcXVxcKFteKV0qXFwpL2csIFwiJDFcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzezAsM30jezEsNn1cXHMrLiokL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHN7MCwzfT5cXHM/L2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHMqWy0qK11cXHMrL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHMqXFxkK1xcLlxccysvZ20sIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvWypfYH49XS9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL1xccysvZywgXCIgXCIpXHJcbiAgICAudHJpbSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaXJzdFRleHQoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCB0ZXh0ID0gdG9QbGFpblRleHQoY29udGVudCk7XHJcbiAgcmV0dXJuIHRleHQubGVuZ3RoID4gMjQgPyBgJHt0ZXh0LnNsaWNlKDAsIDI0KX1cdTIwMjZgIDogdGV4dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFx1NEVDRVx1NjU4N1x1Njg2M1x1OTFDQ1x1NjIyQVx1NTNENlx1NEUwMFx1NEUyQVx1NkJCNVx1ODQzRFx1RkYwOFx1NzdFNVx1OEJDNlx1NzBCOVx1RkYwOVx1MzAwMlxyXG4gKiBcdTY1MkZcdTYzMDEgYFtbXHU5ODc1I1x1NjgwN1x1OTg5OF1dYCBcdTRFMEUgYFtbXHU5ODc1I15cdTU3NTdpZF1dYCBcdTRFMjRcdTc5Q0RcdTVGMTVcdTc1MjhcdTMwMDJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0QmxvY2soXHJcbiAgcmF3OiBzdHJpbmcsXHJcbiAgZmlsZUNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwsXHJcbiAgcmVmOiBzdHJpbmdcclxuKTogeyB0aXRsZTogc3RyaW5nOyBjb250ZW50OiBzdHJpbmcgfSB8IG51bGwge1xyXG4gIGNvbnN0IGxpbmVzID0gcmF3LnNwbGl0KC9cXHI/XFxuLyk7XHJcbiAgY29uc3Qgd2FudGVkID0gZGVjb2RlVVJJQ29tcG9uZW50KHJlZik7XHJcblxyXG4gIC8vIFx1NTc1N1x1NUYxNVx1NzUyOCBeYmxvY2tpZFxyXG4gIGlmICh3YW50ZWQuc3RhcnRzV2l0aChcIl5cIikpIHtcclxuICAgIGNvbnN0IGJsb2NrID0gZmlsZUNhY2hlPy5ibG9ja3M/Llt3YW50ZWQuc2xpY2UoMSldO1xyXG4gICAgaWYgKCFibG9jaykgcmV0dXJuIG51bGw7XHJcbiAgICBjb25zdCBjb250ZW50ID0gbGluZXNcclxuICAgICAgLnNsaWNlKGJsb2NrLnBvc2l0aW9uLnN0YXJ0LmxpbmUsIGJsb2NrLnBvc2l0aW9uLmVuZC5saW5lICsgMSlcclxuICAgICAgLmpvaW4oXCJcXG5cIik7XHJcbiAgICByZXR1cm4geyB0aXRsZTogZmlyc3RUZXh0KGNvbnRlbnQpIHx8IHdhbnRlZCwgY29udGVudCB9O1xyXG4gIH1cclxuXHJcbiAgLy8gXHU2ODA3XHU5ODk4XHU1RjE1XHU3NTI4ICNoZWFkaW5nXHJcbiAgY29uc3QgaGVhZGluZ3MgPSBmaWxlQ2FjaGU/LmhlYWRpbmdzID8/IFtdO1xyXG4gIGNvbnN0IGlkeCA9IGhlYWRpbmdzLmZpbmRJbmRleCgoaCkgPT4gaC5oZWFkaW5nID09PSB3YW50ZWQpO1xyXG4gIGlmIChpZHggPCAwKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgY29uc3QgaCA9IGhlYWRpbmdzW2lkeF07XHJcbiAgY29uc3Qgc3RhcnQgPSBoLnBvc2l0aW9uLnN0YXJ0LmxpbmU7XHJcbiAgbGV0IGVuZCA9IGxpbmVzLmxlbmd0aCAtIDE7XHJcbiAgZm9yIChsZXQgaSA9IGlkeCArIDE7IGkgPCBoZWFkaW5ncy5sZW5ndGg7IGkrKykge1xyXG4gICAgaWYgKGhlYWRpbmdzW2ldLmxldmVsIDw9IGgubGV2ZWwpIHtcclxuICAgICAgZW5kID0gaGVhZGluZ3NbaV0ucG9zaXRpb24uc3RhcnQubGluZSAtIDE7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4geyB0aXRsZTogaC5oZWFkaW5nLCBjb250ZW50OiBsaW5lcy5zbGljZShzdGFydCwgTWF0aC5tYXgoZW5kLCBzdGFydCkgKyAxKS5qb2luKFwiXFxuXCIpIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBpY2tGaWVsZChmbTogRnJvbnRNYXR0ZXJDYWNoZSB8IHVuZGVmaW5lZCwgZmllbGRzOiBzdHJpbmdbXSk6IHN0cmluZyB7XHJcbiAgaWYgKCFmbSkgcmV0dXJuIFwiXCI7XHJcbiAgZm9yIChjb25zdCBmIG9mIGZpZWxkcykge1xyXG4gICAgY29uc3QgdiA9IGZtW2ZdO1xyXG4gICAgaWYgKHR5cGVvZiB2ID09PSBcInN0cmluZ1wiICYmIHYudHJpbSgpKSByZXR1cm4gdi50cmltKCk7XHJcbiAgICBpZiAodHlwZW9mIHYgPT09IFwibnVtYmVyXCIpIHJldHVybiBTdHJpbmcodik7XHJcbiAgfVxyXG4gIHJldHVybiBcIlwiO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjb2xsZWN0VGFncyhhcHA6IEFwcCwgZmlsZTogVEZpbGUpOiBzdHJpbmdbXSB7XHJcbiAgY29uc3QgZm0gPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyO1xyXG4gIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXTtcclxuICBjb25zdCBwdXNoID0gKHY6IHVua25vd24pID0+IHtcclxuICAgIGlmICh0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIikgb3V0LnB1c2godi5yZXBsYWNlKC9eIy8sIFwiXCIpKTtcclxuICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodikpIHYuZm9yRWFjaChwdXNoKTtcclxuICB9O1xyXG4gIHB1c2goZm0/LnRhZ3MpO1xyXG4gIHB1c2goZm0/LnRhZyk7XHJcbiAgaWYgKCFvdXQubGVuZ3RoKSB7XHJcbiAgICBjb25zdCBjYWNoZVRhZ3MgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LnRhZ3MgPz8gW107XHJcbiAgICBmb3IgKGNvbnN0IHQgb2YgY2FjaGVUYWdzKSBvdXQucHVzaCh0LnRhZy5yZXBsYWNlKC9eIy8sIFwiXCIpKTtcclxuICB9XHJcbiAgcmV0dXJuIEFycmF5LmZyb20obmV3IFNldChvdXQpKS5zbGljZSgwLCA2KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZXh0cmFjdENvdmVyKGFwcDogQXBwLCBmaWxlOiBURmlsZSwgYm9keTogc3RyaW5nLCBmaWVsZHM6IHN0cmluZ1tdKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgY29uc3QgZm0gPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyO1xyXG4gIGNvbnN0IGRlY2xhcmVkID0gcGlja0ZpZWxkKGZtLCBmaWVsZHMpO1xyXG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBbZGVjbGFyZWRdO1xyXG5cclxuICBpZiAoIWRlY2xhcmVkKSB7XHJcbiAgICBjb25zdCB3aWtpSW1nID0gYm9keS5tYXRjaCgvIVxcW1xcWyhbXlxcXXxdKykvKTtcclxuICAgIGlmICh3aWtpSW1nKSBjYW5kaWRhdGVzLnB1c2god2lraUltZ1sxXSk7XHJcbiAgICBjb25zdCBtZEltZyA9IGJvZHkubWF0Y2goLyFcXFtbXlxcXV0qXFxdXFwoKFteKV0rKVxcKS8pO1xyXG4gICAgaWYgKG1kSW1nKSBjYW5kaWRhdGVzLnB1c2gobWRJbWdbMV0pO1xyXG4gIH1cclxuXHJcbiAgZm9yIChjb25zdCBjIG9mIGNhbmRpZGF0ZXMpIHtcclxuICAgIGlmICghYykgY29udGludWU7XHJcbiAgICBpZiAoL15odHRwcz86XFwvXFwvL2kudGVzdChjKSkgcmV0dXJuIGM7XHJcbiAgICBjb25zdCBmID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoYy5zcGxpdChcInxcIilbMF0udHJpbSgpLCBmaWxlLnBhdGgpO1xyXG4gICAgaWYgKGYpIHJldHVybiBhcHAudmF1bHQuZ2V0UmVzb3VyY2VQYXRoKGYpO1xyXG4gIH1cclxuICByZXR1cm4gbnVsbDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVGaWxlKGFwcDogQXBwLCB0YXJnZXQ6IHN0cmluZywgc291cmNlUGF0aDogc3RyaW5nKTogVEZpbGUgfCBudWxsIHtcclxuICBjb25zdCBjbGVhbiA9IHRhcmdldC5zcGxpdChcIiNcIilbMF0uc3BsaXQoXCJ8XCIpWzBdLnRyaW0oKTtcclxuICBpZiAoIWNsZWFuKSByZXR1cm4gbnVsbDtcclxuICByZXR1cm4gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoY2xlYW4sIHNvdXJjZVBhdGgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmb3JtYXREYXRlKHY6IHVua25vd24pOiBzdHJpbmcge1xyXG4gIGlmICghdikgcmV0dXJuIFwiXCI7XHJcbiAgaWYgKHR5cGVvZiB2ICE9PSBcInN0cmluZ1wiKSByZXR1cm4gXCJcIjtcclxuICByZXR1cm4gdi5sZW5ndGggPiAxMCA/IHYuc2xpY2UoMCwgMTApIDogdjtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWROb3RlTWV0YShcclxuICBhcHA6IEFwcCxcclxuICB0YXJnZXQ6IHN0cmluZyxcclxuICBzb3VyY2VQYXRoOiBzdHJpbmcsXHJcbiAgc2V0dGluZ3M6IHtcclxuICAgIHN1bW1hcnlGaWVsZHM6IHN0cmluZ1tdO1xyXG4gICAgY292ZXJGaWVsZHM6IHN0cmluZ1tdO1xyXG4gICAgbWV0YUZpZWxkczogc3RyaW5nW107XHJcbiAgICBzdW1tYXJ5TGVuZ3RoOiBudW1iZXI7XHJcbiAgfSxcclxuICBhbGlhcz86IHN0cmluZ1xyXG4pOiBQcm9taXNlPE5vdGVNZXRhPiB7XHJcbiAgY29uc3QgaGFzaElkeCA9IHRhcmdldC5pbmRleE9mKFwiI1wiKTtcclxuICBjb25zdCBwYXRoUGFydCA9IChoYXNoSWR4ID49IDAgPyB0YXJnZXQuc2xpY2UoMCwgaGFzaElkeCkgOiB0YXJnZXQpLnNwbGl0KFwifFwiKVswXS50cmltKCk7XHJcbiAgY29uc3QgcmVmID0gaGFzaElkeCA+PSAwID8gdGFyZ2V0LnNsaWNlKGhhc2hJZHggKyAxKS50cmltKCkgOiBcIlwiO1xyXG4gIGNvbnN0IGZpbGUgPSByZXNvbHZlRmlsZShhcHAsIHBhdGhQYXJ0LCBzb3VyY2VQYXRoKTtcclxuICBjb25zdCBmYWxsYmFja1RpdGxlID0gYWxpYXMgfHwgcmVmIHx8IHBhdGhQYXJ0LnNwbGl0KFwiL1wiKS5wb3AoKSB8fCB0YXJnZXQ7XHJcblxyXG4gIGlmICghZmlsZSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgZmlsZTogbnVsbCxcclxuICAgICAgdGFyZ2V0LFxyXG4gICAgICByZWYsXHJcbiAgICAgIHRpdGxlOiBmYWxsYmFja1RpdGxlLFxyXG4gICAgICBzdW1tYXJ5OiBcIlwiLFxyXG4gICAgICBjb3ZlcjogbnVsbCxcclxuICAgICAgdGFnczogW10sXHJcbiAgICAgIGJhZGdlczogW10sXHJcbiAgICAgIHVwZGF0ZWQ6IFwiXCIsXHJcbiAgICAgIHdvcmRDb3VudDogMCxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBjb25zdCBrZXkgPSBgJHtmaWxlLnBhdGh9IyR7cmVmfToke2ZpbGUuc3RhdC5tdGltZX06JHtzZXR0aW5ncy5zdW1tYXJ5TGVuZ3RofWA7XHJcbiAgY29uc3QgaGl0ID0gY2FjaGUuZ2V0KGtleSk7XHJcbiAgaWYgKGhpdCkgcmV0dXJuIGFsaWFzID8geyAuLi5oaXQsIHRpdGxlOiBhbGlhcyB9IDogaGl0O1xyXG5cclxuICBjb25zdCByYXcgPSBhd2FpdCBhcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcclxuICBjb25zdCBmaWxlQ2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSkgPz8gbnVsbDtcclxuICBjb25zdCBmbSA9IGZpbGVDYWNoZT8uZnJvbnRtYXR0ZXI7XHJcblxyXG4gIC8vIFx1NkJCNVx1ODQzRFx1N0VBN1x1NUYxNVx1NzUyOFx1RkYxQVx1NTNFQVx1NTNENlx1OEJFNVx1NkJCNVx1ODQzRFx1RkYwQ1x1ODAwQ1x1NEUwRFx1NjYyRlx1NjU3NFx1N0JDN1xyXG4gIGNvbnN0IGJsb2NrID0gcmVmID8gZXh0cmFjdEJsb2NrKHJhdywgZmlsZUNhY2hlLCByZWYpIDogbnVsbDtcclxuICBjb25zdCBjb250ZW50Qm9keSA9IGJsb2NrPy5jb250ZW50ID8/IHN0cmlwRnJvbnRtYXR0ZXIocmF3KTtcclxuXHJcbiAgY29uc3QgbWFudWFsID0gYmxvY2sgPyBcIlwiIDogcGlja0ZpZWxkKGZtLCBzZXR0aW5ncy5zdW1tYXJ5RmllbGRzKTtcclxuICBjb25zdCBwbGFpbiA9IHRvUGxhaW5UZXh0KGNvbnRlbnRCb2R5KTtcclxuICBjb25zdCBzdW1tYXJ5ID1cclxuICAgIG1hbnVhbCB8fFxyXG4gICAgcGxhaW4uc2xpY2UoMCwgc2V0dGluZ3Muc3VtbWFyeUxlbmd0aCkgKyAocGxhaW4ubGVuZ3RoID4gc2V0dGluZ3Muc3VtbWFyeUxlbmd0aCA/IFwiXHUyMDI2XCIgOiBcIlwiKTtcclxuXHJcbiAgY29uc3QgYmFkZ2VzOiBOb3RlQmFkZ2VbXSA9IFtdO1xyXG4gIGlmICghYmxvY2spIHtcclxuICAgIGZvciAoY29uc3Qga2V5IG9mIHNldHRpbmdzLm1ldGFGaWVsZHMpIHtcclxuICAgICAgY29uc3QgdiA9IGZtPy5ba2V5XTtcclxuICAgICAgaWYgKHYgPT09IHVuZGVmaW5lZCB8fCB2ID09PSBudWxsKSBjb250aW51ZTtcclxuICAgICAgY29uc3QgdGV4dCA9IEFycmF5LmlzQXJyYXkodikgPyB2LmpvaW4oXCIvXCIpIDogU3RyaW5nKHYpO1xyXG4gICAgICBpZiAodGV4dC50cmltKCkpIGJhZGdlcy5wdXNoKHsga2V5LCB2YWx1ZTogdGV4dC50cmltKCkgfSk7XHJcbiAgICB9XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIFx1NkJCNVx1ODQzRFx1NTM2MVx1NzI0N1x1NTNFQVx1NjgwN1x1Njc2NVx1NkU5MFx1NjU4N1x1Njg2M1x1N0M3Qlx1NTc4Qlx1RkYwQ1x1OTA3Rlx1NTE0RFx1NTQ4Q1x1NjU3NFx1N0JDN1x1NkRGN1x1NkRDNlxyXG4gICAgY29uc3QgdCA9IGZtPy50eXBlO1xyXG4gICAgaWYgKHR5cGVvZiB0ID09PSBcInN0cmluZ1wiICYmIHQudHJpbSgpKSBiYWRnZXMucHVzaCh7IGtleTogXCJ0eXBlXCIsIHZhbHVlOiB0LnRyaW0oKSB9KTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHRpdGxlID1cclxuICAgIGFsaWFzIHx8IChibG9jayA/IGJsb2NrLnRpdGxlIDogXCJcIikgfHwgU3RyaW5nKGZtPy50aXRsZSB8fCBmaWxlLmJhc2VuYW1lKTtcclxuXHJcbiAgY29uc3QgbWV0YTogTm90ZU1ldGEgPSB7XHJcbiAgICBmaWxlLFxyXG4gICAgdGFyZ2V0LFxyXG4gICAgcmVmLFxyXG4gICAgdGl0bGUsXHJcbiAgICBzdW1tYXJ5LFxyXG4gICAgY292ZXI6IGV4dHJhY3RDb3ZlcihhcHAsIGZpbGUsIGNvbnRlbnRCb2R5LCBzZXR0aW5ncy5jb3ZlckZpZWxkcyksXHJcbiAgICB0YWdzOiBibG9jayA/IFtdIDogY29sbGVjdFRhZ3MoYXBwLCBmaWxlKSxcclxuICAgIGJhZGdlcyxcclxuICAgIHVwZGF0ZWQ6IGJsb2NrID8gXCJcIiA6IGZvcm1hdERhdGUoZm0/LnVwZGF0ZWQpIHx8IGZvcm1hdERhdGUoZm0/Lm1vZGlmaWVkKSB8fCBmb3JtYXREYXRlKGZtPy5jcmVhdGVkKSxcclxuICAgIHdvcmRDb3VudDogcGxhaW4ubGVuZ3RoLFxyXG4gICAgYmxvY2tDb250ZW50OiBibG9jaz8uY29udGVudCxcclxuICB9O1xyXG5cclxuICBjYWNoZS5zZXQoa2V5LCBtZXRhKTtcclxuICBpZiAoY2FjaGUuc2l6ZSA+IDUwMCkgY2FjaGUuY2xlYXIoKTtcclxuICByZXR1cm4gbWV0YTtcclxufVxyXG5cclxuLyoqIFx1NTE3Q1x1NUJCOVx1NjVCMFx1NjVFN1x1NzI0OFx1NjcyQyBPYnNpZGlhbiBcdTc2ODQgbWFya2Rvd24gXHU2RTMyXHU2N0QzXHU1MTY1XHU1M0UzICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJNYXJrZG93bihcclxuICBhcHA6IEFwcCxcclxuICBtYXJrZG93bjogc3RyaW5nLFxyXG4gIGVsOiBIVE1MRWxlbWVudCxcclxuICBzb3VyY2VQYXRoOiBzdHJpbmcsXHJcbiAgY29tcG9uZW50OiBDb21wb25lbnRcclxuKTogdm9pZCB7XHJcbiAgY29uc3QgbWQgPSBNYXJrZG93blJlbmRlcmVyIGFzIHVua25vd24gYXMge1xyXG4gICAgcmVuZGVyPzogKGE6IEFwcCwgbTogc3RyaW5nLCBlOiBIVE1MRWxlbWVudCwgcDogc3RyaW5nLCBjOiBDb21wb25lbnQpID0+IHZvaWQ7XHJcbiAgICByZW5kZXJNYXJrZG93bj86IChtOiBzdHJpbmcsIGU6IEhUTUxFbGVtZW50LCBwOiBzdHJpbmcsIGM6IENvbXBvbmVudCkgPT4gdm9pZDtcclxuICB9O1xyXG4gIGlmICh0eXBlb2YgbWQucmVuZGVyTWFya2Rvd24gPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgbWQucmVuZGVyTWFya2Rvd24obWFya2Rvd24sIGVsLCBzb3VyY2VQYXRoLCBjb21wb25lbnQpO1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIG1kLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICBtZC5yZW5kZXIoYXBwLCBtYXJrZG93biwgZWwsIHNvdXJjZVBhdGgsIGNvbXBvbmVudCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIGVsLnNldFRleHQobWFya2Rvd24pO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IEF0b21pY0NhcmRzUGx1Z2luIGZyb20gXCIuL21haW5cIjtcclxuaW1wb3J0IHsgTGF5b3V0LCBTaXplIH0gZnJvbSBcIi4vdHlwZXNcIjtcclxuaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgQXRvbWljQ2FyZHNTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XHJcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBBdG9taWNDYXJkc1BsdWdpbikge1xyXG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xyXG4gIH1cclxuXHJcbiAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XHJcbiAgICBjb25zdCBzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3M7XHJcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiXHU4ODRDXHU0RTNBXCIpLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTYzQTVcdTdCQTFcdTUzOUZcdTc1MUZcdTVENENcdTUxNjUgIVtbIF1dXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU2MjhBXHU3MkVDXHU1MzYwXHU0RTAwXHU4ODRDXHU3Njg0ICFbW1x1N0IxNFx1OEJCMF1dIFx1NUQ0Q1x1NTE2NVx1NkUzMlx1NjdEM1x1NjIxMFx1NTNFRlx1NjI5OFx1NTNFMFx1NTM2MVx1NzI0N1x1RkYxQlx1NTE3M1x1OTVFRFx1NTQwRVx1NjNEMlx1NEVGNlx1NUI4Q1x1NTE2OFx1NEUwRFx1NEVDQlx1NTE2NVx1RkYwQ1x1NUQ0Q1x1NTE2NVx1NEZERFx1NjMwMSBPYnNpZGlhbiBcdTlFRDhcdThCQTRcdTY4MzdcdTVGMEZcIilcclxuICAgICAgLmFkZFRvZ2dsZSgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKHMudXBncmFkZUVtYmVkcykub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMudXBncmFkZUVtYmVkcyA9IHY7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiXHU1RTAzXHU1QzQwXCIpLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTUzNjFcdTcyNDdcdTY3MDBcdTU5MjdcdTlBRDhcdTVFQTYgKHB4KVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIjAgPSBcdTRFMERcdTk2NTBcdTUyMzZcdUZGMUJcdThEODVcdThGQzdcdTU0MEVcdTUzNjFcdTcyNDdcdTUxODVcdTkwRThcdTZFREFcdTUyQThcIilcclxuICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShTdHJpbmcocy5jYXJkSGVpZ2h0KSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMuY2FyZEhlaWdodCA9IE51bWJlcih2KSB8fCAwO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTUzNjFcdTcyNDdcdTVFMDNcdTVDNDBcIilcclxuICAgICAgLnNldERlc2MoXCJcdTUzMDVcdTg4RjlcdTUzNjFcdTcyNDcgPSBcdTZBMkFcdTU0MTFcdTYyNDFcdTVFNzNcdTc2ODRcdTVCQjlcdTU2NjhcdUZGMUJcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNEMgPSBcdTRGMjBcdTdFREZcdTUzNjFcdTcyNDdcdTU4OTlcdUZGMDhcdTk4NzZcdTkwRThcdTU5MjdcdTVDMDFcdTk3NjJcdUZGMDlcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkKSA9PlxyXG4gICAgICAgIGRcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJ3cmFwXCIsIFwiXHU1MzA1XHU4OEY5XHU1MzYxXHU3MjQ3XHVGRjA4XHU2QTJBXHU1NDExXHVGRjA5XCIpXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiY2FyZFwiLCBcIlx1N0FENlx1NzI0OFx1NTM2MVx1NzI0Q1x1RkYwOFx1OTg3Nlx1OTBFOFx1NUMwMVx1OTc2Mlx1RkYwOVwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHMubGF5b3V0KVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICAgIHMubGF5b3V0ID0gdiBhcyBMYXlvdXQ7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTVENENcdTU5NTdcdTUzNjFcdTcyNDdcdTc2ODRcdTVDM0FcdTVCRjhcIilcclxuICAgICAgLnNldERlc2MoXCJcdTUzNjFcdTcyNDdcdTkxQ0NcdTUxOERcdTU5NTdcdTc2ODRcdTVENENcdTUxNjVcdTlFRDhcdThCQTRcdTc1MjhcdTRFQzBcdTRFNDhcdTVDM0FcdTVCRjhcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkKSA9PlxyXG4gICAgICAgIGRcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJzbWFsbFwiLCBcIlx1NzdFNVx1OEJDNlx1NzBCOVx1NUMwRlx1NTM2MVx1NzI0N1x1RkYwOFx1NEUwMFx1ODg0Q1x1NTkxQVx1NEUyQVx1RkYwOVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIm5vcm1hbFwiLCBcIlx1NUUzOFx1ODlDNFx1NTM2MVx1NzI0N1wiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHMubmVzdGVkU2l6ZSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICBzLm5lc3RlZFNpemUgPSB2IGFzIFNpemU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTVCQzZcdTVFQTZcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkKSA9PlxyXG4gICAgICAgIGRcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJjb21mb3J0YWJsZVwiLCBcIlx1NUJCRFx1Njc3RVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImNvbXBhY3RcIiwgXCJcdTdEMjdcdTUxRDFcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZShzLmRlbnNpdHkpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgICAgcy5kZW5zaXR5ID0gdiBhcyBcImNvbXBhY3RcIiB8IFwiY29tZm9ydGFibGVcIjtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiXHU1MzYxXHU3MjQ3XHU1MTg1XHU1QkI5XCIpLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTY0NThcdTg5ODFcdTk1N0ZcdTVFQTZcIilcclxuICAgICAgLnNldERlc2MoXCJcdTgxRUFcdTUyQThcdTY0NThcdTg5ODFcdTYyMkFcdTUzRDZcdTc2ODRcdTVCNTdcdTdCMjZcdTY1NzBcdUZGMDhmcm9udG1hdHRlciBcdTY3MDkgc3VtbWFyeS9kZXNjcmlwdGlvbiBcdTY1RjZcdTRGMThcdTUxNDhcdTc1MjhcdUZGMDlcIilcclxuICAgICAgLmFkZFRleHQoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShTdHJpbmcocy5zdW1tYXJ5TGVuZ3RoKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMuc3VtbWFyeUxlbmd0aCA9IE51bWJlcih2KSB8fCAxODA7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIGNvbnN0IHRvZ2dsZSA9IChuYW1lOiBzdHJpbmcsIGRlc2M6IHN0cmluZywgZ2V0OiAoKSA9PiBib29sZWFuLCBzZXQ6ICh2OiBib29sZWFuKSA9PiB2b2lkKSA9PlxyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShuYW1lKS5zZXREZXNjKGRlc2MpLmFkZFRvZ2dsZSgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKGdldCgpKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgc2V0KHYpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTVDMDFcdTk3NjJcIiwgXCJcdThCRkJcdTUzRDYgZnJvbnRtYXR0ZXIgXHU3Njg0IGNvdmVyL2ltYWdlL2Jhbm5lciBcdTYyMTZcdTZCNjNcdTY1ODdcdTdCMkNcdTRFMDBcdTVGMjBcdTU2RkVcIiwgKCkgPT4gcy5zaG93Q292ZXIsICh2KSA9PiAocy5zaG93Q292ZXIgPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTUxNDNcdTRGRTFcdTYwNkZcIiwgXCJ0eXBlIC8gc3RhdHVzIC8gZG9tYWluIC8gXHU2NkY0XHU2NUIwXHU2NUY2XHU5NUY0IC8gXHU1QjU3XHU2NTcwXCIsICgpID0+IHMuc2hvd01ldGEsICh2KSA9PiAocy5zaG93TWV0YSA9IHYpKTtcclxuICAgIHRvZ2dsZShcIlx1NjYzRVx1NzkzQVx1NjgwN1x1N0I3RVwiLCBcIlwiLCAoKSA9PiBzLnNob3dUYWdzLCAodikgPT4gKHMuc2hvd1RhZ3MgPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTMwMENcdTYyNTNcdTVGMDBcdTMwMERcdTYzMDlcdTk0QUVcIiwgXCJcIiwgKCkgPT4gcy5zaG93T3BlbkJ1dHRvbiwgKHYpID0+IChzLnNob3dPcGVuQnV0dG9uID0gdikpO1xyXG4gICAgdG9nZ2xlKFwiXHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXHU2QjYzXHU2NTg3XCIsIFwiXHU2MjUzXHU1RjAwXHU2NTg3XHU2ODYzXHU2NUY2XHU1MzYxXHU3MjQ3XHU3NkY0XHU2M0E1XHU2NjNFXHU3OTNBXHU1QjhDXHU2NTc0XHU1MTg1XHU1QkI5XHVGRjBDXHU3MEI5XHU2ODA3XHU5ODk4XHU1M0VGXHU2Mjk4XHU1M0UwXCIsICgpID0+IHMuZGVmYXVsdEV4cGFuZGVkLCAodikgPT4gKHMuZGVmYXVsdEV4cGFuZGVkID0gdikpO1xyXG4gICAgdG9nZ2xlKFxyXG4gICAgICBcIlx1NUQ0Q1x1NTk1N1x1NTM2MVx1NzI0N1x1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMFwiLFxyXG4gICAgICBcIlx1NTM2MVx1NzI0N1x1OTFDQ1x1NTE4RFx1NTk1N1x1NzY4NFx1NTM2MVx1NzI0N1x1NTg5OVx1NjYyRlx1NTQyNlx1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMFx1RkYxQlx1NTE3M1x1OTVFRFx1NjVGNlx1NTNFQVx1NjYzRVx1NzkzQVx1NjgwN1x1OTg5OFx1NTQ4Q1x1NjQ1OFx1ODk4MVwiLFxyXG4gICAgICAoKSA9PiBzLm5lc3RlZEV4cGFuZGVkLFxyXG4gICAgICAodikgPT4gKHMubmVzdGVkRXhwYW5kZWQgPSB2KVxyXG4gICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTY3MDBcdTU5MjdcdTVENENcdTU5NTdcdTZERjFcdTVFQTZcIilcclxuICAgICAgLnNldERlc2MoXCJcdTUzNjFcdTcyNDdcdTkxQ0NcdTUxOERcdTY1M0UgY2FyZHMgXHU1NzU3XHU2NUY2XHU3Njg0XHU5MDEyXHU1RjUyXHU1QzQyXHU2NTcwXHU0RTBBXHU5NjUwXHVGRjBDXHU5NjMyXHU2QjYyXHU1RkFBXHU3M0FGXHU1RjE1XHU3NTI4XHU1MzYxXHU2QjdCXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKHMubWF4TmVzdERlcHRoKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMubWF4TmVzdERlcHRoID0gTWF0aC5tYXgoMSwgTnVtYmVyKHYpIHx8IDMpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1NUI1N1x1NkJCNVx1NjYyMFx1NUMwNFwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgY29uc3QgbGlzdEZpZWxkID0gKG5hbWU6IHN0cmluZywgZGVzYzogc3RyaW5nLCBnZXQ6ICgpID0+IHN0cmluZ1tdLCBzZXQ6ICh2OiBzdHJpbmdbXSkgPT4gdm9pZCkgPT5cclxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUobmFtZSlcclxuICAgICAgICAuc2V0RGVzYyhkZXNjKVxyXG4gICAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgICAgdFxyXG4gICAgICAgICAgICAuc2V0VmFsdWUoZ2V0KCkuam9pbihcIiwgXCIpKVxyXG4gICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJhLCBiLCBjXCIpXHJcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICAgIHNldChcclxuICAgICAgICAgICAgICAgIHZcclxuICAgICAgICAgICAgICAgICAgLnNwbGl0KFwiLFwiKVxyXG4gICAgICAgICAgICAgICAgICAubWFwKCh4KSA9PiB4LnRyaW0oKSlcclxuICAgICAgICAgICAgICAgICAgLmZpbHRlcihCb29sZWFuKVxyXG4gICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICBsaXN0RmllbGQoXCJcdTY0NThcdTg5ODFcdTVCNTdcdTZCQjVcIiwgXCJcdTYzMDlcdTk4N0FcdTVFOEZcdTVDMURcdThCRDVcdThCRkJcdTUzRDZcdTc2ODQgZnJvbnRtYXR0ZXIgXHU1QjU3XHU2QkI1XCIsICgpID0+IHMuc3VtbWFyeUZpZWxkcywgKHYpID0+IChzLnN1bW1hcnlGaWVsZHMgPSB2KSk7XHJcbiAgICBsaXN0RmllbGQoXCJcdTVDMDFcdTk3NjJcdTVCNTdcdTZCQjVcIiwgXCJcIiwgKCkgPT4gcy5jb3ZlckZpZWxkcywgKHYpID0+IChzLmNvdmVyRmllbGRzID0gdikpO1xyXG4gICAgbGlzdEZpZWxkKFwiXHU1MTQzXHU0RkUxXHU2MDZGXHU1QjU3XHU2QkI1XCIsIFwiXHU0RjFBXHU0RUU1XHU1RkJEXHU3QUUwXHU1RjYyXHU1RjBGXHU2NjNFXHU3OTNBXHU1NzI4XHU1MzYxXHU3MjQ3XHU0RTBBXCIsICgpID0+IHMubWV0YUZpZWxkcywgKHYpID0+IChzLm1ldGFGaWVsZHMgPSB2KSk7XHJcbiAgfVxyXG59XHJcbiIsICJleHBvcnQgdHlwZSBEZW5zaXR5ID0gXCJjb21wYWN0XCIgfCBcImNvbWZvcnRhYmxlXCI7XHJcbi8qKiB3cmFwID0gXHU2MjQxXHU1RTczXHU1MzA1XHU4OEY5XHU1MzYxXHU3MjQ3XHVGRjA4XHU2QTJBXHU1NDExXHVGRjA5XHVGRjFCY2FyZCA9IFx1NEYyMFx1N0VERlx1N0FENlx1NzI0OFx1NTM2MVx1NzI0Q1x1RkYwOFx1OTg3Nlx1OTBFOFx1NUMwMVx1OTc2Mlx1RkYwOSAqL1xyXG5leHBvcnQgdHlwZSBMYXlvdXQgPSBcIndyYXBcIiB8IFwiY2FyZFwiO1xyXG4vKiogbm9ybWFsID0gXHU1RTM4XHU4OUM0XHU2NTg3XHU2ODYzXHU1MzYxXHU3MjQ3XHVGRjFCc21hbGwgPSBcdTc3RTVcdThCQzZcdTcwQjkgLyBcdTZCQjVcdTg0M0RcdTdFQTdcdTVDMEZcdTUzNjFcdTcyNDcgKi9cclxuZXhwb3J0IHR5cGUgU2l6ZSA9IFwibm9ybWFsXCIgfCBcInNtYWxsXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEF0b21pY0NhcmRzU2V0dGluZ3Mge1xyXG4gIC8qKiBcdTYyOEEgT2JzaWRpYW4gXHU1MzlGXHU3NTFGICFbWyBdXSBcdTU3NTdcdTdFQTdcdTVENENcdTUxNjVcdTZFMzJcdTY3RDNcdTYyMTBcdTUzNjFcdTcyNDdcdUZGMDhcdTUxNzNcdTk1RURcdTUyMTlcdTVCOENcdTUxNjhcdTRFMERcdTRFQ0JcdTUxNjVcdUZGMDkgKi9cclxuICB1cGdyYWRlRW1iZWRzOiBib29sZWFuO1xyXG4gIGxheW91dDogTGF5b3V0O1xyXG4gIC8qKiBcdTVENENcdTU5NTdcdTU3MjhcdTU5MjdcdTUzNjFcdTcyNDdcdTkxQ0NcdTc2ODRcdTUzNjFcdTcyNDdcdTlFRDhcdThCQTRcdTVDM0FcdTVCRjggKi9cclxuICBuZXN0ZWRTaXplOiBTaXplO1xyXG4gIGNhcmRIZWlnaHQ6IG51bWJlcjtcclxuICBzdW1tYXJ5TGVuZ3RoOiBudW1iZXI7XHJcbiAgc2hvd0NvdmVyOiBib29sZWFuO1xyXG4gIHNob3dNZXRhOiBib29sZWFuO1xyXG4gIHNob3dUYWdzOiBib29sZWFuO1xyXG4gIHNob3dPcGVuQnV0dG9uOiBib29sZWFuO1xyXG4gIC8qKiBcdTUzNjFcdTcyNDdcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDBcdTZCNjNcdTY1ODcgKi9cclxuICBkZWZhdWx0RXhwYW5kZWQ6IGJvb2xlYW47XHJcbiAgLyoqIFx1NUQ0Q1x1NTcyOFx1NTM2MVx1NzI0N1x1OTFDQ1x1NzY4NFx1NUQ0Q1x1NTE2NVx1NjYyRlx1NTQyNlx1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMCAqL1xyXG4gIG5lc3RlZEV4cGFuZGVkOiBib29sZWFuO1xyXG4gIG1heE5lc3REZXB0aDogbnVtYmVyO1xyXG4gIGRlbnNpdHk6IERlbnNpdHk7XHJcbiAgc3VtbWFyeUZpZWxkczogc3RyaW5nW107XHJcbiAgY292ZXJGaWVsZHM6IHN0cmluZ1tdO1xyXG4gIG1ldGFGaWVsZHM6IHN0cmluZ1tdO1xyXG4gIHZlcmJvc2U6IGJvb2xlYW47XHJcbiAgLyoqIFx1NUUwM1x1NUM0MFx1OUVEOFx1OEJBNFx1NTAzQ1x1NTNEOFx1NTMxNlx1NjVGNlx1NzUyOFx1Njc2NVx1OEZDMVx1NzlGQlx1NjVFN1x1OEJCRVx1N0Y2RSAqL1xyXG4gIHNldHRpbmdzVmVyc2lvbj86IG51bWJlcjtcclxufVxyXG5cclxuLyoqIFx1NUUwM1x1NUM0MFx1NzZGOFx1NTE3M1x1OUVEOFx1OEJBNFx1NTAzQ1x1NTNEOFx1NjZGNFx1NjVGNiArMVx1RkYwQ1x1NjVFN1x1OEJCRVx1N0Y2RVx1NEYxQVx1ODhBQlx1NjVCMFx1OUVEOFx1OEJBNFx1NTAzQ1x1ODk4Nlx1NzZENiAqL1xyXG5leHBvcnQgY29uc3QgU0VUVElOR1NfVkVSU0lPTiA9IDM7XHJcblxyXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogQXRvbWljQ2FyZHNTZXR0aW5ncyA9IHtcclxuICB1cGdyYWRlRW1iZWRzOiB0cnVlLFxyXG4gIGxheW91dDogXCJ3cmFwXCIsXHJcbiAgbmVzdGVkU2l6ZTogXCJub3JtYWxcIixcclxuICBjYXJkSGVpZ2h0OiAwLFxyXG4gIHN1bW1hcnlMZW5ndGg6IDE4MCxcclxuICBzaG93Q292ZXI6IHRydWUsXHJcbiAgc2hvd01ldGE6IHRydWUsXHJcbiAgc2hvd1RhZ3M6IHRydWUsXHJcbiAgc2hvd09wZW5CdXR0b246IHRydWUsXHJcbiAgZGVmYXVsdEV4cGFuZGVkOiB0cnVlLFxyXG4gIG5lc3RlZEV4cGFuZGVkOiB0cnVlLFxyXG4gIG1heE5lc3REZXB0aDogMyxcclxuICBkZW5zaXR5OiBcImNvbWZvcnRhYmxlXCIsXHJcbiAgc3VtbWFyeUZpZWxkczogW1wic3VtbWFyeVwiLCBcImRlc2NyaXB0aW9uXCIsIFwiYWJzdHJhY3RcIiwgXCJleGNlcnB0XCIsIFwiXHU3QjgwXHU0RUNCXCIsIFwiXHU2NDU4XHU4OTgxXCJdLFxyXG4gIGNvdmVyRmllbGRzOiBbXCJjb3ZlclwiLCBcImltYWdlXCIsIFwiYmFubmVyXCIsIFwidGh1bWJuYWlsXCIsIFwiaW1nXCIsIFwiXHU1QzAxXHU5NzYyXCJdLFxyXG4gIG1ldGFGaWVsZHM6IFtcInR5cGVcIiwgXCJzdGF0dXNcIiwgXCJkb21haW5cIiwgXCJjb21wbGV4aXR5XCJdLFxyXG4gIHZlcmJvc2U6IGZhbHNlLFxyXG59O1xyXG5cclxuLyoqIFx1NkUzMlx1NjdEM1x1NTM1NVx1NUYyMFx1NTM2MVx1NzI0N1x1NjI0MFx1OTcwMFx1OTAwOVx1OTg3OVx1RkYwQ1x1NTE2OFx1OTBFOFx1Njc2NVx1ODFFQVx1NjNEMlx1NEVGNlx1OEJCRVx1N0Y2RVx1RkYwOFx1NkNBMVx1NjcwOVx1NTc1N1x1NTE4NVx1OTAwOVx1OTg3OVx1NEU4Nlx1RkYwOSAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlck9wdGlvbnMge1xyXG4gIHNpemU6IFNpemU7XHJcbiAgZGVuc2l0eTogRGVuc2l0eTtcclxuICBsYXlvdXQ6IExheW91dDtcclxuICBjb3ZlcjogYm9vbGVhbjtcclxuICBtZXRhOiBib29sZWFuO1xyXG4gIHRhZ3M6IGJvb2xlYW47XHJcbiAgb3BlbjogYm9vbGVhbjtcclxuICBleHBhbmRlZDogYm9vbGVhbjtcclxuICAvKiogXHU1MzYxXHU3MjQ3XHU2NzAwXHU1OTI3XHU5QUQ4XHU1RUE2XHVGRjBDMCA9IFx1NEUwRFx1OTY1MFx1NTIzNiAqL1xyXG4gIGhlaWdodDogbnVtYmVyO1xyXG4gIC8qKiBcdTgxRUFcdTUyQThcdTY0NThcdTg5ODFcdTVCNTdcdTdCMjZcdTY1NzAgKi9cclxuICBzdW1tYXJ5OiBudW1iZXI7XHJcbn1cclxuXHJcbi8qKiBcdTk3NUVcdTdCMTRcdThCQjBcdTc2ODRcdTVENENcdTUxNjVcdUZGMDhcdTU2RkVcdTcyNDcgLyBcdTk3RjNcdTg5QzZcdTk4OTEgLyBQREYgLyBcdTc1M0JcdTVFMDNcdTdCNDlcdUZGMDlcdTRFMERcdTUwNUFcdTUzNjFcdTcyNDdcdTUzMTYgKi9cclxuZXhwb3J0IGNvbnN0IFNLSVBfRU1CRURfRVhUID1cclxuICAvXFwuKHBuZ3xqcGU/Z3xnaWZ8d2VicHxzdmd8Ym1wfGljb3xhdmlmfG1wM3x3YXZ8b2dnfGZsYWN8bTRhfG1wNHx3ZWJtfG1vdnxwZGZ8Y2FudmFzfGV4Y2FsaWRyYXcpJC9pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQU9POzs7QUNQUCxJQUFBQyxtQkFBZ0Q7OztBQ0FoRCxzQkFBMEY7QUF3QjFGLElBQU0sUUFBUSxvQkFBSSxJQUFzQjtBQUV4QyxTQUFTLGlCQUFpQixLQUFxQjtBQUM3QyxRQUFNLElBQUksSUFBSSxNQUFNLGlDQUFpQztBQUNyRCxTQUFPLElBQUksSUFBSSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sSUFBSTtBQUN0QztBQUdPLFNBQVMsWUFBWSxNQUFzQjtBQUNoRCxTQUFPLGlCQUFpQixJQUFJLEVBQ3pCLFFBQVEsbUJBQW1CLEVBQUUsRUFDN0IsUUFBUSwrQkFBK0IsRUFBRSxFQUN6QyxR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QUksQ0FBQyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLENBQUM7QUFDbEUsUUFBSSx3QkFBTyxzQkFBTyxNQUFNLE1BQU0scUJBQU07QUFBQSxFQUN0QztBQUFBO0FBQUEsRUFHUSxvQkFBb0IsUUFBc0I7QUFDaEQsVUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGNBQWM7QUFDOUMsUUFBSSxDQUFDLE1BQU07QUFDVCxVQUFJLHdCQUFPLHdEQUFXO0FBQ3RCO0FBQUEsSUFDRjtBQUNBLFVBQU0sUUFBUSxLQUFLLElBQUksY0FBYztBQUNyQyxVQUFNLE9BQU8sT0FBTyxLQUFLLEtBQUssRUFBRSxPQUFPLENBQUMsUUFBSztBQTNNakQ7QUEyTW9ELHlCQUFNLEdBQUcsTUFBVCxtQkFBYSxLQUFLO0FBQUEsS0FBSztBQUN2RSxRQUFJLENBQUMsS0FBSyxRQUFRO0FBQ2hCLFVBQUksd0JBQU8sa0RBQVU7QUFDckI7QUFBQSxJQUNGO0FBQ0EsVUFBTSxPQUFPO0FBQUE7QUFBQSxFQUFZLEtBQ3RCLElBQUksQ0FBQyxNQUFNLFFBQVEsRUFBRSxRQUFRLFVBQVUsRUFBRSxDQUFDLElBQUksRUFDOUMsS0FBSyxJQUFJLENBQUM7QUFBQTtBQUNiLFdBQU8sYUFBYSxNQUFNLE9BQU8sVUFBVSxDQUFDO0FBQzVDLFFBQUksd0JBQU8sc0JBQU8sS0FBSyxNQUFNLHFCQUFNO0FBQUEsRUFDckM7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJoIiwgImtleSIsICJfYSIsICJpbXBvcnRfb2JzaWRpYW4iXQp9Cg==
