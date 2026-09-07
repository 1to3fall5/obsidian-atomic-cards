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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy9tYWluLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvY2FyZC50cyIsICIuLi8uLi8uLi8ucGx1Z2lucy9hdG9taWMtY2FyZHMvc3JjL21ldGFkYXRhLnRzIiwgIi4uLy4uLy4uLy5wbHVnaW5zL2F0b21pYy1jYXJkcy9zcmMvc2V0dGluZ3MudHMiLCAiLi4vLi4vLi4vLnBsdWdpbnMvYXRvbWljLWNhcmRzL3NyYy90eXBlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcclxuICBFZGl0b3IsXHJcbiAgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcclxuICBNYXJrZG93blJlbmRlckNoaWxkLFxyXG4gIE1hcmtkb3duVmlldyxcclxuICBOb3RpY2UsXHJcbiAgUGx1Z2luLFxyXG4gIFRGaWxlLFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyByZW5kZXJDYXJkLCBnZXROZXN0LCB3aXRoTmVzdCwgUmVvcmRlclJlcXVlc3QsIGlzQ2FyZFJlb3JkZXJEcmFnIH0gZnJvbSBcIi4vY2FyZFwiO1xyXG5pbXBvcnQgeyByZWFkTm90ZU1ldGEgfSBmcm9tIFwiLi9tZXRhZGF0YVwiO1xyXG5pbXBvcnQgeyBBdG9taWNDYXJkc1NldHRpbmdUYWIgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xyXG5pbXBvcnQge1xyXG4gIEF0b21pY0NhcmRzU2V0dGluZ3MsXHJcbiAgREVGQVVMVF9TRVRUSU5HUyxcclxuICBSZW5kZXJPcHRpb25zLFxyXG4gIFNFVFRJTkdTX1ZFUlNJT04sXHJcbiAgU2l6ZSxcclxuICBTS0lQX0VNQkVEX0VYVCxcclxufSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQXRvbWljQ2FyZHNQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gIHNldHRpbmdzOiBBdG9taWNDYXJkc1NldHRpbmdzID0geyAuLi5ERUZBVUxUX1NFVFRJTkdTIH07XHJcblxyXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XHJcbiAgICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgQXRvbWljQ2FyZHNTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XHJcblxyXG4gICAgICAvLyBcdTYzQTVcdTdCQTEgT2JzaWRpYW4gXHU1MzlGXHU3NTFGICFbWyBdXSBcdTVENENcdTUxNjVcdUZGMUFcdThCRURcdTZDRDVcdTRGRERcdTYzMDFcdTUzOUZcdTc1MUZcdUZGMENcdTUzRUFcdTYyOEFcdTZFMzJcdTY3RDNcdTY2RkZcdTYzNjJcdTYyMTBcdTUzNjFcdTcyNDdcdTMwMDJcclxuICAgICAgLy8gc29ydE9yZGVyIFx1NTNENlx1NTkyN1x1NTAzQyBcdTIxOTIgXHU2MzkyXHU1NzI4XHU2MjQwXHU2NzA5XHU1MTg1XHU3RjZFXHU1OTA0XHU3NDA2XHU1NjY4XHVGRjA4XHU1NDJCXHU1RDRDXHU1MTY1XHU2RTMyXHU2N0QzXHVGRjA5XHU0RTRCXHU1NDBFXHU4RkQwXHU4ODRDXHVGRjBDXHJcbiAgICAgIC8vIFx1NTQyNlx1NTIxOSBwb3N0IHByb2Nlc3NvciBcdTRGMUFcdThERDFcdTU3MjhcdTVENENcdTUxNjVcdTc1MUZcdTYyMTBcdTRFNEJcdTUyNERcdUZGMENcdTRFQzBcdTRFNDhcdTRFNUZcdTUzMzlcdTkxNERcdTRFMERcdTUyMzBcdTMwMDJcclxuICAgICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duUG9zdFByb2Nlc3NvcihcclxuICAgICAgICAoZWwsIGN0eCkgPT4ge1xyXG4gICAgICAgICAgdGhpcy51cGdyYWRlRW1iZWRzKGVsLCBjdHgpO1xyXG4gICAgICAgICAgLy8gXHU1RDRDXHU1MTY1XHU3NTMxIE9ic2lkaWFuIFx1NUYwMlx1NkI2NVx1NTg2Qlx1NTE0NVx1RkYwQ1x1ODg2NVx1NEUyNFx1NkIyMVx1NjI2Qlx1NjNDRlx1NTE1Q1x1NUU5NVx1MzAwMlxyXG4gICAgICAgICAgLy8gXHU1REYyXHU2M0E1XHU3QkExXHU3Njg0XHU1MTQzXHU3RDIwXHU1RTI2IGRhdGEtYWMtdXBncmFkZWRcdUZGMENcdTkxQ0RcdTU5MERcdTYyNkJcdTYzQ0ZcdTRFMERcdTRGMUFcdTkxQ0RcdTU5MERcdTZFMzJcdTY3RDNcdTMwMDJcclxuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMudXBncmFkZUVtYmVkcyhlbCwgY3R4KSwgNjApO1xyXG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gdGhpcy51cGdyYWRlRW1iZWRzKGVsLCBjdHgpLCA0MDApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgMTAwMFxyXG4gICAgICApO1xyXG5cclxuICAgICAgdGhpcy5yZWdpc3RlckNvbW1hbmRzKCk7XHJcblxyXG4gICAgICAvLyBcdTYzQTVcdTdCQTFcdTYyRDZcdTY1M0VcdUZGMUFcdTRFQ0VcdTY1ODdcdTRFRjZcdTUyMTdcdTg4NjhcdTYyRDZcdTdCMTRcdThCQjBcdThGREJcdTY3NjUgXHUyMTkyIFx1NjNEMlx1NTE2NSAhW1sgXV0gXHU4MDBDXHU0RTBEXHU2NjJGXHU5RUQ4XHU4QkE0XHU3Njg0IFtbIF1dXHUzMDAyXHJcbiAgICAgIC8vIFx1MjZBMFx1RkUwRiBcdTRFMERcdTgwRkRcdTc1Mjggd29ya3NwYWNlIFx1NzY4NCBcImVkaXRvci1kcm9wXCIgXHU0RThCXHU0RUY2XHVGRjFBXHU1QjlFXHU2RDRCXHU2MkQ2IE9ic2lkaWFuIFx1NTE4NVx1OTBFOFx1NjU4N1x1NEVGNlx1NjVGNlx1NUI4M1x1NEUwRFx1ODlFNlx1NTNEMVx1MzAwMlxyXG4gICAgICAvLyBcdTY1MzlcdTc2RDFcdTU0MkMgRE9NIFx1NzY4NFx1NTM5Rlx1NzUxRiBkcm9wXHVGRjA4Y2FwdHVyZSBcdTk2MzZcdTZCQjVcdUZGMDlcdUZGMENcdTRFMDBcdTVCOUFcdTgwRkRcdTYyRkZcdTUyMzBcdTMwMDJcclxuICAgICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KGRvY3VtZW50LCBcImRyb3BcIiwgKGV2dDogRHJhZ0V2ZW50KSA9PiB0aGlzLm9uRG9tRHJvcChldnQpLCB0cnVlKTtcclxuXHJcbiAgICAgIGlmICh0aGlzLnNldHRpbmdzLnZlcmJvc2UpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIFx1NURGMlx1NTJBMFx1OEY3RFx1RkYwQ3VwZ3JhZGVFbWJlZHMgPVwiLCB0aGlzLnNldHRpbmdzLnVwZ3JhZGVFbWJlZHMpO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihcIlthdG9taWMtY2FyZHNdIG9ubG9hZCBcdTU5MzFcdThEMjVcdUZGMUFcIiwgZXJyKTtcclxuICAgICAgbmV3IE5vdGljZShgQXRvbWljIENhcmRzIFx1NTJBMFx1OEY3RFx1NTkzMVx1OEQyNVx1RkYxQSR7U3RyaW5nKGVycil9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbnVubG9hZCgpOiB2b2lkIHtcclxuICAgIC8qIENvbXBvbmVudCBcdTc1MUZcdTU0N0RcdTU0NjhcdTY3MUZcdTc1MzEgY3R4LmFkZENoaWxkIFx1NjI1OFx1N0JBMSAqL1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3Qgc2F2ZWQgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCk7XHJcbiAgICBpZiAoc2F2ZWQgJiYgdHlwZW9mIHNhdmVkID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgIC8vIFx1NUUwM1x1NUM0MFx1OUVEOFx1OEJBNFx1NTAzQ1x1NTNEOFx1NEU4Nlx1RkYwQ1x1NjVFN1x1NUI1OFx1Njg2M1x1ODk4MVx1OEZDMVx1NzlGQlx1RkYwQ1x1NTQyNlx1NTIxOVx1NzUyOFx1NjIzN1x1N0FFRlx1NzcwQlx1NTIzMFx1NzY4NFx1OEZEOFx1NjYyRlx1NjVFN1x1NUUwM1x1NUM0MFxyXG4gICAgICBpZiAoc2F2ZWQuc2V0dGluZ3NWZXJzaW9uICE9PSBTRVRUSU5HU19WRVJTSU9OKSB7XHJcbiAgICAgICAgT2JqZWN0LmFzc2lnbihzYXZlZCwge1xyXG4gICAgICAgICAgbGF5b3V0OiBERUZBVUxUX1NFVFRJTkdTLmxheW91dCxcclxuICAgICAgICAgIG5lc3RlZFNpemU6IERFRkFVTFRfU0VUVElOR1MubmVzdGVkU2l6ZSxcclxuICAgICAgICAgIGRlZmF1bHRFeHBhbmRlZDogREVGQVVMVF9TRVRUSU5HUy5kZWZhdWx0RXhwYW5kZWQsXHJcbiAgICAgICAgICBuZXN0ZWRFeHBhbmRlZDogREVGQVVMVF9TRVRUSU5HUy5uZXN0ZWRFeHBhbmRlZCxcclxuICAgICAgICAgIHNldHRpbmdzVmVyc2lvbjogU0VUVElOR1NfVkVSU0lPTixcclxuICAgICAgICB9KTtcclxuICAgICAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHNhdmVkKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7IC4uLkRFRkFVTFRfU0VUVElOR1MgfSwgc2F2ZWQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zZXR0aW5ncyA9IHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICB9XHJcblxyXG4gIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICogXHU2RTMyXHU2N0QzXHVGRjFBXHU2M0E1XHU3QkExXHU1MzlGXHU3NTFGXHU1RDRDXHU1MTY1XHJcbiAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG4gIHByaXZhdGUgdXBncmFkZUVtYmVkcyhlbDogSFRNTEVsZW1lbnQsIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgdGhpcy5kb1VwZ3JhZGVFbWJlZHMoZWwsIGN0eCk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihcIlthdG9taWMtY2FyZHNdIHVwZ3JhZGVFbWJlZHMgXHU1MUZBXHU5NTE5XHVGRjFBXCIsIGVycik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRvVXBncmFkZUVtYmVkcyhlbDogSFRNTEVsZW1lbnQsIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLnVwZ3JhZGVFbWJlZHMpIHJldHVybjtcclxuICAgIC8vIFx1OEZCRVx1NTIzMFx1NUQ0Q1x1NTk1N1x1NEUwQVx1OTY1MFx1NjVGNlx1NEUwRFx1NTE4RFx1NjNBNVx1N0JBMVx1RkYwQ1x1OTA3Rlx1NTE0RFx1NUZBQVx1NzNBRlx1NUYxNVx1NzUyOFx1NjVFMFx1OTY1MFx1NTk1N1x1NUEwM1xyXG4gICAgaWYgKGdldE5lc3QoKSA+PSB0aGlzLnNldHRpbmdzLm1heE5lc3REZXB0aCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIDpub3QoLm1lZGlhLWVtYmVkKSBcdTc2RjRcdTYzQTVcdTU3MjhcdTkwMDlcdTYyRTlcdTU2NjhcdTVDNDJcdTYzOTJcdTYzODlcdTU2RkVcdTcyNDcvXHU5N0YzXHU4OUM2XHU5ODkxXHU1RDRDXHU1MTY1XHVGRjBDXHJcbiAgICAvLyBcdTRFMERcdTc1MjhcdTYyOEFcdTVCODNcdTRFRUNcdTYzNUVcdThGREJcdTVGQUFcdTczQUZcdTUxOERcdThGQzdcdTZFRTRcdUZGMDhcdTY3NjFcdTc2RUVcdTZCNjNcdTY1ODdcdTkxQ0NcdTVFMzhcdTY3MDlcdTUxRTBcdTUzNDFcdTVGMjBcdTU2RkVcdUZGMDlcdTMwMDJcclxuICAgIGNvbnN0IG5vZGVzID0gQXJyYXkuZnJvbShcclxuICAgICAgZWwucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXHJcbiAgICAgICAgXCIuaW50ZXJuYWwtZW1iZWQ6bm90KC5tZWRpYS1lbWJlZCksIC5tYXJrZG93bi1lbWJlZDpub3QoLm1lZGlhLWVtYmVkKVwiXHJcbiAgICAgIClcclxuICAgICkuZmlsdGVyKChuKSA9PiAhbi5kYXRhc2V0LmFjVXBncmFkZWQpO1xyXG5cclxuICAgIGxldCB0YWtlbiA9IDA7XHJcbiAgICBmb3IgKGNvbnN0IGVtYmVkIG9mIG5vZGVzKSB7XHJcbiAgICAgIC8vIFx1MjZBMFx1RkUwRiBcdTUzRUFcdTUyMjRcdTY1QURcIlx1NUQ0Q1x1NTE2NVx1NjcyQ1x1OEVBQlwiXHU2NjJGXHU0RTBEXHU2NjJGXHU1QTkyXHU0RjUzXHU1MTQzXHU3RDIwXHVGRjBDXHU0RTBEXHU4MEZEXHU2N0U1XHU2MjQwXHU2NzA5XHU1NDBFXHU0RUUzXHVGRjFBXHJcbiAgICAgIC8vIFx1N0IxNFx1OEJCMFx1NkI2M1x1NjU4N1x1OTFDQ1x1NjY2RVx1OTA0RFx1NjcwOVx1NTZGRVx1NzI0N1x1RkYwQ1x1NzUyOCBxdWVyeVNlbGVjdG9yIFx1NEYxQVx1NjI4QVx1NjU3NFx1N0JDN1x1NUQ0Q1x1NTE2NVx1OEJFRlx1NTIyNFx1NjIxMFx1NTZGRVx1NzI0N1x1NUQ0Q1x1NTE2NVx1MzAwMlxyXG4gICAgICBjb25zdCBmaXJzdCA9IGVtYmVkLmZpcnN0RWxlbWVudENoaWxkO1xyXG4gICAgICBpZiAoZmlyc3QgJiYgL14oSU1HfEFVRElPfFZJREVPfENBTlZBU3xJRlJBTUUpJC8udGVzdChmaXJzdC50YWdOYW1lKSkgY29udGludWU7XHJcblxyXG4gICAgICAvLyBzcmMgXHU0RjE4XHU1MTQ4XHVGRjBDXHU2Q0ExXHU2NzA5XHU1MjE5XHU3NTI4IGFsdCBcdTUxNUNcdTVFOTVcclxuICAgICAgY29uc3Qgc3JjID0gKGVtYmVkLmdldEF0dHJpYnV0ZShcInNyY1wiKSA/PyBlbWJlZC5nZXRBdHRyaWJ1dGUoXCJhbHRcIikgPz8gXCJcIikudHJpbSgpO1xyXG4gICAgICBpZiAoIXNyYykgY29udGludWU7XHJcbiAgICAgIC8vIFx1NTZGRVx1NzI0NyAvIFx1OTdGM1x1ODlDNlx1OTg5MSAvIFBERiAvIFx1NzUzQlx1NUUwM1x1N0I0OVx1NjMwOVx1NjI2OVx1NUM1NVx1NTQwRFx1NjM5Mlx1OTY2NFxyXG4gICAgICBpZiAoU0tJUF9FTUJFRF9FWFQudGVzdChzcmMuc3BsaXQoXCIjXCIpWzBdKSkgY29udGludWU7XHJcblxyXG4gICAgICBlbWJlZC5kYXRhc2V0LmFjVXBncmFkZWQgPSBcIjFcIjtcclxuICAgICAgdGFrZW4rKztcclxuICAgICAgdm9pZCB0aGlzLnJlcGxhY2VXaXRoQ2FyZChlbWJlZCwgc3JjLCBjdHgpLmNhdGNoKChlcnIpID0+XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIlthdG9taWMtY2FyZHNdIFx1NkUzMlx1NjdEM1x1NTM2MVx1NzI0N1x1NTkzMVx1OEQyNVx1RkYxQVwiLCBzcmMsIGVycilcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIC8vIFx1NUUzOFx1ODlDNFx1OEZEMFx1ODg0Q1x1NEUwRFx1NjI1M1x1NTM3MFx1RkYwQ1x1NjM5Mlx1NjdFNVx1NjVGNlx1NTcyOFx1OEJCRVx1N0Y2RVx1OTFDQ1x1NjI1M1x1NUYwMFx1MzAwQ1x1OEJFNlx1N0VDNlx1NjVFNVx1NUZEN1x1MzAwRFxyXG4gICAgaWYgKHRha2VuICYmIHRoaXMuc2V0dGluZ3MudmVyYm9zZSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIFx1NURGMlx1NjNBNVx1N0JBMVwiLCB0YWtlbiwgXCJcdTU5MDRcdTVENENcdTUxNjVcIik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHJlcGxhY2VXaXRoQ2FyZChcclxuICAgIGVtYmVkOiBIVE1MRWxlbWVudCxcclxuICAgIHNyYzogc3RyaW5nLFxyXG4gICAgY3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0XHJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBkZXB0aCA9IGdldE5lc3QoKTtcclxuICAgIGNvbnN0IHNpemU6IFNpemUgPSBkZXB0aCA+IDAgPyB0aGlzLnNldHRpbmdzLm5lc3RlZFNpemUgOiBcIm5vcm1hbFwiO1xyXG4gICAgY29uc3QgaXNTbWFsbCA9IHNpemUgPT09IFwic21hbGxcIjtcclxuXHJcbiAgICBjb25zdCBvcHRzOiBSZW5kZXJPcHRpb25zID0ge1xyXG4gICAgICBzaXplLFxyXG4gICAgICBkZW5zaXR5OiBpc1NtYWxsID8gXCJjb21wYWN0XCIgOiB0aGlzLnNldHRpbmdzLmRlbnNpdHksXHJcbiAgICAgIGxheW91dDogdGhpcy5zZXR0aW5ncy5sYXlvdXQsXHJcbiAgICAgIGNvdmVyOiB0aGlzLnNldHRpbmdzLnNob3dDb3ZlcixcclxuICAgICAgbWV0YTogaXNTbWFsbCA/IGZhbHNlIDogdGhpcy5zZXR0aW5ncy5zaG93TWV0YSxcclxuICAgICAgdGFnczogaXNTbWFsbCA/IGZhbHNlIDogdGhpcy5zZXR0aW5ncy5zaG93VGFncyxcclxuICAgICAgLy8gXHU2ODA3XHU5ODk4XHU2NjJGXHU2Mjk4XHU1M0UwXHU1RjAwXHU1MTczXHVGRjBDXCJcdTYyNTNcdTVGMDBcIlx1NjMwOVx1OTRBRVx1NjYyRlx1NTUyRlx1NEUwMFx1NzY4NFx1OERGM1x1OEY2Q1x1NTE2NVx1NTNFM1xyXG4gICAgICBvcGVuOiBpc1NtYWxsID8gdHJ1ZSA6IHRoaXMuc2V0dGluZ3Muc2hvd09wZW5CdXR0b24sXHJcbiAgICAgIGV4cGFuZGVkOiBkZXB0aCA+IDAgPyB0aGlzLnNldHRpbmdzLm5lc3RlZEV4cGFuZGVkIDogdGhpcy5zZXR0aW5ncy5kZWZhdWx0RXhwYW5kZWQsXHJcbiAgICAgIGhlaWdodDogdGhpcy5zZXR0aW5ncy5jYXJkSGVpZ2h0LFxyXG4gICAgICBzdW1tYXJ5OiBpc1NtYWxsID8gOTAgOiB0aGlzLnNldHRpbmdzLnN1bW1hcnlMZW5ndGgsXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFx1NjMwMlx1NTcyOFx1NkUzOFx1NzlCQlx1ODI4Mlx1NzBCOVx1NEUwQVx1RkYxQVx1NTNFQVx1NTAxRlx1NzUyOFx1NzUxRlx1NTQ3RFx1NTQ2OFx1NjcxRlx1RkYwQ29udW5sb2FkIFx1NjVGNlx1NkUwNVx1N0E3QVx1NUI4M1x1NEUwRFx1NUY3MVx1NTRDRFx1NjU4N1x1Njg2M1xyXG4gICAgY29uc3QgaG9sZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBNYXJrZG93blJlbmRlckNoaWxkKGhvbGRlcik7XHJcbiAgICBjb21wb25lbnQubG9hZCgpO1xyXG4gICAgY3R4LmFkZENoaWxkKGNvbXBvbmVudCk7XHJcblxyXG4gICAgY29uc3QgZW52ID0ge1xyXG4gICAgICBhcHA6IHRoaXMuYXBwLFxyXG4gICAgICBzZXR0aW5nczogdGhpcy5zZXR0aW5ncyxcclxuICAgICAgc291cmNlUGF0aDogY3R4LnNvdXJjZVBhdGgsXHJcbiAgICAgIGNvbXBvbmVudCxcclxuICAgICAgLy8gKzFcdUZGMUFcdTUzNjFcdTcyNDdcdTZCNjNcdTY1ODdcdTkxQ0NcdTUxOERcdTZFMzJcdTY3RDNcdTc2ODRcdTUxODVcdTVCQjlcdTVDNUVcdTRFOEVcdTRFMEJcdTRFMDBcdTVDNDJcdUZGMENcdTkwMTJcdTU4OUVcdTU0MEVcdTVENENcdTU5NTdcdTZERjFcdTVFQTZcdTRFMEFcdTk2NTBcdTYyNERcdTY3MDlcdTY1NDhcclxuICAgICAgZGVwdGg6IGRlcHRoICsgMSxcclxuICAgICAgb25SZW9yZGVyOiAocmVxOiBSZW9yZGVyUmVxdWVzdCkgPT4gdm9pZCB0aGlzLnJlb3JkZXJFbWJlZHMoY3R4LnNvdXJjZVBhdGgsIHJlcSksXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFx1MjZBMFx1RkUwRiBcdTUxNDhcdTU0MENcdTZCNjVcdTUzNjBcdTRGNEZcdTRGNERcdTdGNkVcdUZGMENcdTUxOERcdTVGMDJcdTZCNjVcdTc1MUZcdTYyMTBcdTc3MUZcdTZCNjNcdTc2ODRcdTUzNjFcdTcyNDdcdTMwMDJcclxuICAgIC8vIFx1NEU0Qlx1NTI0RFx1NjYyRiBhd2FpdCBcdTRFNEJcdTU0MEVcdTUxOEQgcmVwbGFjZVdpdGhcdUZGMENcdTRGNDYgcmVhZE5vdGVNZXRhIFx1NjYyRlx1NUYwMlx1NkI2NVx1NzY4NFx1RkYwQ1xyXG4gICAgLy8gXHU3QjQ5XHU1QjgzXHU4RkQ0XHU1NkRFXHU2NUY2IE9ic2lkaWFuIFx1NTNFRlx1ODBGRFx1NURGMlx1N0VDRlx1OTFDRFx1NUVGQVx1OEZDN1x1ODI4Mlx1NzBCOSBcdTIxOTIgZW1iZWQuaXNDb25uZWN0ZWQgXHU0RTNBIGZhbHNlIFx1MjE5MiBcdTUzNjFcdTcyNDdcdTRFMjJcdTU5MzFcdTMwMDJcclxuICAgIC8vIFx1NTE0OFx1NjUzRVx1NTM2MFx1NEY0RFx1NTE0M1x1N0QyMFx1NUMzMVx1NEUwRFx1NUI1OFx1NTcyOFx1OEZEOVx1NEUyQVx1N0FERVx1NjAwMVx1RkYxQVx1NTM2MFx1NEY0RFx1NTE0M1x1N0QyMFx1OTY4Rlx1NzIzNlx1ODI4Mlx1NzBCOVx1NEUwMFx1OEQ3N1x1NzU1OVx1NTcyOFx1NjU4N1x1Njg2M1x1OTFDQ1x1MzAwMlxyXG4gICAgY29uc3QgcGxhY2Vob2xkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgcGxhY2Vob2xkZXIuY2xhc3NOYW1lID0gXCJhYy1jYXJkIGFjLWNhcmQtLXBlbmRpbmdcIjtcclxuICAgIHBsYWNlaG9sZGVyLmRhdGFzZXQuYWNQYXRoID0gc3JjO1xyXG4gICAgcGxhY2Vob2xkZXIuc2V0VGV4dChzcmMuc3BsaXQoXCIvXCIpLnBvcCgpPy5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIikgPz8gc3JjKTtcclxuICAgIGVtYmVkLnJlcGxhY2VXaXRoKHBsYWNlaG9sZGVyKTtcclxuXHJcbiAgICAvLyBzcmMgXHU1RjYyXHU1OTgyIFwiXHU3QjE0XHU4QkIwXCJcdTMwMDFcIlx1N0IxNFx1OEJCMC5tZFwiXHUzMDAxXCJcdTdCMTRcdThCQjAjXHU2ODA3XHU5ODk4XCJcdTMwMDFcIlx1N0IxNFx1OEJCMCNeXHU1NzU3aWRcIlxyXG4gICAgY29uc3QgdGFyZ2V0ID0gc3JjLnJlcGxhY2UoL1xcLm1kKD89I3wkKS9pLCBcIlwiKTtcclxuICAgIGNvbnN0IG1ldGEgPSBhd2FpdCByZWFkTm90ZU1ldGEodGhpcy5hcHAsIHRhcmdldCwgY3R4LnNvdXJjZVBhdGgsIHRoaXMuc2V0dGluZ3MpO1xyXG5cclxuICAgIGNvbnN0IGNhcmQgPSB3aXRoTmVzdChkZXB0aCwgKCkgPT4gcmVuZGVyQ2FyZChlbnYsIG1ldGEsIG9wdHMpKTtcclxuICAgIHBsYWNlaG9sZGVyLnJlcGxhY2VXaXRoKGNhcmQpO1xyXG4gIH1cclxuXHJcbiAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgKiBcdTYyRDZcdTY1M0VcdUZGMUFcdThCQTlcIlx1NjJENlx1N0IxNFx1OEJCMFx1OEZEQlx1Njc2NVwiXHU5RUQ4XHU4QkE0XHU1Rjk3XHU1MjMwXHU1RDRDXHU1MTY1ICFbWyBdXVxyXG4gICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuICBwcml2YXRlIG9uRG9tRHJvcChldnQ6IERyYWdFdmVudCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLmVtYmVkT25Ecm9wKSByZXR1cm47XHJcblxyXG4gICAgLy8gXHU2NUU1XHU1RkQ3XHU1RkM1XHU5ODdCXHU2MjUzXHU1NzI4XHU2NzAwXHU1MjREXHU5NzYyXHVGRjFBXHU1NDI2XHU1MjE5XHU2NUUwXHU2Q0Q1XHU1MzNBXHU1MjA2XCJcdTRFOEJcdTRFRjZcdTZDQTFcdTg5RTZcdTUzRDFcIlx1NTQ4Q1wiXHU4OEFCXHU0RTBCXHU5NzYyXHU3Njg0XHU1MjI0XHU2NUFEXHU2MzIxXHU2Mzg5XHU0RTg2XCJcclxuICAgIGNvbnN0IHQgPSBldnQudGFyZ2V0O1xyXG4gICAgaWYgKHRoaXMuc2V0dGluZ3MudmVyYm9zZSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIGRvbSBkcm9wOlwiLCB7XHJcbiAgICAgICAgdGFyZ2V0OiB0IGluc3RhbmNlb2YgRWxlbWVudCA/IGAke3QudGFnTmFtZX0uJHt0LmNsYXNzTmFtZX1gIDogU3RyaW5nKHQpLFxyXG4gICAgICAgIGluRWRpdG9yOiAhISh0IGluc3RhbmNlb2YgRWxlbWVudCAmJiB0LmNsb3Nlc3QoXCIubWFya2Rvd24tc291cmNlLXZpZXcsIC5jbS1lZGl0b3IsIC5jbS1jb250ZW50XCIpKSxcclxuICAgICAgICB0eXBlczogZXZ0LmRhdGFUcmFuc2ZlciA/IEFycmF5LmZyb20oZXZ0LmRhdGFUcmFuc2Zlci50eXBlcykgOiBudWxsLFxyXG4gICAgICAgIHRleHQ6IGV2dC5kYXRhVHJhbnNmZXI/LmdldERhdGEoXCJ0ZXh0L3BsYWluXCIpID8/IFwiXCIsXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFx1MjZBMFx1RkUwRiBcdTRFMERcdTgwRkRcdTc1MjggYWN0aXZlRWRpdG9yKClcdUZGMUFcdTYyRDZcdTYyRkRcdTY1RjZcdTZEM0JcdTUyQThcdTg5QzZcdTU2RkVcdTVGODBcdTVGODBcdThGRDhcdTUwNUNcdTU3MjhcdTY1ODdcdTRFRjZcdThENDRcdTZFOTBcdTdCQTFcdTc0MDZcdTU2NjhcdUZGMDhcdTYyRDZcdTYyRkRcdTZFOTBcdUZGMDlcdUZGMENcclxuICAgIC8vICAgIFx1NTNENlx1NEUwRFx1NTIzMFx1NzZFRVx1NjgwN1x1N0YxNlx1OEY5MVx1NTY2OFx1MzAwMlx1ODk4MVx1NEVDRSBkcm9wIFx1NzY4NFx1NzZFRVx1NjgwN1x1NTE0M1x1N0QyMFx1NTNDRFx1NjdFNVx1NUI4M1x1NUM1RVx1NEU4RVx1NTRFQVx1NEUyQVx1N0YxNlx1OEY5MVx1NTY2OFx1MzAwMlxyXG4gICAgLy8gXHU1MzYxXHU3MjQ3XHU2QjYzXHU1NzI4XHU4OEFCXHU2MkQ2XHU1M0JCXHU5MUNEXHU2MzkyIFx1MjE5MiBcdTRFMERcdTg5ODFcdTg5RTZcdTUzRDFcdTk0RkVcdTYzQTVcdTY1MzlcdTUxOTlcdUZGMENcdTU0MjZcdTUyMTlcdTRGMUFcdTYyOEFcdTUyMUFcdTYzMkFcdTU5N0RcdTc2ODRcdTVENENcdTUxNjVcdTUzQzhcdTY1MzlcdTRFNzFcclxuICAgIGlmIChpc0NhcmRSZW9yZGVyRHJhZygpKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgZWRpdG9yID0gdGhpcy5lZGl0b3JGcm9tRHJvcChldnQpID8/IHRoaXMuYWN0aXZlRWRpdG9yKCk7XHJcbiAgICBpZiAoIWVkaXRvcikge1xyXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy52ZXJib3NlKSBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIFx1NjI3RVx1NEUwRFx1NTIzMFx1NzZFRVx1NjgwN1x1N0YxNlx1OEY5MVx1NTY2OFwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFx1NEUwRFx1OTYzQlx1NkI2Mlx1OUVEOFx1OEJBNFx1ODg0Q1x1NEUzQVx1RkYxQVx1OEJBOSBPYnNpZGlhbiBcdTZCNjNcdTVFMzhcdTYzRDJcdTUxNjVcdTk0RkVcdTYzQTVcdUZGMENcdTdBMERcdTU0MEVcdTY1MzlcdTUxOTlcdTYyMTAgIVtbXHU3QjE0XHU4QkIwXV1cdTMwMDJcclxuICAgIC8vIE9ic2lkaWFuIFx1NjNEMlx1NTE2NVx1NTNFRlx1ODBGRFx1NjYyRlx1NUYwMlx1NkI2NVx1NzY4NFx1RkYwQ1x1NTIwNlx1NTFFMFx1NkIyMVx1OEJENVx1NjNBMlx1RkYwOFx1NjUzOVx1NTE5OVx1OEZDN1x1NUMzMVx1NEUwRFx1NEYxQVx1NTE4RFx1NTMzOVx1OTE0RFx1RkYwQ1x1NUI4OVx1NTE2OFx1RkYwOVx1MzAwMlxyXG4gICAgZm9yIChjb25zdCBkZWxheSBvZiBbODAsIDI1MCwgNjAwXSkge1xyXG4gICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0aGlzLmxpbmtUb0VtYmVkQXRDdXJzb3IoZWRpdG9yKSwgZGVsYXkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTkxQ0RcdTYzOTJcdUZGMUFcdTYyOEFcdTZFOTBcdTc4MDFcdTkxQ0NcdTc2ODQgIVtbc291cmNlXV0gXHU4ODRDXHU2NDJDXHU1MjMwICFbW3RhcmdldF1dIFx1NzY4NFx1NTI0RC9cdTU0MEUgLS0tLS0tLS0tLVxyXG4gICAgIFx1NzZGNFx1NjNBNVx1NjUzOVx1NjU4N1x1NEVGNlx1RkYwOHZhdWx0LnByb2Nlc3NcdUZGMDlcdUZGMENcdTk2MDVcdThCRkJcdTZBMjFcdTVGMEZcdTU0OENcdTdGMTZcdThGOTFcdTZBMjFcdTVGMEZcdTkwRkRcdTgwRkRcdTc1MjhcdTMwMDJcclxuICAgICBcdTUzRUFcdTUwNUFcdTY1NzRcdTg4NENcdTY0MkNcdThGRDBcdUZGMENcdTRFMERcdTUzMzlcdTkxNERcdTVDMzFcdTUzOUZcdTY4MzdcdThGRDRcdTU2REVcdUZGMENcdTRFMERcdTRGMUFcdTYzNUZcdTU3NEZcdTY1ODdcdTRFRjZcdTMwMDIgKi9cclxuICBwcml2YXRlIGFzeW5jIHJlb3JkZXJFbWJlZHMoc291cmNlUGF0aDogc3RyaW5nLCByZXE6IFJlb3JkZXJSZXF1ZXN0KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHNvdXJjZVBhdGgpO1xyXG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xyXG5cclxuICAgIGNvbnN0IHZlcmJvc2UgPSB0aGlzLnNldHRpbmdzLnZlcmJvc2U7XHJcbiAgICBpZiAodmVyYm9zZSkgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSByZW9yZGVyOlwiLCByZXEsIFwiXHUyMTkyXCIsIHNvdXJjZVBhdGgpO1xyXG5cclxuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGRhdGEpID0+IHtcclxuICAgICAgY29uc3QgbGluZXMgPSBkYXRhLnNwbGl0KFwiXFxuXCIpO1xyXG4gICAgICBjb25zdCBmcm9tID0gbGluZXMuZmluZEluZGV4KChsKSA9PiB0aGlzLmxpbmVFbWJlZHMobCwgcmVxLnNvdXJjZSkpO1xyXG4gICAgICBpZiAoZnJvbSA8IDApIHtcclxuICAgICAgICBpZiAodmVyYm9zZSkgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBcdTYyN0VcdTRFMERcdTUyMzBcdTZFOTBcdTVENENcdTUxNjVcdTg4NENcdUZGMUFcIiwgcmVxLnNvdXJjZSk7XHJcbiAgICAgICAgcmV0dXJuIGRhdGE7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgW21vdmVkXSA9IGxpbmVzLnNwbGljZShmcm9tLCAxKTtcclxuICAgICAgY29uc3QgdG8gPSBsaW5lcy5maW5kSW5kZXgoKGwpID0+IHRoaXMubGluZUVtYmVkcyhsLCByZXEudGFyZ2V0KSk7XHJcbiAgICAgIGlmICh0byA8IDApIHtcclxuICAgICAgICBpZiAodmVyYm9zZSkgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBcdTYyN0VcdTRFMERcdTUyMzBcdTc2RUVcdTY4MDdcdTVENENcdTUxNjVcdTg4NENcdUZGMUFcIiwgcmVxLnRhcmdldCk7XHJcbiAgICAgICAgcmV0dXJuIGRhdGE7XHJcbiAgICAgIH1cclxuICAgICAgbGluZXMuc3BsaWNlKHJlcS5iZWZvcmUgPyB0byA6IHRvICsgMSwgMCwgbW92ZWQpO1xyXG4gICAgICBpZiAodmVyYm9zZSkgY29uc29sZS5sb2coXCJbYXRvbWljLWNhcmRzXSBcdTc5RkJcdTUyQThcdTg4NENcIiwgZnJvbSwgXCJcdTIxOTJcIiwgdG8pO1xyXG4gICAgICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBOb3RpY2UoYFx1NURGMlx1NjI4QVx1MzAwQyR7cmVxLnNvdXJjZX1cdTMwMERcdTc5RkJcdTUyMzBcdTMwMEMke3JlcS50YXJnZXR9XHUzMDBEJHtyZXEuYmVmb3JlID8gXCJcdTRFNEJcdTUyNERcIiA6IFwiXHU0RTRCXHU1NDBFXCJ9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBcdThGRDlcdTRFMDBcdTg4NENcdTY2MkZcdTU0MjZcdTY2MkYgbmFtZSBcdTc2ODRcdTVENENcdTUxNjVcdTMwMDJcclxuICAgKiBcdTI2QTBcdUZFMEYgXHU3QjE0XHU4QkIwXHU1NDBEXHU2NjJGXHU3N0VEXHU1NDBEXHVGRjA4XHU3MDZGXHU1MTQ5LVx1NzBEOFx1NzExOVx1RkYwOVx1RkYwQ1x1NEY0Nlx1NkU5MFx1NzgwMVx1OTFDQ1x1NTNFRlx1ODBGRFx1NTE5OVx1NjIxMFx1NUI4Q1x1NjU3NFx1OERFRlx1NUY4NFxyXG4gICAqIFx1RkYwOCFbW3dpa2ktYWkvXHUyMDI2L1x1NzA2Rlx1NTE0OS1cdTcwRDhcdTcxMTldXVx1RkYwOVx1RkYwQ1x1NEU1Rlx1NTNFRlx1ODBGRFx1NUUyNlx1NTIyQlx1NTQwRFx1NjIxNlx1NUMwRlx1ODI4Mlx1NUYxNVx1NzUyOFx1RkYwQ1x1OTBGRFx1ODk4MVx1OEJBNFx1MzAwMlxyXG4gICAqL1xyXG4gIHByaXZhdGUgbGluZUVtYmVkcyhsaW5lOiBzdHJpbmcsIG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgdCA9IGxpbmUudHJpbSgpO1xyXG4gICAgaWYgKCF0LnN0YXJ0c1dpdGgoXCIhW1tcIikpIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IGVuZCA9IHQuaW5kZXhPZihcIl1dXCIpO1xyXG4gICAgaWYgKGVuZCA8IDApIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IGlubmVyID0gdC5zbGljZSgzLCBlbmQpO1xyXG4gICAgY29uc3QgdGFyZ2V0ID0gaW5uZXIuc3BsaXQoXCJ8XCIpWzBdLnNwbGl0KFwiI1wiKVswXS50cmltKCkucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpO1xyXG4gICAgcmV0dXJuIHRhcmdldCA9PT0gbmFtZSB8fCB0YXJnZXQuZW5kc1dpdGgoYC8ke25hbWV9YCk7XHJcbiAgfVxyXG5cclxuICAvKiogXHU0RUNFXHU2MkQ2XHU2NTNFXHU3NkVFXHU2ODA3XHU1MTQzXHU3RDIwXHU1M0NEXHU2N0U1XHU2MjQwXHU1QzVFXHU3RjE2XHU4RjkxXHU1NjY4XHU3Njg0IEVkaXRvciBcdTVCOUVcdTRGOEIgKi9cclxuICBwcml2YXRlIGVkaXRvckZyb21Ecm9wKGV2dDogRHJhZ0V2ZW50KTogRWRpdG9yIHwgbnVsbCB7XHJcbiAgICBjb25zdCB0YXJnZXQgPSBldnQudGFyZ2V0O1xyXG4gICAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCkpIHJldHVybiBudWxsO1xyXG4gICAgLy8gXHU3NTI4XHU2NTcwXHU3RUM0XHU2NTM2XHU5NkM2XHVGRjFBXHU5NUVEXHU1MzA1XHU5MUNDXHU3RUQ5IGxldCBcdTUzRDhcdTkxQ0ZcdThENEJcdTUwM0NcdTRGMUFcdTg4QUIgVFMgXHU2NTM2XHU3QTg0XHU2MjEwIG5ldmVyXHJcbiAgICBjb25zdCBoaXRzOiBNYXJrZG93blZpZXdbXSA9IFtdO1xyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLml0ZXJhdGVBbGxMZWF2ZXMoKGxlYWYpID0+IHtcclxuICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldztcclxuICAgICAgaWYgKHZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcgJiYgdmlldy5jb250YWluZXJFbC5jb250YWlucyh0YXJnZXQpKSBoaXRzLnB1c2godmlldyk7XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBoaXRzWzBdPy5lZGl0b3IgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFx1NjI4QVx1NTE0OVx1NjgwN1x1NTI0RFx1NTIxQVx1NjNEMlx1NTE2NVx1NzY4NFx1OTRGRVx1NjNBNVx1NUMzMVx1NTczMFx1NjUzOVx1NTE5OVx1NjIxMCAhW1tcdTdCMTRcdThCQjBdXVx1MzAwMlxyXG4gICAqIFx1NjJENiBPYnNpZGlhbiBcdTUxODVcdTkwRThcdTY1ODdcdTRFRjZcdTY1RjZcdUZGMENcdTUzOUZcdTc1MUZcdTUzRUZcdTgwRkRcdTYzRDJcdTUxNjVcdTRFMDlcdTc5Q0RcdTVGNjJcdTYwMDFcdUZGMENcdTkwRkRcdTg5ODFcdThCQTRcdUZGMUFcclxuICAgKiAgIFx1MjQ2MCBbW1x1N0IxNFx1OEJCMF1dICAgICAgICAgICAgICAgXHVGRjA4d2lraWxpbmsgXHU4QkJFXHU3RjZFXHVGRjA5XHJcbiAgICogICBcdTI0NjEgW1x1NjgwN1x1OTg5OF0ob2JzaWRpYW46Ly9cdTIwMjYpICAgXHVGRjA4XHU1QjlFXHU2RDRCXHU5RUQ4XHU4QkE0XHU4RDcwXHU4RkQ5XHU3OUNEXHVGRjBDZGF0YVRyYW5zZmVyIFx1OTFDQ1x1NjYyRiBvYnNpZGlhbjovLyBVUkxcdUZGMDlcclxuICAgKiAgIFx1MjQ2MiBvYnNpZGlhbjovL1x1MjAyNiBcdTg4RjhcdTk0RkVcdTYzQTVcclxuICAgKiBcdTkwRkRcdTRFMERcdTY2MkZcdTVDMzFcdTUzOUZcdTY4MzdcdTY1M0VcdThGQzdcdUZGMENcdTkwN0ZcdTUxNERcdThCRUZcdTRGMjRcdTYyRDZcdTU2RkVcdTcyNDcgLyBcdTU5MTZcdTkwRThcdTY1ODdcdTY3MkNcdTMwMDJcclxuICAgKi9cclxuICBwcml2YXRlIGxpbmtUb0VtYmVkQXRDdXJzb3IoZWRpdG9yOiBFZGl0b3IpOiB2b2lkIHtcclxuICAgIGNvbnN0IGN1ciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcclxuICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShjdXIubGluZSkgPz8gXCJcIjtcclxuICAgIGNvbnN0IGhlYWQgPSBsaW5lLnNsaWNlKDAsIGN1ci5jaCk7XHJcblxyXG4gICAgaWYgKHRoaXMuc2V0dGluZ3MudmVyYm9zZSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIFx1NTE0OVx1NjgwN1x1NTI0RFx1NjU4N1x1NjcyQ1x1RkYxQVwiLCBKU09OLnN0cmluZ2lmeShoZWFkLnNsaWNlKC0xMjApKSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmVwbGFjZSA9IChtYXRjaGVkOiBzdHJpbmcsIG5hbWU6IHN0cmluZykgPT4ge1xyXG4gICAgICBjb25zdCBmcm9tID0geyBsaW5lOiBjdXIubGluZSwgY2g6IGN1ci5jaCAtIG1hdGNoZWQubGVuZ3RoIH07XHJcbiAgICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UoYCFbWyR7bmFtZX1dXWAsIGZyb20sIGN1cik7XHJcbiAgICAgIGlmICh0aGlzLnNldHRpbmdzLnZlcmJvc2UpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIlthdG9taWMtY2FyZHNdIFx1OTRGRVx1NjNBNVx1NjUzOVx1NTE5OVx1NEUzQVx1NUQ0Q1x1NTE2NVx1RkYxQVwiLCBtYXRjaGVkLCBcIlx1MjE5MlwiLCBgIVtbJHtuYW1lfV1dYCk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLy8gXHUyNDYwIHdpa2lsaW5rXHVGRjA4XHU0RTE0XHU1MjREXHU5NzYyXHU0RTBEXHU2NjJGICFcdUZGMENcdTkwN0ZcdTUxNERcdTkxQ0RcdTU5MERcdTY1MzlcdTUxOTlcdUZGMDlcclxuICAgIGNvbnN0IHdpa2kgPSBoZWFkLm1hdGNoKC8oPzpefFteIV0pKFxcW1xcW1teXFxdXStcXF1cXF0pJC8pO1xyXG4gICAgaWYgKHdpa2kpIHtcclxuICAgICAgY29uc3QgaW5uZXIgPSB3aWtpWzFdLnNsaWNlKDIsIC0yKS5zcGxpdChcInxcIilbMF0udHJpbSgpO1xyXG4gICAgICBpZiAoaW5uZXIpIHtcclxuICAgICAgICByZXBsYWNlKHdpa2lbMV0sIGlubmVyKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBcdTI0NjEgbWFya2Rvd24gXHU5NEZFXHU2M0E1XHVGRjBDaHJlZiBcdTY2MkYgb2JzaWRpYW46Ly8gVVJMXHJcbiAgICBjb25zdCBtZCA9IGhlYWQubWF0Y2goL1xcW1teXFxdXSpcXF1cXCgoW14pXSspXFwpJC8pO1xyXG4gICAgaWYgKG1kKSB7XHJcbiAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLm5vdGVOYW1lRnJvbU9ic2lkaWFuVXJsKG1kWzFdKTtcclxuICAgICAgaWYgKG5hbWUpIHtcclxuICAgICAgICByZXBsYWNlKG1kWzBdLCBuYW1lKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFx1MjQ2MiBcdTg4Rjggb2JzaWRpYW46Ly8gXHU5NEZFXHU2M0E1XHJcbiAgICBjb25zdCBiYXJlID0gaGVhZC5tYXRjaCgvKG9ic2lkaWFuOlxcL1xcL1xcUyspJC8pO1xyXG4gICAgaWYgKGJhcmUpIHtcclxuICAgICAgY29uc3QgbmFtZSA9IHRoaXMubm90ZU5hbWVGcm9tT2JzaWRpYW5VcmwoYmFyZVsxXSk7XHJcbiAgICAgIGlmIChuYW1lKSByZXBsYWNlKGJhcmVbMV0sIG5hbWUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqIFx1NEVDRSBvYnNpZGlhbjovL29wZW4/dmF1bHQ9WCZmaWxlPTxwYXRoPiBcdTkxQ0NcdTUzRDZcdTUxRkFcdTdCMTRcdThCQjBcdTU0MERcdUZGMDhcdTUzQkJcdTYzODlcdTY1ODdcdTRFRjZcdTU5MzlcdTRFMEUgLm1kXHVGRjA5ICovXHJcbiAgcHJpdmF0ZSBub3RlTmFtZUZyb21PYnNpZGlhblVybCh1cmw6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgdSA9IG5ldyBVUkwodXJsKTtcclxuICAgICAgY29uc3QgZmlsZSA9IHUuc2VhcmNoUGFyYW1zLmdldChcImZpbGVcIik7XHJcbiAgICAgIGlmICghZmlsZSkgcmV0dXJuIG51bGw7XHJcbiAgICAgIGNvbnN0IGRlY29kZWQgPSBkZWNvZGVVUklDb21wb25lbnQoZmlsZSk7XHJcbiAgICAgIGNvbnN0IGJhc2UgPSBkZWNvZGVkLnNwbGl0KFwiL1wiKS5wb3AoKT8ucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpLnRyaW0oKSA/PyBcIlwiO1xyXG4gICAgICByZXR1cm4gYmFzZSB8fCBudWxsO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgKiBcdTU0N0RcdTRFRTRcclxuICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbiAgcHJpdmF0ZSBhY3RpdmVFZGl0b3IoKTogRWRpdG9yIHwgbnVsbCB7XHJcbiAgICBjb25zdCB2aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuICAgIHJldHVybiB2aWV3Py5lZGl0b3IgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVnaXN0ZXJDb21tYW5kcygpOiB2b2lkIHtcclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImxpbmtzLXRvLWVtYmVkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NjI4QVx1OTAwOVx1NTMzQVx1OTFDQ1x1NzY4NCBbW1x1OTRGRVx1NjNBNV1dIFx1OEY2Q1x1NjIxMFx1NUQ0Q1x1NTE2NVx1NTIxN1x1ODg2OFwiLFxyXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB0aGlzLmxpbmtzVG9FbWJlZHMoZWRpdG9yKSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImluc2VydC1yZXZlcnNlLWVtYmVkc1wiLFxyXG4gICAgICBuYW1lOiBcIlx1NjNEMlx1NTE2NVx1NTNDRFx1NjdFNVx1NTIxN1x1ODg2OFx1RkYwOFx1NUYxNVx1NzUyOFx1NjcyQ1x1NjU4N1x1NzY4NFx1N0IxNFx1OEJCMFx1RkYwQ1x1NzUxRlx1NjIxMFx1NEUzQVx1NUQ0Q1x1NTE2NVx1RkYwOVwiLFxyXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB0aGlzLmluc2VydFJldmVyc2VFbWJlZHMoZWRpdG9yKSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcInRvZ2dsZS1hbGwtY2FyZHNcIixcclxuICAgICAgbmFtZTogXCJcdTVDNTVcdTVGMDAgLyBcdTY1MzZcdThENzdcdTY3MkNcdTk4NzVcdTYyNDBcdTY3MDlcdTUzNjFcdTcyNDdcIixcclxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBjYXJkcyA9IEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIuYWMtY2FyZFwiKSk7XHJcbiAgICAgICAgaWYgKCFjYXJkcy5sZW5ndGgpIHtcclxuICAgICAgICAgIG5ldyBOb3RpY2UoXCJcdTVGNTNcdTUyNERcdTg5QzZcdTU2RkVcdTkxQ0NcdTZDQTFcdTY3MDlcdTUzNjFcdTcyNDdcIik7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IGNvbGxhcHNlZCA9IGNhcmRzLmZpbHRlcigoYykgPT4gIWMuY2xhc3NMaXN0LmNvbnRhaW5zKFwiaXMtZXhwYW5kZWRcIikpO1xyXG4gICAgICAgIGNvbnN0IHRhcmdldHMgPSBjb2xsYXBzZWQubGVuZ3RoID8gY29sbGFwc2VkIDogY2FyZHM7XHJcbiAgICAgICAgZm9yIChjb25zdCBjIG9mIHRhcmdldHMpIGMucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCIuYWMtYnRuLS10b2dnbGVcIik/LmNsaWNrKCk7XHJcbiAgICAgICAgbmV3IE5vdGljZShjb2xsYXBzZWQubGVuZ3RoID8gYFx1NURGMlx1NUM1NVx1NUYwMCAke3RhcmdldHMubGVuZ3RofSBcdTVGMjBcdTUzNjFcdTcyNDdgIDogYFx1NURGMlx1NjUzNlx1OEQ3NyAke3RhcmdldHMubGVuZ3RofSBcdTVGMjBcdTUzNjFcdTcyNDdgKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqIFx1OTAwOVx1NTMzQVx1OTFDQ1x1NzY4NCBbW1x1OTRGRVx1NjNBNV1dIFx1MjE5MiBcdTUzOUZcdTc1MUZcdTVENENcdTUxNjVcdTUyMTdcdTg4NjggYC0gIVtbXHU5NEZFXHU2M0E1XV1gICovXHJcbiAgcHJpdmF0ZSBsaW5rc1RvRW1iZWRzKGVkaXRvcjogRWRpdG9yKTogdm9pZCB7XHJcbiAgICBjb25zdCBzZWwgPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XHJcbiAgICBpZiAoIXNlbC50cmltKCkpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlx1OEJGN1x1NTE0OFx1OTAwOVx1NEUyRFx1NTMwNVx1NTQyQiBbW1x1OTRGRVx1NjNBNV1dIFx1NzY4NFx1NjU4N1x1NjcyQ1wiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcmUgPSAvXFxbXFxbKFteXFxdfCNdKykoPzojW15cXF18XSopPyg/OlxcfFteXFxdXSopP1xcXVxcXS9nO1xyXG4gICAgY29uc3QgZm91bmQ6IHN0cmluZ1tdID0gW107XHJcbiAgICBsZXQgbTogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcclxuICAgIHdoaWxlICgobSA9IHJlLmV4ZWMoc2VsKSkgIT09IG51bGwpIHtcclxuICAgICAgY29uc3QgdCA9IG1bMV0udHJpbSgpO1xyXG4gICAgICBpZiAodCAmJiAhZm91bmQuaW5jbHVkZXModCkpIGZvdW5kLnB1c2godCk7XHJcbiAgICB9XHJcbiAgICBpZiAoIWZvdW5kLmxlbmd0aCkge1xyXG4gICAgICBuZXcgTm90aWNlKFwiXHU5MDA5XHU1MzNBXHU5MUNDXHU2Q0ExXHU2NzA5IFtbXHU5NEZFXHU2M0E1XV1cIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKGZvdW5kLm1hcCgodCkgPT4gYC0gIVtbJHt0fV1dYCkuam9pbihcIlxcblwiKSk7XHJcbiAgICBuZXcgTm90aWNlKGBcdTVERjJcdTYzRDJcdTUxNjUgJHtmb3VuZC5sZW5ndGh9IFx1NTkwNFx1NUQ0Q1x1NTE2NWApO1xyXG4gIH1cclxuXHJcbiAgLyoqIFx1NTNDRFx1NjdFNVx1RkYxQVx1NjI4QVx1NUYxNVx1NzUyOFx1NEU4Nlx1NjcyQ1x1NjU4N1x1NzY4NFx1N0IxNFx1OEJCMFx1NEVFNVx1NTM5Rlx1NzUxRlx1NUQ0Q1x1NTE2NVx1NTIxN1x1ODg2OFx1NjNEMlx1NTE2NVx1RkYwOFx1OTc1OVx1NjAwMVx1N0VEM1x1Njc5Q1x1RkYwQ1x1NEUwRFx1NjYyRlx1NTJBOFx1NjAwMVx1NkUzMlx1NjdEM1x1RkYwOSAqL1xyXG4gIHByaXZhdGUgaW5zZXJ0UmV2ZXJzZUVtYmVkcyhlZGl0b3I6IEVkaXRvcik6IHZvaWQge1xyXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XHJcbiAgICBpZiAoIWZpbGUpIHtcclxuICAgICAgbmV3IE5vdGljZShcIlx1NUY1M1x1NTI0RFx1NkNBMVx1NjcwOVx1NjI1M1x1NUYwMFx1NzY4NFx1NjU4N1x1NEVGNlwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbGlua3MgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLnJlc29sdmVkTGlua3M7XHJcbiAgICBjb25zdCByZWZzID0gT2JqZWN0LmtleXMobGlua3MpLmZpbHRlcigoc3JjKSA9PiBsaW5rc1tzcmNdPy5bZmlsZS5wYXRoXSk7XHJcbiAgICBpZiAoIXJlZnMubGVuZ3RoKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoXCJcdTZDQTFcdTY3MDlcdTdCMTRcdThCQjBcdTVGMTVcdTc1MjhcdTY3MkNcdTY1ODdcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IHRleHQgPSBgXHU4OEFCXHU1RjE1XHU3NTI4XHU1NzI4XHVGRjFBXFxuXFxuJHtyZWZzXHJcbiAgICAgIC5tYXAoKHIpID0+IGAtICFbWyR7ci5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIil9XV1gKVxyXG4gICAgICAuam9pbihcIlxcblwiKX1cXG5gO1xyXG4gICAgZWRpdG9yLnJlcGxhY2VSYW5nZSh0ZXh0LCBlZGl0b3IuZ2V0Q3Vyc29yKCkpO1xyXG4gICAgbmV3IE5vdGljZShgXHU1REYyXHU2M0QyXHU1MTY1ICR7cmVmcy5sZW5ndGh9IFx1Njc2MVx1NUYxNVx1NzUyOGApO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgQXBwLCBDb21wb25lbnQsIE5vdGljZSwgc2V0SWNvbiB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBOb3RlTWV0YSwgcmVuZGVyTWFya2Rvd24gfSBmcm9tIFwiLi9tZXRhZGF0YVwiO1xyXG5pbXBvcnQgeyBBdG9taWNDYXJkc1NldHRpbmdzLCBSZW5kZXJPcHRpb25zIH0gZnJvbSBcIi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUmVvcmRlclJlcXVlc3Qge1xyXG4gIC8qKiBcdTg4QUJcdTYyRDZcdTUyQThcdTc2ODRcdTdCMTRcdThCQjBcdTU0MEQgKi9cclxuICBzb3VyY2U6IHN0cmluZztcclxuICAvKiogXHU2NTNFXHU3RjZFXHU3NkVFXHU2ODA3XHU3QjE0XHU4QkIwXHU1NDBEICovXHJcbiAgdGFyZ2V0OiBzdHJpbmc7XHJcbiAgLyoqIHRydWUgPSBcdTYzRDJcdTUyMzBcdTc2RUVcdTY4MDdcdTRFNEJcdTUyNERcdUZGMENmYWxzZSA9IFx1NEU0Qlx1NTQwRSAqL1xyXG4gIGJlZm9yZTogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYXJkRW52IHtcclxuICBhcHA6IEFwcDtcclxuICBzZXR0aW5nczogQXRvbWljQ2FyZHNTZXR0aW5ncztcclxuICBzb3VyY2VQYXRoOiBzdHJpbmc7XHJcbiAgY29tcG9uZW50OiBDb21wb25lbnQ7XHJcbiAgLyoqIFx1NUY1M1x1NTI0RFx1NUQ0Q1x1NTk1N1x1NUM0Mlx1N0VBN1x1RkYwQ1x1NzUyOFx1NEU4RVx1OTAxMlx1NUY1Mlx1NkUzMlx1NjdEM1x1NjVGNlx1OTY1MFx1NTIzNlx1NkRGMVx1NUVBNiAqL1xyXG4gIGRlcHRoOiBudW1iZXI7XHJcbiAgLyoqIFx1NjI4QVx1NTM2MVx1NzI0N1x1NjJENlx1NTIzMFx1NTNFNlx1NEUwMFx1NUYyMFx1NTM2MVx1NzI0N1x1NEUwQVx1OTFDRFx1NjM5Mlx1NjVGNlx1NTZERVx1OEMwM1x1RkYwOFx1NzUzMVx1NjNEMlx1NEVGNlx1NTNCQlx1NjUzOVx1NkU5MFx1NzgwMVx1OTFDQ1x1NzY4NFx1NUQ0Q1x1NTE2NVx1OTg3QVx1NUU4Rlx1RkYwOSAqL1xyXG4gIG9uUmVvcmRlcj86IChyZXE6IFJlb3JkZXJSZXF1ZXN0KSA9PiB2b2lkO1xyXG59XHJcblxyXG4vKiogZGF0YVRyYW5zZmVyIFx1OTFDQ1x1NzY4NFx1ODFFQVx1NUI5QVx1NEU0OVx1N0M3Qlx1NTc4Qlx1RkYxQVx1NjgwN1x1OEJCMFwiXHU4RkQ5XHU2NjJGXHU2NzJDXHU2M0QyXHU0RUY2XHU3Njg0XHU1MzYxXHU3MjQ3XHU1NzI4XHU2MkQ2XCIgKi9cclxuZXhwb3J0IGNvbnN0IEFDX0NBUkRfTUlNRSA9IFwiYXBwbGljYXRpb24veC1hdG9taWMtY2FyZHNcIjtcclxuXHJcbi8qKlxyXG4gKiBcdTYyRDZcdTYyRkRcdTRFMkRcdTUzNjFcdTcyNDdcdTc2ODRcdTcyMzZcdTVCQjlcdTU2NjhcdTMwMDJcclxuICogXHU3NTI4XHU0RThFXHU5NjUwXHU1MjM2XCJcdTUzRUFcdTY3MDlcdTU0MENcdTdFQTdcdTUzNjFcdTcyNDdcIlx1NjI0RFx1ODBGRFx1NEU5Mlx1NzZGOFx1NUY1M1x1NjUzRVx1N0Y2RVx1NzZFRVx1NjgwN1x1MjAxNFx1MjAxNFx1NTQyNlx1NTIxOVx1NjJENlx1NUQ0Q1x1NTk1N1x1NUMwRlx1NTM2MVx1NzI0N1x1NjVGNlx1RkYwQ1xyXG4gKiBcdTRFOEJcdTRFRjZcdTUxOTJcdTZDRTFcdTUyMzBcdTU5MTZcdTVDNDJcdTU5MjdcdTUzNjFcdTcyNDdcdTRGMUFcdTYyOEFcdTYzMDdcdTc5M0FcdTdFQkZcdTc1M0JcdTk1MTlcdTRGNERcdTdGNkVcdTMwMDJcclxuICovXHJcbmxldCBkcmFnU291cmNlUGFyZW50OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNldERyYWdTb3VyY2VQYXJlbnQoZWw6IEhUTUxFbGVtZW50IHwgbnVsbCk6IHZvaWQge1xyXG4gIGRyYWdTb3VyY2VQYXJlbnQgPSBlbDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzQ2FyZFJlb3JkZXJEcmFnKCk6IGJvb2xlYW4ge1xyXG4gIHJldHVybiBkcmFnU291cmNlUGFyZW50ICE9PSBudWxsO1xyXG59XHJcblxyXG5sZXQgbmVzdE1hcmtlciA9IDA7XHJcblxyXG4vKipcclxuICogXHU4QkIwXHU0RjRGXHU2QkNGXHU1RjIwXHU1MzYxXHU3MjQ3XHU3Njg0XHU1QzU1XHU1RjAwXHU3MkI2XHU2MDAxXHUzMDAyXHJcbiAqIFx1OTFDRFx1NjM5MiAvIFx1NjU4N1x1NEVGNlx1NEZERFx1NUI1OFx1NEYxQVx1ODlFNlx1NTNEMVx1OTFDRFx1NjVCMFx1NkUzMlx1NjdEM1x1RkYwQ1x1ODJFNVx1NkJDRlx1NkIyMVx1OTBGRFx1NTZERVx1ODQzRFx1NTIzMFx1OEJCRVx1N0Y2RVx1OUVEOFx1OEJBNFx1NTAzQ1x1RkYwQ1xyXG4gKiBcdTc1MjhcdTYyMzdcdTUyMUFcdTY1MzZcdThENzdcdTc2ODRcdTUzNjFcdTcyNDdcdTUzQzhcdTRGMUFcdTUxNjhcdTkwRThcdTVGMzlcdTVGMDBcdTMwMDJcdThGRDlcdTkxQ0NcdTYzMDlcdTdCMTRcdThCQjBcdThCQjBcdTRFMEJcdTY3MDBcdTU0MEVcdTRFMDBcdTZCMjFcdTc2ODRcdTYyNEJcdTUyQThcdTY0Q0RcdTRGNUNcdTMwMDJcclxuICovXHJcbmNvbnN0IGV4cGFuZE1lbW9yeSA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldE5lc3QoKTogbnVtYmVyIHtcclxuICByZXR1cm4gbmVzdE1hcmtlcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdpdGhOZXN0PFQ+KGRlcHRoOiBudW1iZXIsIGZuOiAoKSA9PiBUKTogVCB7XHJcbiAgY29uc3QgcHJldiA9IG5lc3RNYXJrZXI7XHJcbiAgbmVzdE1hcmtlciA9IGRlcHRoO1xyXG4gIHRyeSB7XHJcbiAgICByZXR1cm4gZm4oKTtcclxuICB9IGZpbmFsbHkge1xyXG4gICAgbmVzdE1hcmtlciA9IHByZXY7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBmbXRDb3VudChuOiBudW1iZXIpOiBzdHJpbmcge1xyXG4gIHJldHVybiBuID49IDEwMDAgPyBgJHsobiAvIDEwMDApLnRvRml4ZWQoMSl9ayBcdTVCNTdgIDogYCR7bn0gXHU1QjU3YDtcclxufVxyXG5cclxuLyoqIFx1NkNBMVx1NjcwOVx1NUMwMVx1OTc2Mlx1NjVGNlx1RkYwQ1x1NzUyOFx1N0M3Qlx1NTc4Qi9cdThERUZcdTVGODRcdTYzQThcdTY1QURcdTRFMDBcdTRFMkFcdTU2RkVcdTY4MDcgKi9cclxuZnVuY3Rpb24gaWNvbkZvcihtZXRhOiBOb3RlTWV0YSk6IHN0cmluZyB7XHJcbiAgLy8gXHU2QkI1XHU4NDNEIC8gXHU3N0U1XHU4QkM2XHU3MEI5XHU3RUE3XHU1RjE1XHU3NTI4XHJcbiAgaWYgKG1ldGEuYmxvY2tDb250ZW50KSByZXR1cm4gXCJxdW90ZVwiO1xyXG4gIGNvbnN0IHR5cGUgPSAobWV0YS5iYWRnZXMuZmluZCgoYikgPT4gYi5rZXkgPT09IFwidHlwZVwiKT8udmFsdWUgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcclxuICBjb25zdCBoYXkgPSBgJHt0eXBlfSAke21ldGEuZmlsZT8ucGF0aCA/PyBtZXRhLnRhcmdldH1gLnRvTG93ZXJDYXNlKCk7XHJcbiAgaWYgKC9jaGFwdGVyfFx1N0FFMFx1ODI4MnxcdTdFQzRcdTU0MDgvLnRlc3QoaGF5KSkgcmV0dXJuIFwibGF5ZXJzXCI7XHJcbiAgaWYgKC9jb25jZXB0fFx1Njk4Mlx1NUZGNS8udGVzdChoYXkpKSByZXR1cm4gXCJsaWdodGJ1bGJcIjtcclxuICBpZiAoL2VudGl0eXxcdTVCOUVcdTRGNTMvLnRlc3QoaGF5KSkgcmV0dXJuIFwidXNlclwiO1xyXG4gIGlmICgvcmVzb3VyY2V8XHU4RDQ0XHU2RTkwLy50ZXN0KGhheSkpIHJldHVybiBcInBhY2thZ2VcIjtcclxuICBpZiAoL2dvYWx8XHU3NkVFXHU2ODA3Ly50ZXN0KGhheSkpIHJldHVybiBcInRhcmdldFwiO1xyXG4gIGlmICgvbWV0YXxkYXNoYm9hcmR8aW5kZXgvLnRlc3QoaGF5KSkgcmV0dXJuIFwibGF5b3V0LWdyaWRcIjtcclxuICBpZiAoL2F0b218XHU1MzlGXHU1QjUwLy50ZXN0KGhheSkpIHJldHVybiBcImNpcmNsZS1kb3RcIjtcclxuICByZXR1cm4gXCJmaWxlLXRleHRcIjtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gb3Blbk5vdGUoZW52OiBDYXJkRW52LCBtZXRhOiBOb3RlTWV0YSwgZTogTW91c2VFdmVudCkge1xyXG4gIGlmICghbWV0YS5maWxlKSB7XHJcbiAgICBjb25zdCBuYW1lID0gbWV0YS50YXJnZXQuc3BsaXQoXCIjXCIpWzBdLnJlcGxhY2UoL1xcLm1kJC9pLCBcIlwiKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBlbnYuYXBwLnZhdWx0LmNyZWF0ZShcclxuICAgICAgICBgJHtuYW1lfS5tZGAsXHJcbiAgICAgICAgYC0tLVxcbnR5cGU6IGF0b21cXG50aXRsZTogXCIke21ldGEudGl0bGV9XCJcXG5jcmVhdGVkOiAke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCl9XFxuLS0tXFxuXFxuIyAke21ldGEudGl0bGV9XFxuXFxuYFxyXG4gICAgICApO1xyXG4gICAgICBhd2FpdCBlbnYuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQoZmlsZS5wYXRoLCBlbnYuc291cmNlUGF0aCwgZmFsc2UpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIG5ldyBOb3RpY2UoYFx1NTIxQlx1NUVGQVx1NTkzMVx1OEQyNVx1RkYxQSR7U3RyaW5nKGVycil9YCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIGNvbnN0IG5ld0xlYWYgPSBlLmN0cmxLZXkgfHwgZS5tZXRhS2V5IHx8IGUuYnV0dG9uID09PSAxO1xyXG4gIC8vIHRhcmdldCBcdTUzRUZcdTgwRkRcdTVFMjYgI1x1NjgwN1x1OTg5OCAvICNeXHU1NzU3aWRcdUZGMENcdTRFQTRcdTdFRDkgT2JzaWRpYW4gXHU1QjlBXHU0RjREXHU1MjMwXHU2QkI1XHU4NDNEXHJcbiAgYXdhaXQgZW52LmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KG1ldGEudGFyZ2V0IHx8IG1ldGEuZmlsZS5wYXRoLCBlbnYuc291cmNlUGF0aCwgbmV3TGVhZik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhyZWZPZihtZXRhOiBOb3RlTWV0YSk6IHN0cmluZyB7XHJcbiAgaWYgKCFtZXRhLmZpbGUpIHJldHVybiBcIiNcIjtcclxuICByZXR1cm4gbWV0YS5yZWYgPyBgJHttZXRhLmZpbGUucGF0aH0jJHttZXRhLnJlZn1gIDogbWV0YS5maWxlLnBhdGg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJ1aWxkTWV0YVJvdyhtZXRhOiBOb3RlTWV0YSk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XHJcbiAgaWYgKCFtZXRhLmJhZGdlcy5sZW5ndGggJiYgIW1ldGEudXBkYXRlZCAmJiAhbWV0YS53b3JkQ291bnQpIHJldHVybiBudWxsO1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgcm93LmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fbWV0YVwiO1xyXG4gIGZvciAoY29uc3QgYiBvZiBtZXRhLmJhZGdlcy5zbGljZSgwLCAyKSkge1xyXG4gICAgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IGBhYy1iYWRnZSBhYy1iYWRnZS0tJHtiLmtleX1gLCB0ZXh0OiBiLnZhbHVlIH0pO1xyXG4gIH1cclxuICBpZiAobWV0YS51cGRhdGVkKSByb3cuY3JlYXRlU3Bhbih7IGNsczogXCJhYy1tZXRhX19kYXRlXCIsIHRleHQ6IG1ldGEudXBkYXRlZCB9KTtcclxuICBpZiAobWV0YS53b3JkQ291bnQpIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLW1ldGFfX3dvcmRzXCIsIHRleHQ6IGZtdENvdW50KG1ldGEud29yZENvdW50KSB9KTtcclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZFRhZ1JvdyhtZXRhOiBOb3RlTWV0YSwgbGltaXQ6IG51bWJlcik6IEhUTUxFbGVtZW50IHwgbnVsbCB7XHJcbiAgaWYgKCFtZXRhLnRhZ3MubGVuZ3RoKSByZXR1cm4gbnVsbDtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSBcImFjLWNhcmRfX3RhZ3NcIjtcclxuICBmb3IgKGNvbnN0IHQgb2YgbWV0YS50YWdzLnNsaWNlKDAsIGxpbWl0KSkgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwiYWMtdGFnXCIsIHRleHQ6IGAjJHt0fWAgfSk7XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckNhcmQoZW52OiBDYXJkRW52LCBtZXRhOiBOb3RlTWV0YSwgb3B0czogUmVuZGVyT3B0aW9ucyk6IEhUTUxFbGVtZW50IHtcclxuICBjb25zdCBpc1dyYXAgPSBvcHRzLmxheW91dCAhPT0gXCJjYXJkXCI7XHJcbiAgY29uc3QgaXNTbWFsbCA9IG9wdHMuc2l6ZSA9PT0gXCJzbWFsbFwiO1xyXG5cclxuICBjb25zdCBjYXJkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICBjYXJkLmNsYXNzTmFtZSA9IGBhYy1jYXJkIGFjLSR7b3B0cy5kZW5zaXR5fSBhYy1zaXplLSR7b3B0cy5zaXplfSBhYy0ke1xyXG4gICAgaXNXcmFwID8gXCJ3cmFwXCIgOiBcImNhcmRzdHlsZVwiXHJcbiAgfWA7XHJcbiAgY2FyZC5kYXRhc2V0LnBhdGggPSBtZXRhLmZpbGU/LnBhdGggPz8gbWV0YS50YXJnZXQ7XHJcbiAgaWYgKCFtZXRhLmZpbGUpIGNhcmQuY2xhc3NMaXN0LmFkZChcImlzLW1pc3NpbmdcIik7XHJcbiAgaWYgKG1ldGEuYmxvY2tDb250ZW50KSBjYXJkLmNsYXNzTGlzdC5hZGQoXCJpcy1ibG9ja1wiKTtcclxuICBpZiAob3B0cy5oZWlnaHQgPiAwKSBjYXJkLnN0eWxlLnNldFByb3BlcnR5KFwiLS1hYy1jYXJkLWhcIiwgYCR7b3B0cy5oZWlnaHR9cHhgKTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTZCNjNcdTY1ODdcdTVCQjlcdTU2NjhcdUZGMDhcdTUxNDhcdTVFRkFcdUZGMENcdTY3MDBcdTU0MEUgYXBwZW5kXHVGRjA5IC0tLS0tLS0tLS0gKi9cclxuICBjb25zdCBib2R5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICBib2R5LmNsYXNzTmFtZSA9IFwiYWMtY2FyZF9fYm9keVwiO1xyXG4gIGJvZHkuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gIGxldCBib2R5TG9hZGVkID0gZmFsc2U7XHJcblxyXG4gIGNvbnN0IGxvYWRCb2R5ID0gKCkgPT4ge1xyXG4gICAgaWYgKGJvZHlMb2FkZWQgfHwgIW1ldGEuZmlsZSkgcmV0dXJuO1xyXG4gICAgYm9keUxvYWRlZCA9IHRydWU7XHJcbiAgICBjb25zdCBmaWxlID0gbWV0YS5maWxlO1xyXG4gICAgdm9pZCBlbnYuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSkudGhlbigocmF3KSA9PiB7XHJcbiAgICAgIGNvbnN0IGZ1bGwgPSByYXcucmVwbGFjZSgvXi0tLVxccj9cXG5bXFxzXFxTXSo/XFxyP1xcbi0tLVxccj9cXG4/LywgXCJcIik7XHJcbiAgICAgIGNvbnN0IG1kID0gbWV0YS5ibG9ja0NvbnRlbnQgPz8gZnVsbDtcclxuICAgICAgYm9keS5lbXB0eSgpO1xyXG4gICAgICB3aXRoTmVzdChlbnYuZGVwdGgsICgpID0+IHtcclxuICAgICAgICByZW5kZXJNYXJrZG93bihlbnYuYXBwLCBtZCwgYm9keSwgZmlsZS5wYXRoLCBlbnYuY29tcG9uZW50KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1N0FENlx1NzI0OFx1NTM2MVx1NzI0Q1x1RkYxQVx1OTg3Nlx1OTBFOFx1NUMwMVx1OTc2MiAtLS0tLS0tLS0tICovXHJcbiAgaWYgKCFpc1dyYXAgJiYgb3B0cy5jb3ZlciAmJiBtZXRhLmNvdmVyKSB7XHJcbiAgICBjb25zdCBjb3ZlciA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWNhcmRfX2NvdmVyXCIgfSk7XHJcbiAgICBjb25zdCBpbWcgPSBjb3Zlci5jcmVhdGVFbChcImltZ1wiLCB7XHJcbiAgICAgIGF0dHI6IHsgc3JjOiBtZXRhLmNvdmVyLCBhbHQ6IG1ldGEudGl0bGUsIGxvYWRpbmc6IFwibGF6eVwiLCBkcmFnZ2FibGU6IFwiZmFsc2VcIiB9LFxyXG4gICAgfSk7XHJcbiAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsICgpID0+IGNvdmVyLnJlbW92ZSgpKTtcclxuICB9XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU1OTM0XHU5MEU4XHVGRjFBXHU1NkZFXHU2ODA3ICsgXHU2ODA3XHU5ODk4ICsgXHU2ODA3XHU3QjdFICsgXHU1RkJEXHU3QUUwICsgXHU2NENEXHU0RjVDXHVGRjBDXHU1MTY4XHU1NzI4XHU0RTAwXHU4ODRDIC0tLS0tLS0tLS0gKi9cclxuICBjb25zdCBoZWFkID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYWMtY2FyZF9faGVhZFwiIH0pO1xyXG5cclxuICBpZiAoaXNXcmFwKSB7XHJcbiAgICBjb25zdCB0aHVtYiA9IGhlYWQuY3JlYXRlRGl2KHsgY2xzOiBcImFjLWNhcmRfX3RodW1iXCIgfSk7XHJcbiAgICBpZiAob3B0cy5jb3ZlciAmJiBtZXRhLmNvdmVyKSB7XHJcbiAgICAgIGNvbnN0IGltZyA9IHRodW1iLmNyZWF0ZUVsKFwiaW1nXCIsIHtcclxuICAgICAgICBhdHRyOiB7IHNyYzogbWV0YS5jb3ZlciwgYWx0OiBtZXRhLnRpdGxlLCBsb2FkaW5nOiBcImxhenlcIiwgZHJhZ2dhYmxlOiBcImZhbHNlXCIgfSxcclxuICAgICAgfSk7XHJcbiAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4ge1xyXG4gICAgICAgIHRodW1iLmVtcHR5KCk7XHJcbiAgICAgICAgc2V0SWNvbih0aHVtYiwgaWNvbkZvcihtZXRhKSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgc2V0SWNvbih0aHVtYiwgaWNvbkZvcihtZXRhKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdCB0aXRsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XHJcbiAgdGl0bGVFbC5jbGFzc05hbWUgPSBcImFjLWNhcmRfX3RpdGxlXCI7XHJcbiAgdGl0bGVFbC5zZXRBdHRyKFwiaHJlZlwiLCBocmVmT2YobWV0YSkpO1xyXG4gIHRpdGxlRWwudGV4dENvbnRlbnQgPSBtZXRhLnRpdGxlO1xyXG4gIHRpdGxlRWwudGl0bGUgPSBtZXRhLmZpbGVcclxuICAgID8gYCR7aHJlZk9mKG1ldGEpfVx1RkYwOFx1NzBCOVx1NTFGQlx1NUM1NVx1NUYwMC9cdTY1MzZcdThENzdcdUZGMENDdHJsK1x1NzBCOVx1NTFGQlx1OERGM1x1NTIzMFx1NTM5Rlx1NjU4N1x1RkYwOWBcclxuICAgIDogYFx1NjVCMFx1NUVGQVx1RkYxQSR7bWV0YS50YXJnZXR9YDtcclxuICBoZWFkLmFwcGVuZENoaWxkKHRpdGxlRWwpO1xyXG5cclxuICBpZiAoIW1ldGEuZmlsZSkgaGVhZC5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWNhcmRfX21pc3NpbmdcIiwgdGV4dDogXCJcdTY3MkFcdTUyMUJcdTVFRkFcIiB9KTtcclxuXHJcbiAgaWYgKG9wdHMudGFncykge1xyXG4gICAgY29uc3QgdGFnUm93ID0gYnVpbGRUYWdSb3cobWV0YSwgaXNTbWFsbCA/IDIgOiAzKTtcclxuICAgIGlmICh0YWdSb3cpIGhlYWQuYXBwZW5kQ2hpbGQodGFnUm93KTtcclxuICB9XHJcblxyXG4gIGlmIChvcHRzLm1ldGEpIHtcclxuICAgIGNvbnN0IG1ldGFSb3cgPSBidWlsZE1ldGFSb3cobWV0YSk7XHJcbiAgICBpZiAobWV0YVJvdykgaGVhZC5hcHBlbmRDaGlsZChtZXRhUm93KTtcclxuICB9XHJcblxyXG4gIGNvbnN0IGFjdGlvbnMgPSBoZWFkLmNyZWF0ZURpdih7IGNsczogXCJhYy1jYXJkX19hY3Rpb25zXCIgfSk7XHJcblxyXG4gIGNvbnN0IHRvZ2dsZUJ0biA9IGFjdGlvbnMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiYWMtYnRuIGFjLWJ0bi0tdG9nZ2xlXCIgfSk7XHJcbiAgY29uc3QgdG9nZ2xlSWNvbiA9IHRvZ2dsZUJ0bi5jcmVhdGVTcGFuKHsgY2xzOiBcImFjLWJ0bl9faWNvblwiIH0pO1xyXG4gIGNvbnN0IHRvZ2dsZVRleHQgPSB0b2dnbGVCdG4uY3JlYXRlU3Bhbih7IGNsczogXCJhYy1idG5fX3RleHRcIiwgdGV4dDogXCJcdTVDNTVcdTVGMDBcIiB9KTtcclxuICBzZXRJY29uKHRvZ2dsZUljb24sIFwiY2hldnJvbi1kb3duXCIpO1xyXG5cclxuICBpZiAob3B0cy5vcGVuKSB7XHJcbiAgICBjb25zdCBvcGVuQnRuID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJhYy1idG4gYWMtYnRuLS1vcGVuXCIgfSk7XHJcbiAgICBjb25zdCBvcGVuSWNvbiA9IG9wZW5CdG4uY3JlYXRlU3Bhbih7IGNsczogXCJhYy1idG5fX2ljb25cIiB9KTtcclxuICAgIG9wZW5CdG4uY3JlYXRlU3Bhbih7IGNsczogXCJhYy1idG5fX3RleHRcIiwgdGV4dDogXCJcdTYyNTNcdTVGMDBcIiB9KTtcclxuICAgIHNldEljb24ob3Blbkljb24sIFwiYXJyb3ctdXAtcmlnaHRcIik7XHJcbiAgICBvcGVuQnRuLnRpdGxlID0gbWV0YS5maWxlID8gXCJcdTU3MjhcdTUzOUZcdTU5Q0JcdTY1ODdcdTY4NjNcdTRFMkRcdTYyNTNcdTVGMDBcIiA6IFwiXHU1MjFCXHU1RUZBXHU4RkQ5XHU3QkM3XHU2NTg3XHU2ODYzXCI7XHJcbiAgICBvcGVuQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4gdm9pZCBvcGVuTm90ZShlbnYsIG1ldGEsIGUpKTtcclxuICB9XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU2NDU4XHU4OTgxXHVGRjA4XHU0RTJEXHVGRjA5IC0tLS0tLS0tLS0gKi9cclxuICBjYXJkLmNyZWF0ZURpdih7XHJcbiAgICBjbHM6IFwiYWMtY2FyZF9fc3VtbWFyeVwiLFxyXG4gICAgdGV4dDogbWV0YS5zdW1tYXJ5IHx8IChtZXRhLmZpbGUgPyBcIlx1RkYwOFx1NjY4Mlx1NjVFMFx1NjQ1OFx1ODk4MVx1RkYwOVwiIDogXCJcdTcwQjlcdTUxRkJcdTY4MDdcdTk4OThcdTUyMUJcdTVFRkFcdThGRDlcdTdCQzdcdTUzOUZcdTVCNTBcdTY1ODdcdTY4NjNcIiksXHJcbiAgfSk7XHJcblxyXG4gIC8qIC0tLS0tLS0tLS0gXHU2QjYzXHU2NTg3XHVGRjA4XHU2REYxXHVGRjA5IC0tLS0tLS0tLS0gKi9cclxuICBjYXJkLmFwcGVuZENoaWxkKGJvZHkpO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tIFx1NUM1NVx1NUYwMCAvIFx1NjUzNlx1OEQ3NyAtLS0tLS0tLS0tICovXHJcbiAgY29uc3QgbWVtb3J5S2V5ID0gbWV0YS5maWxlPy5wYXRoID8/IG1ldGEudGFyZ2V0O1xyXG4gIGxldCBleHBhbmRlZCA9IGZhbHNlO1xyXG4gIGNvbnN0IHNldEV4cGFuZGVkID0gKG5leHQ6IGJvb2xlYW4pID0+IHtcclxuICAgIGV4cGFuZGVkID0gbmV4dDtcclxuICAgIGNhcmQuY2xhc3NMaXN0LnRvZ2dsZShcImlzLWV4cGFuZGVkXCIsIGV4cGFuZGVkKTtcclxuICAgIHRvZ2dsZVRleHQudGV4dENvbnRlbnQgPSBleHBhbmRlZCA/IFwiXHU2NTM2XHU4RDc3XCIgOiBcIlx1NUM1NVx1NUYwMFwiO1xyXG4gICAgc2V0SWNvbih0b2dnbGVJY29uLCBleHBhbmRlZCA/IFwiY2hldnJvbi11cFwiIDogXCJjaGV2cm9uLWRvd25cIik7XHJcbiAgICBib2R5LnN0eWxlLmRpc3BsYXkgPSBleHBhbmRlZCA/IFwiXCIgOiBcIm5vbmVcIjtcclxuICAgIGlmIChleHBhbmRlZCkgbG9hZEJvZHkoKTtcclxuICAgIGV4cGFuZE1lbW9yeS5zZXQobWVtb3J5S2V5LCBleHBhbmRlZCk7XHJcbiAgfTtcclxuXHJcbiAgdG9nZ2xlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBzZXRFeHBhbmRlZCghZXhwYW5kZWQpKTtcclxuXHJcbiAgLy8gXHU3MEI5XHU2ODA3XHU5ODk4XHU2NjJGXHU2Mjk4XHU1M0UwXHU1RjAwXHU1MTczXHVGRjFCXHU2MzA5XHU0RjRGIEN0cmwvQ21kIFx1NjI0RFx1OERGM1x1NTIzMFx1NTM5Rlx1NjU4N1xyXG4gIHRpdGxlRWwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSB8fCBlLmJ1dHRvbiA9PT0gMSkge1xyXG4gICAgICB2b2lkIG9wZW5Ob3RlKGVudiwgbWV0YSwgZSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHNldEV4cGFuZGVkKCFleHBhbmRlZCk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIFx1NTkzNFx1OTBFOFx1N0E3QVx1NzY3RFx1NTkwNFx1NEU1Rlx1NTNFRlx1NEVFNVx1NjI5OFx1NTNFMFx1RkYwOFx1NjMwOVx1OTRBRVx1NTQ4Q1x1OTRGRVx1NjNBNVx1ODFFQVx1NURGMVx1NTkwNFx1NzQwNlx1RkYwQ1x1NEUwRFx1OTFDRFx1NTkwRFx1ODlFNlx1NTNEMVx1RkYwOVxyXG4gIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XHJcbiAgICBjb25zdCBlbCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGlmIChlbD8uY2xvc2VzdChcImJ1dHRvbiwgYVwiKSkgcmV0dXJuO1xyXG4gICAgc2V0RXhwYW5kZWQoIWV4cGFuZGVkKTtcclxuICB9KTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTYyRDZcdTYyRkRcdUZGMUFcdTRFQ0VcdTUzNjFcdTcyNDdcdTU5MzRcdTkwRThcdTYyRDZcdTUyMzBcdTZCNjNcdTY1ODdcdUZGMENcdTYzRDJcdTUxNjUgIVtbIF1dIFx1NUQ0Q1x1NTE2NSAtLS0tLS0tLS0tXHJcbiAgICAgT2JzaWRpYW4gXHU1MzlGXHU3NTFGXHU0RUNFXHU2NTg3XHU0RUY2XHU1MjE3XHU4ODY4XHU2MkQ2XHU4RkRCXHU2NzY1XHU1M0VBXHU4MEZEXHU1Rjk3XHU1MjMwIFtbXHU5NEZFXHU2M0E1XV1cdUZGMENcdTVGOTdcdTRFMERcdTUyMzBcdTVENENcdTUxNjVcdTMwMDJcclxuICAgICBcdThGRDlcdTkxQ0NcdThCQTlcdTUzNjFcdTcyNDdcdTgxRUFcdTVERjFcdTUzRUZcdTRFRTVcdTg4QUJcdTYyRDZcdThENzBcdUZGMENcdTY1M0VcdTUyMzBcdTdGMTZcdThGOTFcdTU2NjhcdTUzNzNcdTc1MUZcdTYyMTAgIVtbXHU3QjE0XHU4QkIwXV1cdTMwMDJcclxuICAgICBcdTUzRUFcdThCQTlcdTU5MzRcdTkwRThcdTUzRUZcdTYyRDZcdUZGMUFcdTZCNjNcdTY1ODdcdTUzM0FcdTg5ODFcdTc1NTlcdTdFRDlcdTkwMDlcdTRFMkRcdTU5MERcdTUyMzZcdTU0OENcdTYyOThcdTUzRTBcdTcwQjlcdTUxRkJcdTMwMDIgKi9cclxuICBjb25zdCBzZWxmTmFtZSA9IG1ldGEuZmlsZT8uYmFzZW5hbWUgPz8gbWV0YS50YXJnZXQ7XHJcblxyXG4gIGhlYWQuZHJhZ2dhYmxlID0gdHJ1ZTtcclxuICBoZWFkLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnc3RhcnRcIiwgKGUpID0+IHtcclxuICAgIGlmICghbWV0YS5maWxlKSByZXR1cm47XHJcbiAgICBjb25zdCBsaW5rID0gbWV0YS5yZWYgPyBgIVtbJHtzZWxmTmFtZX0jJHttZXRhLnJlZn1dXWAgOiBgIVtbJHtzZWxmTmFtZX1dXWA7XHJcbiAgICAvLyBcdTU0MENcdTY1RjZcdTdFRDlcdTRFMjRcdTc5Q0RcdTY1NzBcdTYzNkVcdUZGMUFcdTgxRUFcdTVCOUFcdTRFNDlcdTdDN0JcdTU3OEJcdTc1MjhcdTRFOEVcdTUzNjFcdTcyNDdcdTk1RjRcdTkxQ0RcdTYzOTJcdUZGMEN0ZXh0L3BsYWluIFx1NzUyOFx1NEU4RVx1NjJENlx1NTIzMFx1NkI2M1x1NjU4N1x1NjNEMlx1NTE2NVxyXG4gICAgZS5kYXRhVHJhbnNmZXI/LnNldERhdGEoQUNfQ0FSRF9NSU1FLCBzZWxmTmFtZSk7XHJcbiAgICBlLmRhdGFUcmFuc2Zlcj8uc2V0RGF0YShcInRleHQvcGxhaW5cIiwgbGluayk7XHJcbiAgICBpZiAoZS5kYXRhVHJhbnNmZXIpIGUuZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSBcImNvcHlcIjtcclxuICAgIC8vIFx1OEJCMFx1NEUwQlx1NkU5MFx1NTM2MVx1NzI0N1x1NzY4NFx1NzIzNlx1NUJCOVx1NTY2OFx1RkYxQVx1NTNFQVx1NjcwOVx1NTQwQ1x1N0VBN1x1NTM2MVx1NzI0N1x1NjI0RFx1ODBGRFx1NEU5Mlx1NzZGOFx1NUY1M1x1NjUzRVx1N0Y2RVx1NzZFRVx1NjgwN1xyXG4gICAgc2V0RHJhZ1NvdXJjZVBhcmVudChjYXJkLnBhcmVudEVsZW1lbnQpO1xyXG4gICAgY2FyZC5jbGFzc0xpc3QuYWRkKFwiaXMtZHJhZ2dpbmdcIik7XHJcbiAgfSk7XHJcblxyXG4gIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4ge1xyXG4gICAgY2FyZC5jbGFzc0xpc3QucmVtb3ZlKFwiaXMtZHJhZ2dpbmdcIik7XHJcbiAgICBzZXREcmFnU291cmNlUGFyZW50KG51bGwpO1xyXG4gICAgY2xlYXJEcm9wTWFya3MoKTtcclxuICB9KTtcclxuXHJcbiAgLyogLS0tLS0tLS0tLSBcdTRGNUNcdTRFM0FcdTY1M0VcdTdGNkVcdTc2RUVcdTY4MDdcdUZGMUFcdTYyRDZcdTUzRTZcdTRFMDBcdTVGMjBcdTUzNjFcdTcyNDdcdThGQzdcdTY3NjUgXHUyMTkyIFx1OTFDRFx1NjM5MiAtLS0tLS0tLS0tICovXHJcbiAgY29uc3QgY2xlYXJEcm9wTWFya3MgPSAoKSA9PiB7XHJcbiAgICBmb3IgKGNvbnN0IGVsIG9mIEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5hYy1kcm9wLWJlZm9yZSwgLmFjLWRyb3AtYWZ0ZXJcIikpKSB7XHJcbiAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoXCJhYy1kcm9wLWJlZm9yZVwiLCBcImFjLWRyb3AtYWZ0ZXJcIik7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY2FyZC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ292ZXJcIiwgKGUpID0+IHtcclxuICAgIGNvbnN0IGR0ID0gZS5kYXRhVHJhbnNmZXI7XHJcbiAgICBpZiAoIWR0IHx8ICFBcnJheS5mcm9tKGR0LnR5cGVzKS5pbmNsdWRlcyhBQ19DQVJEX01JTUUpKSByZXR1cm47XHJcbiAgICAvLyBcdTVERjJcdTdFQ0ZcdTU3MjhcdTYyRDZcdTc2ODRcdTY2MkZcdTgxRUFcdTVERjEgXHUyMTkyIFx1NEUwRFx1NjNBNVx1NjUzNlxyXG4gICAgaWYgKGNhcmQuY2xhc3NMaXN0LmNvbnRhaW5zKFwiaXMtZHJhZ2dpbmdcIikpIHJldHVybjtcclxuICAgIC8vIFx1MjZBMFx1RkUwRiBcdTVENENcdTU5NTdcdTUzNjFcdTcyNDdcdTc2ODRcdTRFOEJcdTRFRjZcdTRGMUFcdTUxOTJcdTZDRTFcdTUyMzBcdTU5MTZcdTVDNDJcdTU5MjdcdTUzNjFcdTcyNDdcdTMwMDJcdTRFOEJcdTRFRjZcdTc2RUVcdTY4MDdcdTY3MDBcdThGRDFcdTc2ODQgLmFjLWNhcmRcclxuICAgIC8vICAgIFx1NUZDNVx1OTg3Qlx1NjYyRlx1ODFFQVx1NURGMVx1RkYwQ1x1NTQyNlx1NTIxOVx1NjJENlx1NUMwRlx1NTM2MVx1NzI0N1x1NjVGNlx1NjMwN1x1NzkzQVx1N0VCRlx1NEYxQVx1NzUzQlx1NTIzMFx1NTkyN1x1NTM2MVx1NzI0N1x1NEUwQVx1MzAwMlxyXG4gICAgY29uc3QgbmVhcmVzdCA9IChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdD8uKFwiLmFjLWNhcmRcIik7XHJcbiAgICBpZiAobmVhcmVzdCAhPT0gY2FyZCkgcmV0dXJuO1xyXG4gICAgLy8gXHUyNkEwXHVGRTBGIFx1NTNFQVx1NTE0MVx1OEJCOFx1NTQwQ1x1N0VBN1x1RkYwOFx1NTQwQ1x1NzIzNlx1NUJCOVx1NTY2OFx1RkYwOVx1NjM5Mlx1NUU4Rlx1RkYxQVx1NjJENlx1NUQ0Q1x1NTk1N1x1NUMwRlx1NTM2MVx1NzI0N1x1NjVGNlx1NEUwRFx1NUY3MVx1NTRDRFx1NTkxNlx1NUM0Mlx1RkYwQ1xyXG4gICAgLy8gICAgXHU5RjIwXHU2ODA3XHU4NDNEXHU1NzI4XHU1QzBGXHU1MzYxXHU3MjQ3XHU5NUY0XHU5Njk5XHU2NUY2IHRhcmdldCBcdTRGMUFcdTY2MkZcdTU5MjdcdTUzNjFcdTcyNDcvXHU3QTdBXHU3NjdEXHVGRjBDXHU3MjM2XHU1QkI5XHU1NjY4XHU0RTBEXHU1NDBDXHU3NkY0XHU2M0E1XHU1RkZEXHU3NTY1XHUzMDAyXHJcbiAgICBpZiAoY2FyZC5wYXJlbnRFbGVtZW50ICE9PSBkcmFnU291cmNlUGFyZW50KSByZXR1cm47XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoZHQuZHJvcEVmZmVjdCkgZHQuZHJvcEVmZmVjdCA9IFwibW92ZVwiO1xyXG4gICAgY29uc3QgYm94ID0gY2FyZC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIGNvbnN0IGJlZm9yZSA9IGUuY2xpZW50WSA8IGJveC50b3AgKyBib3guaGVpZ2h0IC8gMjtcclxuICAgIGNhcmQuY2xhc3NMaXN0LnRvZ2dsZShcImFjLWRyb3AtYmVmb3JlXCIsIGJlZm9yZSk7XHJcbiAgICBjYXJkLmNsYXNzTGlzdC50b2dnbGUoXCJhYy1kcm9wLWFmdGVyXCIsICFiZWZvcmUpO1xyXG4gIH0pO1xyXG5cclxuICBjYXJkLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnbGVhdmVcIiwgKCkgPT4ge1xyXG4gICAgY2FyZC5jbGFzc0xpc3QucmVtb3ZlKFwiYWMtZHJvcC1iZWZvcmVcIiwgXCJhYy1kcm9wLWFmdGVyXCIpO1xyXG4gIH0pO1xyXG5cclxuICBjYXJkLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlKSA9PiB7XHJcbiAgICBjb25zdCBkdCA9IGUuZGF0YVRyYW5zZmVyO1xyXG4gICAgY29uc3Qgc291cmNlID0gZHQ/LmdldERhdGEoQUNfQ0FSRF9NSU1FKSA/PyBcIlwiO1xyXG4gICAgY2FyZC5jbGFzc0xpc3QucmVtb3ZlKFwiYWMtZHJvcC1iZWZvcmVcIiwgXCJhYy1kcm9wLWFmdGVyXCIpO1xyXG4gICAgaWYgKGVudi5zZXR0aW5ncy52ZXJib3NlKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiW2F0b21pYy1jYXJkc10gY2FyZCBkcm9wOlwiLCB7XHJcbiAgICAgICAgc291cmNlLFxyXG4gICAgICAgIHRhcmdldDogc2VsZk5hbWUsXHJcbiAgICAgICAgdHlwZXM6IGR0ID8gQXJyYXkuZnJvbShkdC50eXBlcykgOiBudWxsLFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIGlmICghc291cmNlIHx8IHNvdXJjZSA9PT0gc2VsZk5hbWUpIHJldHVybjtcclxuICAgIC8vIFx1NTQwQyBkcmFnb3Zlclx1RkYxQVx1NTNFQVx1OEJBNFx1NjcwMFx1OEZEMVx1NTM2MVx1NzI0N1x1NjYyRlx1ODFFQVx1NURGMVx1NzY4NCBkcm9wXHVGRjBDXHU0RTE0XHU1RkM1XHU5ODdCXHU2NjJGXHU1NDBDXHU3RUE3XHU1MzYxXHU3MjQ3XHJcbiAgICBjb25zdCBuZWFyZXN0ID0gKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0Py4oXCIuYWMtY2FyZFwiKTtcclxuICAgIGlmIChuZWFyZXN0ICE9PSBjYXJkKSByZXR1cm47XHJcbiAgICBpZiAoY2FyZC5wYXJlbnRFbGVtZW50ICE9PSBkcmFnU291cmNlUGFyZW50KSByZXR1cm47XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgY29uc3QgYm94ID0gY2FyZC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIGVudi5vblJlb3JkZXI/Lih7XHJcbiAgICAgIHNvdXJjZSxcclxuICAgICAgdGFyZ2V0OiBzZWxmTmFtZSxcclxuICAgICAgYmVmb3JlOiBlLmNsaWVudFkgPCBib3gudG9wICsgYm94LmhlaWdodCAvIDIsXHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgLy8gXHU2NzA5XHU4QkIwXHU1RjU1XHU1QzMxXHU2MDYyXHU1OTBEXHU0RTBBXHU2QjIxXHU3MkI2XHU2MDAxXHVGRjBDXHU2Q0ExXHU2NzA5XHU4QkIwXHU1RjU1XHU2MjREXHU3NTI4XHU4QkJFXHU3RjZFXHU5MUNDXHU3Njg0XHU5RUQ4XHU4QkE0XHU1MDNDXHJcbiAgaWYgKGV4cGFuZE1lbW9yeS5nZXQobWVtb3J5S2V5KSA/PyBvcHRzLmV4cGFuZGVkKSBzZXRFeHBhbmRlZCh0cnVlKTtcclxuXHJcbiAgcmV0dXJuIGNhcmQ7XHJcbn1cclxuIiwgImltcG9ydCB7IEFwcCwgQ2FjaGVkTWV0YWRhdGEsIENvbXBvbmVudCwgRnJvbnRNYXR0ZXJDYWNoZSwgTWFya2Rvd25SZW5kZXJlciwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTm90ZUJhZGdlIHtcclxuICBrZXk6IHN0cmluZztcclxuICB2YWx1ZTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVNZXRhIHtcclxuICBmaWxlOiBURmlsZSB8IG51bGw7XHJcbiAgLyoqIFx1NTM5Rlx1NTlDQlx1NUYxNVx1NzUyOFx1RkYwOFx1NTNFRlx1NTQyQiAjXHU2ODA3XHU5ODk4IFx1NjIxNiAjXlx1NTc1N2lkXHVGRjA5ICovXHJcbiAgdGFyZ2V0OiBzdHJpbmc7XHJcbiAgLyoqICMgXHU0RTRCXHU1NDBFXHU3Njg0XHU5MEU4XHU1MjA2XHVGRjBDXHU2Q0ExXHU2NzA5XHU1MjE5XHU0RTNBXHU3QTdBICovXHJcbiAgcmVmOiBzdHJpbmc7XHJcbiAgdGl0bGU6IHN0cmluZztcclxuICBzdW1tYXJ5OiBzdHJpbmc7XHJcbiAgY292ZXI6IHN0cmluZyB8IG51bGw7XHJcbiAgdGFnczogc3RyaW5nW107XHJcbiAgYmFkZ2VzOiBOb3RlQmFkZ2VbXTtcclxuICB1cGRhdGVkOiBzdHJpbmc7XHJcbiAgd29yZENvdW50OiBudW1iZXI7XHJcbiAgLyoqIFx1NkJCNVx1ODQzRFx1N0VBN1x1NUYxNVx1NzUyOFx1RkYwOFtbXHU5ODc1I1x1NjgwN1x1OTg5OF1dIC8gW1tcdTk4NzUjXlx1NTc1N11dXHVGRjA5XHU2NUY2XHVGRjBDXHU4QkU1XHU2QkI1XHU4NDNEXHU3Njg0XHU2QjYzXHU2NTg3ICovXHJcbiAgYmxvY2tDb250ZW50Pzogc3RyaW5nO1xyXG59XHJcblxyXG5jb25zdCBjYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBOb3RlTWV0YT4oKTtcclxuXHJcbmZ1bmN0aW9uIHN0cmlwRnJvbnRtYXR0ZXIocmF3OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IG0gPSByYXcubWF0Y2goL14tLS1cXHI/XFxuW1xcc1xcU10qP1xccj9cXG4tLS1cXHI/XFxuPy8pO1xyXG4gIHJldHVybiBtID8gcmF3LnNsaWNlKG1bMF0ubGVuZ3RoKSA6IHJhdztcclxufVxyXG5cclxuLyoqIFx1NjI4QSBtYXJrZG93biBcdTZCNjNcdTY1ODdcdTUzOEJcdTYyMTBcdTRFMDBcdTZCQjVcdTdFQUZcdTY1ODdcdTY3MkNcdTY0NThcdTg5ODEgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHRvUGxhaW5UZXh0KGJvZHk6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIHN0cmlwRnJvbnRtYXR0ZXIoYm9keSlcclxuICAgIC5yZXBsYWNlKC9gYGBbXFxzXFxTXSo/YGBgL2csIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvXlxccyo+XFxzKlxcWyFcXHcrW15cXF1dKlxcXS4qJC9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC8hXFxbXFxbW15cXF1dKlxcXVxcXS9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoLyFcXFtbXlxcXV0qXFxdXFwoW14pXSpcXCkvZywgXCJcIilcclxuICAgIC8vIEhUTUwgXHU2Q0U4XHU5MUNBXHVGRjFBaVdpa2kgXHU2MjkzXHU1M0Q2XHU3Njg0XHU2NzYxXHU3NkVFXHU2NjZFXHU5MDREXHU1RTI2IDwhLS0gXHU2NzY1XHU2RTkwIGl3aWtpIGRvY2lkOnh4eCAtLT5cdUZGMENcclxuICAgIC8vIFx1NEUwRFx1NkUwNVx1NjM4OVx1NzY4NFx1OEJERFx1NUI4M1x1NEYxQVx1NTM5Rlx1NjgzN1x1NTFGQVx1NzNCMFx1NTcyOFx1NTM2MVx1NzI0N1x1NjQ1OFx1ODk4MVx1OTFDQ1x1MzAwMlxyXG4gICAgLnJlcGxhY2UoLzwhLS1bXFxzXFxTXSo/LS0+L2csIFwiXCIpXHJcbiAgICAucmVwbGFjZSgvXFxbXFxbKFteXFxdfF0rKVxcfD8oW15cXF1dKilcXF1cXF0vZywgKF9tLCBhOiBzdHJpbmcsIGI6IHN0cmluZykgPT4gYiB8fCBhKVxyXG4gICAgLnJlcGxhY2UoL1xcWyhbXlxcXV0qKVxcXVxcKFteKV0qXFwpL2csIFwiJDFcIilcclxuICAgIC5yZXBsYWNlKC9eXFxzezAsM30jezEsNn1cXHMrLiokL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHN7MCwzfT5cXHM/L2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHMqWy0qK11cXHMrL2dtLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL15cXHMqXFxkK1xcLlxccysvZ20sIFwiXCIpXHJcbiAgICAvLyBcdTg4NjhcdTY4M0NcdUZGMUFcdTUxNDhcdTUyMjBcdTYzODkgfCAtLS0gfCBcdThGRDlcdTdDN0JcdTUyMDZcdTk2OTRcdTg4NENcdUZGMENcdTUxOERcdTYyOEFcdTUyNjlcdTRFMEJcdTc2ODRcdTdBRDZcdTdFQkZcdTUzRDhcdTYyMTBcdTdBN0FcdTY4M0NcdUZGMENcclxuICAgIC8vIFx1NTQyNlx1NTIxOVx1NEVFNVx1ODg2OFx1NjgzQ1x1NEUzQVx1NEUzQlx1NzY4NFx1Njc2MVx1NzZFRVx1NjQ1OFx1ODk4MVx1NEYxQVx1NTNEOFx1NjIxMFx1NEUwMFx1NEUzMlx1N0JBMVx1OTA1M1x1N0IyNlx1MzAwMlxyXG4gICAgLnJlcGxhY2UoL15cXHMqXFx8P1tcXHM6fC1dK1xcfD9cXHMqJC9nbSwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9cXHwvZywgXCIgXCIpXHJcbiAgICAucmVwbGFjZSgvWypfYH49XS9nLCBcIlwiKVxyXG4gICAgLnJlcGxhY2UoL1xccysvZywgXCIgXCIpXHJcbiAgICAudHJpbSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaXJzdFRleHQoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCB0ZXh0ID0gdG9QbGFpblRleHQoY29udGVudCk7XHJcbiAgcmV0dXJuIHRleHQubGVuZ3RoID4gMjQgPyBgJHt0ZXh0LnNsaWNlKDAsIDI0KX1cdTIwMjZgIDogdGV4dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFx1NEVDRVx1NjU4N1x1Njg2M1x1OTFDQ1x1NjIyQVx1NTNENlx1NEUwMFx1NEUyQVx1NkJCNVx1ODQzRFx1RkYwOFx1NzdFNVx1OEJDNlx1NzBCOVx1RkYwOVx1MzAwMlxyXG4gKiBcdTY1MkZcdTYzMDEgYFtbXHU5ODc1I1x1NjgwN1x1OTg5OF1dYCBcdTRFMEUgYFtbXHU5ODc1I15cdTU3NTdpZF1dYCBcdTRFMjRcdTc5Q0RcdTVGMTVcdTc1MjhcdTMwMDJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0QmxvY2soXHJcbiAgcmF3OiBzdHJpbmcsXHJcbiAgZmlsZUNhY2hlOiBDYWNoZWRNZXRhZGF0YSB8IG51bGwsXHJcbiAgcmVmOiBzdHJpbmdcclxuKTogeyB0aXRsZTogc3RyaW5nOyBjb250ZW50OiBzdHJpbmcgfSB8IG51bGwge1xyXG4gIGNvbnN0IGxpbmVzID0gcmF3LnNwbGl0KC9cXHI/XFxuLyk7XHJcbiAgY29uc3Qgd2FudGVkID0gZGVjb2RlVVJJQ29tcG9uZW50KHJlZik7XHJcblxyXG4gIC8vIFx1NTc1N1x1NUYxNVx1NzUyOCBeYmxvY2tpZFxyXG4gIGlmICh3YW50ZWQuc3RhcnRzV2l0aChcIl5cIikpIHtcclxuICAgIGNvbnN0IGJsb2NrID0gZmlsZUNhY2hlPy5ibG9ja3M/Llt3YW50ZWQuc2xpY2UoMSldO1xyXG4gICAgaWYgKCFibG9jaykgcmV0dXJuIG51bGw7XHJcbiAgICBjb25zdCBjb250ZW50ID0gbGluZXNcclxuICAgICAgLnNsaWNlKGJsb2NrLnBvc2l0aW9uLnN0YXJ0LmxpbmUsIGJsb2NrLnBvc2l0aW9uLmVuZC5saW5lICsgMSlcclxuICAgICAgLmpvaW4oXCJcXG5cIik7XHJcbiAgICByZXR1cm4geyB0aXRsZTogZmlyc3RUZXh0KGNvbnRlbnQpIHx8IHdhbnRlZCwgY29udGVudCB9O1xyXG4gIH1cclxuXHJcbiAgLy8gXHU2ODA3XHU5ODk4XHU1RjE1XHU3NTI4ICNoZWFkaW5nXHJcbiAgY29uc3QgaGVhZGluZ3MgPSBmaWxlQ2FjaGU/LmhlYWRpbmdzID8/IFtdO1xyXG4gIGNvbnN0IGlkeCA9IGhlYWRpbmdzLmZpbmRJbmRleCgoaCkgPT4gaC5oZWFkaW5nID09PSB3YW50ZWQpO1xyXG4gIGlmIChpZHggPCAwKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgY29uc3QgaCA9IGhlYWRpbmdzW2lkeF07XHJcbiAgY29uc3Qgc3RhcnQgPSBoLnBvc2l0aW9uLnN0YXJ0LmxpbmU7XHJcbiAgbGV0IGVuZCA9IGxpbmVzLmxlbmd0aCAtIDE7XHJcbiAgZm9yIChsZXQgaSA9IGlkeCArIDE7IGkgPCBoZWFkaW5ncy5sZW5ndGg7IGkrKykge1xyXG4gICAgaWYgKGhlYWRpbmdzW2ldLmxldmVsIDw9IGgubGV2ZWwpIHtcclxuICAgICAgZW5kID0gaGVhZGluZ3NbaV0ucG9zaXRpb24uc3RhcnQubGluZSAtIDE7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4geyB0aXRsZTogaC5oZWFkaW5nLCBjb250ZW50OiBsaW5lcy5zbGljZShzdGFydCwgTWF0aC5tYXgoZW5kLCBzdGFydCkgKyAxKS5qb2luKFwiXFxuXCIpIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBpY2tGaWVsZChmbTogRnJvbnRNYXR0ZXJDYWNoZSB8IHVuZGVmaW5lZCwgZmllbGRzOiBzdHJpbmdbXSk6IHN0cmluZyB7XHJcbiAgaWYgKCFmbSkgcmV0dXJuIFwiXCI7XHJcbiAgZm9yIChjb25zdCBmIG9mIGZpZWxkcykge1xyXG4gICAgY29uc3QgdiA9IGZtW2ZdO1xyXG4gICAgaWYgKHR5cGVvZiB2ID09PSBcInN0cmluZ1wiICYmIHYudHJpbSgpKSByZXR1cm4gdi50cmltKCk7XHJcbiAgICBpZiAodHlwZW9mIHYgPT09IFwibnVtYmVyXCIpIHJldHVybiBTdHJpbmcodik7XHJcbiAgfVxyXG4gIHJldHVybiBcIlwiO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjb2xsZWN0VGFncyhhcHA6IEFwcCwgZmlsZTogVEZpbGUpOiBzdHJpbmdbXSB7XHJcbiAgY29uc3QgZm0gPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyO1xyXG4gIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXTtcclxuICBjb25zdCBwdXNoID0gKHY6IHVua25vd24pID0+IHtcclxuICAgIGlmICh0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIikgb3V0LnB1c2godi5yZXBsYWNlKC9eIy8sIFwiXCIpKTtcclxuICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodikpIHYuZm9yRWFjaChwdXNoKTtcclxuICB9O1xyXG4gIHB1c2goZm0/LnRhZ3MpO1xyXG4gIHB1c2goZm0/LnRhZyk7XHJcbiAgaWYgKCFvdXQubGVuZ3RoKSB7XHJcbiAgICBjb25zdCBjYWNoZVRhZ3MgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LnRhZ3MgPz8gW107XHJcbiAgICBmb3IgKGNvbnN0IHQgb2YgY2FjaGVUYWdzKSBvdXQucHVzaCh0LnRhZy5yZXBsYWNlKC9eIy8sIFwiXCIpKTtcclxuICB9XHJcbiAgcmV0dXJuIEFycmF5LmZyb20obmV3IFNldChvdXQpKS5zbGljZSgwLCA2KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZXh0cmFjdENvdmVyKGFwcDogQXBwLCBmaWxlOiBURmlsZSwgYm9keTogc3RyaW5nLCBmaWVsZHM6IHN0cmluZ1tdKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgY29uc3QgZm0gPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyO1xyXG4gIGNvbnN0IGRlY2xhcmVkID0gcGlja0ZpZWxkKGZtLCBmaWVsZHMpO1xyXG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBbZGVjbGFyZWRdO1xyXG5cclxuICBpZiAoIWRlY2xhcmVkKSB7XHJcbiAgICBjb25zdCB3aWtpSW1nID0gYm9keS5tYXRjaCgvIVxcW1xcWyhbXlxcXXxdKykvKTtcclxuICAgIGlmICh3aWtpSW1nKSBjYW5kaWRhdGVzLnB1c2god2lraUltZ1sxXSk7XHJcbiAgICBjb25zdCBtZEltZyA9IGJvZHkubWF0Y2goLyFcXFtbXlxcXV0qXFxdXFwoKFteKV0rKVxcKS8pO1xyXG4gICAgaWYgKG1kSW1nKSBjYW5kaWRhdGVzLnB1c2gobWRJbWdbMV0pO1xyXG4gIH1cclxuXHJcbiAgZm9yIChjb25zdCBjIG9mIGNhbmRpZGF0ZXMpIHtcclxuICAgIGlmICghYykgY29udGludWU7XHJcbiAgICBpZiAoL15odHRwcz86XFwvXFwvL2kudGVzdChjKSkgcmV0dXJuIGM7XHJcbiAgICBjb25zdCBmID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoYy5zcGxpdChcInxcIilbMF0udHJpbSgpLCBmaWxlLnBhdGgpO1xyXG4gICAgaWYgKGYpIHJldHVybiBhcHAudmF1bHQuZ2V0UmVzb3VyY2VQYXRoKGYpO1xyXG4gIH1cclxuICByZXR1cm4gbnVsbDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVGaWxlKGFwcDogQXBwLCB0YXJnZXQ6IHN0cmluZywgc291cmNlUGF0aDogc3RyaW5nKTogVEZpbGUgfCBudWxsIHtcclxuICBjb25zdCBjbGVhbiA9IHRhcmdldC5zcGxpdChcIiNcIilbMF0uc3BsaXQoXCJ8XCIpWzBdLnRyaW0oKTtcclxuICBpZiAoIWNsZWFuKSByZXR1cm4gbnVsbDtcclxuICByZXR1cm4gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoY2xlYW4sIHNvdXJjZVBhdGgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmb3JtYXREYXRlKHY6IHVua25vd24pOiBzdHJpbmcge1xyXG4gIGlmICghdikgcmV0dXJuIFwiXCI7XHJcbiAgaWYgKHR5cGVvZiB2ICE9PSBcInN0cmluZ1wiKSByZXR1cm4gXCJcIjtcclxuICByZXR1cm4gdi5sZW5ndGggPiAxMCA/IHYuc2xpY2UoMCwgMTApIDogdjtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWROb3RlTWV0YShcclxuICBhcHA6IEFwcCxcclxuICB0YXJnZXQ6IHN0cmluZyxcclxuICBzb3VyY2VQYXRoOiBzdHJpbmcsXHJcbiAgc2V0dGluZ3M6IHtcclxuICAgIHN1bW1hcnlGaWVsZHM6IHN0cmluZ1tdO1xyXG4gICAgY292ZXJGaWVsZHM6IHN0cmluZ1tdO1xyXG4gICAgbWV0YUZpZWxkczogc3RyaW5nW107XHJcbiAgICBzdW1tYXJ5TGVuZ3RoOiBudW1iZXI7XHJcbiAgfSxcclxuICBhbGlhcz86IHN0cmluZ1xyXG4pOiBQcm9taXNlPE5vdGVNZXRhPiB7XHJcbiAgY29uc3QgaGFzaElkeCA9IHRhcmdldC5pbmRleE9mKFwiI1wiKTtcclxuICBjb25zdCBwYXRoUGFydCA9IChoYXNoSWR4ID49IDAgPyB0YXJnZXQuc2xpY2UoMCwgaGFzaElkeCkgOiB0YXJnZXQpLnNwbGl0KFwifFwiKVswXS50cmltKCk7XHJcbiAgY29uc3QgcmVmID0gaGFzaElkeCA+PSAwID8gdGFyZ2V0LnNsaWNlKGhhc2hJZHggKyAxKS50cmltKCkgOiBcIlwiO1xyXG4gIGNvbnN0IGZpbGUgPSByZXNvbHZlRmlsZShhcHAsIHBhdGhQYXJ0LCBzb3VyY2VQYXRoKTtcclxuICBjb25zdCBmYWxsYmFja1RpdGxlID0gYWxpYXMgfHwgcmVmIHx8IHBhdGhQYXJ0LnNwbGl0KFwiL1wiKS5wb3AoKSB8fCB0YXJnZXQ7XHJcblxyXG4gIGlmICghZmlsZSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgZmlsZTogbnVsbCxcclxuICAgICAgdGFyZ2V0LFxyXG4gICAgICByZWYsXHJcbiAgICAgIHRpdGxlOiBmYWxsYmFja1RpdGxlLFxyXG4gICAgICBzdW1tYXJ5OiBcIlwiLFxyXG4gICAgICBjb3ZlcjogbnVsbCxcclxuICAgICAgdGFnczogW10sXHJcbiAgICAgIGJhZGdlczogW10sXHJcbiAgICAgIHVwZGF0ZWQ6IFwiXCIsXHJcbiAgICAgIHdvcmRDb3VudDogMCxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBjb25zdCBrZXkgPSBgJHtmaWxlLnBhdGh9IyR7cmVmfToke2ZpbGUuc3RhdC5tdGltZX06JHtzZXR0aW5ncy5zdW1tYXJ5TGVuZ3RofWA7XHJcbiAgY29uc3QgaGl0ID0gY2FjaGUuZ2V0KGtleSk7XHJcbiAgaWYgKGhpdCkgcmV0dXJuIGFsaWFzID8geyAuLi5oaXQsIHRpdGxlOiBhbGlhcyB9IDogaGl0O1xyXG5cclxuICBjb25zdCByYXcgPSBhd2FpdCBhcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcclxuICBjb25zdCBmaWxlQ2FjaGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSkgPz8gbnVsbDtcclxuICBjb25zdCBmbSA9IGZpbGVDYWNoZT8uZnJvbnRtYXR0ZXI7XHJcblxyXG4gIC8vIFx1NkJCNVx1ODQzRFx1N0VBN1x1NUYxNVx1NzUyOFx1RkYxQVx1NTNFQVx1NTNENlx1OEJFNVx1NkJCNVx1ODQzRFx1RkYwQ1x1ODAwQ1x1NEUwRFx1NjYyRlx1NjU3NFx1N0JDN1xyXG4gIGNvbnN0IGJsb2NrID0gcmVmID8gZXh0cmFjdEJsb2NrKHJhdywgZmlsZUNhY2hlLCByZWYpIDogbnVsbDtcclxuICBjb25zdCBjb250ZW50Qm9keSA9IGJsb2NrPy5jb250ZW50ID8/IHN0cmlwRnJvbnRtYXR0ZXIocmF3KTtcclxuXHJcbiAgY29uc3QgbWFudWFsID0gYmxvY2sgPyBcIlwiIDogcGlja0ZpZWxkKGZtLCBzZXR0aW5ncy5zdW1tYXJ5RmllbGRzKTtcclxuICBjb25zdCBwbGFpbiA9IHRvUGxhaW5UZXh0KGNvbnRlbnRCb2R5KTtcclxuICBjb25zdCBzdW1tYXJ5ID1cclxuICAgIG1hbnVhbCB8fFxyXG4gICAgcGxhaW4uc2xpY2UoMCwgc2V0dGluZ3Muc3VtbWFyeUxlbmd0aCkgKyAocGxhaW4ubGVuZ3RoID4gc2V0dGluZ3Muc3VtbWFyeUxlbmd0aCA/IFwiXHUyMDI2XCIgOiBcIlwiKTtcclxuXHJcbiAgY29uc3QgYmFkZ2VzOiBOb3RlQmFkZ2VbXSA9IFtdO1xyXG4gIGlmICghYmxvY2spIHtcclxuICAgIGZvciAoY29uc3Qga2V5IG9mIHNldHRpbmdzLm1ldGFGaWVsZHMpIHtcclxuICAgICAgY29uc3QgdiA9IGZtPy5ba2V5XTtcclxuICAgICAgaWYgKHYgPT09IHVuZGVmaW5lZCB8fCB2ID09PSBudWxsKSBjb250aW51ZTtcclxuICAgICAgY29uc3QgdGV4dCA9IEFycmF5LmlzQXJyYXkodikgPyB2LmpvaW4oXCIvXCIpIDogU3RyaW5nKHYpO1xyXG4gICAgICBpZiAodGV4dC50cmltKCkpIGJhZGdlcy5wdXNoKHsga2V5LCB2YWx1ZTogdGV4dC50cmltKCkgfSk7XHJcbiAgICB9XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIFx1NkJCNVx1ODQzRFx1NTM2MVx1NzI0N1x1NTNFQVx1NjgwN1x1Njc2NVx1NkU5MFx1NjU4N1x1Njg2M1x1N0M3Qlx1NTc4Qlx1RkYwQ1x1OTA3Rlx1NTE0RFx1NTQ4Q1x1NjU3NFx1N0JDN1x1NkRGN1x1NkRDNlxyXG4gICAgY29uc3QgdCA9IGZtPy50eXBlO1xyXG4gICAgaWYgKHR5cGVvZiB0ID09PSBcInN0cmluZ1wiICYmIHQudHJpbSgpKSBiYWRnZXMucHVzaCh7IGtleTogXCJ0eXBlXCIsIHZhbHVlOiB0LnRyaW0oKSB9KTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHRpdGxlID1cclxuICAgIGFsaWFzIHx8IChibG9jayA/IGJsb2NrLnRpdGxlIDogXCJcIikgfHwgU3RyaW5nKGZtPy50aXRsZSB8fCBmaWxlLmJhc2VuYW1lKTtcclxuXHJcbiAgY29uc3QgbWV0YTogTm90ZU1ldGEgPSB7XHJcbiAgICBmaWxlLFxyXG4gICAgdGFyZ2V0LFxyXG4gICAgcmVmLFxyXG4gICAgdGl0bGUsXHJcbiAgICBzdW1tYXJ5LFxyXG4gICAgY292ZXI6IGV4dHJhY3RDb3ZlcihhcHAsIGZpbGUsIGNvbnRlbnRCb2R5LCBzZXR0aW5ncy5jb3ZlckZpZWxkcyksXHJcbiAgICB0YWdzOiBibG9jayA/IFtdIDogY29sbGVjdFRhZ3MoYXBwLCBmaWxlKSxcclxuICAgIGJhZGdlcyxcclxuICAgIHVwZGF0ZWQ6IGJsb2NrID8gXCJcIiA6IGZvcm1hdERhdGUoZm0/LnVwZGF0ZWQpIHx8IGZvcm1hdERhdGUoZm0/Lm1vZGlmaWVkKSB8fCBmb3JtYXREYXRlKGZtPy5jcmVhdGVkKSxcclxuICAgIHdvcmRDb3VudDogcGxhaW4ubGVuZ3RoLFxyXG4gICAgYmxvY2tDb250ZW50OiBibG9jaz8uY29udGVudCxcclxuICB9O1xyXG5cclxuICBjYWNoZS5zZXQoa2V5LCBtZXRhKTtcclxuICBpZiAoY2FjaGUuc2l6ZSA+IDUwMCkgY2FjaGUuY2xlYXIoKTtcclxuICByZXR1cm4gbWV0YTtcclxufVxyXG5cclxuLyoqIFx1NTE3Q1x1NUJCOVx1NjVCMFx1NjVFN1x1NzI0OFx1NjcyQyBPYnNpZGlhbiBcdTc2ODQgbWFya2Rvd24gXHU2RTMyXHU2N0QzXHU1MTY1XHU1M0UzICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJNYXJrZG93bihcclxuICBhcHA6IEFwcCxcclxuICBtYXJrZG93bjogc3RyaW5nLFxyXG4gIGVsOiBIVE1MRWxlbWVudCxcclxuICBzb3VyY2VQYXRoOiBzdHJpbmcsXHJcbiAgY29tcG9uZW50OiBDb21wb25lbnRcclxuKTogdm9pZCB7XHJcbiAgY29uc3QgbWQgPSBNYXJrZG93blJlbmRlcmVyIGFzIHVua25vd24gYXMge1xyXG4gICAgcmVuZGVyPzogKGE6IEFwcCwgbTogc3RyaW5nLCBlOiBIVE1MRWxlbWVudCwgcDogc3RyaW5nLCBjOiBDb21wb25lbnQpID0+IHZvaWQ7XHJcbiAgICByZW5kZXJNYXJrZG93bj86IChtOiBzdHJpbmcsIGU6IEhUTUxFbGVtZW50LCBwOiBzdHJpbmcsIGM6IENvbXBvbmVudCkgPT4gdm9pZDtcclxuICB9O1xyXG4gIC8vIFx1NUZDNVx1OTg3Qlx1NEYxOFx1NTE0OFx1NzUyOCByZW5kZXIoKVx1RkYxQXJlbmRlck1hcmtkb3duKCkgXHU2NjJGXHU3QjgwXHU1MzE2XHU3MjQ4XHVGRjBDXHU0RTBEXHU0RjFBXHU2MjhBXHU3MkVDXHU1MzYwXHU0RTAwXHU4ODRDXHU3Njg0ICFbWyBdXVxyXG4gIC8vIFx1NTkwNFx1NzQwNlx1NjIxMFx1NTc1N1x1N0VBN1x1NUQ0Q1x1NTE2NVx1RkYwQ1x1NTNFQVx1NzU1OVx1NEUwQlx1NEUwMFx1NEUyQSA8c3BhbiBjbGFzcz1cImludGVybmFsLWVtYmVkXCI+IFx1NTM2MFx1NEY0RFx1N0IyNlx1RkYwQ1xyXG4gIC8vIFx1NUJGQ1x1ODFGNFx1NTM2MVx1NzI0N1x1NkI2M1x1NjU4N1x1OTFDQ1x1NzY4NFx1NUQ0Q1x1NTk1N1x1NUQ0Q1x1NTE2NVx1NkMzOFx1OEZEQ1x1NjVFMFx1NkNENVx1ODhBQlx1NjNBNVx1N0JBMVx1NjIxMFx1NTM2MVx1NzI0N1x1MzAwMlxyXG4gIGlmICh0eXBlb2YgbWQucmVuZGVyID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgIG1kLnJlbmRlcihhcHAsIG1hcmtkb3duLCBlbCwgc291cmNlUGF0aCwgY29tcG9uZW50KTtcclxuICB9IGVsc2UgaWYgKHR5cGVvZiBtZC5yZW5kZXJNYXJrZG93biA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICBtZC5yZW5kZXJNYXJrZG93bihtYXJrZG93biwgZWwsIHNvdXJjZVBhdGgsIGNvbXBvbmVudCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIGVsLnNldFRleHQobWFya2Rvd24pO1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IEF0b21pY0NhcmRzUGx1Z2luIGZyb20gXCIuL21haW5cIjtcclxuaW1wb3J0IHsgTGF5b3V0LCBTaXplIH0gZnJvbSBcIi4vdHlwZXNcIjtcclxuaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgQXRvbWljQ2FyZHNTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XHJcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcGx1Z2luOiBBdG9taWNDYXJkc1BsdWdpbikge1xyXG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xyXG4gIH1cclxuXHJcbiAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XHJcbiAgICBjb25zdCBzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3M7XHJcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiXHU4ODRDXHU0RTNBXCIpLnNldEhlYWRpbmcoKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJcdTYzQTVcdTdCQTFcdTUzOUZcdTc1MUZcdTVENENcdTUxNjUgIVtbIF1dXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU2MjhBXHU3MkVDXHU1MzYwXHU0RTAwXHU4ODRDXHU3Njg0ICFbW1x1N0IxNFx1OEJCMF1dIFx1NUQ0Q1x1NTE2NVx1NkUzMlx1NjdEM1x1NjIxMFx1NTNFRlx1NjI5OFx1NTNFMFx1NTM2MVx1NzI0N1x1RkYxQlx1NTE3M1x1OTVFRFx1NTQwRVx1NjNEMlx1NEVGNlx1NUI4Q1x1NTE2OFx1NEUwRFx1NEVDQlx1NTE2NVx1RkYwQ1x1NUQ0Q1x1NTE2NVx1NEZERFx1NjMwMSBPYnNpZGlhbiBcdTlFRDhcdThCQTRcdTY4MzdcdTVGMEZcIilcclxuICAgICAgLmFkZFRvZ2dsZSgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKHMudXBncmFkZUVtYmVkcykub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgIHMudXBncmFkZUVtYmVkcyA9IHY7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NjJENlx1NTE2NVx1N0IxNFx1OEJCMFx1NjVGNlx1NjNEMlx1NTE2NVx1NUQ0Q1x1NTE2NSAhW1sgXV1cIilcclxuICAgICAgLnNldERlc2MoXCJcdTRFQ0VcdTY1ODdcdTRFRjZcdTUyMTdcdTg4NjhcdTYyOEFcdTdCMTRcdThCQjBcdTYyRDZcdThGREJcdTdGMTZcdThGOTFcdTU2NjhcdTY1RjZcdTYzRDJcdTUxNjUgIVtbIF1dXHVGRjA4XHU0RjFBXHU2RTMyXHU2N0QzXHU2MjEwXHU1MzYxXHU3MjQ3XHVGRjA5XHVGRjFCXHU1MTczXHU5NUVEXHU1MjE5XHU0RkREXHU2MzAxIE9ic2lkaWFuIFx1OUVEOFx1OEJBNFx1NzY4NCBbWyBdXSBcdTk0RkVcdTYzQTVcIilcclxuICAgICAgLmFkZFRvZ2dsZSgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKHMuZW1iZWRPbkRyb3ApLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLmVtYmVkT25Ecm9wID0gdjtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJcdTVFMDNcdTVDNDBcIikuc2V0SGVhZGluZygpO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NTM2MVx1NzI0N1x1NjcwMFx1NTkyN1x1OUFEOFx1NUVBNiAocHgpXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiMCA9IFx1NEUwRFx1OTY1MFx1NTIzNlx1RkYxQlx1OEQ4NVx1OEZDN1x1NTQwRVx1NTM2MVx1NzI0N1x1NTE4NVx1OTBFOFx1NkVEQVx1NTJBOFwiKVxyXG4gICAgICAuYWRkVGV4dCgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKFN0cmluZyhzLmNhcmRIZWlnaHQpKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgcy5jYXJkSGVpZ2h0ID0gTnVtYmVyKHYpIHx8IDA7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NTM2MVx1NzI0N1x1NUUwM1x1NUM0MFwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1NTMwNVx1ODhGOVx1NTM2MVx1NzI0NyA9IFx1NkEyQVx1NTQxMVx1NjI0MVx1NUU3M1x1NzY4NFx1NUJCOVx1NTY2OFx1RkYxQlx1N0FENlx1NzI0OFx1NTM2MVx1NzI0QyA9IFx1NEYyMFx1N0VERlx1NTM2MVx1NzI0N1x1NTg5OVx1RkYwOFx1OTg3Nlx1OTBFOFx1NTkyN1x1NUMwMVx1OTc2Mlx1RkYwOVwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGQpID0+XHJcbiAgICAgICAgZFxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIndyYXBcIiwgXCJcdTUzMDVcdTg4RjlcdTUzNjFcdTcyNDdcdUZGMDhcdTZBMkFcdTU0MTFcdUZGMDlcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJjYXJkXCIsIFwiXHU3QUQ2XHU3MjQ4XHU1MzYxXHU3MjRDXHVGRjA4XHU5ODc2XHU5MEU4XHU1QzAxXHU5NzYyXHVGRjA5XCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUocy5sYXlvdXQpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgICAgcy5sYXlvdXQgPSB2IGFzIExheW91dDtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NUQ0Q1x1NTk1N1x1NTM2MVx1NzI0N1x1NzY4NFx1NUMzQVx1NUJGOFwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1NTM2MVx1NzI0N1x1OTFDQ1x1NTE4RFx1NTk1N1x1NzY4NFx1NUQ0Q1x1NTE2NVx1OUVEOFx1OEJBNFx1NzUyOFx1NEVDMFx1NEU0OFx1NUMzQVx1NUJGOFwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGQpID0+XHJcbiAgICAgICAgZFxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcInNtYWxsXCIsIFwiXHU3N0U1XHU4QkM2XHU3MEI5XHU1QzBGXHU1MzYxXHU3MjQ3XHVGRjA4XHU0RTAwXHU4ODRDXHU1OTFBXHU0RTJBXHVGRjA5XCIpXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwibm9ybWFsXCIsIFwiXHU1RTM4XHU4OUM0XHU1MzYxXHU3MjQ3XCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUocy5uZXN0ZWRTaXplKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICAgIHMubmVzdGVkU2l6ZSA9IHYgYXMgU2l6ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NUJDNlx1NUVBNlwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGQpID0+XHJcbiAgICAgICAgZFxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImNvbWZvcnRhYmxlXCIsIFwiXHU1QkJEXHU2NzdFXCIpXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiY29tcGFjdFwiLCBcIlx1N0QyN1x1NTFEMVwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHMuZGVuc2l0eSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgICBzLmRlbnNpdHkgPSB2IGFzIFwiY29tcGFjdFwiIHwgXCJjb21mb3J0YWJsZVwiO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJcdTUzNjFcdTcyNDdcdTUxODVcdTVCQjlcIikuc2V0SGVhZGluZygpO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlx1NjQ1OFx1ODk4MVx1OTU3Rlx1NUVBNlwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlx1ODFFQVx1NTJBOFx1NjQ1OFx1ODk4MVx1NjIyQVx1NTNENlx1NzY4NFx1NUI1N1x1N0IyNlx1NjU3MFx1RkYwOGZyb250bWF0dGVyIFx1NjcwOSBzdW1tYXJ5L2Rlc2NyaXB0aW9uIFx1NjVGNlx1NEYxOFx1NTE0OFx1NzUyOFx1RkYwOVwiKVxyXG4gICAgICAuYWRkVGV4dCgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKFN0cmluZyhzLnN1bW1hcnlMZW5ndGgpKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xyXG4gICAgICAgICAgcy5zdW1tYXJ5TGVuZ3RoID0gTnVtYmVyKHYpIHx8IDE4MDtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgY29uc3QgdG9nZ2xlID0gKG5hbWU6IHN0cmluZywgZGVzYzogc3RyaW5nLCBnZXQ6ICgpID0+IGJvb2xlYW4sIHNldDogKHY6IGJvb2xlYW4pID0+IHZvaWQpID0+XHJcbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKG5hbWUpLnNldERlc2MoZGVzYykuYWRkVG9nZ2xlKCh0KSA9PlxyXG4gICAgICAgIHQuc2V0VmFsdWUoZ2V0KCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzZXQodik7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIHRvZ2dsZShcIlx1NjYzRVx1NzkzQVx1NUMwMVx1OTc2MlwiLCBcIlx1OEJGQlx1NTNENiBmcm9udG1hdHRlciBcdTc2ODQgY292ZXIvaW1hZ2UvYmFubmVyIFx1NjIxNlx1NkI2M1x1NjU4N1x1N0IyQ1x1NEUwMFx1NUYyMFx1NTZGRVwiLCAoKSA9PiBzLnNob3dDb3ZlciwgKHYpID0+IChzLnNob3dDb3ZlciA9IHYpKTtcclxuICAgIHRvZ2dsZShcIlx1NjYzRVx1NzkzQVx1NTE0M1x1NEZFMVx1NjA2RlwiLCBcInR5cGUgLyBzdGF0dXMgLyBkb21haW4gLyBcdTY2RjRcdTY1QjBcdTY1RjZcdTk1RjQgLyBcdTVCNTdcdTY1NzBcIiwgKCkgPT4gcy5zaG93TWV0YSwgKHYpID0+IChzLnNob3dNZXRhID0gdikpO1xyXG4gICAgdG9nZ2xlKFwiXHU2NjNFXHU3OTNBXHU2ODA3XHU3QjdFXCIsIFwiXCIsICgpID0+IHMuc2hvd1RhZ3MsICh2KSA9PiAocy5zaG93VGFncyA9IHYpKTtcclxuICAgIHRvZ2dsZShcIlx1NjYzRVx1NzkzQVx1MzAwQ1x1NjI1M1x1NUYwMFx1MzAwRFx1NjMwOVx1OTRBRVwiLCBcIlwiLCAoKSA9PiBzLnNob3dPcGVuQnV0dG9uLCAodikgPT4gKHMuc2hvd09wZW5CdXR0b24gPSB2KSk7XHJcbiAgICB0b2dnbGUoXCJcdTlFRDhcdThCQTRcdTVDNTVcdTVGMDBcdTZCNjNcdTY1ODdcIiwgXCJcdTYyNTNcdTVGMDBcdTY1ODdcdTY4NjNcdTY1RjZcdTUzNjFcdTcyNDdcdTc2RjRcdTYzQTVcdTY2M0VcdTc5M0FcdTVCOENcdTY1NzRcdTUxODVcdTVCQjlcdUZGMENcdTcwQjlcdTY4MDdcdTk4OThcdTUzRUZcdTYyOThcdTUzRTBcIiwgKCkgPT4gcy5kZWZhdWx0RXhwYW5kZWQsICh2KSA9PiAocy5kZWZhdWx0RXhwYW5kZWQgPSB2KSk7XHJcbiAgICB0b2dnbGUoXHJcbiAgICAgIFwiXHU1RDRDXHU1OTU3XHU1MzYxXHU3MjQ3XHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXCIsXHJcbiAgICAgIFwiXHU1MzYxXHU3MjQ3XHU5MUNDXHU1MThEXHU1OTU3XHU3Njg0XHU1MzYxXHU3MjQ3XHU1ODk5XHU2NjJGXHU1NDI2XHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwXHVGRjFCXHU1MTczXHU5NUVEXHU2NUY2XHU1M0VBXHU2NjNFXHU3OTNBXHU2ODA3XHU5ODk4XHU1NDhDXHU2NDU4XHU4OTgxXCIsXHJcbiAgICAgICgpID0+IHMubmVzdGVkRXhwYW5kZWQsXHJcbiAgICAgICh2KSA9PiAocy5uZXN0ZWRFeHBhbmRlZCA9IHYpXHJcbiAgICApO1xyXG4gICAgdG9nZ2xlKFxyXG4gICAgICBcIlx1OEJFNlx1N0VDNlx1NjVFNVx1NUZEN1wiLFxyXG4gICAgICBcIlx1NTcyOFx1NUYwMFx1NTNEMVx1ODAwNVx1NjNBN1x1NTIzNlx1NTNGMFx1RkYwOEN0cmwrU2hpZnQrSVx1RkYwOVx1OEY5M1x1NTFGQVx1OEZEMFx1ODg0Q1x1NjVFNVx1NUZEN1x1RkYwQ1x1NjM5Mlx1NjdFNVx1NzUyOFx1RkYxQlx1NUU3M1x1NjVGNlx1NTNFRlx1NTE3M1wiLFxyXG4gICAgICAoKSA9PiBzLnZlcmJvc2UsXHJcbiAgICAgICh2KSA9PiAocy52ZXJib3NlID0gdilcclxuICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiXHU2NzAwXHU1OTI3XHU1RDRDXHU1OTU3XHU2REYxXHU1RUE2XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiXHU1MzYxXHU3MjQ3XHU5MUNDXHU1MThEXHU2NTNFIGNhcmRzIFx1NTc1N1x1NjVGNlx1NzY4NFx1OTAxMlx1NUY1Mlx1NUM0Mlx1NjU3MFx1NEUwQVx1OTY1MFx1RkYwQ1x1OTYzMlx1NkI2Mlx1NUZBQVx1NzNBRlx1NUYxNVx1NzUyOFx1NTM2MVx1NkI3QlwiKVxyXG4gICAgICAuYWRkVGV4dCgodCkgPT5cclxuICAgICAgICB0LnNldFZhbHVlKFN0cmluZyhzLm1heE5lc3REZXB0aCkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XHJcbiAgICAgICAgICBzLm1heE5lc3REZXB0aCA9IE1hdGgubWF4KDEsIE51bWJlcih2KSB8fCAzKTtcclxuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJcdTVCNTdcdTZCQjVcdTY2MjBcdTVDMDRcIikuc2V0SGVhZGluZygpO1xyXG5cclxuICAgIGNvbnN0IGxpc3RGaWVsZCA9IChuYW1lOiBzdHJpbmcsIGRlc2M6IHN0cmluZywgZ2V0OiAoKSA9PiBzdHJpbmdbXSwgc2V0OiAodjogc3RyaW5nW10pID0+IHZvaWQpID0+XHJcbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKG5hbWUpXHJcbiAgICAgICAgLnNldERlc2MoZGVzYylcclxuICAgICAgICAuYWRkVGV4dCgodCkgPT5cclxuICAgICAgICAgIHRcclxuICAgICAgICAgICAgLnNldFZhbHVlKGdldCgpLmpvaW4oXCIsIFwiKSlcclxuICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiYSwgYiwgY1wiKVxyXG4gICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcclxuICAgICAgICAgICAgICBzZXQoXHJcbiAgICAgICAgICAgICAgICB2XHJcbiAgICAgICAgICAgICAgICAgIC5zcGxpdChcIixcIilcclxuICAgICAgICAgICAgICAgICAgLm1hcCgoeCkgPT4geC50cmltKCkpXHJcbiAgICAgICAgICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbilcclxuICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgbGlzdEZpZWxkKFwiXHU2NDU4XHU4OTgxXHU1QjU3XHU2QkI1XCIsIFwiXHU2MzA5XHU5ODdBXHU1RThGXHU1QzFEXHU4QkQ1XHU4QkZCXHU1M0Q2XHU3Njg0IGZyb250bWF0dGVyIFx1NUI1N1x1NkJCNVwiLCAoKSA9PiBzLnN1bW1hcnlGaWVsZHMsICh2KSA9PiAocy5zdW1tYXJ5RmllbGRzID0gdikpO1xyXG4gICAgbGlzdEZpZWxkKFwiXHU1QzAxXHU5NzYyXHU1QjU3XHU2QkI1XCIsIFwiXCIsICgpID0+IHMuY292ZXJGaWVsZHMsICh2KSA9PiAocy5jb3ZlckZpZWxkcyA9IHYpKTtcclxuICAgIGxpc3RGaWVsZChcIlx1NTE0M1x1NEZFMVx1NjA2Rlx1NUI1N1x1NkJCNVwiLCBcIlx1NEYxQVx1NEVFNVx1NUZCRFx1N0FFMFx1NUY2Mlx1NUYwRlx1NjYzRVx1NzkzQVx1NTcyOFx1NTM2MVx1NzI0N1x1NEUwQVwiLCAoKSA9PiBzLm1ldGFGaWVsZHMsICh2KSA9PiAocy5tZXRhRmllbGRzID0gdikpO1xyXG4gIH1cclxufVxyXG4iLCAiZXhwb3J0IHR5cGUgRGVuc2l0eSA9IFwiY29tcGFjdFwiIHwgXCJjb21mb3J0YWJsZVwiO1xyXG4vKiogd3JhcCA9IFx1NjI0MVx1NUU3M1x1NTMwNVx1ODhGOVx1NTM2MVx1NzI0N1x1RkYwOFx1NkEyQVx1NTQxMVx1RkYwOVx1RkYxQmNhcmQgPSBcdTRGMjBcdTdFREZcdTdBRDZcdTcyNDhcdTUzNjFcdTcyNENcdUZGMDhcdTk4NzZcdTkwRThcdTVDMDFcdTk3NjJcdUZGMDkgKi9cclxuZXhwb3J0IHR5cGUgTGF5b3V0ID0gXCJ3cmFwXCIgfCBcImNhcmRcIjtcclxuLyoqIG5vcm1hbCA9IFx1NUUzOFx1ODlDNFx1NjU4N1x1Njg2M1x1NTM2MVx1NzI0N1x1RkYxQnNtYWxsID0gXHU3N0U1XHU4QkM2XHU3MEI5IC8gXHU2QkI1XHU4NDNEXHU3RUE3XHU1QzBGXHU1MzYxXHU3MjQ3ICovXHJcbmV4cG9ydCB0eXBlIFNpemUgPSBcIm5vcm1hbFwiIHwgXCJzbWFsbFwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBdG9taWNDYXJkc1NldHRpbmdzIHtcclxuICAvKiogXHU2MjhBIE9ic2lkaWFuIFx1NTM5Rlx1NzUxRiAhW1sgXV0gXHU1NzU3XHU3RUE3XHU1RDRDXHU1MTY1XHU2RTMyXHU2N0QzXHU2MjEwXHU1MzYxXHU3MjQ3XHVGRjA4XHU1MTczXHU5NUVEXHU1MjE5XHU1QjhDXHU1MTY4XHU0RTBEXHU0RUNCXHU1MTY1XHVGRjA5ICovXHJcbiAgdXBncmFkZUVtYmVkczogYm9vbGVhbjtcclxuICAvKiogXHU0RUNFXHU2NTg3XHU0RUY2XHU1MjE3XHU4ODY4XHU2MkQ2XHU3QjE0XHU4QkIwXHU1MjMwXHU3RjE2XHU4RjkxXHU1NjY4XHU2NUY2XHU2M0QyXHU1MTY1ICFbWyBdXSBcdTVENENcdTUxNjVcdUZGMENcdTgwMENcdTRFMERcdTY2MkZcdTlFRDhcdThCQTRcdTc2ODQgW1sgXV0gXHU5NEZFXHU2M0E1ICovXHJcbiAgZW1iZWRPbkRyb3A6IGJvb2xlYW47XHJcbiAgbGF5b3V0OiBMYXlvdXQ7XHJcbiAgLyoqIFx1NUQ0Q1x1NTk1N1x1NTcyOFx1NTkyN1x1NTM2MVx1NzI0N1x1OTFDQ1x1NzY4NFx1NTM2MVx1NzI0N1x1OUVEOFx1OEJBNFx1NUMzQVx1NUJGOCAqL1xyXG4gIG5lc3RlZFNpemU6IFNpemU7XHJcbiAgY2FyZEhlaWdodDogbnVtYmVyO1xyXG4gIHN1bW1hcnlMZW5ndGg6IG51bWJlcjtcclxuICBzaG93Q292ZXI6IGJvb2xlYW47XHJcbiAgc2hvd01ldGE6IGJvb2xlYW47XHJcbiAgc2hvd1RhZ3M6IGJvb2xlYW47XHJcbiAgc2hvd09wZW5CdXR0b246IGJvb2xlYW47XHJcbiAgLyoqIFx1NTM2MVx1NzI0N1x1OUVEOFx1OEJBNFx1NUM1NVx1NUYwMFx1NkI2M1x1NjU4NyAqL1xyXG4gIGRlZmF1bHRFeHBhbmRlZDogYm9vbGVhbjtcclxuICAvKiogXHU1RDRDXHU1NzI4XHU1MzYxXHU3MjQ3XHU5MUNDXHU3Njg0XHU1RDRDXHU1MTY1XHU2NjJGXHU1NDI2XHU5RUQ4XHU4QkE0XHU1QzU1XHU1RjAwICovXHJcbiAgbmVzdGVkRXhwYW5kZWQ6IGJvb2xlYW47XHJcbiAgbWF4TmVzdERlcHRoOiBudW1iZXI7XHJcbiAgZGVuc2l0eTogRGVuc2l0eTtcclxuICBzdW1tYXJ5RmllbGRzOiBzdHJpbmdbXTtcclxuICBjb3ZlckZpZWxkczogc3RyaW5nW107XHJcbiAgbWV0YUZpZWxkczogc3RyaW5nW107XHJcbiAgdmVyYm9zZTogYm9vbGVhbjtcclxuICAvKiogXHU1RTAzXHU1QzQwXHU5RUQ4XHU4QkE0XHU1MDNDXHU1M0Q4XHU1MzE2XHU2NUY2XHU3NTI4XHU2NzY1XHU4RkMxXHU3OUZCXHU2NUU3XHU4QkJFXHU3RjZFICovXHJcbiAgc2V0dGluZ3NWZXJzaW9uPzogbnVtYmVyO1xyXG59XHJcblxyXG4vKiogXHU1RTAzXHU1QzQwXHU3NkY4XHU1MTczXHU5RUQ4XHU4QkE0XHU1MDNDXHU1M0Q4XHU2NkY0XHU2NUY2ICsxXHVGRjBDXHU2NUU3XHU4QkJFXHU3RjZFXHU0RjFBXHU4OEFCXHU2NUIwXHU5RUQ4XHU4QkE0XHU1MDNDXHU4OTg2XHU3NkQ2ICovXHJcbmV4cG9ydCBjb25zdCBTRVRUSU5HU19WRVJTSU9OID0gMztcclxuXHJcbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBBdG9taWNDYXJkc1NldHRpbmdzID0ge1xyXG4gIHVwZ3JhZGVFbWJlZHM6IHRydWUsXHJcbiAgZW1iZWRPbkRyb3A6IHRydWUsXHJcbiAgbGF5b3V0OiBcIndyYXBcIixcclxuICBuZXN0ZWRTaXplOiBcIm5vcm1hbFwiLFxyXG4gIGNhcmRIZWlnaHQ6IDAsXHJcbiAgc3VtbWFyeUxlbmd0aDogMTgwLFxyXG4gIHNob3dDb3ZlcjogdHJ1ZSxcclxuICBzaG93TWV0YTogdHJ1ZSxcclxuICBzaG93VGFnczogdHJ1ZSxcclxuICBzaG93T3BlbkJ1dHRvbjogdHJ1ZSxcclxuICBkZWZhdWx0RXhwYW5kZWQ6IHRydWUsXHJcbiAgbmVzdGVkRXhwYW5kZWQ6IHRydWUsXHJcbiAgbWF4TmVzdERlcHRoOiAzLFxyXG4gIGRlbnNpdHk6IFwiY29tZm9ydGFibGVcIixcclxuICBzdW1tYXJ5RmllbGRzOiBbXCJzdW1tYXJ5XCIsIFwiZGVzY3JpcHRpb25cIiwgXCJhYnN0cmFjdFwiLCBcImV4Y2VycHRcIiwgXCJcdTdCODBcdTRFQ0JcIiwgXCJcdTY0NThcdTg5ODFcIl0sXHJcbiAgY292ZXJGaWVsZHM6IFtcImNvdmVyXCIsIFwiaW1hZ2VcIiwgXCJiYW5uZXJcIiwgXCJ0aHVtYm5haWxcIiwgXCJpbWdcIiwgXCJcdTVDMDFcdTk3NjJcIl0sXHJcbiAgbWV0YUZpZWxkczogW1widHlwZVwiLCBcInN0YXR1c1wiLCBcImRvbWFpblwiLCBcImNvbXBsZXhpdHlcIl0sXHJcbiAgdmVyYm9zZTogZmFsc2UsXHJcbn07XHJcblxyXG4vKiogXHU2RTMyXHU2N0QzXHU1MzU1XHU1RjIwXHU1MzYxXHU3MjQ3XHU2MjQwXHU5NzAwXHU5MDA5XHU5ODc5XHVGRjBDXHU1MTY4XHU5MEU4XHU2NzY1XHU4MUVBXHU2M0QyXHU0RUY2XHU4QkJFXHU3RjZFXHVGRjA4XHU2Q0ExXHU2NzA5XHU1NzU3XHU1MTg1XHU5MDA5XHU5ODc5XHU0RTg2XHVGRjA5ICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgUmVuZGVyT3B0aW9ucyB7XHJcbiAgc2l6ZTogU2l6ZTtcclxuICBkZW5zaXR5OiBEZW5zaXR5O1xyXG4gIGxheW91dDogTGF5b3V0O1xyXG4gIGNvdmVyOiBib29sZWFuO1xyXG4gIG1ldGE6IGJvb2xlYW47XHJcbiAgdGFnczogYm9vbGVhbjtcclxuICBvcGVuOiBib29sZWFuO1xyXG4gIGV4cGFuZGVkOiBib29sZWFuO1xyXG4gIC8qKiBcdTUzNjFcdTcyNDdcdTY3MDBcdTU5MjdcdTlBRDhcdTVFQTZcdUZGMEMwID0gXHU0RTBEXHU5NjUwXHU1MjM2ICovXHJcbiAgaGVpZ2h0OiBudW1iZXI7XHJcbiAgLyoqIFx1ODFFQVx1NTJBOFx1NjQ1OFx1ODk4MVx1NUI1N1x1N0IyNlx1NjU3MCAqL1xyXG4gIHN1bW1hcnk6IG51bWJlcjtcclxufVxyXG5cclxuLyoqIFx1OTc1RVx1N0IxNFx1OEJCMFx1NzY4NFx1NUQ0Q1x1NTE2NVx1RkYwOFx1NTZGRVx1NzI0NyAvIFx1OTdGM1x1ODlDNlx1OTg5MSAvIFBERiAvIFx1NzUzQlx1NUUwM1x1N0I0OVx1RkYwOVx1NEUwRFx1NTA1QVx1NTM2MVx1NzI0N1x1NTMxNiAqL1xyXG5leHBvcnQgY29uc3QgU0tJUF9FTUJFRF9FWFQgPVxyXG4gIC9cXC4ocG5nfGpwZT9nfGdpZnx3ZWJwfHN2Z3xibXB8aWNvfGF2aWZ8bXAzfHdhdnxvZ2d8ZmxhY3xtNGF8bXA0fHdlYm18bW92fHBkZnxjYW52YXN8ZXhjYWxpZHJhdykkL2k7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBUU87OztBQ1JQLElBQUFDLG1CQUFnRDs7O0FDQWhELHNCQUEwRjtBQXdCMUYsSUFBTSxRQUFRLG9CQUFJLElBQXNCO0FBRXhDLFNBQVMsaUJBQWlCLEtBQXFCO0FBQzdDLFFBQU0sSUFBSSxJQUFJLE1BQU0saUNBQWlDO0FBQ3JELFNBQU8sSUFBSSxJQUFJLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxJQUFJO0FBQ3RDO0FBR08sU0FBUyxZQUFZLE1BQXNCO0FBQ2hELFNBQU8saUJBQWlCLElBQUksRUFDekIsUUFBUSxtQkFBbUIsRUFBRSxFQUM3QixRQUFRLCtCQUErQixFQUFFLEVBQ3pDLFFBQVEsb0JBQW9CLEVBQUUsRUFDOUIsUUFBUSx5QkFBeUIsRUFBRSxFQUduQyxRQUFRLG9CQUFvQixFQUFFLEVBQzlCLFFBQVEsaUNBQWlDLENBQUMsSUFBSSxHQUFXLE1BQWMsS0FBSyxDQUFDLEVBQzdFLFFBQVEsMEJBQTBCLElBQUksRUFDdEMsUUFBUSwwQkFBMEIsRUFBRSxFQUNwQyxRQUFRLGtCQUFrQixFQUFFLEVBQzVCLFFBQVEsa0JBQWtCLEVB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RSxZQUFJLHdCQUFPLFVBQVUsU0FBUyxzQkFBTyxRQUFRLE1BQU0sd0JBQVMsc0JBQU8sUUFBUSxNQUFNLHFCQUFNO0FBQUEsTUFDekY7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUE7QUFBQSxFQUdRLGNBQWMsUUFBc0I7QUFDMUMsVUFBTSxNQUFNLE9BQU8sYUFBYTtBQUNoQyxRQUFJLENBQUMsSUFBSSxLQUFLLEdBQUc7QUFDZixVQUFJLHdCQUFPLDBFQUFtQjtBQUM5QjtBQUFBLElBQ0Y7QUFDQSxVQUFNLEtBQUs7QUFDWCxVQUFNLFFBQWtCLENBQUM7QUFDekIsUUFBSTtBQUNKLFlBQVEsSUFBSSxHQUFHLEtBQUssR0FBRyxPQUFPLE1BQU07QUFDbEMsWUFBTSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEtBQUs7QUFDcEIsVUFBSSxLQUFLLENBQUMsTUFBTSxTQUFTLENBQUMsRUFBRyxPQUFNLEtBQUssQ0FBQztBQUFBLElBQzNDO0FBQ0EsUUFBSSxDQUFDLE1BQU0sUUFBUTtBQUNqQixVQUFJLHdCQUFPLGlEQUFjO0FBQ3pCO0FBQUEsSUFDRjtBQUNBLFdBQU8saUJBQWlCLE1BQU0sSUFBSSxDQUFDLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQztBQUNsRSxRQUFJLHdCQUFPLHNCQUFPLE1BQU0sTUFBTSxxQkFBTTtBQUFBLEVBQ3RDO0FBQUE7QUFBQSxFQUdRLG9CQUFvQixRQUFzQjtBQUNoRCxVQUFNLE9BQU8sS0FBSyxJQUFJLFVBQVUsY0FBYztBQUM5QyxRQUFJLENBQUMsTUFBTTtBQUNULFVBQUksd0JBQU8sd0RBQVc7QUFDdEI7QUFBQSxJQUNGO0FBQ0EsVUFBTSxRQUFRLEtBQUssSUFBSSxjQUFjO0FBQ3JDLFVBQU0sT0FBTyxPQUFPLEtBQUssS0FBSyxFQUFFLE9BQU8sQ0FBQyxRQUFLO0FBMWFqRDtBQTBhb0QseUJBQU0sR0FBRyxNQUFULG1CQUFhLEtBQUs7QUFBQSxLQUFLO0FBQ3ZFLFFBQUksQ0FBQyxLQUFLLFFBQVE7QUFDaEIsVUFBSSx3QkFBTyxrREFBVTtBQUNyQjtBQUFBLElBQ0Y7QUFDQSxVQUFNLE9BQU87QUFBQTtBQUFBLEVBQVksS0FDdEIsSUFBSSxDQUFDLE1BQU0sUUFBUSxFQUFFLFFBQVEsVUFBVSxFQUFFLENBQUMsSUFBSSxFQUM5QyxLQUFLLElBQUksQ0FBQztBQUFBO0FBQ2IsV0FBTyxhQUFhLE1BQU0sT0FBTyxVQUFVLENBQUM7QUFDNUMsUUFBSSx3QkFBTyxzQkFBTyxLQUFLLE1BQU0scUJBQU07QUFBQSxFQUNyQztBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImgiLCAia2V5IiwgIl9hIiwgIl9iIiwgIl9jIiwgIl9kIiwgImltcG9ydF9vYnNpZGlhbiJdCn0K
