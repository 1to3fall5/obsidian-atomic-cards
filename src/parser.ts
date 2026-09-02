import { CardEntry, CardOptions, CardsQuery, SortKey } from "./types";

const SORT_KEYS: SortKey[] = ["name", "updated", "created", "none"];

function applyOption(opts: CardOptions, rawKey: string, rawValue: string) {
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
      opts.sort = (SORT_KEYS.includes(value as SortKey) ? value : "name") as SortKey;
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

function parseEntry(line: string): CardEntry | null {
  let text = line.replace(/^[-*+]\s+/, "").trim();
  if (!text) return null;
  // 容忍 ![[...]] 与 [[...]] 两种写法
  text = text.replace(/^!\s*/, "");

  const wiki = text.match(/^\[\[([^\]]+)\]\]\s*(.*)$/);
  if (wiki) {
    const [target, inlineAlias] = wiki[1].split("|");
    return {
      target: target.trim(),
      alias: (inlineAlias || "").trim() || (wiki[2] || "").trim() || undefined,
    };
  }

  // 纯文本 / 路径
  if (/^[>#`]/.test(text)) return null;
  const bare = text.replace(/\[\[|\]\]/g, "").trim();
  return bare ? { target: bare } : null;
}

/**
 * 解析 cards 代码块内容。
 * 支持形如：
 *   columns: 3
 *   ---
 *   - [[笔记A]]
 *   - [[笔记B|自定义标题]]
 */
export function parseCardsBlock(source: string): CardsQuery {
  const options: CardOptions = {};
  const entries: CardEntry[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line === "---" || line === "***") continue;

    // 选项行：key: value（不是列表项、不是 wikilink）
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
