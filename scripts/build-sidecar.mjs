#!/usr/bin/env node
/**
 * 编译 sidecar 二进制：把兄弟项目 ../feedback-classifier 的 Express 用 Bun
 * 编译成单文件二进制，按 Tauri 期望的 <name>-<target-triple> 命名放到
 * src-tauri/binaries/。
 *
 * 用法：
 *   node scripts/build-sidecar.mjs           # 编译当前平台
 *   node scripts/build-sidecar.mjs --current # 同上（显式）
 *   node scripts/build-sidecar.mjs --all     # 编译三大平台（需 bun >= 1.1）
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const binariesDir = resolve(projectRoot, "src-tauri/binaries");
const sidecarSrc = resolve(projectRoot, "../feedback-classifier/server-bundle/entry.js");

if (!existsSync(sidecarSrc)) {
  console.error(`找不到 sidecar 入口：${sidecarSrc}`);
  console.error(`请检查 ../feedback-classifier 仓库是否存在并已包含 server-bundle/entry.js`);
  process.exit(1);
}
if (!existsSync(binariesDir)) {
  mkdirSync(binariesDir, { recursive: true });
}

function detectTriple() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "darwin" && arch === "arm64") return "aarch64-apple-darwin";
  if (platform === "darwin" && arch === "x64") return "x86_64-apple-darwin";
  if (platform === "win32" && arch === "x64") return "x86_64-pc-windows-msvc";
  if (platform === "linux" && arch === "x64") return "x86_64-unknown-linux-gnu";
  throw new Error(`不支持的平台：${platform}/${arch}`);
}

const ALL_TARGETS = [
  { triple: "aarch64-apple-darwin", bunTarget: "bun-darwin-arm64", ext: "" },
  { triple: "x86_64-apple-darwin", bunTarget: "bun-darwin-x64", ext: "" },
  { triple: "x86_64-pc-windows-msvc", bunTarget: "bun-windows-x64", ext: ".exe" },
];

const args = process.argv.slice(2);
const wantAll = args.includes("--all");

const targets = wantAll
  ? ALL_TARGETS
  : ALL_TARGETS.filter((t) => t.triple === detectTriple()).map((t) => ({
      ...t,
      bunTarget: undefined,
    }));

if (targets.length === 0) {
  targets.push({ triple: detectTriple(), bunTarget: undefined, ext: process.platform === "win32" ? ".exe" : "" });
}

for (const t of targets) {
  const out = join(binariesDir, `feedback-server-${t.triple}${t.ext}`);
  const cmd = [
    "bun build",
    JSON.stringify(sidecarSrc),
    "--compile",
    t.bunTarget ? `--target=${t.bunTarget}` : "",
    `--outfile=${JSON.stringify(out)}`,
  ]
    .filter(Boolean)
    .join(" ");
  console.log(`→ ${t.triple}`);
  execSync(cmd, { stdio: "inherit", cwd: resolve(projectRoot, "../feedback-classifier") });
  console.log(`  ✓ ${out}`);
}

console.log("sidecar build done.");
