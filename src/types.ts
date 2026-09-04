export type Density = "compact" | "comfortable";
/** wrap = 扁平包裹卡片（横向）；card = 传统竖版卡牌（顶部封面） */
export type Layout = "wrap" | "card";
/** normal = 常规文档卡片；small = 知识点 / 段落级小卡片 */
export type Size = "normal" | "small";

export interface AtomicCardsSettings {
  /** 把 Obsidian 原生 ![[ ]] 块级嵌入渲染成卡片（关闭则完全不介入） */
  upgradeEmbeds: boolean;
  layout: Layout;
  /** 嵌套在大卡片里的卡片默认尺寸 */
  nestedSize: Size;
  cardHeight: number;
  summaryLength: number;
  showCover: boolean;
  showMeta: boolean;
  showTags: boolean;
  showOpenButton: boolean;
  /** 卡片默认展开正文 */
  defaultExpanded: boolean;
  /** 嵌在卡片里的嵌入是否默认展开 */
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
export const SETTINGS_VERSION = 3;

export const DEFAULT_SETTINGS: AtomicCardsSettings = {
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
  summaryFields: ["summary", "description", "abstract", "excerpt", "简介", "摘要"],
  coverFields: ["cover", "image", "banner", "thumbnail", "img", "封面"],
  metaFields: ["type", "status", "domain", "complexity"],
  verbose: false,
};

/** 渲染单张卡片所需选项，全部来自插件设置（没有块内选项了） */
export interface RenderOptions {
  size: Size;
  density: Density;
  layout: Layout;
  cover: boolean;
  meta: boolean;
  tags: boolean;
  open: boolean;
  expanded: boolean;
  /** 卡片最大高度，0 = 不限制 */
  height: number;
  /** 自动摘要字符数 */
  summary: number;
}

/** 非笔记的嵌入（图片 / 音视频 / PDF / 画布等）不做卡片化 */
export const SKIP_EMBED_EXT =
  /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|mp3|wav|ogg|flac|m4a|mp4|webm|mov|pdf|canvas|excalidraw)$/i;
