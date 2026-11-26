/**
 * 发布包链路自检
 *
 * 目的：保证「改文件 → npm run build:zip → 上传火山引擎」这条交付链路不会被后续改动破坏。
 * - 出包脚本必须存在，且必须硬性排除 .env
 * - zip 必须根目录平铺，run.sh 必须保留 0755
 * - 限流必须按真实访客 IP 计数（云平台在网关后面）
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

let failures = 0;
function assert(condition, message) {
  if (condition) {
    console.log("  ✓ " + message);
  } else {
    console.log("  ✗ " + message);
    failures += 1;
  }
}

const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const serverSource = readFileSync(resolve(ROOT, "server.js"), "utf8");

console.log("发布包构建脚本");
const buildPath = resolve(ROOT, "tools/build-release.mjs");
assert(existsSync(buildPath), "tools/build-release.mjs 存在");
assert(pkg.scripts && pkg.scripts["build:zip"] === "node tools/build-release.mjs", "package.json 提供 npm run build:zip");

if (existsSync(buildPath)) {
  const source = readFileSync(buildPath, "utf8");
  assert(/EXCLUDED_FILES[\s\S]*?\.env/.test(source), "排除清单包含 .env");
  assert(/startsWith\("\.env\."\)[\s\S]*?\.env\.example/.test(source), "排除 .env.* 但保留 .env.example");
  assert(source.includes("构建中止"), "误纳入凭据文件时中止构建（失败即停）");
  assert(source.includes("0o100755"), "run.sh 保留可执行位");
  assert(source.includes("0x0800"), "文件名写入 UTF-8 标志位（中文文件名不乱码）");
  assert(source.includes('name === "run.sh"'), "仅 run.sh 使用 0755");
}

console.log("限流与网关");
assert(serverSource.includes("function clientAddress(req)"), "存在 clientAddress 解析真实访客地址");
assert(serverSource.includes("x-forwarded-for"), "读取 X-Forwarded-For");
assert(serverSource.includes("x-real-ip"), "读取 X-Real-IP 作为回退");
assert(serverSource.includes("function isGatewayAddress(address)"), "仅在网关/私网对端时信任转发头");
assert(serverSource.includes('process.env.TRUST_PROXY'), "TRUST_PROXY 可强制开启");
assert(/function assertWithinRateLimit[\s\S]{0,200}clientAddress\(req\)/.test(serverSource), "限流键使用 clientAddress(req)");

console.log("");
if (failures) {
  console.error(`发布链路自检未通过：${failures} 项失败。`);
  process.exit(1);
}
console.log("发布链路自检通过。");
