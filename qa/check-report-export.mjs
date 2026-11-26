/**
 * 报告导出模块自检
 *
 * 直接在 Node 里跑 js/report-export.js（它不碰 DOM），验证：
 * - CRC32 / zip 容器合法（docx 能被标准工具解开）
 * - 生成内容正确转义，不会把 `<script>` 原样写进导出文件
 * - 简版提炼能命中「摘要 / 结论」章节，取不到时有合理退化
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

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

const source = readFileSync(resolve(ROOT, "js/report-export.js"), "utf8");
const sandbox = { module: { exports: {} }, TextEncoder, TextDecoder, URL, Blob: class {}, setTimeout };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const EXPORT = sandbox.module.exports;

console.log("模块装载");
assert(typeof EXPORT.buildDocxBytes === "function", "暴露 buildDocxBytes");
assert(typeof EXPORT.buildBrief === "function", "暴露 buildBrief");
assert(typeof EXPORT.toMarkdown === "function", "暴露 toMarkdown");

console.log("CRC32");
assert(EXPORT.crc32(new TextEncoder().encode("123456789")) === 0xcbf43926, "标准测试向量 0xCBF43926");

const sampleBody = [
  "一、公司与行业概览",
  "该标的主营工业自动化零部件，下游覆盖新能源与 3C 制造。近三年收入复合增速 18%，毛利率稳定在 34% 左右。",
  "",
  "二、核心结论",
  "结论一：所处赛道景气度仍在，但价格竞争加剧，2026 年毛利率存在 2–3 个百分点压力。",
  "结论二：海外收入占比不足 8%，汇率与关税敏感度可控。",
  "",
  "三、风险与证据缺口",
  "- 前五大客户集中度 46%，客户流失风险需重点跟踪。",
  "- 缺少 2025 年四季度分产品收入拆分，需向公司索取。"
].join("\n");

const payload = {
  title: "非上市公司报告润览",
  version: "full",
  body: sampleBody,
  agentName: "梦工场市场专员",
  generatedAt: new Date("2026-11-24T14:30:00")
};

console.log("DOCX 容器");
const docx = EXPORT.buildDocxBytes(payload);
assert(ArrayBuffer.isView(docx) && docx.BYTES_PER_ELEMENT === 1, "产出字节数组（Uint8Array）");
assert(docx[0] === 0x50 && docx[1] === 0x4b && docx[2] === 0x03 && docx[3] === 0x04, "以 PK\\x03\\x04 开头");

function readZipEntries(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("找不到 EOCD");
  const total = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const entries = [];
  for (let i = 0; i < total; i += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error("中央目录损坏 @" + pointer);
    const method = view.getUint16(pointer + 10, true);
    const crc = view.getUint32(pointer + 16, true);
    const size = view.getUint32(pointer + 24, true);
    const nameLen = view.getUint16(pointer + 28, true);
    const extraLen = view.getUint16(pointer + 30, true);
    const commentLen = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = new TextDecoder().decode(buffer.subarray(pointer + 46, pointer + 46 + nameLen));
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    entries.push({
      name,
      method,
      crc,
      size,
      data: buffer.subarray(dataStart, dataStart + size)
    });
    pointer += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const entries = readZipEntries(docx);
const names = entries.map(entry => entry.name).sort();
assert(entries.length === 4, "docx 内含 4 个部件（实际 " + entries.length + "）");
assert(names.includes("[Content_Types].xml"), "含 [Content_Types].xml");
assert(names.includes("_rels/.rels"), "含 _rels/.rels");
assert(names.includes("word/document.xml"), "含 word/document.xml");
assert(entries.every(entry => entry.method === 0), "全部为存储模式（无需解压）");

const docXml = new TextDecoder().decode(entries.find(entry => entry.name === "word/document.xml").data);
assert(docXml.includes("<w:document"), "document.xml 根节点正确");
assert(docXml.includes("非上市公司报告润览"), "正文含报告标题");
assert(docXml.includes("客户流失风险需重点跟踪"), "正文含样本文本");
assert(/<w:sectPr>[\s\S]*<\/w:sectPr><\/w:body><\/w:document>$/.test(docXml), "sectPr 位于 body 末尾");
assert(docXml.indexOf("<w:sectPr>") > docXml.indexOf("<w:p>"), "sectPr 在段落之后");

// CRC 自校验：用独立实现重算
function crc32Ref(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
assert(entries.every(entry => crc32Ref(entry.data) === entry.crc), "每个部件的 CRC32 与记录一致");

console.log("转义安全");
const risky = { ...payload, body: '风险点：<script>alert(1)</script> 与 "引号" & 括号' };
const riskyDoc = new TextDecoder().decode(
  readZipEntries(EXPORT.buildDocxBytes(risky)).find(entry => entry.name === "word/document.xml").data
);
assert(!riskyDoc.includes("<script>"), "docx 中 <script> 被转义");
assert(riskyDoc.includes("&lt;script&gt;"), "docx 中保留转义后的原文");
const riskyHtml = EXPORT.toHtmlDocument(risky);
assert(!/<script>alert/.test(riskyHtml), "HTML 中 <script> 被转义");

console.log("Markdown / HTML");
const md = EXPORT.toMarkdown(payload);
assert(md.startsWith("# 非上市公司报告润览"), "Markdown 以标题开头");
assert(md.includes("版本：详细版"), "Markdown 含版本行");
assert(md.includes("客户流失风险需重点跟踪"), "Markdown 含正文");
const briefMd = EXPORT.toMarkdown({ ...payload, version: "brief" });
assert(briefMd.includes("简版由详细底稿自动提炼"), "简版 Markdown 带提炼说明");
const html = EXPORT.toHtmlDocument(payload);
assert(html.startsWith("<!doctype html>"), "HTML 为完整文档");
assert(html.includes("@page"), "HTML 含打印分页规则");
assert(html.includes("<h2>二、核心结论</h2>"), "HTML 把小标题渲染为 h2");

console.log("简版提炼");
// 上限设得比正文短，才会真正走「提炼」分支；否则会原样返回全文
const simplified = EXPORT.buildBrief(sampleBody, 120);
assert(typeof simplified === "string" && simplified.length > 0, "能产出简版文本");
assert(simplified.includes("结论一") && simplified.includes("结论二"), "命中并完整保留「核心结论」两条");
assert(!simplified.includes("缺少 2025 年四季度分产品收入拆分"), "简版剔除同章节的次要细节");
assert(simplified.length <= 121, "简版受长度上限约束（" + simplified.length + " 字）");
const unchanged = EXPORT.buildBrief(sampleBody, 4000);
assert(unchanged.length === sampleBody.replace(/\n{3,}/g, "\n\n").trim().length, "正文短于上限时原样返回全文");
const noSummaryHeading = EXPORT.buildBrief("甲段落讲了一件事。乙段落讲了另一件事。丙段落再讲一件。", 200);
assert(noSummaryHeading.length > 0, "无摘要标题时仍能退化产出");

console.log("文件名");
const fileName = EXPORT.buildFileName({ ...payload, extension: "docx" });
assert(/^非上市公司报告润览-详细版-\d{8}-\d{4}\.docx$/.test(fileName), "文件名格式正确：" + fileName);
const unsafeName = EXPORT.buildFileName({ ...payload, title: 'A/B:C*?"<>|', extension: "md" });
assert(!/[\\/:*?"<>|]/.test(unsafeName), "文件名剔除非法字符");

console.log("长度统计");
assert(EXPORT.countChars("中 文\nabc") === 5, "字数统计忽略空白（中 文abc = 5）");

console.log("");
if (failures) {
  console.error(`报告导出自检未通过：${failures} 项失败。`);
  process.exit(1);
}
console.log("报告导出自检通过。源文件指纹 " + createHash("md5").update(source).digest("hex").slice(0, 8));
