import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(root, "../../.obsidian/plugins/atomic-cards");
const watch = process.argv.includes("--watch");

fs.mkdirSync(outDir, { recursive: true });

const copy = (name) =>
  fs.copyFileSync(path.join(root, name), path.join(outDir, name));

const ctx = await esbuild.context({
  entryPoints: [path.join(root, "src/main.ts")],
  bundle: true,
  format: "cjs",
  target: "es2018",
  platform: "browser",
  external: ["obsidian", "electron", "node:*", "@codemirror/*", "@lezer/*"],
  outfile: path.join(outDir, "main.js"),
  sourcemap: "inline",
  treeShaking: true,
  logLevel: "info",
});

await ctx.rebuild();
copy("manifest.json");
copy("styles.css");
// 仓库根目录也放一份 main.js，方便直接从 GitHub 下载安装
fs.copyFileSync(path.join(outDir, "main.js"), path.join(root, "main.js"));

if (watch) {
  await ctx.watch();
  console.log("[atomic-cards] watching ...");
} else {
  await ctx.dispose();
  console.log("[atomic-cards] built -> " + outDir);
}
