import AtomicCardsPlugin from "./main";
import { Layout, Size } from "./types";
import { App, PluginSettingTab, Setting } from "obsidian";

export class AtomicCardsSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AtomicCardsPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();

    new Setting(containerEl).setName("行为").setHeading();

    new Setting(containerEl)
      .setName("接管原生嵌入 ![[ ]]")
      .setDesc("把独占一行的 ![[笔记]] 嵌入渲染成可折叠卡片；关闭后插件完全不介入，嵌入保持 Obsidian 默认样式")
      .addToggle((t) =>
        t.setValue(s.upgradeEmbeds).onChange(async (v) => {
          s.upgradeEmbeds = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("布局").setHeading();

    new Setting(containerEl)
      .setName("卡片最大高度 (px)")
      .setDesc("0 = 不限制；超过后卡片内部滚动")
      .addText((t) =>
        t.setValue(String(s.cardHeight)).onChange(async (v) => {
          s.cardHeight = Number(v) || 0;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("卡片布局")
      .setDesc("包裹卡片 = 横向扁平的容器；竖版卡牌 = 传统卡片墙（顶部大封面）")
      .addDropdown((d) =>
        d
          .addOption("wrap", "包裹卡片（横向）")
          .addOption("card", "竖版卡牌（顶部封面）")
          .setValue(s.layout)
          .onChange(async (v) => {
            s.layout = v as Layout;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("嵌套卡片的尺寸")
      .setDesc("卡片里再套的嵌入默认用什么尺寸")
      .addDropdown((d) =>
        d
          .addOption("small", "知识点小卡片（一行多个）")
          .addOption("normal", "常规卡片")
          .setValue(s.nestedSize)
          .onChange(async (v) => {
            s.nestedSize = v as Size;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("密度")
      .addDropdown((d) =>
        d
          .addOption("comfortable", "宽松")
          .addOption("compact", "紧凑")
          .setValue(s.density)
          .onChange(async (v) => {
            s.density = v as "compact" | "comfortable";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName("卡片内容").setHeading();

    new Setting(containerEl)
      .setName("摘要长度")
      .setDesc("自动摘要截取的字符数（frontmatter 有 summary/description 时优先用）")
      .addText((t) =>
        t.setValue(String(s.summaryLength)).onChange(async (v) => {
          s.summaryLength = Number(v) || 180;
          await this.plugin.saveSettings();
        })
      );

    const toggle = (name: string, desc: string, get: () => boolean, set: (v: boolean) => void) =>
      new Setting(containerEl).setName(name).setDesc(desc).addToggle((t) =>
        t.setValue(get()).onChange(async (v) => {
          set(v);
          await this.plugin.saveSettings();
        })
      );

    toggle("显示封面", "读取 frontmatter 的 cover/image/banner 或正文第一张图", () => s.showCover, (v) => (s.showCover = v));
    toggle("显示元信息", "type / status / domain / 更新时间 / 字数", () => s.showMeta, (v) => (s.showMeta = v));
    toggle("显示标签", "", () => s.showTags, (v) => (s.showTags = v));
    toggle("显示「打开」按钮", "", () => s.showOpenButton, (v) => (s.showOpenButton = v));
    toggle("默认展开正文", "打开文档时卡片直接显示完整内容，点标题可折叠", () => s.defaultExpanded, (v) => (s.defaultExpanded = v));
    toggle(
      "嵌套卡片默认展开",
      "卡片里再套的卡片墙是否默认展开；关闭时只显示标题和摘要",
      () => s.nestedExpanded,
      (v) => (s.nestedExpanded = v)
    );

    new Setting(containerEl)
      .setName("最大嵌套深度")
      .setDesc("卡片里再放 cards 块时的递归层数上限，防止循环引用卡死")
      .addText((t) =>
        t.setValue(String(s.maxNestDepth)).onChange(async (v) => {
          s.maxNestDepth = Math.max(1, Number(v) || 3);
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("字段映射").setHeading();

    const listField = (name: string, desc: string, get: () => string[], set: (v: string[]) => void) =>
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText((t) =>
          t
            .setValue(get().join(", "))
            .setPlaceholder("a, b, c")
            .onChange(async (v) => {
              set(
                v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
              );
              await this.plugin.saveSettings();
            })
        );

    listField("摘要字段", "按顺序尝试读取的 frontmatter 字段", () => s.summaryFields, (v) => (s.summaryFields = v));
    listField("封面字段", "", () => s.coverFields, (v) => (s.coverFields = v));
    listField("元信息字段", "会以徽章形式显示在卡片上", () => s.metaFields, (v) => (s.metaFields = v));
  }
}
