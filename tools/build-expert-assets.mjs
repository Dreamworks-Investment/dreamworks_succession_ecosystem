/**
 * 研报精修师专家包 · 修正版与 workspace 注入包构建脚本
 *
 * 用法：
 *   node tools/build-expert-assets.mjs "<解压后的专家包目录>"
 *
 * 产物：
 *   dist/report-converter-fixed-<时间戳>.zip       用于重新上传/更新专家
 *   dist/report-converter-workspace-<时间戳>.zip   用于注入 Runtime /workspace
 *
 * 处理内容：
 *   1. 统一 SKILL.md frontmatter 的 name 与目录名/agent 引用：report-converter
 *   2. 把标题从「非上市企业研究报告转换」改为覆盖四种模式的「研报转换与精修」
 *   3. 移除 __pycache__ 等本地缓存
 *   4. 生成 workspace-manifest.json 与注入说明
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(ROOT, "dist");
const STAGE = join(DIST, ".expert-stage");

const SKILL_NAME = "report-converter";
const SKILL_DIR = join("skills", SKILL_NAME);

/* ---------------- 零依赖 zip 写入器 ---------------- */

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

const STORED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip"]);

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
    const flags = 0x0800;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
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
    header.writeUInt16LE(0x031e, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(flags, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(time, 12);
    header.writeUInt16LE(day, 14);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(payload.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(nameBuffer.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE((0o100644 << 16) >>> 0, 38);
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

// 注意：Node 22 在 Windows 上对含中文的目标路径使用 fs.cpSync 会静默不复制，
// 这里改用显式 read/write，保证本项目（路径含中文）下构建稳定。
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else if (entry.isFile()) writeFileSync(dst, readFileSync(src));
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__pycache__" || entry.name === ".git") continue;
      walk(full, out);
    } else if (entry.isFile()) {
      if (/[\\/]__pycache__[\\/]/.test(full)) continue;
      if (entry.name.endsWith(".pyc")) continue;
      out.push(full);
    }
  }
  return out;
}

function toEntries(baseDir, prefix = "") {
  return walk(baseDir).map(full => {
    const name = (prefix ? prefix.replace(/\/$/, "") + "/" : "") + relative(baseDir, full).split(sep).join("/");
    const stat = statSync(full);
    return { name, data: readFileSync(full), mtime: stat.mtime };
  });
}

function stamp() {
  const date = new Date();
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/* ---------------- 主流程 ---------------- */

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error("用法：node tools/build-expert-assets.mjs \"<解压后的专家包目录>\"");
  process.exit(1);
}
const source = resolve(sourceArg);
if (!existsSync(join(source, ".codebuddy-plugin", "plugin.json")) || !existsSync(join(source, SKILL_DIR, "SKILL.md"))) {
  console.error("源目录不是有效的 report-converter 专家包：缺少 plugin.json 或 skills/report-converter/SKILL.md");
  process.exit(1);
}

mkdirSync(DIST, { recursive: true });
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
const stage = join(STAGE, SKILL_NAME);
copyDir(source, stage);

// 修正 skill 名称不一致：目录、plugin、agent 都是 report-converter，frontmatter 必须一致。
const skillPath = join(stage, SKILL_DIR, "SKILL.md");
const skillSource = readFileSync(skillPath, "utf8");
const skillFixed = skillSource
  .replace(/^name:\s*.*$/m, `name: ${SKILL_NAME}`)
  .replace(/^#[ \t]*非上市企业研究报告转换[ \t]*$/m, "# 研报转换与精修");
if (skillFixed === skillSource && !skillSource.includes(`name: ${SKILL_NAME}`)) {
  console.error("SKILL.md 未发生预期修正，请检查 frontmatter 格式。");
  process.exit(1);
}
writeFileSync(skillPath, skillFixed, "utf8");

const label = stamp();
const expertZip = join(DIST, `report-converter-fixed-${label}.zip`);
const workspaceZip = join(DIST, `report-converter-workspace-${label}.zip`);

const expertEntries = toEntries(stage, `${SKILL_NAME}/`);
writeFileSync(expertZip, buildZip(expertEntries));

// workspace 包只放 skill 本身 + 注入说明，不放头像/README/plugin 元信息。
const workspaceStage = join(STAGE, "workspace");
mkdirSync(workspaceStage, { recursive: true });
copyDir(join(stage, SKILL_DIR), join(workspaceStage, SKILL_DIR));

const manifest = {
  schemaVersion: "dreamworks-market-workspace-v1",
  generatedAt: new Date().toISOString(),
  skillName: SKILL_NAME,
  mountPath: `/workspace/${SKILL_DIR}`,
  modeRoute: {
    A: "listed-detailed",
    B: "listed-brief",
    C: "unlisted-detailed",
    D: "unlisted-brief"
  },
  routeSignal: "网站会话 context.reportType = listed / unlisted；用户在提问里说明详细版或简版；未说明时按详细版。",
  runtimeNotes: [
    "这是一个 skill，不是四个独立 skill；四种模式通过 SKILL.md 的「模式路由」分流。",
    "脚本依赖 Python 包 python-docx / Pillow / PyMuPDF，docx/PDF 渲染依赖本地 Office 编辑通道与 Word COM。",
    "网站上传的底稿与 1–3 张图片会落在 inputs/ 目录，并把清单与文本内容注入 prompt。"
  ],
  files: walk(join(workspaceStage, SKILL_DIR))
    .map(full => relative(workspaceStage, full).split(sep).join("/"))
    .sort()
};
writeFileSync(join(workspaceStage, "workspace-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
writeFileSync(join(workspaceStage, "INJECT_README.md"), [
  "# 研报精修师 workspace 注入包",
  "",
  "把本包内容解压到 Runtime 的 `/workspace`，保持 `skills/report-converter/` 目录结构。",
  "",
  "- 入口说明：`skills/report-converter/SKILL.md`",
  "- 规则文件：`skills/report-converter/references/`",
  "- 脚本文件：`skills/report-converter/scripts/`",
  "- 机器可读清单：`workspace-manifest.json`",
  "",
  "网站上传的报告底稿与封面图片会存放到 `/workspace/inputs/`。专家 prompt 会带上文件清单、sha256 与可注入的文本/base64 内容。",
  "",
  "四种模式对应关系：A 上市详细版、B 上市简版、C 非上市详细版、D 非上市简版。",
  ""
].join("\n"), "utf8");

const workspaceEntries = toEntries(workspaceStage);
writeFileSync(workspaceZip, buildZip(workspaceEntries));

console.log("专家包修正版已生成：" + expertZip);
console.log("workspace 注入包已生成：" + workspaceZip);
console.log(`修正项：SKILL.md name=${SKILL_NAME}；标题改为「研报转换与精修」；移除 __pycache__/pyc。`);
console.log(`workspace 文件数：${workspaceEntries.length}`);
