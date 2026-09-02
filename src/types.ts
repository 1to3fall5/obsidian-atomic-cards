export type Density = "compact" | "comfortable";
export type SortKey = "name" | "updated" | "created" | "none";
/** wrap = 扁平包裹卡片（横向）；card = 传统竖版卡牌（顶部封面） */
export type Layout = "wrap" | "card";
/** normal = 常规文档卡片；small = 知识点 / 段落级小卡片（更窄，一行排多个） */
export type Size = "normal" | "small";

export interface AtomicCardsSettings {
  /** 列数：1 = 每张卡片占一整行；0 = 自适应网格 */
  columns: number;
  layout: Layout;
  /** 嵌套在大卡片里的卡片墙默认尺寸 */
  nestedSize: Size;
  minCardWidth: number;
  cardHeight: number;
  summaryLength: number;
  showCover: boolean;
  showMeta: boolean;
  showTags: boolean;
  showOpenButton: boolean;
  /** 卡片默认展开正文 */
  defaultExpanded: boolean;
  /** 嵌在卡片里的卡片墙是否默认展开 */
  nestedExpanded: boolean;
  maxNestDepth: number;
  density: Density;
  summaryFields: string[];
  coverFields: string[];
  metaFields: string[];
  verbose: boolean;
  /** 布局默认值变化时用来迁移旧设置 */
  settingsVersion?: number;
}

/** 布局相关默认值变更时 +1，旧设置会被新默认值覆盖 */
export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: AtomicCardsSettings = {
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
  summaryFields: ["summary", "description", "abstract", "excerpt", "简介", "摘要"],
  coverFields: ["cover", "image", "banner", "thumbnail", "img", "封面"],
  metaFields: ["type", "status", "domain", "complexity"],
  verbose: false,
};

/** 单个 cards 代码块可覆盖的选项 */
export interface CardOptions {
  columns?: number;
  width?: number;
  height?: number;
  summary?: number;
  expanded?: boolean;
  cover?: boolean;
  meta?: boolean;
  tags?: boolean;
  open?: boolean;
  density?: Density;
  layout?: Layout;
  size?: Size;
  /** 按文件夹筛选，如 wiki/concepts */
  from?: string;
  /** 按标签筛选，如 type/concept 或 #type/concept */
  tag?: string;
  sort?: SortKey;
  limit?: number;
  /** true = 反查：列出所有引用了当前文档的笔记（上层章节） */
  reverse?: boolean;
  title?: string;
}

export interface CardEntry {
  target: string;
  alias?: string;
}

export interface CardsQuery {
  options: CardOptions;
  entries: CardEntry[];
}

export interface MergedOptions extends Required<Omit<CardOptions, "from" | "tag" | "title" | "sort">> {
  from: string;
  tag: string;
  title: string;
  sort: SortKey;
  limit: number;
}
