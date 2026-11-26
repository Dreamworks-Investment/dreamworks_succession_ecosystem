/**
 * 梦工场官网 · 火山引擎发布包构建脚本
 *
 * 用法：node tools/build-release.mjs
 * 产物：dist/mgc-website-<时间戳>.zip（根目录平铺，直接上传火山引擎函数服务「上传」）
 *
 * 设计要点：
 * 1. 不依赖 npm 包，仅用 Node 内置 zlib 自己写 zip，保证在任何机器上结果一致；
 * 2. 目录结构根平铺：解压后第一层就是 package.json / server.js / index.html；
 * 3. 强制排除 .env —— 真实凭据只能写在火山引擎控制台的「环境变量」里；
 * 4. run.sh 保留 0755 可执行位，平台用 ./run.sh 启动；
 * 5. 文件名带 UTF-8 标志位，中文文件名不会乱码。
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(ROOT, "dist");

// 不进入发布包的路径（相对 ROOT，统一用 / 分隔）
const EXCLUDED_DIRS = new Set([
  ".git",
  ".github",
  ".workbuddy",
  "node_modules",
  "dist",
  "qa", // 本地自检脚本与截图，线上运行不需要
  "__MACOSX"
]);

const EXCLUDED_FILES = new Set([
  ".env",
  ".DS_Store",
  ".gitignore",
  "package-lock.json"
]);

// .env.local / .env.production 之类一律排除，但保留 .env.example 作为配置说明
function isExcludedFile(name) {
  if (EXCLUDED_FILES.has(name)) return true;
  if (name.startsWith(".env.") && name !== ".env.example") return true;
  if (name.endsWith(".log")) return true;
  if (/^CHANGELOG_/i.test(name)) return true; // 历史变更日志，非运行时依赖
  if (/^VERSION_V/i.test(name)) return true;
  return false;
}

// 已压缩格式不再 deflate，省 CPU 也不影响体积
const STORED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".zip", ".gz",
  ".woff", ".woff2", ".mp4", ".webm", ".pdf"
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      if (isExcludedFile(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

/* ---------------- 最小 zip 写入器 ---------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { time, day };
}

function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
    const useStore = STORED_EXTENSIONS.has(ext);
    const payload = useStore ? data : deflateRawSync(data, { level: 9 });
    const method = useStore ? 0 : 8;
    const checksum = crc32(data);
    const { time, day } = dosDateTime(entry.mtime);
    const flags = 0x0800; // bit 11：文件名为 UTF-8

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuffer, payload);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(0x031e, 4); // made by: unix, spec 3.0（保留权限位）
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(flags, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(time, 12);
    header.writeUInt16LE(day, 14);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(payload.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(nameBuffer.length, 28);
    header.writeUInt16LE(0, 30); // extra
    header.writeUInt16LE(0, 32); // comment
    header.writeUInt16LE(0, 34); // disk start
    header.writeUInt16LE(0, 36); // internal attrs
    header.writeUInt32LE((entry.mode << 16) >>> 0, 38); // external attrs
    header.writeUInt32LE(offset, 42);
    central.push(header, nameBuffer);

    offset += local.length + nameBuffer.length + payload.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuffer, end]);
}

/* ---------------- 主流程 ---------------- */

const files = walk(ROOT).sort();
const entries = files.map(full => {
  const name = relative(ROOT, full).split(sep).join("/");
  const stat = statSync(full);
  const mode = name === "run.sh" ? 0o100755 : 0o100644;
  return { name, data: readFileSync(full), mtime: stat.mtime, mode };
});

// 硬性保险：凭据文件绝不能进包
const leaked = entries.filter(entry => entry.name === ".env" || /^\.env\.(?!example$)/.test(entry.name));
if (leaked.length) {
  console.error("构建中止：以下凭据文件被误纳入发布包，请检查排除规则：");
  leaked.forEach(entry => console.error("  - " + entry.name));
  process.exit(1);
}

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

const stamp = new Date();
const pad = value => String(value).padStart(2, "0");
const label = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`;
const target = join(DIST, `mgc-website-${label}.zip`);
writeFileSync(target, buildZip(entries));

const totalBytes = entries.reduce((sum, entry) => sum + entry.data.length, 0);
const zipBytes = statSync(target).size;
const mb = bytes => (bytes / 1024 / 1024).toFixed(1) + " MB";

console.log("发布包已生成：" + target);
console.log(`文件数 ${entries.length} · 原始 ${mb(totalBytes)} · 压缩后 ${mb(zipBytes)}`);
console.log("");
console.log("第一层结构（上传前请确认没有外层文件夹）：");
const topLevel = new Map();
for (const entry of entries) {
  const parts = entry.name.split("/");
  const key = parts.length > 1 ? parts[0] + "/" : parts[0];
  topLevel.set(key, (topLevel.get(key) || 0) + 1);
}
for (const [key, count] of [...topLevel.entries()].sort()) {
  console.log(`  ${key}${key.endsWith("/") ? ` (${count} 个文件)` : ""}`);
}
console.log("");
console.log("已排除：.env / .env.*、node_modules、.workbuddy、dist、qa、CHANGELOG_*、VERSION_V*、*.log");
