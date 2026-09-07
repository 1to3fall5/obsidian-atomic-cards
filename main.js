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
var AC_CARD_MIME = "application/x-atomic-cards";
var dragSourceParent = null;
function setDragSourceParent(el) {
  dragSourceParent = el;
}
function isCardReorderDrag() {
  return dragSourceParent !== null;
}
var nestMarker = 0;
var expandMemory = /* @__PURE__ */ new Map();
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
  var _a, _b, _c, _d, _e, _f, _g;
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
  const memoryKey = (_d = (_c = meta.file) == null ? void 0 : _c.path) != null ? _d : meta.target;
  let expanded = false;
  const setExpanded = (next) => {
    expanded = next;
    card.classList.toggle("is-expanded", expanded);
    toggleText.textContent = expanded ? "\u6536\u8D77" : "\u5C55\u5F00";
    (0, import_obsidian2.setIcon)(toggleIcon, expanded ? "chevron-up" : "chevron-down");
    body.style.display = expanded ? "" : "none";
    if (expanded) loadBody();
    expandMemory.set(memoryKey, expanded);
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
  const selfName = (_f = (_e = meta.file) == null ? void 0 : _e.basename) != null ? _f : meta.target;
  head.draggable = true;
  head.addEventListener("dragstart", (e) => {
    var _a2, _b2;
    if (!meta.file) return;
    const link = meta.ref ? `![[${selfName}#${meta.ref}]]` : `![[${selfName}]]`;
    (_a2 = e.dataTransfer) == null ? void 0 : _a2.setData(AC_CARD_MIME, selfName);
    (_b2 = e.dataTransfer) == null ? void 0 : _b2.setData("text/plain", link);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
    setDragSourceParent(card.parentElement);
    card.classList.add("is-dragging");
  });
  head.addEventListener("dragend", () => {
    card.classList.remove("is-dragging");
    setDragSourceParent(null);
    clearDropMarks();
  });
  const clearDropMarks = () => {
    for (const el of Array.from(document.querySelectorAll(".ac-drop-before, .ac-drop-after"))) {
      el.classList.remove("ac-drop-before", "ac-drop-after");
    }
  };
  card.addEventListener("dragover", (e) => {
    var _a2, _b2;
    const dt = e.dataTransfer;
    if (!dt || !Array.from(dt.types).includes(AC_CARD_MIME)) return;
    if (card.classList.contains("is-dragging")) return;
    const nearest = (_b2 = (_a2 = e.target).closest) == null ? void 0 : _b2.call(_a2, ".ac-card");
    if (nearest !== card) return;
    if (card.parentElement !== dragSourceParent) return;
    e.preventDefault();
    if (dt.dropEffect) dt.dropEffect = "move";
    const box = card.getBoundingClientRect();
    const before = e.clientY < box.top + box.height / 2;
    card.classList.toggle("ac-drop-before", before);
    card.classList.toggle("ac-drop-after", !before);
  });
  card.addEventListener("dragleave", () => {
    card.classList.remove("ac-drop-before", "ac-drop-after");
  });
  card.addEventListener("drop", (e) => {
    var _a2, _b2, _c2, _d2;
    const dt = e.dataTransfer;
    const source = (_a2 = dt == null ? void 0 : dt.getData(AC_CARD_MIME)) != null ? _a2 : "";
    card.classList.remove("ac-drop-before", "ac-drop-after");
    if (env.settings.verbose) {
      console.log("[atomic-cards] card drop:", {
        source,
        target: selfName,
        types: dt ? Array.from(dt.types) : null
      });
    }
    if (!source || source === selfName) return;
    const nearest = (_c2 = (_b2 = e.target).closest) == null ? void 0 : _c2.call(_b2, ".ac-card");
    if (nearest !== card) return;
    if (card.parentElement !== dragSourceParent) return;
    e.preventDefault();
    e.stopPropagation();
    const box = card.getBoundingClientRect();
    (_d2 = env.onReorder) == null ? void 0 : _d2.call(env, {
      source,
      target: selfName,
      before: e.clientY < box.top + box.height / 2
    });
  });
  if ((_g = expandMemory.get(memoryKey)) != null ? _g : opts.expanded) setExpanded(true);
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
      depth: depth + 1,
      onReorder: (req) => void this.reorderEmbeds(ctx.sourcePath, req)
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
    if (isCardReorderDrag()) return;
    const editor = (_c = this.editorFromDrop(evt)) != null ? _c : this.activeEditor();
    if (!editor) {
      if (this.settings.verbose) console.log("[atomic-cards] \u627E\u4E0D\u5230\u76EE\u6807\u7F16\u8F91\u5668");
      return;
    }
    for (const delay of [80, 250, 600]) {
      window.setTimeout(() => this.linkToEmbedAtCursor(editor), delay);
    }
  }
  /* ---------- 重排：把源码里的 ![[source]] 行搬到 ![[target]] 的前/后 ----------
     直接改文件（vault.process），阅读模式和编辑模式都能用。
     只做整行搬运，不匹配就原样返回，不会损坏文件。 */
  async reorderEmbeds(sourcePath, req) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof import_obsidian4.TFile)) return;
    const verbose = this.settings.verbose;
    if (verbose) console.log("[atomic-cards] reorder:", req, "\u2192", sourcePath);
    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const from = lines.findIndex((l) => this.lineEmbeds(l, req.source));
      if (from < 0) {
        if (verbose) console.log("[atomic-cards] \u627E\u4E0D\u5230\u6E90\u5D4C\u5165\u884C\uFF1A", req.source);
        return data;
      }
      const [moved] = lines.splice(from, 1);
      const to = lines.findIndex((l) => this.lineEmbeds(l, req.target));
      if (to < 0) {
        if (verbose) console.log("[atomic-cards] \u627E\u4E0D\u5230\u76EE\u6807\u5D4C\u5165\u884C\uFF1A", req.target);
        return data;
      }
      lines.splice(req.before ? to : to + 1, 0, moved);
      if (verbose) console.log("[atomic-cards] \u79FB\u52A8\u884C", from, "\u2192", to);
      return lines.join("\n");
    });
    new import_obsidian4.Notice(`\u5DF2\u628A\u300C${req.source}\u300D\u79FB\u5230\u300C${req.target}\u300D${req.before ? "\u4E4B\u524D" : "\u4E4B\u540E"}`);
  }
  /**
   * 这一行是否是 name 的嵌入。
   * ⚠️ 笔记名是短名（灯光-烘焙），但源码里可能写成完整路径
   * （![[wiki-ai/…/灯光-烘焙]]），也可能带别名或小节引用，都要认。
   */
  lineEmbeds(line, name) {
    const t = line.trim();
    if (!t.startsWith("![[")) return false;
    const end = t.indexOf("]]");
    if (end < 0) return false;
    const inner = t.slice(3, end);
    const target = inner.split("|")[0].split("#")[0].trim().replace(/\.md$/i, "");
    return target === name || target.endsWith(`/${name}`);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy9tYWluLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvY2FyZC50cyIsICIuLi8uLi8uLi8ucGx1Z2lucy9hdG9taWMtY2FyZHMvc3JjL21ldGFkYXRhLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvc2V0dGluZ3MudHMiLCAiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy90eXBlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcclxuICBFZGl0b3IsXHJcbiAgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcclxuICBNYXJrZG93blJlbmRlckNoaWxkLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBOb3RpY2UsXHJcbiAgUGx1Z2luLFxyXG4gIFRGaWxlLFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyByZW5kZXJDYXJkLCBnZXROZXN0LCB3aXRoTmVzdCwgUmVvcmRlclJlcXVlc3QsIGlzQ2FyZFJlb3JkZXJEcmFnIH0gZnJvbSBcIi4vY2FyZFwiO1xyXG5pbXBvcnQgeyByZWFkTm90ZU1ldGEgfSBmcm9tIFwiLi9tZXRhZGF0YVwiO1xyXG5pbXBvcnQgeyBBdG9taWNDYXJkc1NldHRpbmdUYWIgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xyXG5pbXBvcnQge1xyXG4gIEF0b21pY0NhcmRzU2V0dGluZ3MsXHJcbiAgREVGQVVMVF9TRVRUSU5HUyxcclxuICBSZW5kZXJPcHRpb25zLFxyXG4gIFNFVFRJTkdTX1ZFUlNJT04sXHJcbiAgU2l6ZSxcclxuICBTS0lQX0VNQkVEX0VYVCxcclxufSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQXRvbWljQ2FyZHNQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gIHNldHRpbmdzOiBBdG9taWNDYXJkc1NldHRpbmdzID0geyAuLi5ERUZBVUxUX1NFVFRJTkdTIH07XHJcblxyXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XHJcbiAgICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgQXRvbWljQ2FyZHNTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XHJcblxyXG4gICAgICAvLyBcdTYzQTVcdTdCQTEgT2JzaWRpYW4gXHU1MzlGXHU3NTFGICFbWyBdXSBcdTVENENcdTUxNjVcdUZGMUFcdThCRURcdTZDRDVcdTRGRERcdTYzMDFcdTUzOUZcdTc1MUZcdUZGMENcdTUzRUFcdTYyOEFcdTZFMzJcdTY3RDNcdTY2RkZcdTYzNjJcdTYyMTBcdTUzNjFcdTcyNDdcdTMwMDJcclxuICAgICAgLy8gc29ydE9yZGVyIFx1NTNENlx1NTkyN1x1NTAzQyBcdTIxOTIgXHU2MzkyXHU1NzI4XHU2MjQwXHU2NzA5XHU1MTg1XHU3RjZFXHU1OTA0XHU3NDA2XHU1NjY4XHVGRjA4XHU1NDJCXHU1RDRDXHU1MTY1XHU2RTMyXHU2N0QzXHVGRjA5XHU0RTRCXHU1NDBFXHU4RkQwXHU4ODRDXHVGRjBDXHJcbiAgICAgIC8vIFx1NTQyNlx1NTIxOSBwb3N0IHByb2Nlc3NvciBcdTRGMUFcdThERDFcdTU3MjhcdTVENENcdTUxNjVcdTc1MUZcdTYyMTBcdTRFNEJcdTUyNERcdUZGMENcdTRFQzBcdTRFNDhcdTRFNUZcdTUzMzlcdTkxNERcdTRFMERcdTUyMzBcdTMwMDJcclxuICAgICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duUG9zdFByb2Nlc3NvcihcclxuICAgICAgICAoZWwsIGN0eCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy51cGdyYWRlRW1iZWRzKGVsLCBjdHgpO1xyXG4gICAgICAgICAgLy8gXHU1RDRDXHU1MTY1XHU3NTMxIE9ic2lkaWFuIFx1NUYwMlx1NkI2NVx1NTg2Qlx1NTE0NVx1RkYwQ1x1ODg2NVx1NEUyNFx1NkIyMVx1NjI2Qlx1NjNDRlx1NTE1Q1x1NUU5NVx1MzAwMlxyXG4gICAgICAgICAgLy8gXHU1REYyXHU2M0E1XHU3QkExXHU3Njg0XHU1MTQzXHU3RDIwXHU1RTI2IGRhdGEtYWMtdXBncmFkZWRcdUZGMENcdTkxQ0RcdTU5MERcdTYyNkJcdTYzQ0ZcdTRFMERcdTRGMUFcdTkxQ0RcdTU5MERcdTZFMzJcdTY3RDNcdTMwMDJcclxuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMudXBncmFkZUVtYmVkcyhlbCwgY3R4KSwgNjApO1xyXG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gdGhpcy51cGdyYWRlRW1iZWRzKGVsLCBjdHgpLCA0MDApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgMTAwMFxyXG4gICAgICApO1xyXG5cclxuICAgICAgdGhpcy5yZWdpc3RlckNvbW1hbmRzKCk7XHJcblxyXG4gICAgICAvLyBcdTI2QTBcdUZFMEYgXHU0RTBEXHU4OTgxXHU2Q0U4XHU1MThDIENvZGVNaXJyb3IgXHU2MjY5XHU1QzU1XHVGRjA4c3JjL2VkaXRvci50c1x1RkYwOVx1RkYxQUBjb2RlbWlycm9yLyogXHU1RkM1XHU5ODdCXHU2NjJGIGV4dGVybmFsXHVGRjBDXHJcbiAgICAgIC8vIFx1NEUwMFx1NjVFNlx1NjI1M1x1NTMwNVx1NUMzMVx1NEYxQVx1NTFGQVx1NzNCMFx1NEUyNFx1NEVGRCBAY29kZW1pcnJvci9zdGF0ZVx1RkYwQ1x1NUJGQ1x1ODFGNFxyXG4gICAgICAvLyBcIlVucmVjb2duaXplZCBleHRlbnNpb24gdmFsdWUgLi4uIG11bHRpcGxlIGluc3RhbmNlc1wiIFx1ODAwQ1x1NjU3NFx1NEUyQVx1NjNEMlx1NEVGNlx1NTJBMFx1OEY3RFx1NTkzMVx1OEQyNVx1MzAwMlxyXG4gICAgICAvLyBMaXZlIFByZXZpZXcgXHU3Njg0XHU1MzYxXHU3MjQ3XHU1OTE2XHU4OUMyXHU2NTM5XHU3NTMxIHNuaXBwZXQgXHU3Njg0IENTUyBcdTY1QjlcdTY4NDhcdTVCOUVcdTczQjBcdUZGMDhcdTg5QzFcdTdCMkNcdTRFOTRcdTgyODJcdUZGMDlcdTMwMDJcclxuXHJcbiAgICAgIC8vIFx1NjNBNVx1N0JBMVx1NjJENlx1NjUzRVx1RkYxQVx1NEVDRVx1NjU4N1x1NEVGNlx1NTIxN1x1ODg2OFx1NjJENlx1N0IxNFx1OEJCMFx1OEZEQlx1Njc2NSBcdTIxOTIgXHU2M0QyXHU1MTY1ICFbWyBdXSBcdTgwMENcdTRFMERcdTY2MkZcdTlFRDhcdThCQTRcdTc2ODQgW1sgXV1cdTMwMDJcclxuICAgICAgLy8gXHUyNkEwXHVGRTBGIFx1NEUwRFx1ODBGRFx1NzUyOCB3b3Jrc3BhY2UgXHU3Njg0IFwiZWRpdG9yLWRyb3BcIiBcdTRFOEJcdTRFRjZcdUZGMUFcdTVCOUVcdTZENEJcdTYyRDYgT2JzaWRpYW4gXHU1MTg1XHU5MEU4XHU2NTg3XHU0RUY2XHU2NUY2XHU1QjgzXHU0RTBEXHU4OUU2XHU1M0QxXHUzMDAyXHJcbiAgICAgIC8vIFx1NjUzOVx1NzZEMVx1NTQyQyBET00gXHU3Njg0XHU1MzlGXHU3NTFGIGRyb3BcdUZGMDhjYXB0dXJlIFx1OTYzNlx1NkJCNVx1RkYwOVx1RkYwQ1x1NEUwMFx1NUI5QVx1ODBGRFx1NjJGRlx1NTIzMFx1MzAwMlxyXG4gICAgICB0aGlzLnJlZ2lzdGVyRG9tRXZlbnQoZG9jdW1lbnQsIFwiZHJvcFwiLCAoZXZ0OiBEcmFnRXZlbnQpID0+IHRoaXMub25Eb21Ecm9wKGV2dCksIHRydWUpO1xyXG5cclxuICAgICAgaWYgKHRoaXMuc2V0dGluZ3MudmVyYm9zZSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiW2F0b21pYy1jYXJkc10gXHU1REYyXHU1MkEwXHU4RjdEXHVGRjBDdXBncmFkZUVtYmVkcyA9XCIsIHRoaXMuc2V0dGluZ3MudXBncmFkZUVtYmVkcyk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKFwiW2F0b21pYy1jYXJkc10gb25sb2FkIFx1NTkzMVx1OEQyNVx1RkYxQVwiLCBlcnIpO1xyXG4gICAgICBuZXcgTm90aWNlKGBBdG9taWMgQ2FyZHMgXHU1MkEwXHU4RjdEXHU1OTMxXHU4RDI1XHVGRjFBJHtTdHJpbmcoZXJyKX1gKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG9udW5sb2FkKCk6IHZvaWQge1xyXG4gICAgLyogQ29tcG9uZW50IFx1NzUxRlx1NTQ3RFx1NTQ2OFx1NjcxRlx1NzUzMSBjdHguYWRkQ2hpbGQgXHU2MjU4XHU3QkExICovXHJcbiAgfVxyXG5cclxuICBhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBzYXZlZCA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcclxuICAgIGlmIChzYXZlZCAmJiB0eXBlb2Ygc2F2ZWQgPT09IFwib2JqZWN0XCIpIHtcclxuICAgICAgLy8gXHU1RTAzXHU1QzQwXHU5RUQ4XHU4QkE0XHU1MDNDXHU1M0Q4XHU0RTg2XHVGRjBDXHU2NUU3XHU1QjU4XHU2ODYzXHU4OTgxXHU4RkMxXHU3OUZCXHVGRjBDXHU1NDI2XHU1MjE5XHU3NTI4XHU2MjM3XHU3QUVGXHU3NzBCXHU1MjMwXHU3Njg0XHU4RkQ4XHU2NjJGXHU2NUU3XHU1RTAzXHU1QzQwXHJcbiAgICAgIGlmIChzYXZlZC5zZXR0aW5nc1ZlcnNpb24gIT09IFNFVFRJTkdTX1ZFUlNJT04pIHtcclxuICAgICAgICBPYmplY3QuYXNzaWduKHNhdmVkLCB7XHJcbiAgICAgICAgICBsYXlvdXQ6IERFRkFVTFRfU0VUVElOR1MubGF5b3V0LFxyXG4gICAgICAgICAgbmVzdGVkU2l6ZTogREVGQVVMVF9TRVRUSU5HUy5uZXN0ZWRTaXplLFxyXG4gICAgICAgICAgZGVmYXVsdEV4cGFuZGVkOiBERUZBVUxUX1NFVFRJTkdTLmRlZmF1bHRFeHBhbmRlZCxcclxuICAgICAgICAgIG5lc3RlZEV4cGFuZGVkOiBERUZBVUxUX1NFVFRJTkdTLm5lc3RlZEV4cGFuZGVkLFxyXG4gICAgICAgICAgc2V0dGluZ3NWZXJzaW9uOiBTRVRUSU5HU19WRVJTSU9OLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEoc2F2ZWQpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9LCBzYXZlZCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnNldHRpbmdzID0geyAuLi5ERUZBVUxUX1NFVFRJTkdTIH07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gIH1cclxuXHJcbiAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgKiBcdTZFMzJcdTY3RDNcdUZGMUFcdTYzQTVcdTdCQTFcdTUzOUZcdTc1MUZcdTVENENcdTUxNjVcclxuICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbiAgcHJpdmF0ZSB1cGdyYWRlRW1iZWRzKGVsOiBIVE1MRWxlbWVudCwgY3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLmRvVXBncmFkZUVtYmVkcyhlbCwgY3R4KTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKFwiW2F0b21pYy1jYXJkc10gdXBncmFkZUVtYmVkcyBcdTUxRkFcdTk1MTlcdUZGMUFcIiwgZXJyKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZG9VcGdyYWRlRW1iZWRzKGVsOiBIVE1MRWxlbWVudCwgY3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuc2V0dGluZ3MudXBncmFkZUVtYmVkcykgcmV0dXJuO1xyXG4gICAgLy8gXHU4RkJFXHU1MjMwXHU1RDRDXHU1OTU3XHU0RTBBXHU5NjUwXHU2NUY2XHU0RTBEXHU1MThEXHU2M0E1XHU3QkExXHVGRjBDXHU5MDdGXHU1MTREXHU1RkFBXHU3M0FGXHU1RjE1XHU3NTI4XHU2NUUwXHU5NjUwXHU1OTU3XHU1QTAzXHJcbiAgICBpZiAoZ2V0TmVzdCgpID49IHRoaXMuc2V0dGluZ3MubWF4TmVzdERlcHRoKSByZXR1cm47XHJcblxyXG4gICAgLy8gOm5vdCgubWVkaWEtZW1iZWQpIFx1NzZGNFx1NjNBNVx1NTcyOFx1OTAwOVx1NjJFOVx1NTY2OFx1NUM0Mlx1NjM5Mlx1NjM4OVx1NTZGRVx1NzI0Ny9cdTk3RjNcdTg5QzZcdTk4OTFcdTVENENcdTUxNjVcdUZGMENcclxuICAgIC8vIFx1NEUwRFx1NzUyOFx1NjI4QVx1NUI4M1x1NEVFQ1x1NjM1RVx1OEZEQlx1NUZBQVx1NzNBRlx1NTE4RFx1OEZDN1x1NkVFNFx1RkYwOFx1Njc2MVx1NzZFRVx1NkI2M1x1NjU4N1x1OTFDQ1x1NUUzOFx1NjcwOVx1NTFFMFx1NTM0MVx1NUYyMFx1NTZGRVx1RkYwOVx1MzAwMlxyXG4gICAgY29uc3Qgbm9kZXMgPSBBcnJheS5mcm9tKFxyXG4gICAgICBlbC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcclxuICAgICAgICBcIi5pbnRlcm5hbC1lbWJlZDpub3QoLm1lZGlhLWVtYmVkKSwgLm1hcmtkb3duLWVtYmVkOm5vdCgubWVkaWEtZW1iZWQpXCJcclxuICAgICAgKVxyXG4gICAgKS5maWx0ZXIoKG4pID0+ICFuLmRhdGFzZXQuYWNVcGdyYWRlZCk7XHJcblxyXG4gICAgbGV0IHRha2VuID0gMDtcclxuICAgIGZvciAoY29uc3QgZW1iZWQgb2Ygbm9kZXMpIHtcclxuICAgICAgLy8gXHUyNkEwXHVGRTBGIFx1NTNFQVx1NTIyNFx1NjVBRFwiXHU1RDRDXHU1MTY1XHU2NzJDXHU4RUFCXCJcdTY2MkZcdTRFMERcdTY2MkZcdTVBOTJcdTRGNTNcdTUxNDNcdTdEMjBcdUZGMENcdTRFMERcdTgwRkRcdTY3RTVcdTYyNDBcdTY3MDlcdTU0MEVcdTRFRTNcdUZGMUFcclxuICAgICAgLy8gXHU3QjE0XHU4QkIwXHU2QjYzXHU2NTg3XHU5MUNDXHU2NjZFXHU5MDREXHU2NzA5XHU1NkZFXHU3MjQ3XHVGRjBDXHU3NTI4IHF1ZXJ5U2VsZWN0b3IgXHU0RjFBXHU2MjhBXHU2NTc0XHU3QkM3XHU1RDRDXHU1MTY1XHU4QkVGXHU1MjI0XHU2MjEwXHU1NkZFXHU3MjQ3XHU1RDRDXHU1MTY1XHUzMDAyXHJcbiAgICAgIGNvbnN0IGZpcnN0ID0gZW1iZWQuZmlyc3RFbGVtZW50Q2hpbGQ7XHJcbiAgICAgIGlmIChmaXJzdCAmJiAvXihJTUd8QVVESU98VklERU98Q0FOVkFTfElGUkFNRSkkLy50ZXN0KGZpcnN0LnRhZ05hbWUpKSBjb250aW51ZTtcclxuXHJcbiAgICAgIC8vIHNyYyBcdTRGMThcdTUxNDhcdUZGMENcdTZDQTFcdTY3MDlcdTUyMTlcdTc1MjggYWx0IFx1NTE1Q1x1NUU5NVxyXG4gICAgICBjb25zdCBzcmMgPSAoZW1iZWQuZ2V0QXR0cmlidXRlKFwic3JjXCIpID8/IGVtYmVkLmdldEF0dHJpYnV0ZShcImFsdFwiKSA/PyBcIlwiKS50cmltKCk7XHJcbiAgICAgIGlmICghc3JjKSBjb250aW51ZTtcclxuICAgICAgLy8gXHU1NkZFXHU3MjQ3IC8gXHU5N0YzXHU4OUM2XHU5ODkxIC8gUERGIC8gXHU3NTNCXHU1RTAzXHU3QjQ5XHU2MzA5XHU2MjY5XHU1QzU1XHU1NDBEXHU2MzkyXHU5NjY0XHJcbiAgICAgIGlmIChTS0lQX0VNQkVEX0VYVC50ZXN0KHNyYy5zcGxpdChcIiNcIilbMF0pKSBjb250aW51ZTtcclxuXHJcbiAgICAgIGVtYmVkLmRhdGFzZXQuYWNVcGdyYWRlZCA9IFwiMVwiO1xyXG4gICAgICB0YWtlbisrO1xyXG4gICAgICB2b2lkIHRoaXMucmVwbGFjZVdpdGhDYXJkKGVtYmVkLCBzcmMsIGN0eCkuY2F0Y2goKGVycikgPT5cclxuICAgICAgICBjb25zb2xlLmVycm9yKFwiW2F0b21pYy1jYXJkc10gXHU2RTMyXHU2N0QzXHU1MzYxXHU3MjQ3XHU1OTMxXHU4RDI1XHVGRjFBXCIsIHNyYywgZXJyKVxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgLy8gXHU1RTM4XHU4OUM0XHU4RkQwXHU4ODRDXHU0RTBEXHU2MjUzXHU1MzcwXHVGRjBDXHU2MzkyXHU2N0U1XHU2NUY2XHU1NzI4XHU4QkJFXHU3RjZFXHU5MUNDXHU2MjUzXHU1RjAwXHUzMDBDXHU4QkU2XHU3RUM2XHU2NUU1XHU1RkQ3XHUzMDBEXHJcbiAgICBpZiAodGFrZW4gJiYgdGhpcy5zZXR0aW5ncy52ZXJib3NlKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiW2F0b21pYy1jYXJkc10gXHU1REYyXHU2M0E1XHU3QkExXCIsIHRha2VuLCBcIlx1NTkwNFx1NUQ0Q1x1NTE2NVwiKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgcmVwbGFjZVdpdGhDYXJkKFxyXG4gICAgZW1iZWQ6IEhUTUxFbGVtZW50LFxyXG4gICAgc3JjOiBzdHJpbmcsXHJcbiAgICBjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHRcclxuICApOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGRlcHRoID0gZ2V0TmVzdCgpO1xyXG4gICAgY29uc3Qgc2l6ZTogU2l6ZSA9IGRlcHRoID4gMCA/IHRoaXMuc2V0dGluZ3MubmVzdGVkU2l6ZSA6IFwibm9ybWFsXCI7XHJcbiAgICBjb25zdCBpc1NtYWxsID0gc2l6ZSA9PT0gXCJzbWFsbFwiO1xyXG5cclxuICAgIGNvbnN0IG9wdHM6IFJlbmRlck9wdGlvbnMgPSB7XHJcbiAgICAgIHNpemUsXHJcbiAgICAgIGRlbnNpdHk6IGlzU21hbGwgPyBcImNvbXBhY3RcIiA6IHRoaXMuc2V0dGluZ3MuZGVuc2l0eSxcclxuICAgICAgbGF5b3V0OiB0aGlzLnNldHRpbmdzLmxheW91dCxcclxuICAgICAgY292ZXI6IHRoaXMuc2V0dGluZ3Muc2hvd0NvdmVyLFxyXG4gICAgICBtZXRhOiBpc1NtYWxsID8gZmFsc2UgOiB0aGlzLnNldHRpbmdzLnNob3dNZXRhLFxyXG4gICAgICB0YWdzOiBpc1NtYWxsID8gZmFsc2UgOiB0aGlzLnNldHRpbmdzLnNob3dUYWdzLFxyXG4gICAgICAvLyBcdTY4MDdcdTk4OThcdTY2MkZcdTYyOThcdTUzRTBcdTVGMDBcdTUxNzNcdUZGMENcIlx1NjI1M1x1NUYwMFwiXHU2MzA5XHU5NEFFXHU2NjJGXHU1NTJGXHU0RTAwXHU3Njg0XHU4REYzXHU4RjZDXHU1MTY1XHU1M0UzXHJcbiAgICAgIG9wZW46IGlzU21hbGwgPyB0cnVlIDogdGhpcy5zZXR0aW5ncy5zaG93T3BlbkJ1dHRvbixcclxuICAgICAgZXhwYW5kZWQ6IGRlcHRoID4gMCA/IHRoaXMuc2V0dGluZ3MubmVzdGVkRXhwYW5kZWQgOiB0aGlzLnNldHRpbmdzLmRlZmF1bHRFeHBhbmRlZCxcclxuICAgICAgaGVpZ2h0OiB0aGlzLnNldHRpbmdzLmNhcmRIZWlnaHQsXHJcbiAgICAgIHN1bW1hcnk6IGlzU21hbGwgPyA5MCA6IHRoaXMuc2V0dGluZ3Muc3VtbWFyeUxlbmd0aCxcclxuICAgIH07XHJcblxyXG4gICAgLy8gXHU2MzAyXHU1NzI4XHU2RTM4XHU3OUJCXHU4MjgyXHU3MEI5XHU0RTBBXHVGRjFBXHU1M0VBXHU1MDFGXHU3NTI4XHU3NTFGXHU1NDdEXHU1NDY4XHU2NzFGXHVGRjBDb251bmxvYWQgXHU2NUY2XHU2RTA1XHU3QTdBXHU1QjgzXHU0RTBEXHU1RjcxXHU1NENEXHU2NTg3XHU2ODYzXHJcbiAgICBjb25zdCBob2xkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IE1hcmtkb3duUmVuZGVyQ2hpbGQoaG9sZGVyKTtcclxuICAgIGNvbXBvbmVudC5sb2FkKCk7XHJcbiAgICBjdHguYWRkQ2hpbGQoY29tcG9uZW50KTtcclxuXHJcbiAgICBjb25zdCBlbnYgPSB7XHJcbiAgICAgIGFwcDogdGhpcy5hcHAsXHJcbiAgICAgIHNldHRpbmdzOiB0aGlzLnNldHRpbmdzLFxyXG4gICAgICBzb3VyY2VQYXRoOiBjdHguc291cmNlUGF0aCxcclxuICAgICAgY29tcG9uZW50LFxyXG4gICAgICAvLyArMVx1RkYxQVx1NTM2MVx1NzI0N1x1NkI2M1x1NjU4N1x1OTFDQ1x1NTE4RFx1NkUzMlx1NjdEM1x1NzY4NFx1NTE4NVx1NUJCOVx1NUM1RVx1NEU4RVx1NEUwQlx1NEUwMFx1NUM0Mlx1RkYwQ1x1OTAxMlx1NTg5RVx1NTQwRVx1NUQ0Q1x1NTk1N1x1NkRGMVx1NUVBNlx1NEUwQVx1OTY1MFx1NjI0RFx1NjcwOVx1NjU0OFxyXG4gICAgICBkZXB0aDogZGVwdGggKyAxLFxyXG4gICAgICBvblJlb3JkZXI6IChyZXE6IFJlb3JkZXJSZXF1ZXN0KSA9PiB2b2lkIHRoaXMucmVvcmRlckVtYmVkcyhjdHguc291cmNlUGF0aCwgcmVxKSxcclxuICAgIH07XHJcblxyXG4gICAgLy8gXHUyNkEwXHVGRTBGIFx1NTE0OFx1NTQwQ1x1NkI2NVx1NTM2MFx1NEY0Rlx1NEY0RFx1N0Y2RVx1RkYwQ1x1NTE4RFx1NUYwMlx1NkI2NVx1NzUxRlx1NjIxMFx1NzcxRlx1NkI2M1x1NzY4NFx1NTM2MVx1NzI0N1x1MzAwMlxyXG4gICAgLy8gXHU0RTRCXHU1MjREXHU2NjJGIGF3YWl0IFx1NEU0Qlx1NTQwRVx1NTE4RCByZXBsYWNlV2l0aFx1RkYwQ1x1NEY0NiByZWFkTm90ZU1ldGEgXHU2NjJGXHU1RjAyXHU2QjY1XHU3Njg0XHVGRjBDXHJcbiAgICAvLyBcdTdCNDlcdTVCODNcdThGRDRcdTU2REVcdTY1RjYgT2JzaWRpYW4gXHU1M0VGXHU4MEZEXHU1REYyXHU3RUNGXHU5MUNEXHU1RUZBXHU4RkM3XHU4MjgyXHU3MEI5IFx1MjE5MiBlbWJlZC5pc0Nvbm5lY3RlZCBcdTRFM0EgZmFsc2UgXHUyMTkyIFx1NTM2MVx1NzI0N1x1NEUyMlx1NTkzMVx1MzAwMlxyXG4gICAgLy8gXHU1MTQ4XHU2NTNFXHU1MzYwXHU0RjREXHU1MTQzXHU3RDIwXHU1QzMxXHU0RTBEXHU1QjU4XHU1NzI4XHU4RkQ5XHU0RTJBXHU3QURFXHU2MDAxXHVGRjFBXHU1MzYwXHU0RjREXHU1MTQzXHU3RDIwXHU5NjhGXHU3MjM2XHU4MjgyXHU3MEI5XHU0RTAwXHU4RDc3XHU3NTU5XHU1NzI4XHU2NTg3XHU2ODYzXHU5MUNDXHUzMDAyXHJcbiAgICBjb25zdCBwbGFjZWhvbGRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBwbGFjZWhvbGRlci5jbGFzc05hbWUgPSBcImFjLWNhcmQgYWMtY2FyZC0tcGVuZGluZ1wiO1xyXG4gICAgcGxhY2Vob2xkZXIuZGF0YXNldC5hY1BhdGggPSBzcmM7XHJcbiAgICBwbGFjZWhvbGRlci5zZXRUZXh0KHNyYy5zcGxpdChcIi9cIikucG9wKCk/LnJlcGxhY2UoL1xcLm1kJC9pLCBcIlwiKSA/PyBzcmMpO1xyXG4gICAgZW1iZWQucmVwbGFjZVdpdGgocGxhY2Vob2xkZXIpO1xyXG5cclxuICAgIC8vIHNyYyBcdTVGNjJcdTU5ODIgXCJcdTdCMTRcdThCQjBcIlx1MzAwMVwiXHU3QjE0XHU4QkIwLm1kXCJcdTMwMDFcIlx1N0IxNFx1OEJCMCNcdTY4MDdcdTk4OThcIlx1MzAwMVwiXHU3QjE0XHU4QkIwI15cdTU3NTdpZFwiXHJcbiAgICBjb25zdCB0YXJnZXQgPSBzcmMucmVwbGFjZSgvXFwubWQoPz0jfCQpL2ksIFwiXCIpO1xyXG4gICAgY29uc3QgbWV0YSA9IGF3YWl0IHJlYWROb3RlTWV0YSh0aGlzLmFwcCwgdGFyZ2V0LCBjdHguc291cmNlUGF0aCwgdGhpcy5zZXR0aW5ncyk7XHJcblxyXG4gICAgY29uc3QgY2FyZCA9IHdpdGhOZXN0KGRlcHRoLCAoKSA9PiByZW5kZXJDYXJkKGVudiwgbWV0YSwgb3B0cykpO1xyXG4gICAgcGxhY2Vob2xkZXIucmVwbGFjZVdpdGgoY2FyZCk7XHJcbiAgfVxyXG5cclxuICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAqIFx1NjJENlx1NjUzRVx1RkYxQVx1OEJBOVwiXHU2MkQ2XHU3QjE0XHU4QkIwXHU4RkRCXHU2NzY1XCJcdTlFRDhcdThCQTRcdTVGOTdcdTUyMzBcdTVENENcdTUxNjUgIVtbIF1dXHJcbiAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG4gIHByaXZhdGUgb25Eb21Ecm9wKGV2dDogRHJhZ0V2ZW50KTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuc2V0dGluZ3MuZW1iZWRPbkRyb3ApIHJldHVybjtcclxuXHJcbiAgICAvLyBcdTY1RTVcdTVGRDdcdTVGQzVcdTk4N0JcdTYyNTNcdTU3MjhcdTY3MDBcdTUyNERcdTk3NjJcdUZGMUFcdTU0MjZcdTUyMTlcdTY1RTBcdTZDRDVcdTUzM0FcdTUyMDZcIlx1NEU4Qlx1NEVGNlx1NkNBMVx1ODlFNlx1NTNEMVwiXHU1NDhDXCJcdTg4QUJcdTRFMEJcdTk3NjJcdTc2ODRcdTUyMjRcdTY1QURcdTYzMjFcdTYzODlcdTRFODZcIlxyXG4gICAgY29uc3QgdCA9IGV2dC50YXJnZXQ7XHJcbiAgICBpZiAodGhpcy5zZXR0aW5ncy52ZXJib3NlKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiW2F0b21pYy1jYXJkc10gZG9tIGRyb3A6XCIsIHtcclxuICAgICAgICB0YXJnZXQ6IHQgaW5zdGFuY2VvZiBFbGVtZW50ID8gYCR7dC50YWdOYW1lfS4ke3QuY2xhc3NOYW1lfWAgOiBTdHJpbmcodCksXHJcbiAgICAgICAgaW5FZGl0b3I6ICEhKHQgaW5zdGFuY2VvZiBFbGVtZW50ICYmIHQuY2xvc2VzdChcIi5tYXJrZG93bi1zb3VyY2UtdmlldywgLmNtLWVkaXRvciwgLmNtLWNvbnRlbnRcIikpLFxyXG4gICAgICAgIHR5cGVzOiBldnQuZGF0YVRyYW5zZmVyID8gQXJyYXkuZnJvbShldnQuZGF0YVRyYW5zZmVyLnR5cGVzKSA6IG51bGwsXHJcbiAgICAgICAgdGV4dDogZXZ0LmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQvcGxhaW5cIikgPz8gXCJcIixcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHUyNkEwXHVGRTBGIFx1NEUwRFx1ODBGRFx1NzUyOCBhY3RpdmVFZGl0b3IoKVx1RkYxQVx1NjJENlx1NjJGRFx1NjVGNlx1NkQzQlx1NTJBOFx1ODlDNlx1NTZGRVx1NUY4MFx1NUY4MFx1OEZEOFx1NTA1Q1x1NTcyOFx1NjU4N1x1NEVGNlx1OEQ0NFx1NkU5MFx1N0JBMVx1NzQwNlx1NTY2OFx1RkYwOFx1NjJENlx1NjJGRFx1NkU5MFx1RkYwOVx1RkYwQ1xyXG4gICAgLy8gICAgXHU1M0Q2XHU0RTBEXHU1MjMwXHU3NkVFXHU2ODA3XHU3RjE2XHU4RjkxXHU1NjY4XHUzMDAyXHU4OTgxXHU0RUNFIGRyb3AgXHU3Njg0XHU3NkVFXHU2ODA3XHU1MTQzXHU3RDIwXHU1M0NEXHU2N0U1XHU1QjgzXHU1QzVFXHU0RThFXHU1NEVBXHU0RTJBXHU3RjE2XHU4RjkxXHU1NjY4XHUzMDAyXHJcbiAgICAvLyBcdTUzNjFcdTcyNDdcdTZCNjNcdTU3MjhcdTg4QUJcdTYyRDZcdTUzQkJcdTkxQ0RcdTYzOTIgXHUyMTkyIFx1NEUwRFx1ODk4MVx1ODlFNlx1NTNEMVx1OTRGRVx1NjNBNVx1NjUzOVx1NTE5OVx1RkYwQ1x1NTQyNlx1NTIxOVx1NEYxQVx1NjI4QVx1NTIxQVx1NjMyQVx1NTk3RFx1NzY4NFx1NUQ0Q1x1NTE2NVx1NTNDOFx1NjUzOVx1NEU3MVxyXG4gICAgaWYgKGlzQ2FyZFJlb3JkZXJEcmFnKCkpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBlZGl0b3IgPSB0aGlzLmVkaXRvckZyb21Ecm9wKGV2dCkgPz8gdGhpcy5hY3RpdmVFZGl0b3IoKTtcclxuICAgIGlmICghZWRpdG9yKSB7XHJcbiAgICAgIGlmICh0aGlzLnNldHRpbmdzLnZlcmJvc2UpIGNvbnNvbGUubG9nKFwiW2F0b21pYy1jYXJkc10gXHU2MjdFXHU0RTBEXHU1MjMwXHU3NkVFXHU2ODA3XHU3RjE2XHU4RjkxXHU1NjY4XCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHU0RTBEXHU5NjNCXHU2QjYyXHU5RUQ4XHU4QkE0XHU4ODRDXHU0RTNBXHVGRjFBXHU4QkE5IE9ic2lkaWFuIFx1NkI2M1x1NUUzOFx1NjNEMlx1NTE2NVx1OTRGRVx1NjNBNVx1RkYwQ1x1N0EwRFx1NTQwRVx1NjUzOVx1NTE5OVx1NjIxMCAhW1tcdTdCMTRcdThCQjBdXVx1MzAwMlxyXG4gICAgLy8gT2JzaWRpYW4gXHU2M0QyXHU1MTY1XHU1M0VGXHU4MEZEXHU2NjJGXHU1RjAyXHU2QjY1XHU3Njg0XHVGRjBDXHU1MjA2XHU1MUUwXHU2QjIxXHU4QkQ1XHU2M0EyXHVGRjA4XHU2NTM5XHU1MTk5XHU4RkM3XHU1QzMxXHU0RTBEXHU0RjFBXHU1MThEXHU1MzM5XHU5MTREXHVGRjBDXHU1Qjg5XHU1MTY4XHVGRjA5XHUzMDAyXHJcbiAgICBmb3IgKGNvbnN0IGRlbGF5IG9mIFs4MCwgMjUwLCA2MDBdKSB7XHJcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMubGlua1RvRW1iZWRBdEN1cnNvcihlZGl0b3IpLCBkZWxheSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1OTFDRFx1NjM5Mlx1RkYxQVx1NjI4QVx1NkU5MFx1NzgwMVx1OTFDQ1x1NzY4NCAhW1tzb3VyY2VdXSBcdTg4NENcdTY0MkNcdTUyMzAgIVtbdGFyZ2V0XV0gXHU3Njg0XHU1MjREL1x1NTQwRSAtLS0tLS0tLS0tXHJcbiAgICAgXHU3NkY0XHU2M0E1XHU2NTM5XHU2NTg3XHU0RUY2XHVGRjA4dmF1bHQucHJvY2Vzc1x1RkYwOVx1RkYwQ1x1OTYwNVx1OEJGQlx1NkEyMVx1NUYwRlx1NTQ4Q1x1N0YxNlx1OEY5MVx1NkEyMVx1NUYwRlx1OTBGRFx1ODBGRFx1NzUyOFx1MzAwMlxyXG4gICAgIFx1NTNFQVx1NTA1QVx1NjU3NFx1ODg0Q1x1NjQyQ1x1OEZEMFx1RkYwQ1x1NEUwRFx1NTMzOVx1OTE0RFx1NUMzMVx1NTM5Rlx1NjgzN1x1OEZENFx1NTZERVx1RkYwQ1x1NEUwRFx1NEYxQVx1NjM1Rlx1NTc0Rlx1NjU4N1x1NEVGNlx1MzAwMiAqL1xyXG4gIHByaXZhdGUgYXN5bmMgcmVvcmRlckVtYmVkcyhzb3VyY2VQYXRoOiBzdHJpbmcsIHJlcTogUmVvcmRlclJlcXVlc3QpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoc291cmNlUGF0aCk7XHJcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgdmVyYm9zZSA9IHRoaXMuc2V0dGluZ3MudmVyYm9zZTtcclxuICAgIGlmICh2ZXJib3NlKSBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIHJlb3JkZXI6XCIsIHJlcSwgXCJcdTIxOTJcIiwgc291cmNlUGF0aCk7XHJcblxyXG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoZGF0YSkgPT4ge1xyXG4gICAgICBjb25zdCBsaW5lcyA9IGRhdGEuc3BsaXQoXCJcXG5cIik7XHJcbiAgICAgIGNvbnN0IGZyb20gPSBsaW5lcy5maW5kSW5kZXgoKGwpID0+IHRoaXMubGluZUVtYmVkcyhsLCByZXEuc291cmNlKSk7XHJcbiAgICAgIGlmIChmcm9tIDwgMCkge1xyXG4gICAgICAgIGlmICh2ZXJib3NlKSBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIFx1NjI3RVx1NEUwRFx1NTIzMFx1NkU5MFx1NUQ0Q1x1NTE2NVx1ODg0Q1x1RkYxQVwiLCByZXEuc291cmNlKTtcclxuICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBbbW92ZWRdID0gbGluZXMuc3BsaWNlKGZyb20sIDEpO1xyXG4gICAgICBjb25zdCB0byA9IGxpbmVzLmZpbmRJbmRleCgobCkgPT4gdGhpcy5saW5lRW1iZWRzKGwsIHJlcS50YXJnZXQpKTtcclxuICAgICAgaWYgKHRvIDwgMCkge1xyXG4gICAgICAgIGlmICh2ZXJib3NlKSBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIFx1NjI3RVx1NEUwRFx1NTIzMFx1NzZFRVx1NjgwN1x1NUQ0Q1x1NTE2NVx1ODg0Q1x1RkYxQVwiLCByZXEudGFyZ2V0KTtcclxuICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgfVxyXG4gICAgICBsaW5lcy5zcGxpY2UocmVxLmJlZm9yZSA/IHRvIDogdG8gKyAxLCAwLCBtb3ZlZCk7XHJcbiAgICAgIGlmICh2ZXJib3NlKSBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIFx1NzlGQlx1NTJBOFx1ODg0Q1wiLCBmcm9tLCBcIlx1MjE5MlwiLCB0byk7XHJcbiAgICAgIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IE5vdGljZShgXHU1REYyXHU2MjhBXHUzMDBDJHtyZXEuc291cmNlfVx1MzAwRFx1NzlGQlx1NTIzMFx1MzAwQyR7cmVxLnRhcmdldH1cdTMwMEQke3JlcS5iZWZvcmUgPyBcIlx1NEU0Qlx1NTI0RFwiIDogXCJcdTRFNEJcdTU0MEVcIn1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFx1OEZEOVx1NEUwMFx1ODg0Q1x1NjYyRlx1NTQyNlx1NjYyRiBuYW1lIFx1NzY4NFx1NUQ0Q1x1NTE2NVx1MzAwMlxyXG4gICAqIFx1MjZBMFx1RkUwRiBcdTdCMTRcdThCQjBcdTU0MERcdTY2MkZcdTc3RURcdTU0MERcdUZGMDhcdTcwNkZcdTUxNDktXHU3MEQ4XHU3MTE5XHVGRjA5XHVGRjBDXHU0RjQ2XHU2RTkwXHU3ODAxXHU5MUNDXHU1M0VGXHU4MEZEXHU1MTk5XHU2MjEwXHU1QjhDXHU2NTc0XHU4REVGXHU1Rjg0XHJcbiAgICogXHVGRjA4IVtbd2lraS1haS9cdTIwMjYvXHU3MDZGXHU1MTQ5LVx1NzBEOFx1NzExOV1dXHVGRjA5XHVGRjBDXHU0RTVGXHU1M0VGXHU4MEZEXHU1RTI2XHU1MjJCXHU1NDBEXHU2MjE2XHU1QzBGXHU4MjgyXHU1RjE1XHU3NTI4XHVGRjBDXHU5MEZEXHU4OTgxXHU4QkE0XHUzMDAyXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBsaW5lRW1iZWRzKGxpbmU6IHN0cmluZywgbmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCB0ID0gbGluZS50cmltKCk7XHJcbiAgICBpZiAoIXQuc3RhcnRzV2l0aChcIiFbW1wiKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgY29uc3QgZW5kID0gdC5pbmRleE9mKFwiXV1cIik7XHJcbiAgICBpZiAoZW5kIDwgMCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgY29uc3QgaW5uZXIgPSB0LnNsaWNlKDMsIGVuZCk7XHJcbiAgICBjb25zdCB0YXJnZXQgPSBpbm5lci5zcGxpdChcInxcIilbMF0uc3BsaXQoXCIjXCIpWzBdLnRyaW0oKS5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIik7XHJcbiAgICByZXR1cm4gdGFyZ2V0ID09PSBuYW1lIHx8IHRhcmdldC5lbmRzV2l0aChgLyR7bmFtZX1gKTtcclxuICB9XHJcblxyXG4gIC8qKiBcdTRFQ0VcdTYyRDZcdTY1M0VcdTc2RUVcdTY4MDdcdTUxNDNcdTdEMjBcdTUzQ0RcdTY3RTVcdTYyNDBcdTVDNUVcdTdGMTZcdThGOTFcdTU2NjhcdTc2ODQgRWRpdG9yIFx1NUI5RVx1NEY4QiAqL1xyXG4gIHByaXZhdGUgZWRpdG9yRnJvbURyb3AoZXZ0OiBEcmFnRXZlbnQpOiBFZGl0b3IgfCBudWxsIHtcclxuICAgIGNvbnN0IHRhcmdldCA9IGV2dC50YXJnZXQ7XHJcbiAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50KSkgcmV0dXJuIG51bGw7XHJcbiAgICAvLyBcdTc1MjhcdTY1NzBcdTdFQzRcdTY1MzZcdTk2QzZcdUZGMUFcdTk1RURcdTUzMDVcdTkxQ0NcdTdFRDkgbGV0IFx1NTNEOFx1OTFDRlx1OEQ0Qlx1NTAzQ1x1NEYxQVx1ODhBQiBUUyBcdTY1MzZcdTdBODRcdTYyMTAgbmV2ZXJcclxuICAgIGNvbnN0IGhpdHM6IE1hcmtkb3duVmlld1tdID0gW107XHJcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuaXRlcmF0ZUFsbExlYXZlcygobGVhZikgPT4ge1xyXG4gICAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3O1xyXG4gICAgICBpZiAodmlldyBpbnN0YW5jZW9mIE1hcmtkb3duVmlldyAmJiB2aWV3LmNvbnRhaW5lckVsLmNvbnRhaW5zKHRhcmdldCkpIGhpdHMucHVzaCh2aWV3KTtcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIGhpdHNbMF0/LmVkaXRvciA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogXHU2MjhBXHU1MTQ5XHU2ODA3XHU1MjREXHU1MjFBXHU2M0QyXHU1MTY1XHU3Njg0XHU5NEZFXHU2M0E1XHU1QzMxXHU1NzMwXHU2NTM5XHU1MTk5XHU2MjEwICFbW1x1N0IxNFx1OEJCMF1dXHUzMDAyXHJcbiAgICogXHU2MkQ2IE9ic2lkaWFuIFx1NTE4NVx1OTBFOFx1NjU4N1x1NEVGNlx1NjVGNlx1RkYwQ1x1NTM5Rlx1NzUxRlx1NTNFRlx1ODBGRFx1NjNEMlx1NTE2NVx1NEUwOVx1NzlDRFx1NUY2Mlx1NjAwMVx1RkYwQ1x1OTBGRFx1ODk4MVx1OEJBNFx1RkYxQVxyXG4gICAqICAgXHUyNDYwIFtbXHU3QjE0XHU4QkIwXV0gICAgICAgICAgICAgICBcdUZGMDh3aWtpbGluayBcdThCQkVcdTdGNkVcdUZGMDlcclxuICAgKiAgIFx1MjQ2MSBbXHU2ODA3XHU5ODk4XShvYnNpZGlhbjovL1x1MjAyNikgICBcdUZGMDhcdTVCOUVcdTZENEJcdTlFRDhcdThCQTRcdThENzBcdThGRDlcdTc5Q0RcdUZGMENkYXRhVHJhbnNmZXIgXHU5MUNDXHU2NjJGIG9ic2lkaWFuOi8vIFVSTFx1RkYwOVxyXG4gICAqICAgXHUyNDYyIG9ic2lkaWFuOi8vXHUyMDI2IFx1ODhGOFx1OTRGRVx1NjNBNVxyXG4gICAqIFx1OTBGRFx1NEUwRFx1NjYyRlx1NUMzMVx1NTM5Rlx1NjgzN1x1NjUzRVx1OEZDN1x1RkYwQ1x1OTA3Rlx1NTE0RFx1OEJFRlx1NEYyNFx1NjJENlx1NTZGRVx1NzI0NyAvIFx1NTkxNlx1OTBFOFx1NjU4N1x1NjcyQ1x1MzAwMlxyXG4gICAqL1xyXG4gIHByaXZhdGUgbGlua1RvRW1iZWRBdEN1cnNvcihlZGl0b3I6IEVkaXRvcik6IHZvaWQge1xyXG4gICAgY29uc3QgY3VyID0gZWRpdG9yLmdldEN1cnNvcigpO1xyXG4gICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGN1ci5saW5lKSA/PyBcIlwiO1xyXG4gICAgY29uc3QgaGVhZCA9IGxpbmUuc2xpY2UoMCwgY3VyLmNoKTtcclxuXHJcbiAgICBpZiAodGhpcy5zZXR0aW5ncy52ZXJib3NlKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiW2F0b21pYy1jYXJkc10gXHU1MTQ5XHU2ODA3XHU1MjREXHU2NTg3XHU2NzJDXHVGRjFBXCIsIEpTT04uc3RyaW5naWZ5KGhlYWQuc2xpY2UoLTEyMCkpKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZXBsYWNlID0gKG1hdGNoZWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IGZyb20gPSB7IGxpbmU6IGN1ci5saW5lLCBjaDogY3VyLmNoIC0gbWF0Y2hlZC5sZW5ndGggfTtcclxuICAgICAgZWRpdG9yLnJlcGxhY2VSYW5nZShgIVtbJHtuYW1lfV1dYCwgZnJvbSwgY3VyKTtcclxuICAgICAgaWYgKHRoaXMuc2V0dGluZ3MudmVyYm9zZSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiW2F0b21pYy1jYXJkc10gXHU5NEZFXHU2M0E1XHU2NTM5XHU1MTk5XHU0RTNBXHU1RDRDXHU1MTY1XHVGRjFBXCIsIG1hdGNoZWQsIFwiXHUyMTkyXCIsIGAhW1ske25hbWV9XV1gKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBcdTI0NjAgd2lraWxpbmtcdUZGMDhcdTRFMTRcdTUyNERcdTk3NjJcdTRFMERcdTY2MkYgIVx1RkYwQ1x1OTA3Rlx1NTE0RFx1OTFDRFx1NTkwRFx1NjUzOVx1NTE5OVx1RkYwOVxyXG4gICAgY29uc3Qgd2lraSA9IGhlYWQubWF0Y2goLyg/Ol58W14hXSkoXFxbXFxbW15cXF1dK1xcXVxcXSkkLyk7XHJcbiAgICBpZiAod2lraSkge1xyXG4gICAgICBjb25zdCBpbm5lciA9IHdpa2lbMV0uc2xpY2UoMiwgLTIpLnNwbGl0KFwifFwiKVswXS50cmltKCk7XHJcbiAgICAgIGlmIChpbm5lcikge1xyXG4gICAgICAgIHJlcGxhY2Uod2lraVsxXSwgaW5uZXIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFx1MjQ2MSBtYXJrZG93biBcdTk0RkVcdTYzQTVcdUZGMENocmVmIFx1NjYyRiBvYnNpZGlhbjovLyBVUkxcclxuICAgIGNvbnN0IG1kID0gaGVhZC5tYXRjaCgvXFxbW15cXF1dKlxcXVxcKChbXildKylcXCkkLyk7XHJcbiAgICBpZiAobWQpIHtcclxuICAgICAgY29uc3QgbmFtZSA9IHRoaXMubm90ZU5hbWVGcm9tT2JzaWRpYW5VcmwobWRbMV0pO1xyXG4gICAgICBpZiAobmFtZSkge1xyXG4gICAgICAgIHJlcGxhY2UobWRbMF0sIG5hbWUpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHUyNDYyIFx1ODhGOCBvYnNpZGlhbjovLyBcdTk0RkVcdTYzQTVcclxuICAgIGNvbnN0IGJhcmUgPSBoZWFkLm1hdGNoKC8ob2JzaWRpYW46XFwvXFwvXFxTKykkLyk7XHJcbiAgICBpZiAoYmFyZSkge1xyXG4gICAgICBjb25zdCBuYW1lID0gdGhpcy5ub3RlTmFtZUZyb21PYnNpZGlhblVybChiYXJlWzFdKTtcclxuICAgICAgaWYgKG5hbWUpIHJlcGxhY2UoYmFyZVsxXSwgbmFtZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKiogXHU0RUNFIG9ic2lkaWFuOi8vb3Blbj92YXVsdD1YJmZpbGU9PHBhdGg+IFx1OTFDQ1x1NTNENlx1NTFGQVx1N0IxNFx1OEJCMFx1NTQwRFx1RkYwOFx1NTNCQlx1NjM4OVx1NjU4N1x1NEVGNlx1NTkzOVx1NEUwRSAubWRcdUZGMDkgKi9cclxuICBwcml2YXRlIG5vdGVOYW1lRnJvbU9ic2lkaWFuVXJsKHVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCB1ID0gbmV3IFVSTCh1cmwpO1xyXG4gICAgICBjb25zdCBmaWxlID0gdS5zZWFyY2hQYXJhbXMuZ2V0KFwiZmlsZVwiKTtcclxuICAgICAgaWYgKCFmaWxlKSByZXR1cm4gbnVsbDtcclxuICAgICAgY29uc3QgZGVjb2RlZCA9IGRlY29kZVVSSUNvbXBvbmVudChmaWxlKTtcclxuICAgICAgY29uc3QgYmFzZSA9IGRlY29kZWQuc3BsaXQoXCIvXCIpLnBvcCgpPy5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIikudHJpbSgpID8/IFwiXCI7XHJcbiAgICAgIHJldHVybiBiYXNlIHx8IG51bGw7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAqIFx1NTQ3RFx1NEVFNFxyXG4gICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuICBwcml2YXRlIGFjdGl2ZUVkaXRvcigpOiBFZGl0b3IgfCBudWxsIHtcclxuICAgIGNvbnN0IHZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgcmV0dXJuIHZpZXc/LmVkaXRvciA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWdpc3RlckNvbW1hbmRzKCk6IHZvaWQge1xyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwibGlua3MtdG8tZW1iZWRzXCIsXHJcbiAgICAgIG5hbWU6IFwiXHU2MjhBXHU5MDA5XHU1MzNBXHU5MUNDXHU3Njg0IFtbXHU5NEZFXHU2M0E1XV0gXHU4RjZDXHU2MjEwXHU1RDRDXHU1MTY1XHU1MjE3XHU4ODY4XCIsXHJcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHRoaXMubGlua3NUb0VtYmVkcyhlZGl0b3IpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiaW5zZXJ0LXJldmVyc2UtZW1iZWRzXCIsXHJcbiAgICAgIG5hbWU6IFwiXHU2M0QyXHU1MTY1XHU1M0NEXHU2N0U1XHU1MjE3XHU4ODY4XHVGRjA4XHU1RjE1XHU3NTI4XHU2NzJDXHU2NTg3XHU3Njg0XHU3QjE0XHU4QkIwXHVGRjBDXHU3NTFGXHU2MjEwXHU0RTNBXHU1RDRDXHU1MTY1XHVGRjA5XCIsXHJcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHRoaXMuaW5zZXJ0UmV2ZXJzZUVtYmVkcyhlZGl0b3IpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwidG9nZ2xlLWFsbC1jYXJkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NUM1NVx1NUYwMCAvIFx1NjUzNlx1OEQ3N1x1NjcyQ1x1OTg3NVx1NjI0MFx1NjcwOVx1NTM2MVx1NzI0N1wiLFxyXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGNhcmRzID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5hYy1jYXJkXCIpKTtcclxuICAgICAgICBpZiAoIWNhcmRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgbmV3IE5vdGljZShcIlx1NUY1M1x1NTI0RFx1ODlDNlx1NTZGRVx1OTFDQ1x1NkNBMVx1NjcwOVx1NTM2MVx1NzI0N1wiKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgY29sbGFwc2VkID0gY2FyZHMuZmlsdGVyKChjKSA9PiAhYy5jbGFzc0xpc3QuY29udGFpbnMoXCJpcy1leHBhbmRlZFwiKSk7XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0cyA9IGNvbGxhcHNlZC5sZW5ndGggPyBjb2xsYXBzZWQgOiBjYXJkcztcclxuICAgICAgICBmb3IgKGNvbnN0IGMgb2YgdGFyZ2V0cykgYy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcIi5hYy1idG4tLXRvZ2dsZVwiKT8uY2xpY2soKTtcclxuICAgICAgICBuZXcgTm90aWNlKGNvbGxhcHNlZC5sZW5ndGggPyBgXHU1REYyXHU1QzU1XHU1RjAwICR7dGFyZ2V0cy5sZW5ndGh9IFx1NUYyMFx1NTM2MVx1NzI0N2AgOiBgXHU1REYyXHU2NTM2XHU4RDc3ICR7dGFyZ2V0cy5sZW5ndGh9IFx1NUYyMFx1NTM2MVx1NzI0N2ApO1xyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKiogXHU5MDA5XHU1MzNBXHU5MUNDXHU3Njg0IFtbXHU5NEZFXHU2M0E1XV0gXHUyMTkyIFx1NTM5Rlx1NzUxRlx1NUQ0Q1x1NTE2NVx1NTIxN1x1ODg2OCBgLSAhW1tcdTk0RkVcdTYzQTVdXWAgKi9cclxuICBwcml2YXRlIGxpbmtzVG9FbWJlZHMoZWRpdG9yOiBFZGl0b3IpOiB2b2lkIHtcclxuICAgIGNvbnN0IHNlbCA9IGVkaXRvci5nZXRTZWxlY3Rpb24oKTtcclxuICAgIGlmICghc2VsLnRyaW0oKSkge1xyXG4gICAgICBuZXcgTm90aWNlKFwiXHU4QkY3XHU1MTQ4XHU5MDA5XHU0RTJEXHU1MzA1XHU1NDJCIFtbXHU5NEZFXHU2M0E1XV0gXHU3Njg0XHU2NTg3XHU2NzJDXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCByZSA9IC9cXFtcXFsoW15cXF18I10rKSg/OiNbXlxcXXxdKik/KD86XFx8W15cXF1dKik/XFxdXFxdL2c7XHJcbiAgICBjb25zdCBmb3VuZDogc3RyaW5nW10gPSBbXTtcclxuICAgIGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xyXG4gICAgd2hpbGUgKChtID0gcmUuZXhlYyhzZWwpKSAhPT0gbnVsbCkge1xyXG4gICAgICBjb25zdCB0ID0gbVsxXS50cmltKCk7XHJcbiAgICAgIGlmICh0ICYmICFmb3VuZC5pbmNsdWRlcyh0KSkgZm91bmQucHVzaCh0KTtcclxuICAgIH1cclxuICAgIGlmICghZm91bmQubGVuZ3RoKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJcdTkwMDlcdTUzM0FcdTkxQ0NcdTZDQTFcdTY3MDkgW1tcdTk0RkVcdTYzQTVdXVwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgZWRpdG9yLnJlcGxhY2VTZWxlY3Rpb24oZm91bmQubWFwKCh0KSA9PiBgLSAhW1ske3R9XV1gKS5qb2luKFwiXFxuXCIpKTtcclxuICAgIG5ldyBOb3RpY2UoYFx1NURGMlx1NjNEMlx1NTE2NSAke2ZvdW5kLmxlbmd0aH0gXHU1OTA0XHU1RDRDXHU1MTY1YCk7XHJcbiAgfVxyXG5cclxuICAvKiogXHU1M0NEXHU2N0U1XHVGRjFBXHU2MjhBXHU1RjE1XHU3NTI4XHU0RTg2XHU2NzJDXHU2NTg3XHU3Njg0XHU3QjE0XHU4QkIwXHU0RUU1XHU1MzlGXHU3NTFGXHU1RDRDXHU1MTY1XHU1MjE3XHU4ODY4XHU2M0QyXHU1MTY1XHVGRjA4XHU5NzU5XHU2MDAxXHU3RUQzXHU2NzlDXHVGRjBDXHU0RTBEXHU2NjJGXHU1MkE4XHU2MDAxXHU2RTMyXHU2N0QzXHVGRjA5ICovXHJcbiAgcHJpdmF0ZSBpbnNlcnRSZXZlcnNlRW1iZWRzKGVkaXRvcjogRWRpdG9yKTogdm9pZCB7XHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcclxuICAgIGlmICghZmlsZSkge1xyXG4gICAgICBuZXcgTm90aWNlKFwiXHU1RjUzXHU1MjREXHU2Q0ExXHU2NzA5XHU2MjUzXHU1RjAwXHU3Njg0XHU2NTg3XHU0RUY2XCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBsaW5rcyA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUucmVzb2x2ZWRMaW5rcztcclxuICAgIGNvbnN0IHJlZnMgPSBPYmplY3Qua2V5cyhsaW5rcykuZmlsdGVyKChzcmMpID0+IGxpbmtzW3NyY10/LltmaWxlLnBhdGhdKTtcclxuICAgIGlmICghcmVmcy5sZW5ndGgpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlx1NkNBMVx1NjcwOVx1N0IxNFx1OEJCMFx1NUYxNVx1NzUyOFx1NjcyQ1x1NjU4N1wiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgdGV4dCA9IGBcdTg4QUJcdTVGMTVcdTc1MjhcdTU3MjhcdUZGMUFcXG5cXG4ke3JlZnNcclxuICAgICAgLm1hcCgocikgPT4gYC0gIVtbJHtyLnJlcGxhY2UoL1xcLm1kJC9pLCBcIlwiKX1dXWApXHJcbiAgICAgIC5qb2luKFwiXFxuXCIpfVxcbmA7XHJcbiAgICBlZGl0b3IucmVwbGFjZVJhbmdlKHRleHQsIGVkaXRvci5nZXRDdXJzb3IoKSk7XHJcbiAgICBuZXcgTm90aWNlKGBcdTVERjJcdTYzRDJcdTUxNjUgJHtyZWZzLmxlbmd0aH0gXHU2NzYxXHU1RjE1XHU3NTI4YCk7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBBcHAsIENvbXBvbmVudCwgTm90aWNlLCBzZXRJY29uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IE5vdGVNZXRhLCByZW5kZXJNYXJrZG93biB9IGZyb20gXCIuL21ldGFkYXRhXCI7XHJcbmltcG9ydCB7IEF0b21pY0NhcmRzU2V0dGluZ3MsIFJlbmRlck9wdGlvbnMgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBSZW9yZGVyUmVxdWVzdCB7XHJcbiAgLyoqIFx1ODhBQlx1NjJENlx1NTJBOFx1NzY4NFx1N0IxNFx1OEJCMFx1NTQwRCAqL1xyXG4gIHNvdXJjZTogc3RyaW5nO1xyXG4gIC8qKiBcdTY1M0VcdTdGNkVcdTc2RUVcdTY4MDdcdTdCMTRcdThCQjBcdTU0MEQgKi9cclxuICB0YXJnZXQ6IHN0cmluZztcclxuICAvKiogdHJ1ZSA9IFx1NjNEMlx1NTIzMFx1NzZFRVx1NjgwN1x1NEU0Qlx1NTI0RFx1RkYwQ2ZhbHNlID0gXHU0RTRCXHU1NDBFICovXHJcbiAgYmVmb3JlOiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENhcmRFbnYge1xyXG4gIGFwcDogQXBwO1xyXG4gIHNldHRpbmdzOiBBdG9taWNDYXJkc1NldHRpbmdzO1xyXG4gIHNvdXJjZVBhdGg6IHN0cmluZztcclxuICBjb21wb25lbnQ6IENvbXBvbmVudDtcclxuICAvKiogXHU1RjUzXHU1MjREXHU1RDRDXHU1OTU3XHU1QzQyXHU3RUE3XHVGRjBDXHU3NTI4XHU0RThFXHU5MDEyXHU1RjUyXHU2RTMyXHU2N0QzXHU2NUY2XHU5NjUwXHU1MjM2XHU2REYxXHU1RUE2ICovXHJcbiAgZGVwdGg6IG51bWJlcjtcclxuICAvKiogXHU2MjhBXHU1MzYxXHU3MjQ3XHU2MkQ2XHU1MjMwXHU1M0U2XHU0RTAwXHU1RjIwXHU1MzYxXHU3MjQ3XHU0RTBBXHU5MUNEXHU2MzkyXHU2NUY2XHU1NkRFXHU4QzAzXHVGRjA4XHU3NTMxXHU2M0QyXHU0RUY2XHU1M0JCXHU2NTM5XHU2RTkwXHU3ODAxXHU5MUNDXHU3Njg0XHU1RDRDXHU1MTY1XHU5ODdBXHU1RThGXHVGRjA5ICovXHJcbiAgb25SZW9yZGVyPzogKHJlcTogUmVvcmRlclJlcXVlc3QpID0+IHZvaWQ7XHJcbn1cclxuXHJcbi8qKiBkYXRhVHJhbnNmZXIgXHU5MUNDXHU3Njg0XHU4MUVBXHU1QjlBXHU0RTQ5XHU3QzdCXHU1NzhCXHVGRjFBXHU2ODA3XHU4QkIwXCJcdThGRDlcdTY2MkZcdTY3MkNcdTYzRDJcdTRFRjZcdTc2ODRcdTUzNjFcdTcyNDdcdTU3MjhcdTYyRDZcIiAqL1xyXG5leHBvcnQgY29uc3QgQUNfQ0FSRF9NSU1FID0gXCJhcHBsaWNhdGlvbi94LWF0b21pYy1jYXJkc1wiO1xyXG5cclxuLyoqXHJcbiAqIFx1NjJENlx1NjJGRFx1NEUyRFx1NTM2MVx1NzI0N1x1NzY4NFx1NzIzNlx1NUJCOVx1NTY2OFx1MzAwMlxyXG4gKiBcdTc1MjhcdTRFOEVcdTk2NTBcdTUyMzZcIlx1NTNFQVx1NjcwOVx1NTQwQ1x1N0VBN1x1NTM2MVx1NzI0N1wiXHU2MjREXHU4MEZEXHU0RTkyXHU3NkY4XHU1RjUzXHU2NTNFXHU3RjZFXHU3NkVFXHU2ODA3XHUyMDE0XHUyMDE0XHU1NDI2XHU1MjE5XHU2MkQ2XHU1RDRDXHU1OTU3XHU1QzBGXHU1MzYxXHU3MjQ3XHU2NUY2XHVGRjBDXHJcbiAqIFx1NEU4Qlx1NEVGNlx1NTE5Mlx1NkNFMVx1NTIzMFx1NTkxNlx1NUM0Mlx1NTkyN1x1NTM2MVx1NzI0N1x1NEYxQVx1NjI4QVx1NjMwN1x1NzkzQVx1N0VCRlx1NzUzQlx1OTUxOVx1NEY0RFx1N0Y2RVx1MzAwMlxyXG4gKi9cclxubGV0IGRyYWdTb3VyY2VQYXJlbnQ6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2V0RHJhZ1NvdXJjZVBhcmVudChlbDogSFRNTEVsZW1lbnQgfCBudWxsKTogdm9pZCB7XHJcbiAgZHJhZ1NvdXJjZVBhcmVudCA9IGVsO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaXNDYXJkUmVvcmRlckRyYWcoKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIGRyYWdTb3VyY2VQYXJlbnQgIT09IG51bGw7XHJcbn1cclxuXHJcbmxldCBuZXN0TWFya2VyID0gMDtcclxuXHJcbi8qKlxyXG4gKiBcdThCQjBcdTRGNEZcdTZCQ0ZcdTVGMjBcdTUzNjFcdTcyNDdcdTc2ODRcdTVDNTVcdTVGMDBcdTcyQjZcdTYwMDFcdTMwMDJcclxuICogXHU5MUNEXHU2MzkyIC8gXHU2NTg3XHU0RUY2XHU0RkREXHU1QjU4XHU0RjFBXHU4OUU2XHU1M0QxXHU5MUNEXHU2NUIwXHU2RTMyXHU2N0QzXHVGRjBDXHU4MkU1XHU2QkNGXHU2QjIxXHU5MEZEXHU1NkRFXHU4NDNEXHU1MjMwXHU4QkJFXHU3RjZFXHU5RUQ4XHU4QkE0XHU1MDNDXHVGRjBDXHJcbiAqIFx1NzUyOFx1NjIzN1x1NTIxQVx1NjUzNlx1OEQ3N1x1NzY4NFx1NTM2MVx1NzI0N1x1NTNDOFx1NEYxQVx1NTE2OFx1OTBFOFx1NUYzOVx1NUYwMFx1MzAwMlx1OEZEOVx1OTFDQ1x1NjMwOVx1N0IxNFx1OEJCMFx1OEJCMFx1NEUwQlx1NjcwMFx1NTQwRVx1NEUwMFx1NkIyMVx1NzY4NFx1NjI0Qlx1NTJBOFx1NjRDRFx1NEY1Q1x1MzAwMlxyXG4gKi9cclxuY29uc3QgZXhwYW5kTWVtb3J5ID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmVzdCgpOiBudW1iZXIge1xyXG4gIHJldHVybiBuZXN0TWFya2VyO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd2l0aE5lc3Q8VD4oZGVwdGg6IG51bWJlciwgZm46ICgpID0+IFQpOiBUIHtcclxuICBjb25zdCBwcmV2ID0gbmVzdE1hcmtlcjtcclxuICBuZXN0TWFya2VyID0gZGVwdGg7XHJcbiAgdHJ5IHtcclxuICAgIHJldHVybiBmbigpO1xyXG4gIH0gZmluYWxseSB7XHJcbiAgICBuZXN0TWFya2VyID0gcHJldjtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZtdENvdW50KG46IG51bWJlcik6IHN0cmluZyB7XHJcbiAgcmV0dXJuIG4gPj0gMTAwMCA/IGAkeyhuIC8gMTAwMCkudG9GaXhlZCgxKX1rIFx1NUI1N2AgOiBgJHtufSBcdTVCNTdgO1xyXG59XHJcblxyXG4vKiogXHU2Q0ExXHU2NzA5XHU1QzAxXHU5NzYyXHU2NUY2XHVGRjBDXHU3NTI4XHU3QzdCXHU1NzhCL1x1OERFRlx1NUY4NFx1NjNBOFx1NjVBRFx1NEUwMFx1NEUyQVx1NTZGRVx1NjgwNyAqL1xyXG5mdW5jdGlvbiBpY29uRm9yKG1ldGE6IE5vdGVNZXRhKTogc3RyaW5nIHtcclxuICAvLyBcdTZCQjVcdTg0M0QgLyBcdTc3RTVcdThCQzZcdTcwQjlcdTdFQTdcdTVGMTVcdTc1MjhcclxuICBpZiAobWV0YS5ibG9ja0NvbnRlbnQpIHJldHVybiBcInF1b3RlXCI7XHJcbiAgY29uc3QgdHlwZSA9IChtZXRhLmJhZGdlcy5maW5kKChiKSA9PiBiLmtleSA9PT0gXCJ0eXBlXCIpPy52YWx1ZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xyXG4gIGNvbnN0IGhheSA9IGAke3R5cGV9ICR7bWV0YS5maWxlPy5wYXRoID8/IG1ldGEudGFyZ2V0fWAudG9Mb3dlckNhc2UoKTtcclxuICBpZiAoL2NoYXB0ZXJ8XHU3QUUwXHU4MjgyfFx1N0VDNFx1NTQwOC8udGVzdChoYXkpKSByZXR1cm4gXCJsYXllcnNcIjtcclxuICBpZiAoL2NvbmNlcHR8XHU2OTgyXHU1RkY1Ly50ZXN0KGhheSkpIHJldHVybiBcImxpZ2h0YnVsYlwiO1xyXG4gIGlmICgvZW50aXR5fFx1NUI5RVx1NEY1My8udGVzdChoYXkpKSByZXR1cm4gXCJ1c2VyXCI7XHJcbiAgaWYgKC9yZXNvdXJjZXxcdThENDRcdTZFOTAvLnRlc3QoaGF5KSkgcmV0dXJuIFwicGFja2FnZVwiO1xyXG4gIGlmICgvZ29hbHxcdTc2RUVcdTY4MDcvLnRlc3QoaGF5KSkgcmV0dXJuIFwidGFyZ2V0XCI7XHJcbiAgaWYgKC9tZXRhfGRhc2hib2FyZHxpbmRleC8udGVzdChoYXkpKSByZXR1cm4gXCJsYXlvdXQtZ3JpZFwiO1xyXG4gIGlmICgvYXRvbXxcdTUzOUZcdTVCNTAvLnRlc3QoaGF5KSkgcmV0dXJuIFwiY2lyY2xlLWRvdFwiO1xyXG4gIHJldHVybiBcImZpbGUtdGV4dFwiO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBvcGVuTm90ZShlbnY6IENhcmRFbnYsIG1ldGE6IE5vdGVNZXRhLCBlOiBNb3VzZUV2ZW50KSB7XHJcbiAgaWYgKCFtZXRhLmZpbGUpIHtcclxuICAgIGNvbnN0IG5hbWUgPSBtZXRhLnRhcmdldC5zcGxpdChcIiNcIilbMF0ucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IGVudi5hcHAudmF1bHQuY3JlYXRlKFxyXG4gICAgICAgIGAke25hbWV9Lm1kYCxcclxuICAgICAgICBgLS0tXFxudHlwZTogYXRvbVxcbnRpdGxlOiBcIiR7bWV0YS50aXRsZX1cIlxcbmNyZWF0ZWQ6ICR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKX1cXG4tLS1cXG5cXG4jICR7bWV0YS50aXRsZX1cXG5cXG5gXHJcbiAgICAgICk7XHJcbiAgICAgIGF3YWl0IGVudi5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsIGVudi5zb3VyY2VQYXRoLCBmYWxzZSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgbmV3IE5vdGljZShgXHU1MjFCXHU1RUZBXHU1OTMxXHU4RDI1XHVGRjFBJHtTdHJpbmcoZXJyKX1gKTtcclxuICAgIH1cclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgY29uc3QgbmV3TGVhZiA9IGUuY3RybEtleSB8fCBlLm1ldGFLZXkgfHwgZS5idXR0b24gPT09IDE7XHJcbiAgLy8gdGFyZ2V0IFx1NTNFRlx1ODBGRFx1NUUyNiAjXHU2ODA3XHU5ODk4IC8gI15cdTU3NTdpZFx1RkYwQ1x1NEVBNFx1N0VEOSBPYnNpZGlhbiBcdTVCOUFcdTRGNERcdTUyMzBcdTZCQjVcdTg0M0RcclxuICBhd2FpdCBlbnYuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQobWV0YS50YXJnZXQgfHwgbWV0YS5maWxlLnBhdGgsIGVudi5zb3VyY2VQYXRoLCBuZXdMZWFmKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaHJlZk9mKG1ldGE6IE5vdGVNZXRhKTogc3RyaW5nIHtcclxuICBpZiAoIW1ldGEuZmlsZSkgcmV0dXJuIFwiI1wiO1xyXG4gIHJldHVybiBtZXRhLnJlZiA/IGAke21ldGEuZmlsZS5wYXRofSMke21ldGEucmVmfWAgOiBtZXRhLmZpbGUucGF0aDtcclxufVxyXG5cclxuZnVuY3Rpb24gYnVpbGRNZXRhUm93KG1ldGE6IE5vdGVNZXRhKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcclxuICBpZiAoIW1ldGEuYmFkZ2VzLmxlbmd0aCAmJiAhbWV0YS51cGRhdGVkICYmICFtZXRhLndvcmRDb3VudCkgcmV0dXJuIG51bGw7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICByb3cuY2xhc3NOYW1lID0gXCJhYy1jYXJkX19tZXRhXCI7XHJcbiAgZm9yIChjb25zdCBiIG9mIG1ldGEuYmFkZ2VzLnNsaWNlKDAsIDIpKSB7XHJcbiAgICByb3cuY3JlYXRlU3Bhbih7IGNsczogYGFjLWJhZGdlIGFjLWJhZGdlLS0ke2Iua2V5fWAsIHRleHQ6IGIudmFsdWUgfSk7XHJcbiAgfVxyXG4gIGlmIChtZXRhLnVwZGF0ZWQpIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLW1ldGFfX2RhdGVcIiwgdGV4dDogbWV0YS51cGRhdGVkIH0pO1xyXG4gIGlmIChtZXRhLndvcmRDb3VudCkgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtbWV0YV9fd29yZHNcIiwgdGV4dDogZm10Q291bnQobWV0YS53b3JkQ291bnQpIH0pO1xyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJ1aWxkVGFnUm93KG1ldGE6IE5vdGVNZXRhLCBsaW1pdDogbnVtYmVyKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcclxuICBpZiAoIW1ldGEudGFncy5sZW5ndGgpIHJldHVybiBudWxsO1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgcm93LmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fdGFnc1wiO1xyXG4gIGZvciAoY29uc3QgdCBvZiBtZXRhLnRhZ3Muc2xpY2UoMCwgbGltaXQpKSByb3cuY3JlYXRlU3Bhbih7IGNsczogXCJhYy10YWdcIiwgdGV4dDogYCMke3R9YCB9KTtcclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ2FyZChlbnY6IENhcmRFbnYsIG1ldGE6IE5vdGVNZXRhLCBvcHRzOiBSZW5kZXJPcHRpb25zKTogSFRNTEVsZW1lbnQge1xyXG4gIGNvbnN0IGlzV3JhcCA9IG9wdHMubGF5b3V0ICE9PSBcImNhcmRcIjtcclxuICBjb25zdCBpc1NtYWxsID0gb3B0cy5zaXplID09PSBcInNtYWxsXCI7XHJcblxyXG4gIGNvbnN0IGNhcmQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIGNhcmQuY2xhc3NOYW1lID0gYGFjLWNhcmQgYWMtJHtvcHRzLmRlbnNpdHl9IGFjLXNpemUtJHtvcHRzLnNpemV9IGFjLSR7XHJcbiAgICBpc1dyYXAgPyBcIndyYXBcIiA6IFwiY2FyZHN0eWxlXCJcclxuICB9YDtcclxuICBjYXJkLmRhdGFzZXQucGF0aCA9IG1ldGEuZmlsZT8ucGF0aCA/PyBtZXRhLnRhcmdldDtcclxuICBpZiAoIW1ldGEuZmlsZSkgY2FyZC5jbGFzc0xpc3QuYWRkKFwiaXMtbWlzc2luZ1wiKTtcclxuICBpZiAobWV0YS5ibG9ja0NvbnRlbnQpIGNhcmQuY2xhc3NMaXN0LmFkZChcImlzLWJsb2NrXCIpO1xyXG4gIGlmIChvcHRzLmhlaWdodCA+IDApIGNhcmQuc3R5bGUuc2V0UHJvcGVydHkoXCItLWFjLWNhcmQtaFwiLCBgJHtvcHRzLmhlaWdodH1weGApO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NkI2M1x1NjU4N1x1NUJCOVx1NTY2OFx1RkYwOFx1NTE0OFx1NUVGQVx1RkYwQ1x1NjcwMFx1NTQwRSBhcHBlbmRcdUZGMDkgLS0tLS0tLS0tLSAqL1xyXG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIGJvZHkuY2xhc3NOYW1lID0gXCJhYy1jYXJkX19ib2R5XCI7XHJcbiAgYm9keS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgbGV0IGJvZHlMb2FkZWQgPSBmYWxzZTtcclxuXHJcbiAgY29uc3QgbG9hZEJvZHkgPSAoKSA9PiB7XHJcbiAgICBpZiAoYm9keUxvYWRlZCB8fCAhbWV0YS5maWxlKSByZXR1cm47XHJcbiAgICBib2R5TG9hZGVkID0gdHJ1ZTtcclxuICAgIGNvbnN0IGZpbGUgPSBtZXRhLmZpbGU7XHJcbiAgICB2b2lkIGVudi5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKS50aGVuKChyYXcpID0+IHtcclxuICAgICAgY29uc3QgZnVsbCA9IHJhdy5yZXBsYWNlKC9eLS0tXFxyP1xcbltcXHNcXFNdKj9cXHI/XFxuLS0tXFxyP1xcbj8vLCBcIlwiKTtcclxuICAgICAgY29uc3QgbWQgPSBtZXRhLmJsb2NrQ29udGVudCA/PyBmdWxsO1xyXG4gICAgICBib2R5LmVtcHR5KCk7XHJcbiAgICAgIHdpdGhOZXN0KGVudi5kZXB0aCwgKCkgPT4ge1xyXG4gICAgICAgIHJlbmRlck1hcmtkb3duKGVudi5hcHAsIG1kLCBib2R5LCBmaWxlLnBhdGgsIGVudi5jb21wb25lbnQpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDXHVGRjFBXHU5ODc2XHU5MEU4XHU1QzAxXHU5NzYyIC0tLS0tLS0tLS0gKi9cclxuICBpZiAoIWlzV3JhcCAmJiBvcHRzLmNvdmVyICYmIG1ldGEuY292ZXIpIHtcclxuICAgIGNvbnN0IGNvdmVyID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9fY292ZXJcIiB9KTtcclxuICAgIGNvbnN0IGltZyA9IGNvdmVyLmNyZWF0ZUVsKFwiaW1nXCIsIHtcclxuICAgICAgYXR0cjogeyBzcmM6IG1ldGEuY292ZXIsIGFsdDogbWV0YS50aXRsZSwgbG9hZGluZzogXCJsYXp5XCIsIGRyYWdnYWJsZTogXCJmYWxzZVwiIH0sXHJcbiAgICB9KTtcclxuICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4gY292ZXIucmVtb3ZlKCkpO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTU5MzRcdTkwRThcdUZGMUFcdTU2RkVcdTY4MDcgKyBcdTY4MDdcdTk4OTggKyBcdTY4MDdcdTdCN0UgKyBcdTVGQkRcdTdBRTAgKyBcdTY0Q0RcdTRGNUNcdUZGMENcdTUxNjhcdTU3MjhcdTRFMDBcdTg4NEMgLS0tLS0tLS0tLSAqL1xyXG4gIGNvbnN0IGhlYWQgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJhYy1jYXJkX19oZWFkXCIgfSk7XHJcblxyXG4gIGlmIChpc1dyYXApIHtcclxuICAgIGNvbnN0IHRodW1iID0gaGVhZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9fdGh1bWJcIiB9KTtcclxuICAgIGlmIChvcHRzLmNvdmVyICYmIG1ldGEuY292ZXIpIHtcclxuICAgICAgY29uc3QgaW1nID0gdGh1bWIuY3JlYXRlRWwoXCJpbWdcIiwge1xyXG4gICAgICAgIGF0dHI6IHsgc3JjOiBtZXRhLmNvdmVyLCBhbHQ6IG1ldGEudGl0bGUsIGxvYWRpbmc6IFwibGF6eVwiLCBkcmFnZ2FibGU6IFwiZmFsc2VcIiB9LFxyXG4gICAgICB9KTtcclxuICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCAoKSA9PiB7XHJcbiAgICAgICAgdGh1bWIuZW1wdHkoKTtcclxuICAgICAgICBzZXRJY29uKHRodW1iLCBpY29uRm9yKG1ldGEpKTtcclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzZXRJY29uKHRodW1iLCBpY29uRm9yKG1ldGEpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNvbnN0IHRpdGxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcclxuICB0aXRsZUVsLmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fdGl0bGVcIjtcclxuICB0aXRsZUVsLnNldEF0dHIoXCJocmVmXCIsIGhyZWZPZihtZXRhKSk7XHJcbiAgdGl0bGVFbC50ZXh0Q29udGVudCA9IG1ldGEudGl0bGU7XHJcbiAgdGl0bGVFbC50aXRsZSA9IG1ldGEuZmlsZVxyXG4gICAgPyBgJHtocmVmT2YobWV0YSl9XHVGRjA4XHU3MEI5XHU1MUZCXHU1QzU1XHU1RjAwL1x1NjUzNlx1OEQ3N1x1RkYwQ0N0cmwrXHU3MEI5XHU1MUZCXHU4REYzXHU1MjMwXHU1MzlGXHU2NTg3XHVGRjA5YFxyXG4gICAgOiBgXHU2NUIwXHU1RUZBXHVGRjFBJHttZXRhLnRhcmdldH1gO1xyXG4gIGhlYWQuYXBwZW5kQ2hpbGQodGl0bGVFbCk7XHJcblxyXG4gIGlmICghbWV0YS5maWxlKSBoZWFkLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtY2FyZF9fbWlzc2luZ1wiLCB0ZXh0OiBcIlx1NjcyQVx1NTIxQlx1NUVGQVwiIH0pO1xyXG5cclxuICBpZiAob3B0cy50YWdzKSB7XHJcbiAgICBjb25zdCB0YWdSb3cgPSBidWlsZFRhZ1JvdyhtZXRhLCBpc1NtYWxsID8gMiA6IDMpO1xyXG4gICAgaWYgKHRhZ1JvdykgaGVhZC5hcHBlbmRDaGlsZCh0YWdSb3cpO1xyXG4gIH1cclxuXHJcbiAgaWYgKG9wdHMubWV0YSkge1xyXG4gICAgY29uc3QgbWV0YVJvdyA9IGJ1aWxkTWV0YVJvdyhtZXRhKTtcclxuICAgIGlmIChtZXRhUm93KSBoZWFkLmFwcGVuZENoaWxkKG1ldGFSb3cpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgYWN0aW9ucyA9IGhlYWQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWNhcmRfX2FjdGlvbnNcIiB9KTtcclxuXHJcbiAgY29uc3QgdG9nZ2xlQnRuID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJhYy1idG4gYWMtYnRuLS10b2dnbGVcIiB9KTtcclxuICBjb25zdCB0b2dnbGVJY29uID0gdG9nZ2xlQnRuLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtYnRuX19pY29uXCIgfSk7XHJcbiAgY29uc3QgdG9nZ2xlVGV4dCA9IHRvZ2dsZUJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9fdGV4dFwiLCB0ZXh0OiBcIlx1NUM1NVx1NUYwMFwiIH0pO1xyXG4gIHNldEljb24odG9nZ2xlSWNvbiwgXCJjaGV2cm9uLWRvd25cIik7XHJcblxyXG4gIGlmIChvcHRzLm9wZW4pIHtcclxuICAgIGNvbnN0IG9wZW5CdG4gPSBhY3Rpb25zLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImFjLWJ0biBhYy1idG4tLW9wZW5cIiB9KTtcclxuICAgIGNvbnN0IG9wZW5JY29uID0gb3BlbkJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9faWNvblwiIH0pO1xyXG4gICAgb3BlbkJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9fdGV4dFwiLCB0ZXh0OiBcIlx1NjI1M1x1NUYwMFwiIH0pO1xyXG4gICAgc2V0SWNvbihvcGVuSWNvbiwgXCJhcnJvdy11cC1yaWdodFwiKTtcclxuICAgIG9wZW5CdG4udGl0bGUgPSBtZXRhLmZpbGUgPyBcIlx1NTcyOFx1NTM5Rlx1NTlDQlx1NjU4N1x1Njg2M1x1NEUyRFx1NjI1M1x1NUYwMFwiIDogXCJcdTUyMUJcdTVFRkFcdThGRDlcdTdCQzdcdTY1ODdcdTY4NjNcIjtcclxuICAgIG9wZW5CdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB2b2lkIG9wZW5Ob3RlKGVudiwgbWV0YSwgZSkpO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTY0NThcdTg5ODFcdUZGMDhcdTRFMkRcdUZGMDkgLS0tLS0tLS0tLSAqL1xyXG4gIGNhcmQuY3JlYXRlRGl2KHtcclxuICAgIGNsczogXCJhYy1jYXJkX19zdW1tYXJ5XCIsXHJcbiAgICB0ZXh0OiBtZXRhLnN1bW1hcnkgfHwgKG1ldGEuZmlsZSA/IFwiXHVGRjA4XHU2NjgyXHU2NUUwXHU2NDU4XHU4OTgxXHVGRjA5XCIgOiBcIlx1NzBCOVx1NTFGQlx1NjgwN1x1OTg5OFx1NTIxQlx1NUVGQVx1OEZEOVx1N0JDN1x1NTM5Rlx1NUI1MFx1NjU4N1x1Njg2M1wiKSxcclxuICB9KTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTZCNjNcdTY1ODdcdUZGMDhcdTZERjFcdUZGMDkgLS0tLS0tLS0tLSAqL1xyXG4gIGNhcmQuYXBwZW5kQ2hpbGQoYm9keSk7XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU1QzU1XHU1RjAwIC8gXHU2NTM2XHU4RDc3IC0tLS0tLS0tLS0gKi9cclxuICBjb25zdCBtZW1vcnlLZXkgPSBtZXRhLmZpbGU/LnBhdGggPz8gbWV0YS50YXJnZXQ7XHJcbiAgbGV0IGV4cGFuZGVkID0gZmFsc2U7XHJcbiAgY29uc3Qgc2V0RXhwYW5kZWQgPSAobmV4dDogYm9vbGVhbikgPT4ge1xyXG4gICAgZXhwYW5kZWQgPSBuZXh0O1xyXG4gICAgY2FyZC5jbGFzc0xpc3QudG9nZ2xlKFwiaXMtZXhwYW5kZWRcIiwgZXhwYW5kZWQpO1xyXG4gICAgdG9nZ2xlVGV4dC50ZXh0Q29udGVudCA9IGV4cGFuZGVkID8gXCJcdTY1MzZcdThENzdcIiA6IFwiXHU1QzU1XHU1RjAwXCI7XHJcbiAgICBzZXRJY29uKHRvZ2dsZUljb24sIGV4cGFuZGVkID8gXCJjaGV2cm9uLXVwXCIgOiBcImNoZXZyb24tZG93blwiKTtcclxuICAgIGJvZHkuc3R5bGUuZGlzcGxheSA9IGV4cGFuZGVkID8gXCJcIiA6IFwibm9uZVwiO1xyXG4gICAgaWYgKGV4cGFuZGVkKSBsb2FkQm9keSgpO1xyXG4gICAgZXhwYW5kTWVtb3J5LnNldChtZW1vcnlLZXksIGV4cGFuZGVkKTtcclxuICB9O1xyXG5cclxuICB0b2dnbGVCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHNldEV4cGFuZGVkKCFleHBhbmRlZCkpO1xyXG5cclxuICAvLyBcdTcwQjlcdTY4MDdcdTk4OThcdTY2MkZcdTYyOThcdTUzRTBcdTVGMDBcdTUxNzNcdUZGMUJcdTYzMDlcdTRGNEYgQ3RybC9DbWQgXHU2MjREXHU4REYzXHU1MjMwXHU1MzlGXHU2NTg3XHJcbiAgdGl0bGVFbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5IHx8IGUuYnV0dG9uID09PSAxKSB7XHJcbiAgICAgIHZvaWQgb3Blbk5vdGUoZW52LCBtZXRhLCBlKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgc2V0RXhwYW5kZWQoIWV4cGFuZGVkKTtcclxuICB9KTtcclxuXHJcbiAgLy8gXHU1OTM0XHU5MEU4XHU3QTdBXHU3NjdEXHU1OTA0XHU0RTVGXHU1M0VGXHU0RUU1XHU2Mjk4XHU1M0UwXHVGRjA4XHU2MzA5XHU5NEFFXHU1NDhDXHU5NEZFXHU2M0E1XHU4MUVBXHU1REYxXHU1OTA0XHU3NDA2XHVGRjBDXHU0RTBEXHU5MUNEXHU1OTBEXHU4OUU2XHU1M0QxXHVGRjA5XHJcbiAgaGVhZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcclxuICAgIGNvbnN0IGVsID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgaWYgKGVsPy5jbG9zZXN0KFwiYnV0dG9uLCBhXCIpKSByZXR1cm47XHJcbiAgICBzZXRFeHBhbmRlZCghZXhwYW5kZWQpO1xyXG4gIH0pO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NjJENlx1NjJGRFx1RkYxQVx1NEVDRVx1NTM2MVx1NzI0N1x1NTkzNFx1OTBFOFx1NjJENlx1NTIzMFx1NkI2M1x1NjU4N1x1RkYwQ1x1NjNEMlx1NTE2NSAhW1sgXV0gXHU1RDRDXHU1MTY1IC0tLS0tLS0tLS1cclxuICAgICBPYnNpZGlhbiBcdTUzOUZcdTc1MUZcdTRFQ0VcdTY1ODdcdTRFRjZcdTUyMTdcdTg4NjhcdTYyRDZcdThGREJcdTY3NjVcdTUzRUFcdTgwRkRcdTVGOTdcdTUyMzAgW1tcdTk0RkVcdTYzQTVdXVx1RkYwQ1x1NUY5N1x1NEUwRFx1NTIzMFx1NUQ0Q1x1NTE2NVx1MzAwMlxyXG4gICAgIFx1OEZEOVx1OTFDQ1x1OEJBOVx1NTM2MVx1NzI0N1x1ODFFQVx1NURGMVx1NTNFRlx1NEVFNVx1ODhBQlx1NjJENlx1OEQ3MFx1RkYwQ1x1NjUzRVx1NTIzMFx1N0YxNlx1OEY5MVx1NTY2OFx1NTM3M1x1NzUxRlx1NjIxMCAhW1tcdTdCMTRcdThCQjBdXVx1MzAwMlxyXG4gICAgIFx1NTNFQVx1OEJBOVx1NTkzNFx1OTBFOFx1NTNFRlx1NjJENlx1RkYxQVx1NkI2M1x1NjU4N1x1NTMzQVx1ODk4MVx1NzU1OVx1N0VEOVx1OTAwOVx1NEUyRFx1NTkwRFx1NTIzNlx1NTQ4Q1x1NjI5OFx1NTNFMFx1NzBCOVx1NTFGQlx1MzAwMiAqL1xyXG4gIGNvbnN0IHNlbGZOYW1lID0gbWV0YS5maWxlPy5iYXNlbmFtZSA/PyBtZXRhLnRhcmdldDtcclxuXHJcbiAgaGVhZC5kcmFnZ2FibGUgPSB0cnVlO1xyXG4gIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdzdGFydFwiLCAoZSkgPT4ge1xyXG4gICAgaWYgKCFtZXRhLmZpbGUpIHJldHVybjtcclxuICAgIGNvbnN0IGxpbmsgPSBtZXRhLnJlZiA/IGAhW1ske3NlbGZOYW1lfSMke21ldGEucmVmfV1dYCA6IGAhW1ske3NlbGZOYW1lfV1dYDtcclxuICAgIC8vIFx1NTQwQ1x1NjVGNlx1N0VEOVx1NEUyNFx1NzlDRFx1NjU3MFx1NjM2RVx1RkYxQVx1ODFFQVx1NUI5QVx1NEU0OVx1N0M3Qlx1NTc4Qlx1NzUyOFx1NEU4RVx1NTM2MVx1NzI0N1x1OTVGNFx1OTFDRFx1NjM5Mlx1RkYwQ3RleHQvcGxhaW4gXHU3NTI4XHU0RThFXHU2MkQ2XHU1MjMwXHU2QjYzXHU2NTg3XHU2M0QyXHU1MTY1XHJcbiAgICBlLmRhdGFUcmFuc2Zlcj8uc2V0RGF0YShBQ19DQVJEX01JTUUsIHNlbGZOYW1lKTtcclxuICAgIGUuZGF0YVRyYW5zZmVyPy5zZXREYXRhKFwidGV4dC9wbGFpblwiLCBsaW5rKTtcclxuICAgIGlmIChlLmRhdGFUcmFuc2ZlcikgZS5kYXRhVHJhbnNmZXIuZWZmZWN0QWxsb3dlZCA9IFwiY29weVwiO1xyXG4gICAgLy8gXHU4QkIwXHU0RTBCXHU2RTkwXHU1MzYxXHU3MjQ3XHU3Njg0XHU3MjM2XHU1QkI5XHU1NjY4XHVGRjFBXHU1M0VBXHU2NzA5XHU1NDBDXHU3RUE3XHU1MzYxXHU3MjQ3XHU2MjREXHU4MEZEXHU0RTkyXHU3NkY4XHU1RjUzXHU2NTNFXHU3RjZFXHU3NkVFXHU2ODA3XHJcbiAgICBzZXREcmFnU291cmNlUGFyZW50KGNhcmQucGFyZW50RWxlbWVudCk7XHJcbiAgICBjYXJkLmNsYXNzTGlzdC5hZGQoXCJpcy1kcmFnZ2luZ1wiKTtcclxuICB9KTtcclxuXHJcbiAgaGVhZC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2VuZFwiLCAoKSA9PiB7XHJcbiAgICBjYXJkLmNsYXNzTGlzdC5yZW1vdmUoXCJpcy1kcmFnZ2luZ1wiKTtcclxuICAgIHNldERyYWdTb3VyY2VQYXJlbnQobnVsbCk7XHJcbiAgICBjbGVhckRyb3BNYXJrcygpO1xyXG4gIH0pO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NEY1Q1x1NEUzQVx1NjUzRVx1N0Y2RVx1NzZFRVx1NjgwN1x1RkYxQVx1NjJENlx1NTNFNlx1NEUwMFx1NUYyMFx1NTM2MVx1NzI0N1x1OEZDN1x1Njc2NSBcdTIxOTIgXHU5MUNEXHU2MzkyIC0tLS0tLS0tLS0gKi9cclxuICBjb25zdCBjbGVhckRyb3BNYXJrcyA9ICgpID0+IHtcclxuICAgIGZvciAoY29uc3QgZWwgb2YgQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmFjLWRyb3AtYmVmb3JlLCAuYWMtZHJvcC1hZnRlclwiKSkpIHtcclxuICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZShcImFjLWRyb3AtYmVmb3JlXCIsIFwiYWMtZHJvcC1hZnRlclwiKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjYXJkLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnb3ZlclwiLCAoZSkgPT4ge1xyXG4gICAgY29uc3QgZHQgPSBlLmRhdGFUcmFuc2ZlcjtcclxuICAgIGlmICghZHQgfHwgIUFycmF5LmZyb20oZHQudHlwZXMpLmluY2x1ZGVzKEFDX0NBUkRfTUlNRSkpIHJldHVybjtcclxuICAgIC8vIFx1NURGMlx1N0VDRlx1NTcyOFx1NjJENlx1NzY4NFx1NjYyRlx1ODFFQVx1NURGMSBcdTIxOTIgXHU0RTBEXHU2M0E1XHU2NTM2XHJcbiAgICBpZiAoY2FyZC5jbGFzc0xpc3QuY29udGFpbnMoXCJpcy1kcmFnZ2luZ1wiKSkgcmV0dXJuO1xyXG4gICAgLy8gXHUyNkEwXHVGRTBGIFx1NUQ0Q1x1NTk1N1x1NTM2MVx1NzI0N1x1NzY4NFx1NEU4Qlx1NEVGNlx1NEYxQVx1NTE5Mlx1NkNFMVx1NTIzMFx1NTkxNlx1NUM0Mlx1NTkyN1x1NTM2MVx1NzI0N1x1MzAwMlx1NEU4Qlx1NEVGNlx1NzZFRVx1NjgwN1x1NjcwMFx1OEZEMVx1NzY4NCAuYWMtY2FyZFxyXG4gICAgLy8gICAgXHU1RkM1XHU5ODdCXHU2NjJGXHU4MUVBXHU1REYxXHVGRjBDXHU1NDI2XHU1MjE5XHU2MkQ2XHU1QzBGXHU1MzYxXHU3MjQ3XHU2NUY2XHU2MzA3XHU3OTNBXHU3RUJGXHU0RjFBXHU3NTNCXHU1MjMwXHU1OTI3XHU1MzYxXHU3MjQ3XHU0RTBBXHUzMDAyXHJcbiAgICBjb25zdCBuZWFyZXN0ID0gKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0Py4oXCIuYWMtY2FyZFwiKTtcclxuICAgIGlmIChuZWFyZXN0ICE9PSBjYXJkKSByZXR1cm47XHJcbiAgICAvLyBcdTI2QTBcdUZFMEYgXHU1M0VBXHU1MTQxXHU4QkI4XHU1NDBDXHU3RUE3XHVGRjA4XHU1NDBDXHU3MjM2XHU1QkI5XHU1NjY4XHVGRjA5XHU2MzkyXHU1RThGXHVGRjFBXHU2MkQ2XHU1RDRDXHU1OTU3XHU1QzBGXHU1MzYxXHU3MjQ3XHU2NUY2XHU0RTBEXHU1RjcxXHU1NENEXHU1OTE2XHU1QzQyXHVGRjBDXHJcbiAgICAvLyAgICBcdTlGMjBcdTY4MDdcdTg0M0RcdTU3MjhcdTVDMEZcdTUzNjFcdTcyNDdcdTk1RjRcdTk2OTlcdTY1RjYgdGFyZ2V0IFx1NEYxQVx1NjYyRlx1NTkyN1x1NTM2MVx1NzI0Ny9cdTdBN0FcdTc2N0RcdUZGMENcdTcyMzZcdTVCQjlcdTU2NjhcdTRFMERcdTU0MENcdTc2RjRcdTYzQTVcdTVGRkRcdTc1NjVcdTMwMDJcclxuICAgIGlmIChjYXJkLnBhcmVudEVsZW1lbnQgIT09IGRyYWdTb3VyY2VQYXJlbnQpIHJldHVybjtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChkdC5kcm9wRWZmZWN0KSBkdC5kcm9wRWZmZWN0ID0gXCJtb3ZlXCI7XHJcbiAgICBjb25zdCBib3ggPSBjYXJkLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgY29uc3QgYmVmb3JlID0gZS5jbGllbnRZIDwgYm94LnRvcCArIGJveC5oZWlnaHQgLyAyO1xyXG4gICAgY2FyZC5jbGFzc0xpc3QudG9nZ2xlKFwiYWMtZHJvcC1iZWZvcmVcIiwgYmVmb3JlKTtcclxuICAgIGNhcmQuY2xhc3NMaXN0LnRvZ2dsZShcImFjLWRyb3AtYWZ0ZXJcIiwgIWJlZm9yZSk7XHJcbiAgfSk7XHJcblxyXG4gIGNhcmQuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdsZWF2ZVwiLCAoKSA9PiB7XHJcbiAgICBjYXJkLmNsYXNzTGlzdC5yZW1vdmUoXCJhYy1kcm9wLWJlZm9yZVwiLCBcImFjLWRyb3AtYWZ0ZXJcIik7XHJcbiAgfSk7XHJcblxyXG4gIGNhcmQuYWRkRXZlbnRMaXN0ZW5lcihcImRyb3BcIiwgKGUpID0+IHtcclxuICAgIGNvbnN0IGR0ID0gZS5kYXRhVHJhbnNmZXI7XHJcbiAgICBjb25zdCBzb3VyY2UgPSBkdD8uZ2V0RGF0YShBQ19DQVJEX01JTUUpID8/IFwiXCI7XHJcbiAgICBjYXJkLmNsYXNzTGlzdC5yZW1vdmUoXCJhYy1kcm9wLWJlZm9yZVwiLCBcImFjLWRyb3AtYWZ0ZXJcIik7XHJcbiAgICBpZiAoZW52LnNldHRpbmdzLnZlcmJvc2UpIHtcclxuICAgICAgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBjYXJkIGRyb3A6XCIsIHtcclxuICAgICAgICBzb3VyY2UsXHJcbiAgICAgICAgdGFyZ2V0OiBzZWxmTmFtZSxcclxuICAgICAgICB0eXBlczogZHQgPyBBcnJheS5mcm9tKGR0LnR5cGVzKSA6IG51bGwsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgaWYgKCFzb3VyY2UgfHwgc291cmNlID09PSBzZWxmTmFtZSkgcmV0dXJuO1xyXG4gICAgLy8gXHU1NDBDIGRyYWdvdmVyXHVGRjFBXHU1M0VBXHU4QkE0XHU2NzAwXHU4RkQxXHU1MzYxXHU3MjQ3XHU2NjJGXHU4MUVBXHU1REYxXHU3Njg0IGRyb3BcdUZGMENcdTRFMTRcdTVGQzVcdTk4N0JcdTY2MkZcdTU0MENcdTdFQTdcdTUzNjFcdTcyNDdcclxuICAgIGNvbnN0IG5lYXJlc3QgPSAoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmNsb3Nlc3Q/LihcIi5hYy1jYXJkXCIpO1xyXG4gICAgaWYgKG5lYXJlc3QgIT09IGNhcmQpIHJldHVybjtcclxuICAgIGlmIChjYXJkLnBhcmVudEVsZW1lbnQgIT09IGRyYWdTb3VyY2VQYXJlbnQpIHJldHVybjtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICBjb25zdCBib3ggPSBjYXJkLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgZW52Lm9uUmVvcmRlcj8uKHtcclxuICAgICAgc291cmNlLFxyXG4gICAgICB0YXJnZXQ6IHNlbGZOYW1lLFxyXG4gICAgICBiZWZvcmU6IGUuY2xpZW50WSA8IGJveC50b3AgKyBib3guaGVpZ2h0IC8gMixcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICAvLyBcdTY3MDlcdThCQjBcdTVGNTVcdTVDMzFcdTYwNjJcdTU5MERcdTRFMEFcdTZCMjFcdTcyQjZcdTYwMDFcdUZGMENcdTZDQTFcdTY3MDlcdThCQjBcdTVGNTVcdTYyNERcdTc1MjhcdThCQkVcdTdGNkVcdTkxQ0NcdTc2ODRcdTlFRDhcdThCQTRcdTUwM0NcclxuICBpZiAoZXhwYW5kTWVtb3J5LmdldChtZW1vcnlLZXkpID8/IG9wdHMuZXhwYW5kZWQpIHNldEV4cGFuZGVkKHRydWUpO1xyXG5cclxuICByZXR1cm4gY2FyZDtcclxufVxyXG4iLCAiaW1wb3J0IHsgQXBwLCBDYWNoZWRNZXRhZGF0YSwgQ29tcG9uZW50LCBGcm9udE1hdHRlckNhY2hlLCBNYXJrZG93blJlbmRlcmVyLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBOb3RlQmFkZ2Uge1xyXG4gIGtleTogc3RyaW5nO1xyXG4gIHZhbHVlOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTm90ZU1ldGEge1xyXG4gIGZpbGU6IFRGaWxlIHwgbnVsbDtcclxuICAvKiogXHU1MzlGXHU1OUNCXHU1RjE1XHU3NTI4XHVGRjA4XHU1M0VGXHU1NDJCICNcdTY4MDdcdTk4OTggXHU2MjE2ICNeXHU1NzU3aWRcdUZGMDkgKi9cclxuICB0YXJnZXQ6IHN0cmluZztcclxuICAvKiogIyBcdTRFNEJcdTU0MEVcdTc2ODRcdTkwRThcdTUyMDZcdUZGMENcdTZDQTFcdTY3MDlcdTUyMTlcdTRFM0FcdTdBN0EgKi9cclxuICByZWY6IHN0cmluZztcclxuICB0aXRsZTogc3RyaW5nO1xyXG4gIHN1bW1hcnk6IHN0cmluZztcclxuICBjb3Zlcjogc3RyaW5nIHwgbnVsbDtcclxuICB0YWdzOiBzdHJpbmdbXTtcclxuICBiYWRnZXM6IE5vdGVCYWRnZVtdO1xyXG4gIHVwZGF0ZWQ6IHN0cmluZztcclxuICB3b3JkQ291bnQ6IG51bWJlcjtcclxuICAvKiogXHU2QkI1XHU4NDNEXHU3RUE3XHU1RjE1XHU3NTI4XHVGRjA4W1tcdTk4NzUjXHU2ODA3XHU5ODk4XV0gLyBbW1x1OTg3NSNeXHU1NzU3XV1cdUZGMDlcdTY1RjZcdUZGMENcdThCRTVcdTZCQjVcdTg0M0RcdTc2ODRcdTZCNjNcdTY1ODcgKi9cclxuICBibG9ja0NvbnRlbnQ/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmNvbnN0IGNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIE5vdGVNZXRhPigpO1xyXG5cclxuZnVuY3Rpb24gc3RyaXBGcm9udG1hdHRlcihyYXc6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgbSA9IHJhdy5tYXRjaCgvXi0tLVxccj9cXG5bXFxzXFxTXSo/XFxyP1xcbi0tLVxccj9cXG4/Lyk7XHJcbiAgcmV0dXJuIG0gPyByYXcuc2xpY2UobVswXS5sZW5ndGgpIDogcmF3O1xyXG59XHJcblxyXG4vKiogXHU2MjhBIG1hcmtkb3duIFx1NkI2M1x1NjU4N1x1NTM4Qlx1NjIxMFx1NEUwMFx1NkJCNVx1N0VBRlx1NjU4N1x1NjcyQ1x1NjQ1OFx1ODk4MSAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdG9QbGFpblRleHQoYm9keTogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gc3RyaXBGcm9udG1hdHRlcihib2R5KVxyXG4gICAgLnJlcGxhY2UoL2BgYFtcXHNcXFNdKj9gYGAvZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzKj5cXHMqXFxbIVxcdytbXlxcXV0qXFxdLiokL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoLyFcXFtcXFtbXlxcXV0qXFxdXFxdL2csIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvIVxcW1teXFxdXSpcXF1cXChbXildKlxcKS9nLCBcIlwiKVxyXG4gICAgLy8gSFRNTCBcdTZDRThcdTkxQ0FcdUZGMUFpV2lraSBcdTYyOTNcdTUzRDZcdTc2ODRcdTY3NjFcdTc2RUVcdTY2NkVcdTkwNERcdTVFMjYgPCEtLSBcdTY3NjVcdTZFOTAgaXdpa2kgZG9jaWQ6eHh4IC0tPlx1RkYwQ1xyXG4gICAgLy8gXHU0RTBEXHU2RTA1XHU2Mzg5XHU3Njg0XHU4QkREXHU1QjgzXHU0RjFBXHU1MzlGXHU2ODM3XHU1MUZBXHU3M0IwXHU1NzI4XHU1MzYxXHU3MjQ3XHU2NDU4XHU4OTgxXHU5MUNDXHUzMDAyXHJcbiAgICAucmVwbGFjZSgvPCEtLVtcXHNcXFNdKj8tLT4vZywgXCJcIilcclxuICAgIC5yZXBsYWNlKC9cXFtcXFsoW15cXF18XSspXFx8PyhbXlxcXV0qKVxcXVxcXS9nLCAoX20sIGE6IHN0cmluZywgYjogc3RyaW5nKSA9PiBiIHx8IGEpXHJcbiAgICAucmVwbGFjZSgvXFxbKFteXFxdXSopXFxdXFwoW14pXSpcXCkvZywgXCIkMVwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHN7MCwzfSN7MSw2fVxccysuKiQvZ20sIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvXlxcc3swLDN9Plxccz8vZ20sIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvXlxccypbLSorXVxccysvZ20sIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvXlxccypcXGQrXFwuXFxzKy9nbSwgXCJcIilcclxuICAgIC8vIFx1ODg2OFx1NjgzQ1x1RkYxQVx1NTE0OFx1NTIyMFx1NjM4OSB8IC0tLSB8IFx1OEZEOVx1N0M3Qlx1NTIwNlx1OTY5NFx1ODg0Q1x1RkYwQ1x1NTE4RFx1NjI4QVx1NTI2OVx1NEUwQlx1NzY4NFx1N0FENlx1N0VCRlx1NTNEOFx1NjIxMFx1N0E3QVx1NjgzQ1x1RkYwQ1xyXG4gICAgLy8gXHU1NDI2XHU1MjE5XHU0RUU1XHU4ODY4XHU2ODNDXHU0RTNBXHU0RTNCXHU3Njg0XHU2NzYxXHU3NkVFXHU2NDU4XHU4OTgxXHU0RjFBXHU1M0Q4XHU2MjEwXHU0RTAwXHU0RTMyXHU3QkExXHU5MDUzXHU3QjI2XHUzMDAyXHJcbiAgICAucmVwbGFjZSgvXlxccypcXHw/W1xcczp8LV0rXFx8P1xccyokL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL1xcfC9nLCBcIiBcIilcclxuICAgIC5yZXBsYWNlKC9bKl9gfj1dL2csIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvXFxzKy9nLCBcIiBcIilcclxuICAgIC50cmltKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpcnN0VGV4dChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IHRleHQgPSB0b1BsYWluVGV4dChjb250ZW50KTtcclxuICByZXR1cm4gdGV4dC5sZW5ndGggPiAyNCA/IGAke3RleHQuc2xpY2UoMCwgMjQpfVx1MjAyNmAgOiB0ZXh0O1xyXG59XHJcblxyXG4vKipcclxuICogXHU0RUNFXHU2NTg3XHU2ODYzXHU5MUNDXHU2MjJBXHU1M0Q2XHU0RTAwXHU0RTJBXHU2QkI1XHU4NDNEXHVGRjA4XHU3N0U1XHU4QkM2XHU3MEI5XHVGRjA5XHUzMDAyXHJcbiAqIFx1NjUyRlx1NjMwMSBgW1tcdTk4NzUjXHU2ODA3XHU5ODk4XV1gIFx1NEUwRSBgW1tcdTk4NzUjXlx1NTc1N2lkXV1gIFx1NEUyNFx1NzlDRFx1NUYxNVx1NzUyOFx1MzAwMlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RCbG9jayhcclxuICByYXc6IHN0cmluZyxcclxuICBmaWxlQ2FjaGU6IENhY2hlZE1ldGFkYXRhIHwgbnVsbCxcclxuICByZWY6IHN0cmluZ1xyXG4pOiB7IHRpdGxlOiBzdHJpbmc7IGNvbnRlbnQ6IHN0cmluZyB9IHwgbnVsbCB7XHJcbiAgY29uc3QgbGluZXMgPSByYXcuc3BsaXQoL1xccj9cXG4vKTtcclxuICBjb25zdCB3YW50ZWQgPSBkZWNvZGVVUklDb21wb25lbnQocmVmKTtcclxuXHJcbiAgLy8gXHU1NzU3XHU1RjE1XHU3NTI4IF5ibG9ja2lkXHJcbiAgaWYgKHdhbnRlZC5zdGFydHNXaXRoKFwiXlwiKSkge1xyXG4gICAgY29uc3QgYmxvY2sgPSBmaWxlQ2FjaGU/LmJsb2Nrcz8uW3dhbnRlZC5zbGljZSgxKV07XHJcbiAgICBpZiAoIWJsb2NrKSByZXR1cm4gbnVsbDtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBsaW5lc1xyXG4gICAgICAuc2xpY2UoYmxvY2sucG9zaXRpb24uc3RhcnQubGluZSwgYmxvY2sucG9zaXRpb24uZW5kLmxpbmUgKyAxKVxyXG4gICAgICAuam9pbihcIlxcblwiKTtcclxuICAgIHJldHVybiB7IHRpdGxlOiBmaXJzdFRleHQoY29udGVudCkgfHwgd2FudGVkLCBjb250ZW50IH07XHJcbiAgfVxyXG5cclxuICAvLyBcdTY4MDdcdTk4OThcdTVGMTVcdTc1MjggI2hlYWRpbmdcclxuICBjb25zdCBoZWFkaW5ncyA9IGZpbGVDYWNoZT8uaGVhZGluZ3MgPz8gW107XHJcbiAgY29uc3QgaWR4ID0gaGVhZGluZ3MuZmluZEluZGV4KChoKSA9PiBoLmhlYWRpbmcgPT09IHdhbnRlZCk7XHJcbiAgaWYgKGlkeCA8IDApIHJldHVybiBudWxsO1xyXG5cclxuICBjb25zdCBoID0gaGVhZGluZ3NbaWR4XTtcclxuICBjb25zdCBzdGFydCA9IGgucG9zaXRpb24uc3RhcnQubGluZTtcclxuICBsZXQgZW5kID0gbGluZXMubGVuZ3RoIC0gMTtcclxuICBmb3IgKGxldCBpID0gaWR4ICsgMTsgaSA8IGhlYWRpbmdzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBpZiAoaGVhZGluZ3NbaV0ubGV2ZWwgPD0gaC5sZXZlbCkge1xyXG4gICAgICBlbmQgPSBoZWFkaW5nc1tpXS5wb3NpdGlvbi5zdGFydC5saW5lIC0gMTtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiB7IHRpdGxlOiBoLmhlYWRpbmcsIGNvbnRlbnQ6IGxpbmVzLnNsaWNlKHN0YXJ0LCBNYXRoLm1heChlbmQsIHN0YXJ0KSArIDEpLmpvaW4oXCJcXG5cIikgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGlja0ZpZWxkKGZtOiBGcm9udE1hdHRlckNhY2hlIHwgdW5kZWZpbmVkLCBmaWVsZHM6IHN0cmluZ1tdKTogc3RyaW5nIHtcclxuICBpZiAoIWZtKSByZXR1cm4gXCJcIjtcclxuICBmb3IgKGNvbnN0IGYgb2YgZmllbGRzKSB7XHJcbiAgICBjb25zdCB2ID0gZm1bZl07XHJcbiAgICBpZiAodHlwZW9mIHYgPT09IFwic3RyaW5nXCIgJiYgdi50cmltKCkpIHJldHVybiB2LnRyaW0oKTtcclxuICAgIGlmICh0eXBlb2YgdiA9PT0gXCJudW1iZXJcIikgcmV0dXJuIFN0cmluZyh2KTtcclxuICB9XHJcbiAgcmV0dXJuIFwiXCI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNvbGxlY3RUYWdzKGFwcDogQXBwLCBmaWxlOiBURmlsZSk6IHN0cmluZ1tdIHtcclxuICBjb25zdCBmbSA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXI7XHJcbiAgY29uc3Qgb3V0OiBzdHJpbmdbXSA9IFtdO1xyXG4gIGNvbnN0IHB1c2ggPSAodjogdW5rbm93bikgPT4ge1xyXG4gICAgaWYgKHR5cGVvZiB2ID09PSBcInN0cmluZ1wiKSBvdXQucHVzaCh2LnJlcGxhY2UoL14jLywgXCJcIikpO1xyXG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2KSkgdi5mb3JFYWNoKHB1c2gpO1xyXG4gIH07XHJcbiAgcHVzaChmbT8udGFncyk7XHJcbiAgcHVzaChmbT8udGFnKTtcclxuICBpZiAoIW91dC5sZW5ndGgpIHtcclxuICAgIGNvbnN0IGNhY2hlVGFncyA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8udGFncyA/PyBbXTtcclxuICAgIGZvciAoY29uc3QgdCBvZiBjYWNoZVRhZ3MpIG91dC5wdXNoKHQudGFnLnJlcGxhY2UoL14jLywgXCJcIikpO1xyXG4gIH1cclxuICByZXR1cm4gQXJyYXkuZnJvbShuZXcgU2V0KG91dCkpLnNsaWNlKDAsIDYpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBleHRyYWN0Q292ZXIoYXBwOiBBcHAsIGZpbGU6IFRGaWxlLCBib2R5OiBzdHJpbmcsIGZpZWxkczogc3RyaW5nW10pOiBzdHJpbmcgfCBudWxsIHtcclxuICBjb25zdCBmbSA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXI7XHJcbiAgY29uc3QgZGVjbGFyZWQgPSBwaWNrRmllbGQoZm0sIGZpZWxkcyk7XHJcbiAgY29uc3QgY2FuZGlkYXRlcyA9IFtkZWNsYXJlZF07XHJcblxyXG4gIGlmICghZGVjbGFyZWQpIHtcclxuICAgIGNvbnN0IHdpa2lJbWcgPSBib2R5Lm1hdGNoKC8hXFxbXFxbKFteXFxdfF0rKS8pO1xyXG4gICAgaWYgKHdpa2lJbWcpIGNhbmRpZGF0ZXMucHVzaCh3aWtpSW1nWzFdKTtcclxuICAgIGNvbnN0IG1kSW1nID0gYm9keS5tYXRjaCgvIVxcW1teXFxdXSpcXF1cXCgoW14pXSspXFwpLyk7XHJcbiAgICBpZiAobWRJbWcpIGNhbmRpZGF0ZXMucHVzaChtZEltZ1sxXSk7XHJcbiAgfVxyXG5cclxuICBmb3IgKGNvbnN0IGMgb2YgY2FuZGlkYXRlcykge1xyXG4gICAgaWYgKCFjKSBjb250aW51ZTtcclxuICAgIGlmICgvXmh0dHBzPzpcXC9cXC8vaS50ZXN0KGMpKSByZXR1cm4gYztcclxuICAgIGNvbnN0IGYgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChjLnNwbGl0KFwifFwiKVswXS50cmltKCksIGZpbGUucGF0aCk7XHJcbiAgICBpZiAoZikgcmV0dXJuIGFwcC52YXVsdC5nZXRSZXNvdXJjZVBhdGgoZik7XHJcbiAgfVxyXG4gIHJldHVybiBudWxsO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUZpbGUoYXBwOiBBcHAsIHRhcmdldDogc3RyaW5nLCBzb3VyY2VQYXRoOiBzdHJpbmcpOiBURmlsZSB8IG51bGwge1xyXG4gIGNvbnN0IGNsZWFuID0gdGFyZ2V0LnNwbGl0KFwiI1wiKVswXS5zcGxpdChcInxcIilbMF0udHJpbSgpO1xyXG4gIGlmICghY2xlYW4pIHJldHVybiBudWxsO1xyXG4gIHJldHVybiBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChjbGVhbiwgc291cmNlUGF0aCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZvcm1hdERhdGUodjogdW5rbm93bik6IHN0cmluZyB7XHJcbiAgaWYgKCF2KSByZXR1cm4gXCJcIjtcclxuICBpZiAodHlwZW9mIHYgIT09IFwic3RyaW5nXCIpIHJldHVybiBcIlwiO1xyXG4gIHJldHVybiB2Lmxlbmd0aCA+IDEwID8gdi5zbGljZSgwLCAxMCkgOiB2O1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZE5vdGVNZXRhKFxyXG4gIGFwcDogQXBwLFxyXG4gIHRhcmdldDogc3RyaW5nLFxyXG4gIHNvdXJjZVBhdGg6IHN0cmluZyxcclxuICBzZXR0aW5nczoge1xyXG4gICAgc3VtbWFyeUZpZWxkczogc3RyaW5nW107XHJcbiAgICBjb3ZlckZpZWxkczogc3RyaW5nW107XHJcbiAgICBtZXRhRmllbGRzOiBzdHJpbmdbXTtcclxuICAgIHN1bW1hcnlMZW5ndGg6IG51bWJlcjtcclxuICB9LFxyXG4gIGFsaWFzPzogc3RyaW5nXHJcbik6IFByb21pc2U8Tm90ZU1ldGE+IHtcclxuICBjb25zdCBoYXNoSWR4ID0gdGFyZ2V0LmluZGV4T2YoXCIjXCIpO1xyXG4gIGNvbnN0IHBhdGhQYXJ0ID0gKGhhc2hJZHggPj0gMCA/IHRhcmdldC5zbGljZSgwLCBoYXNoSWR4KSA6IHRhcmdldCkuc3BsaXQoXCJ8XCIpWzBdLnRyaW0oKTtcclxuICBjb25zdCByZWYgPSBoYXNoSWR4ID49IDAgPyB0YXJnZXQuc2xpY2UoaGFzaElkeCArIDEpLnRyaW0oKSA6IFwiXCI7XHJcbiAgY29uc3QgZmlsZSA9IHJlc29sdmVGaWxlKGFwcCwgcGF0aFBhcnQsIHNvdXJjZVBhdGgpO1xyXG4gIGNvbnN0IGZhbGxiYWNrVGl0bGUgPSBhbGlhcyB8fCByZWYgfHwgcGF0aFBhcnQuc3BsaXQoXCIvXCIpLnBvcCgpIHx8IHRhcmdldDtcclxuXHJcbiAgaWYgKCFmaWxlKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBmaWxlOiBudWxsLFxyXG4gICAgICB0YXJnZXQsXHJcbiAgICAgIHJlZixcclxuICAgICAgdGl0bGU6IGZhbGxiYWNrVGl0bGUsXHJcbiAgICAgIHN1bW1hcnk6IFwiXCIsXHJcbiAgICAgIGNvdmVyOiBudWxsLFxyXG4gICAgICB0YWdzOiBbXSxcclxuICAgICAgYmFkZ2VzOiBbXSxcclxuICAgICAgdXBkYXRlZDogXCJcIixcclxuICAgICAgd29yZENvdW50OiAwLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIGNvbnN0IGtleSA9IGAke2ZpbGUucGF0aH0jJHtyZWZ9OiR7ZmlsZS5zdGF0Lm10aW1lfToke3NldHRpbmdzLnN1bW1hcnlMZW5ndGh9YDtcclxuICBjb25zdCBoaXQgPSBjYWNoZS5nZXQoa2V5KTtcclxuICBpZiAoaGl0KSByZXR1cm4gYWxpYXMgPyB7IC4uLmhpdCwgdGl0bGU6IGFsaWFzIH0gOiBoaXQ7XHJcblxyXG4gIGNvbnN0IHJhdyA9IGF3YWl0IGFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xyXG4gIGNvbnN0IGZpbGVDYWNoZSA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKSA/PyBudWxsO1xyXG4gIGNvbnN0IGZtID0gZmlsZUNhY2hlPy5mcm9udG1hdHRlcjtcclxuXHJcbiAgLy8gXHU2QkI1XHU4NDNEXHU3RUE3XHU1RjE1XHU3NTI4XHVGRjFBXHU1M0VBXHU1M0Q2XHU4QkU1XHU2QkI1XHU4NDNEXHVGRjBDXHU4MDBDXHU0RTBEXHU2NjJGXHU2NTc0XHU3QkM3XHJcbiAgY29uc3QgYmxvY2sgPSByZWYgPyBleHRyYWN0QmxvY2socmF3LCBmaWxlQ2FjaGUsIHJlZikgOiBudWxsO1xyXG4gIGNvbnN0IGNvbnRlbnRCb2R5ID0gYmxvY2s/LmNvbnRlbnQgPz8gc3RyaXBGcm9udG1hdHRlcihyYXcpO1xyXG5cclxuICBjb25zdCBtYW51YWwgPSBibG9jayA/IFwiXCIgOiBwaWNrRmllbGQoZm0sIHNldHRpbmdzLnN1bW1hcnlGaWVsZHMpO1xyXG4gIGNvbnN0IHBsYWluID0gdG9QbGFpblRleHQoY29udGVudEJvZHkpO1xyXG4gIGNvbnN0IHN1bW1hcnkgPVxyXG4gICAgbWFudWFsIHx8XHJcbiAgICBwbGFpbi5zbGljZSgwLCBzZXR0aW5ncy5zdW1tYXJ5TGVuZ3RoKSArIChwbGFpbi5sZW5ndGggPiBzZXR0aW5ncy5zdW1tYXJ5TGVuZ3RoID8gXCJcdTIwMjZcIiA6IFwiXCIpO1xyXG5cclxuICBjb25zdCBiYWRnZXM6IE5vdGVCYWRnZVtdID0gW107XHJcbiAgaWYgKCFibG9jaykge1xyXG4gICAgZm9yIChjb25zdCBrZXkgb2Ygc2V0dGluZ3MubWV0YUZpZWxkcykge1xyXG4gICAgICBjb25zdCB2ID0gZm0/LltrZXldO1xyXG4gICAgICBpZiAodiA9PT0gdW5kZWZpbmVkIHx8IHYgPT09IG51bGwpIGNvbnRpbnVlO1xyXG4gICAgICBjb25zdCB0ZXh0ID0gQXJyYXkuaXNBcnJheSh2KSA/IHYuam9pbihcIi9cIikgOiBTdHJpbmcodik7XHJcbiAgICAgIGlmICh0ZXh0LnRyaW0oKSkgYmFkZ2VzLnB1c2goeyBrZXksIHZhbHVlOiB0ZXh0LnRyaW0oKSB9KTtcclxuICAgIH1cclxuICB9IGVsc2Uge1xyXG4gICAgLy8gXHU2QkI1XHU4NDNEXHU1MzYxXHU3MjQ3XHU1M0VBXHU2ODA3XHU2NzY1XHU2RTkwXHU2NTg3XHU2ODYzXHU3QzdCXHU1NzhCXHVGRjBDXHU5MDdGXHU1MTREXHU1NDhDXHU2NTc0XHU3QkM3XHU2REY3XHU2REM2XHJcbiAgICBjb25zdCB0ID0gZm0/LnR5cGU7XHJcbiAgICBpZiAodHlwZW9mIHQgPT09IFwic3RyaW5nXCIgJiYgdC50cmltKCkpIGJhZGdlcy5wdXNoKHsga2V5OiBcInR5cGVcIiwgdmFsdWU6IHQudHJpbSgpIH0pO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgdGl0bGUgPVxyXG4gICAgYWxpYXMgfHwgKGJsb2NrID8gYmxvY2sudGl0bGUgOiBcIlwiKSB8fCBTdHJpbmcoZm0/LnRpdGxlIHx8IGZpbGUuYmFzZW5hbWUpO1xyXG5cclxuICBjb25zdCBtZXRhOiBOb3RlTWV0YSA9IHtcclxuICAgIGZpbGUsXHJcbiAgICB0YXJnZXQsXHJcbiAgICByZWYsXHJcbiAgICB0aXRsZSxcclxuICAgIHN1bW1hcnksXHJcbiAgICBjb3ZlcjogZXh0cmFjdENvdmVyKGFwcCwgZmlsZSwgY29udGVudEJvZHksIHNldHRpbmdzLmNvdmVyRmllbGRzKSxcclxuICAgIHRhZ3M6IGJsb2NrID8gW10gOiBjb2xsZWN0VGFncyhhcHAsIGZpbGUpLFxyXG4gICAgYmFkZ2VzLFxyXG4gICAgdXBkYXRlZDogYmxvY2sgPyBcIlwiIDogZm9ybWF0RGF0ZShmbT8udXBkYXRlZCkgfHwgZm9ybWF0RGF0ZShmbT8ubW9kaWZpZWQpIHx8IGZvcm1hdERhdGUoZm0/LmNyZWF0ZWQpLFxyXG4gICAgd29yZENvdW50OiBwbGFpbi5sZW5ndGgsXHJcbiAgICBibG9ja0NvbnRlbnQ6IGJsb2NrPy5jb250ZW50LFxyXG4gIH07XHJcblxyXG4gIGNhY2hlLnNldChrZXksIG1ldGEpO1xyXG4gIGlmIChjYWNoZS5zaXplID4gNTAwKSBjYWNoZS5jbGVhcigpO1xyXG4gIHJldHVybiBtZXRhO1xyXG59XHJcblxyXG4vKiogXHU1MTdDXHU1QkI5XHU2NUIwXHU2NUU3XHU3MjQ4XHU2NzJDIE9ic2lkaWFuIFx1NzY4NCBtYXJrZG93biBcdTZFMzJcdTY3RDNcdTUxNjVcdTUzRTMgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlck1hcmtkb3duKFxyXG4gIGFwcDogQXBwLFxyXG4gIG1hcmtkb3duOiBzdHJpbmcsXHJcbiAgZWw6IEhUTUxFbGVtZW50LFxyXG4gIHNvdXJjZVBhdGg6IHN0cmluZyxcclxuICBjb21wb25lbnQ6IENvbXBvbmVudFxyXG4pOiB2b2lkIHtcclxuICBjb25zdCBtZCA9IE1hcmtkb3duUmVuZGVyZXIgYXMgdW5rbm93biBhcyB7XHJcbiAgICByZW5kZXI/OiAoYTogQXBwLCBtOiBzdHJpbmcsIGU6IEhUTUxFbGVtZW50LCBwOiBzdHJpbmcsIGM6IENvbXBvbmVudCkgPT4gdm9pZDtcclxuICAgIHJlbmRlck1hcmtkb3duPzogKG06IHN0cmluZywgZTogSFRNTEVsZW1lbnQsIHA6IHN0cmluZywgYzogQ29tcG9uZW50KSA9PiB2b2lkO1xyXG4gIH07XHJcbiAgLy8gXHU1RkM1XHU5ODdCXHU0RjE4XHU1MTQ4XHU3NTI4IHJlbmRlcigpXHVGRjFBcmVuZGVyTWFya2Rvd24oKSBcdTY2MkZcdTdCODBcdTUzMTZcdTcyNDhcdUZGMENcdTRFMERcdTRGMUFcdTYyOEFcdTcyRUNcdTUzNjBcdTRFMDBcdTg4NENcdTc2ODQgIVtbIF1dXHJcbiAgLy8gXHU1OTA0XHU3NDA2XHU2MjEwXHU1NzU3XHU3RUE3XHU1RDRDXHU1MTY1XHVGRjBDXHU1M0VBXHU3NTU5XHU0RTBCXHU0RTAwXHU0RTJBIDxzcGFuIGNsYXNzPVwiaW50ZXJuYWwtZW1iZWRcIj4gXHU1MzYwXHU0RjREXHU3QjI2XHVGRjBDXHJcbiAgLy8gXHU1QkZDXHU4MUY0XHU1MzYxXHU3MjQ3XHU2QjYzXHU2NTg3XHU5MUNDXHU3Njg0XHU1RDRDXHU1OTU3XHU1RDRDXHU1MTY1XHU2QzM4XHU4RkRDXHU2NUUwXHU2Q0Q1XHU4OEFCXHU2M0E1XHU3QkExXHU2MjEwXHU1MzYxXHU3MjQ3XHUzMDAyXHJcbiAgaWYgKHR5cGVvZiBtZC5yZW5kZXIgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgbWQucmVuZGVyKGFwcCwgbWFya2Rvd24sIGVsLCBzb3VyY2VQYXRoLCBjb21wb25lbnQpO1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIG1kLnJlbmRlck1hcmtkb3duID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgIG1kLnJlbmRlck1hcmtkb3duKG1hcmtkb3duLCBlbCwgc291cmNlUGF0aCwgY29tcG9uZW50KTtcclxuICB9IGVsc2Uge1xyXG4gICAgZWwuc2V0VGV4dChtYXJrZG93bik7XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgQXRvbWljQ2FyZHNQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xyXG5pbXBvcnQgeyBMYXlvdXQsIFNpemUgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5pbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBBdG9taWNDYXJkc1NldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcclxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IEF0b21pY0NhcmRzUGx1Z2luKSB7XHJcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XHJcbiAgfVxyXG5cclxuICBkaXNwbGF5KCk6IHZvaWQge1xyXG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcclxuICAgIGNvbnN0IHMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncztcclxuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJcdTg4NENcdTRFM0FcIikuc2V0SGVhZGluZygpO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NjNBNVx1N0JBMVx1NTM5Rlx1NzUxRlx1NUQ0Q1x1NTE2NSAhW1sgXV1cIilcclxuICAgICAgLnNldERlc2MoXCJcdTYyOEFcdTcyRUNcdTUzNjBcdTRFMDBcdTg4NENcdTc2ODQgIVtbXHU3QjE0XHU4QkIwXV0gXHU1RDRDXHU1MTY1XHU2RTMyXHU2N0QzXHU2MjEwXHU1M0VGXHU2Mjk4XHU1M0UwXHU1MzYxXHU3MjQ3XHVGRjFCXHU1MTczXHU5NUVEXHU1NDBFXHU2M0QyXHU0RUY2XHU1QjhDXHU1MTY4XHU0RTBEXHU0RUNCXHU1MTY1XHVGRjBDXHU1RDRDXHU1MTY1XHU0RkREXHU2MzAxIE9ic2lkaWFuIFx1OUVEOFx1OEJBNFx1NjgzN1x1NUYwRlwiKVxyXG4gICAgICAuYWRkVG9nZ2xlKCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUocy51cGdyYWRlRW1iZWRzKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgcy51cGdyYWRlRW1iZWRzID0gdjtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU2MkQ2XHU1MTY1XHU3QjE0XHU4QkIwXHU2NUY2XHU2M0QyXHU1MTY1XHU1RDRDXHU1MTY1ICFbWyBdXVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1NEVDRVx1NjU4N1x1NEVGNlx1NTIxN1x1ODg2OFx1NjI4QVx1N0IxNFx1OEJCMFx1NjJENlx1OEZEQlx1N0YxNlx1OEY5MVx1NTY2OFx1NjVGNlx1NjNEMlx1NTE2NSAhW1sgXV1cdUZGMDhcdTRGMUFcdTZFMzJcdTY3RDNcdTYyMTBcdTUzNjFcdTcyNDdcdUZGMDlcdUZGMUJcdTUxNzNcdTk1RURcdTUyMTlcdTRGRERcdTYzMDEgT2JzaWRpYW4gXHU5RUQ4XHU4QkE0XHU3Njg0IFtbIF1dIFx1OTRGRVx1NjNBNVwiKVxyXG4gICAgICAuYWRkVG9nZ2xlKCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUocy5lbWJlZE9uRHJvcCkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMuZW1iZWRPbkRyb3AgPSB2O1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1NUUwM1x1NUM0MFwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1MzYxXHU3MjQ3XHU2NzAwXHU1OTI3XHU5QUQ4XHU1RUE2IChweClcIilcclxuICAgICAgLnNldERlc2MoXCIwID0gXHU0RTBEXHU5NjUwXHU1MjM2XHVGRjFCXHU4RDg1XHU4RkM3XHU1NDBFXHU1MzYxXHU3MjQ3XHU1MTg1XHU5MEU4XHU2RURBXHU1MkE4XCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKHMuY2FyZEhlaWdodCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLmNhcmRIZWlnaHQgPSBOdW1iZXIodikgfHwgMDtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1MzYxXHU3MjQ3XHU1RTAzXHU1QzQwXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU1MzA1XHU4OEY5XHU1MzYxXHU3MjQ3ID0gXHU2QTJBXHU1NDExXHU2MjQxXHU1RTczXHU3Njg0XHU1QkI5XHU1NjY4XHVGRjFCXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDID0gXHU0RjIwXHU3RURGXHU1MzYxXHU3MjQ3XHU1ODk5XHVGRjA4XHU5ODc2XHU5MEU4XHU1OTI3XHU1QzAxXHU5NzYyXHVGRjA5XCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZCkgPT5cclxuICAgICAgICBkXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwid3JhcFwiLCBcIlx1NTMwNVx1ODhGOVx1NTM2MVx1NzI0N1x1RkYwOFx1NkEyQVx1NTQxMVx1RkYwOVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImNhcmRcIiwgXCJcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNENcdUZGMDhcdTk4NzZcdTkwRThcdTVDMDFcdTk3NjJcdUZGMDlcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZShzLmxheW91dClcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICBzLmxheW91dCA9IHYgYXMgTGF5b3V0O1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1RDRDXHU1OTU3XHU1MzYxXHU3MjQ3XHU3Njg0XHU1QzNBXHU1QkY4XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU1MzYxXHU3MjQ3XHU5MUNDXHU1MThEXHU1OTU3XHU3Njg0XHU1RDRDXHU1MTY1XHU5RUQ4XHU4QkE0XHU3NTI4XHU0RUMwXHU0RTQ4XHU1QzNBXHU1QkY4XCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZCkgPT5cclxuICAgICAgICBkXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwic21hbGxcIiwgXCJcdTc3RTVcdThCQzZcdTcwQjlcdTVDMEZcdTUzNjFcdTcyNDdcdUZGMDhcdTRFMDBcdTg4NENcdTU5MUFcdTRFMkFcdUZGMDlcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJub3JtYWxcIiwgXCJcdTVFMzhcdTg5QzRcdTUzNjFcdTcyNDdcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZShzLm5lc3RlZFNpemUpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgICAgcy5uZXN0ZWRTaXplID0gdiBhcyBTaXplO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU1QkM2XHU1RUE2XCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZCkgPT5cclxuICAgICAgICBkXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiY29tZm9ydGFibGVcIiwgXCJcdTVCQkRcdTY3N0VcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJjb21wYWN0XCIsIFwiXHU3RDI3XHU1MUQxXCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUocy5kZW5zaXR5KVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICAgIHMuZGVuc2l0eSA9IHYgYXMgXCJjb21wYWN0XCIgfCBcImNvbWZvcnRhYmxlXCI7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1NTM2MVx1NzI0N1x1NTE4NVx1NUJCOVwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU2NDU4XHU4OTgxXHU5NTdGXHU1RUE2XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU4MUVBXHU1MkE4XHU2NDU4XHU4OTgxXHU2MjJBXHU1M0Q2XHU3Njg0XHU1QjU3XHU3QjI2XHU2NTcwXHVGRjA4ZnJvbnRtYXR0ZXIgXHU2NzA5IHN1bW1hcnkvZGVzY3JpcHRpb24gXHU2NUY2XHU0RjE4XHU1MTQ4XHU3NTI4XHVGRjA5XCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKHMuc3VtbWFyeUxlbmd0aCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLnN1bW1hcnlMZW5ndGggPSBOdW1iZXIodikgfHwgMTgwO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBjb25zdCB0b2dnbGUgPSAobmFtZTogc3RyaW5nLCBkZXNjOiBzdHJpbmcsIGdldDogKCkgPT4gYm9vbGVhbiwgc2V0OiAodjogYm9vbGVhbikgPT4gdm9pZCkgPT5cclxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUobmFtZSkuc2V0RGVzYyhkZXNjKS5hZGRUb2dnbGUoKHQpID0+XHJcbiAgICAgICAgdC5zZXRWYWx1ZShnZXQoKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHNldCh2KTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgdG9nZ2xlKFwiXHU2NjNFXHU3OTNBXHU1QzAxXHU5NzYyXCIsIFwiXHU4QkZCXHU1M0Q2IGZyb250bWF0dGVyIFx1NzY4NCBjb3Zlci9pbWFnZS9iYW5uZXIgXHU2MjE2XHU2QjYzXHU2NTg3XHU3QjJDXHU0RTAwXHU1RjIwXHU1NkZFXCIsICgpID0+IHMuc2hvd0NvdmVyLCAodikgPT4gKHMuc2hvd0NvdmVyID0gdikpO1xyXG4gICAgdG9nZ2xlKFwiXHU2NjNFXHU3OTNBXHU1MTQzXHU0RkUxXHU2MDZGXCIsIFwidHlwZSAvIHN0YXR1cyAvIGRvbWFpbiAvIFx1NjZGNFx1NjVCMFx1NjVGNlx1OTVGNCAvIFx1NUI1N1x1NjU3MFwiLCAoKSA9PiBzLnNob3dNZXRhLCAodikgPT4gKHMuc2hvd01ldGEgPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTY2M0VcdTc5M0FcdTY4MDdcdTdCN0VcIiwgXCJcIiwgKCkgPT4gcy5zaG93VGFncywgKHYpID0+IChzLnNob3dUYWdzID0gdikpO1xyXG4gICAgdG9nZ2xlKFwiXHU2NjNFXHU3OTNBXHUzMDBDXHU2MjUzXHU1RjAwXHUzMDBEXHU2MzA5XHU5NEFFXCIsIFwiXCIsICgpID0+IHMuc2hvd09wZW5CdXR0b24sICh2KSA9PiAocy5zaG93T3BlbkJ1dHRvbiA9IHYpKTtcclxuICAgIHRvZ2dsZShcIlx1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMFx1NkI2M1x1NjU4N1wiLCBcIlx1NjI1M1x1NUYwMFx1NjU4N1x1Njg2M1x1NjVGNlx1NTM2MVx1NzI0N1x1NzZGNFx1NjNBNVx1NjYzRVx1NzkzQVx1NUI4Q1x1NjU3NFx1NTE4NVx1NUJCOVx1RkYwQ1x1NzBCOVx1NjgwN1x1OTg5OFx1NTNFRlx1NjI5OFx1NTNFMFwiLCAoKSA9PiBzLmRlZmF1bHRFeHBhbmRlZCwgKHYpID0+IChzLmRlZmF1bHRFeHBhbmRlZCA9IHYpKTtcclxuICAgIHRvZ2dsZShcclxuICAgICAgXCJcdTVENENcdTU5NTdcdTUzNjFcdTcyNDdcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDBcIixcclxuICAgICAgXCJcdTUzNjFcdTcyNDdcdTkxQ0NcdTUxOERcdTU5NTdcdTc2ODRcdTUzNjFcdTcyNDdcdTU4OTlcdTY2MkZcdTU0MjZcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDBcdUZGMUJcdTUxNzNcdTk1RURcdTY1RjZcdTUzRUFcdTY2M0VcdTc5M0FcdTY4MDdcdTk4OThcdTU0OENcdTY0NThcdTg5ODFcIixcclxuICAgICAgKCkgPT4gcy5uZXN0ZWRFeHBhbmRlZCxcclxuICAgICAgKHYpID0+IChzLm5lc3RlZEV4cGFuZGVkID0gdilcclxuICAgICk7XHJcbiAgICB0b2dnbGUoXHJcbiAgICAgIFwiXHU4QkU2XHU3RUM2XHU2NUU1XHU1RkQ3XCIsXHJcbiAgICAgIFwiXHU1NzI4XHU1RjAwXHU1M0QxXHU4MDA1XHU2M0E3XHU1MjM2XHU1M0YwXHVGRjA4Q3RybCtTaGlmdCtJXHVGRjA5XHU4RjkzXHU1MUZBXHU4RkQwXHU4ODRDXHU2NUU1XHU1RkQ3XHVGRjBDXHU2MzkyXHU2N0U1XHU3NTI4XHVGRjFCXHU1RTczXHU2NUY2XHU1M0VGXHU1MTczXCIsXHJcbiAgICAgICgpID0+IHMudmVyYm9zZSxcclxuICAgICAgKHYpID0+IChzLnZlcmJvc2UgPSB2KVxyXG4gICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTY3MDBcdTU5MjdcdTVENENcdTU5NTdcdTZERjFcdTVFQTZcIilcclxuICAgICAgLnNldERlc2MoXCJcdTUzNjFcdTcyNDdcdTkxQ0NcdTUxOERcdTY1M0UgY2FyZHMgXHU1NzU3XHU2NUY2XHU3Njg0XHU5MDEyXHU1RjUyXHU1QzQyXHU2NTcwXHU0RTBBXHU5NjUwXHVGRjBDXHU5NjMyXHU2QjYyXHU1RkFBXHU3M0FGXHU1RjE1XHU3NTI4XHU1MzYxXHU2QjdCXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoU3RyaW5nKHMubWF4TmVzdERlcHRoKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMubWF4TmVzdERlcHRoID0gTWF0aC5tYXgoMSwgTnVtYmVyKHYpIHx8IDMpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlx1NUI1N1x1NkJCNVx1NjYyMFx1NUMwNFwiKS5zZXRIZWFkaW5nKCk7XHJcblxyXG4gICAgY29uc3QgbGlzdEZpZWxkID0gKG5hbWU6IHN0cmluZywgZGVzYzogc3RyaW5nLCBnZXQ6ICgpID0+IHN0cmluZ1tdLCBzZXQ6ICh2OiBzdHJpbmdbXSkgPT4gdm9pZCkgPT5cclxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUobmFtZSlcclxuICAgICAgICAuc2V0RGVzYyhkZXNjKVxyXG4gICAgICAgIC5hZGRUZXh0KCh0KSA9PlxyXG4gICAgICAgICAgdFxyXG4gICAgICAgICAgICAuc2V0VmFsdWUoZ2V0KCkuam9pbihcIiwgXCIpKVxyXG4gICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJhLCBiLCBjXCIpXHJcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICAgIHNldChcclxuICAgICAgICAgICAgICAgIHZcclxuICAgICAgICAgICAgICAgICAgLnNwbGl0KFwiLFwiKVxyXG4gICAgICAgICAgICAgICAgICAubWFwKCh4KSA9PiB4LnRyaW0oKSlcclxuICAgICAgICAgICAgICAgICAgLmZpbHRlcihCb29sZWFuKVxyXG4gICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICBsaXN0RmllbGQoXCJcdTY0NThcdTg5ODFcdTVCNTdcdTZCQjVcIiwgXCJcdTYzMDlcdTk4N0FcdTVFOEZcdTVDMURcdThCRDVcdThCRkJcdTUzRDZcdTc2ODQgZnJvbnRtYXR0ZXIgXHU1QjU3XHU2QkI1XCIsICgpID0+IHMuc3VtbWFyeUZpZWxkcywgKHYpID0+IChzLnN1bW1hcnlGaWVsZHMgPSB2KSk7XHJcbiAgICBsaXN0RmllbGQoXCJcdTVDMDFcdTk3NjJcdTVCNTdcdTZCQjVcIiwgXCJcIiwgKCkgPT4gcy5jb3ZlckZpZWxkcywgKHYpID0+IChzLmNvdmVyRmllbGRzID0gdikpO1xyXG4gICAgbGlzdEZpZWxkKFwiXHU1MTQzXHU0RkUxXHU2MDZGXHU1QjU3XHU2QkI1XCIsIFwiXHU0RjFBXHU0RUU1XHU1RkJEXHU3QUUwXHU1RjYyXHU1RjBGXHU2NjNFXHU3OTNBXHU1NzI4XHU1MzYxXHU3MjQ3XHU0RTBBXCIsICgpID0+IHMubWV0YUZpZWxkcywgKHYpID0+IChzLm1ldGFGaWVsZHMgPSB2KSk7XHJcbiAgfVxyXG59XHJcbiIsICJleHBvcnQgdHlwZSBEZW5zaXR5ID0gXCJjb21wYWN0XCIgfCBcImNvbWZvcnRhYmxlXCI7XHJcbi8qKiB3cmFwID0gXHU2MjQxXHU1RTczXHU1MzA1XHU4OEY5XHU1MzYxXHU3MjQ3XHVGRjA4XHU2QTJBXHU1NDExXHVGRjA5XHVGRjFCY2FyZCA9IFx1NEYyMFx1N0VERlx1N0FENlx1NzI0OFx1NTM2MVx1NzI0Q1x1RkYwOFx1OTg3Nlx1OTBFOFx1NUMwMVx1OTc2Mlx1RkYwOSAqL1xyXG5leHBvcnQgdHlwZSBMYXlvdXQgPSBcIndyYXBcIiB8IFwiY2FyZFwiO1xyXG4vKiogbm9ybWFsID0gXHU1RTM4XHU4OUM0XHU2NTg3XHU2ODYzXHU1MzYxXHU3MjQ3XHVGRjFCc21hbGwgPSBcdTc3RTVcdThCQzZcdTcwQjkgLyBcdTZCQjVcdTg0M0RcdTdFQTdcdTVDMEZcdTUzNjFcdTcyNDcgKi9cclxuZXhwb3J0IHR5cGUgU2l6ZSA9IFwibm9ybWFsXCIgfCBcInNtYWxsXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEF0b21pY0NhcmRzU2V0dGluZ3Mge1xyXG4gIC8qKiBcdTYyOEEgT2JzaWRpYW4gXHU1MzlGXHU3NTFGICFbWyBdXSBcdTU3NTdcdTdFQTdcdTVENENcdTUxNjVcdTZFMzJcdTY3RDNcdTYyMTBcdTUzNjFcdTcyNDdcdUZGMDhcdTUxNzNcdTk1RURcdTUyMTlcdTVCOENcdTUxNjhcdTRFMERcdTRFQ0JcdTUxNjVcdUZGMDkgKi9cclxuICB1cGdyYWRlRW1iZWRzOiBib29sZWFuO1xyXG4gIC8qKiBcdTRFQ0VcdTY1ODdcdTRFRjZcdTUyMTdcdTg4NjhcdTYyRDZcdTdCMTRcdThCQjBcdTUyMzBcdTdGMTZcdThGOTFcdTU2NjhcdTY1RjZcdTYzRDJcdTUxNjUgIVtbIF1dIFx1NUQ0Q1x1NTE2NVx1RkYwQ1x1ODAwQ1x1NEUwRFx1NjYyRlx1OUVEOFx1OEJBNFx1NzY4NCBbWyBdXSBcdTk0RkVcdTYzQTUgKi9cclxuICBlbWJlZE9uRHJvcDogYm9vbGVhbjtcclxuICBsYXlvdXQ6IExheW91dDtcclxuICAvKiogXHU1RDRDXHU1OTU3XHU1NzI4XHU1OTI3XHU1MzYxXHU3MjQ3XHU5MUNDXHU3Njg0XHU1MzYxXHU3MjQ3XHU5RUQ4XHU4QkE0XHU1QzNBXHU1QkY4ICovXHJcbiAgbmVzdGVkU2l6ZTogU2l6ZTtcclxuICBjYXJkSGVpZ2h0OiBudW1iZXI7XHJcbiAgc3VtbWFyeUxlbmd0aDogbnVtYmVyO1xyXG4gIHNob3dDb3ZlcjogYm9vbGVhbjtcclxuICBzaG93TWV0YTogYm9vbGVhbjtcclxuICBzaG93VGFnczogYm9vbGVhbjtcclxuICBzaG93T3BlbkJ1dHRvbjogYm9vbGVhbjtcclxuICAvKiogXHU1MzYxXHU3MjQ3XHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXHU2QjYzXHU2NTg3ICovXHJcbiAgZGVmYXVsdEV4cGFuZGVkOiBib29sZWFuO1xyXG4gIC8qKiBcdTVENENcdTU3MjhcdTUzNjFcdTcyNDdcdTkxQ0NcdTc2ODRcdTVENENcdTUxNjVcdTY2MkZcdTU0MjZcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDAgKi9cclxuICBuZXN0ZWRFeHBhbmRlZDogYm9vbGVhbjtcclxuICBtYXhOZXN0RGVwdGg6IG51bWJlcjtcclxuICBkZW5zaXR5OiBEZW5zaXR5O1xyXG4gIHN1bW1hcnlGaWVsZHM6IHN0cmluZ1tdO1xyXG4gIGNvdmVyRmllbGRzOiBzdHJpbmdbXTtcclxuICBtZXRhRmllbGRzOiBzdHJpbmdbXTtcclxuICB2ZXJib3NlOiBib29sZWFuO1xyXG4gIC8qKiBcdTVFMDNcdTVDNDBcdTlFRDhcdThCQTRcdTUwM0NcdTUzRDhcdTUzMTZcdTY1RjZcdTc1MjhcdTY3NjVcdThGQzFcdTc5RkJcdTY1RTdcdThCQkVcdTdGNkUgKi9cclxuICBzZXR0aW5nc1ZlcnNpb24/OiBudW1iZXI7XHJcbn1cclxuXHJcbi8qKiBcdTVFMDNcdTVDNDBcdTc2RjhcdTUxNzNcdTlFRDhcdThCQTRcdTUwM0NcdTUzRDhcdTY2RjRcdTY1RjYgKzFcdUZGMENcdTY1RTdcdThCQkVcdTdGNkVcdTRGMUFcdTg4QUJcdTY1QjBcdTlFRDhcdThCQTRcdTUwM0NcdTg5ODZcdTc2RDYgKi9cclxuZXhwb3J0IGNvbnN0IFNFVFRJTkdTX1ZFUlNJT04gPSAzO1xyXG5cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEF0b21pY0NhcmRzU2V0dGluZ3MgPSB7XHJcbiAgdXBncmFkZUVtYmVkczogdHJ1ZSxcclxuICBlbWJlZE9uRHJvcDogdHJ1ZSxcclxuICBsYXlvdXQ6IFwid3JhcFwiLFxyXG4gIG5lc3RlZFNpemU6IFwibm9ybWFsXCIsXHJcbiAgY2FyZEhlaWdodDogMCxcclxuICBzdW1tYXJ5TGVuZ3RoOiAxODAsXHJcbiAgc2hvd0NvdmVyOiB0cnVlLFxyXG4gIHNob3dNZXRhOiB0cnVlLFxyXG4gIHNob3dUYWdzOiB0cnVlLFxyXG4gIHNob3dPcGVuQnV0dG9uOiB0cnVlLFxyXG4gIGRlZmF1bHRFeHBhbmRlZDogdHJ1ZSxcclxuICBuZXN0ZWRFeHBhbmRlZDogdHJ1ZSxcclxuICBtYXhOZXN0RGVwdGg6IDMsXHJcbiAgZGVuc2l0eTogXCJjb21mb3J0YWJsZVwiLFxyXG4gIHN1bW1hcnlGaWVsZHM6IFtcInN1bW1hcnlcIiwgXCJkZXNjcmlwdGlvblwiLCBcImFic3RyYWN0XCIsIFwiZXhjZXJwdFwiLCBcIlx1N0I4MFx1NEVDQlwiLCBcIlx1NjQ1OFx1ODk4MVwiXSxcclxuICBjb3ZlckZpZWxkczogW1wiY292ZXJcIiwgXCJpbWFnZVwiLCBcImJhbm5lclwiLCBcInRodW1ibmFpbFwiLCBcImltZ1wiLCBcIlx1NUMwMVx1OTc2MlwiXSxcclxuICBtZXRhRmllbGRzOiBbXCJ0eXBlXCIsIFwic3RhdHVzXCIsIFwiZG9tYWluXCIsIFwiY29tcGxleGl0eVwiXSxcclxuICB2ZXJib3NlOiBmYWxzZSxcclxufTtcclxuXHJcbi8qKiBcdTZFMzJcdTY3RDNcdTUzNTVcdTVGMjBcdTUzNjFcdTcyNDdcdTYyNDBcdTk3MDBcdTkwMDlcdTk4NzlcdUZGMENcdTUxNjhcdTkwRThcdTY3NjVcdTgxRUFcdTYzRDJcdTRFRjZcdThCQkVcdTdGNkVcdUZGMDhcdTZDQTFcdTY3MDlcdTU3NTdcdTUxODVcdTkwMDlcdTk4NzlcdTRFODZcdUZGMDkgKi9cclxuZXhwb3J0IGludGVyZmFjZSBSZW5kZXJPcHRpb25zIHtcclxuICBzaXplOiBTaXplO1xyXG4gIGRlbnNpdHk6IERlbnNpdHk7XHJcbiAgbGF5b3V0OiBMYXlvdXQ7XHJcbiAgY292ZXI6IGJvb2xlYW47XHJcbiAgbWV0YTogYm9vbGVhbjtcclxuICB0YWdzOiBib29sZWFuO1xyXG4gIG9wZW46IGJvb2xlYW47XHJcbiAgZXhwYW5kZWQ6IGJvb2xlYW47XHJcbiAgLyoqIFx1NTM2MVx1NzI0N1x1NjcwMFx1NTkyN1x1OUFEOFx1NUVBNlx1RkYwQzAgPSBcdTRFMERcdTk2NTBcdTUyMzYgKi9cclxuICBoZWlnaHQ6IG51bWJlcjtcclxuICAvKiogXHU4MUVBXHU1MkE4XHU2NDU4XHU4OTgxXHU1QjU3XHU3QjI2XHU2NTcwICovXHJcbiAgc3VtbWFyeTogbnVtYmVyO1xyXG59XHJcblxyXG4vKiogXHU5NzVFXHU3QjE0XHU4QkIwXHU3Njg0XHU1RDRDXHU1MTY1XHVGRjA4XHU1NkZFXHU3MjQ3IC8gXHU5N0YzXHU4OUM2XHU5ODkxIC8gUERGIC8gXHU3NTNCXHU1RTAzXHU3QjQ5XHVGRjA5XHU0RTBEXHU1MDVBXHU1MzYxXHU3MjQ3XHU1MzE2ICovXHJcbmV4cG9ydCBjb25zdCBTS0lQX0VNQkVEX0VYVCA9XHJcbiAgL1xcLihwbmd8anBlP2d8Z2lmfHdlYnB8c3ZnfGJtcHxpY298YXZpZnxtcDN8d2F2fG9nZ3xmbGFjfG00YXxtcDR8d2VibXxtb3Z8cGRmfGNhbnZhc3xleGNhbGlkcmF3KSQvaTtcclxuIl0sCiAg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QixVQUFJLEtBQUssQ0FBQyxNQUFNLFNBQVMsQ0FBQyxFQUFHLE9BQU0sS0FBSyxDQUFDO0FBQUEsSUFDM0M7QUFDQSxRQUFJLENBQUMsTUFBTSxRQUFRO0FBQ2pCLFVBQUksd0JBQU8saURBQWM7QUFDekI7QUFBQSxJQUNGO0FBQ0EsV0FBTyxpQkFBaUIsTUFBTSxJQUFJLENBQUMsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxDQUFDO0FBQ2xFLFFBQUksd0JBQU8sc0JBQU8sTUFBTSxNQUFNLHFCQUFNO0FBQUEsRUFDdEM7QUFBQTtBQUFBLEVBR1Esb0JBQW9CLFFBQXNCO0FBQ2hELFVBQU0sT0FBTyxLQUFLLElBQUksVUFBVSxjQUFjO0FBQzlDLFFBQUksQ0FBQyxNQUFNO0FBQ1QsVUFBSSx3QkFBTyx3REFBVztBQUN0QjtBQUFBLElBQ0Y7QUFDQSxVQUFNLFFBQVEsS0FBSyxJQUFJLGNBQWM7QUFDckMsVUFBTSxPQUFPLE9BQU8sS0FBSyxLQUFLLEVBQUUsT0FBTyxDQUFDLFFBQUs7QUEvYWpEO0FBK2FvRCx5QkFBTSxHQUFHLE1BQVQsbUJBQWEsS0FBSztBQUFBLEtBQUs7QUFDdkUsUUFBSSxDQUFDLEtBQUssUUFBUTtBQUNoQixVQUFJLHdCQUFPLGtEQUFVO0FBQ3JCO0FBQUEsSUFDRjtBQUNBLFVBQU0sT0FBTztBQUFBO0FBQUEsRUFBWSxLQUN0QixJQUFJLENBQUMsTUFBTSxRQUFRLEVBQUUsUUFBUSxVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQzlDLEtBQUssSUFBSSxDQUFDO0FBQUE7QUFDYixXQUFPLGFBQWEsTUFBTSxPQUFPLFVBQVUsQ0FBQztBQUM1QyxRQUFJLHdCQUFPLHNCQUFPLEtBQUssTUFBTSxxQkFBTTtBQUFBLEVBQ3JDO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaCIsICJrZXkiLCAiX2EiLCAiX2IiLCAiX2MiLCAiX2QiLCAiaW1wb3J0X29ic2lkaWFuIl0KfQo=
