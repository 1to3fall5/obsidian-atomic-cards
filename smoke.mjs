import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const stub = path.resolve(".smoke-obsidian-stub.cjs");
fs.writeFileSync(stub, "module.exports={MarkdownRenderer:{},Component:class{}};\n");

const load = async (entry, out, alias) => {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: out,
    logLevel: "error",
    ...(alias ? { alias } : { external: ["obsidian"] }),
  });
  const mod = await import(pathToFileURL(path.resolve(out)).href);
  return mod.default ?? mod;
};

const parser = await load("src/parser.ts", ".smoke-parser.cjs");
const metadata = await load("src/metadata.ts", ".smoke-metadata.cjs", {
  obsidian: stub,
});

let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`ok   ${name}`);
  else {
    console.log(`FAIL ${name} ${extra}`);
    fail++;
  }
};
const eq = (name, actual, expected) =>
  check(name, JSON.stringify(actual) === JSON.stringify(expected), `\n  got ${JSON.stringify(actual)}\n  exp ${JSON.stringify(expected)}`);

/* ---------- parser ---------- */
const q1 = parser.parseCardsBlock(
  ["columns: 3", "title: 本章引用的原子文档", "---", "- [[A]]", "- ![[B]]", "- [[C|别名]]", "- 纯文本标题"].join("\n")
);
eq("options 解析", q1.options, { columns: 3, title: "本章引用的原子文档" });
eq("entries 解析", q1.entries, [
  { target: "A" },
  { target: "B" },
  { target: "C", alias: "别名" },
  { target: "纯文本标题" },
]);

const q2 = parser.parseCardsBlock(
  ["from: wiki/concepts", "tag: #type/concept", "sort: updated", "limit: 5", "reverse: true", "density: compact", "height: 220", "summary: 80", "expanded: true", "cover: false"].join("\n")
);
eq("query 选项", q2.options, {
  from: "wiki/concepts",
  tag: "type/concept",
  sort: "updated",
  limit: 5,
  reverse: true,
  density: "compact",
  height: 220,
  summary: 80,
  expanded: true,
  cover: false,
});

eq("layout 选项（style 为别名，后者覆盖）", parser.parseCardsBlock("layout: card\nstyle: wrap").options, {
  layout: "wrap",
});

eq("空块", parser.parseCardsBlock(""), { options: {}, entries: [] });
eq("忽略 markdown 标题行、只收普通行", parser.parseCardsBlock("# 标题\n普通一行"), {
  options: {},
  entries: [{ target: "普通一行" }],
});
eq("块引用与标签行不收为条目", parser.parseCardsBlock("> 引用\n#tag\n- [[A]]"), {
  options: {},
  entries: [{ target: "A" }],
});

/* ---------- 摘要提取 ---------- */
const md = [
  "---",
  "type: concept",
  'title: "Second Brain"',
  "---",
  "",
  "# Second Brain（第二大脑）",
  "",
  "一套**个人知识管理**方法论的总称：把信息外置到可信系统里。",
  "",
  "> [!gap] 尚未深入对比各仓库的取舍。",
  "> 这一行是引用正文",
  "",
  "- [[LLM Wiki Pattern]] — 自组织 wiki",
  "- ![](cover.png)",
].join("\n");

const text = metadata.toPlainText(md);
check("去掉 frontmatter", !text.includes("type: concept") && !text.includes("title:"), text);
check("去掉标题行", !text.includes("Second Brain（第二大脑）"), text);
check("保留正文", text.includes("一套个人知识管理方法论的总称"), text);
check("去掉强调符号", !text.includes("**"), text);
check("wikilink 取显示名", text.includes("LLM Wiki Pattern") && !text.includes("[["), text);
check("去掉 callout 标题行", !text.includes("[!gap]"), text);
check("保留 callout 正文", text.includes("这一行是引用正文"), text);
check("去掉图片语法", !text.includes("cover.png"), text);

/* ---------- 段落级引用 ---------- */
const lines = [
  "# Title",
  "",
  "intro",
  "",
  "## 关键机制",
  "- a",
  "- b",
  "",
  "## 为什么适合 Chen",
  "text",
  "",
  "# 一级结尾",
];
const rawDoc = lines.join("\n");
const fakeCache = {
  headings: [
    { heading: "Title", level: 1, position: { start: { line: 0 } } },
    { heading: "关键机制", level: 2, position: { start: { line: 4 } } },
    { heading: "为什么适合 Chen", level: 2, position: { start: { line: 8 } } },
    { heading: "一级结尾", level: 1, position: { start: { line: 11 } } },
  ],
  blocks: { abc: { position: { start: { line: 5 }, end: { line: 6 } } } },
};

const b1 = metadata.extractBlock(rawDoc, fakeCache, "关键机制");
check(
  "heading 块：取该标题到下一个同级标题之间",
  !!b1 && b1.title === "关键机制" && b1.content.includes("- a") && !b1.content.includes("text"),
  JSON.stringify(b1)
);

const b2 = metadata.extractBlock(rawDoc, fakeCache, "为什么适合 Chen");
check(
  "heading 块：遇更高级标题也会结束",
  !!b2 && b2.content.includes("text") && !b2.content.includes("一级结尾"),
  JSON.stringify(b2)
);

const b3 = metadata.extractBlock(rawDoc, fakeCache, "^abc");
check("块 id 引用", !!b3 && b3.content === "- a\n- b", JSON.stringify(b3));

check("找不到的段落返回 null", metadata.extractBlock(rawDoc, fakeCache, "不存在") === null);
check("URL 编码的标题可匹配", !!metadata.extractBlock(rawDoc, fakeCache, "为什么适合%20Chen"));

for (const tmp of [stub, ".smoke-parser.cjs", ".smoke-metadata.cjs"]) {
  fs.rmSync(path.resolve(tmp), { force: true });
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
