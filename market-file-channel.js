/**
 * 梦工场市场专员 · 文件通道骨架
 *
 * 目标：让「报告底稿 + 1–3 张图片」不再只是把文件名拼进 prompt，
 * 而是真正落到会话 workspace，并把清单 / 文本 / base64 注入专家 prompt。
 *
 * 这一步不依赖真实 API Key，也不猜 WorkBuddy Runtime 的私有上传接口：
 * 1. 本地先完整落盘；
 * 2. prompt 里明确告诉专家 workspacePath 与 sha256；
 * 3. 文本文件直接注入正文，小体积二进制注入 base64；
 * 4. 以后拿到真实 Runtime 文件接口时，只需替换 saveFiles() 的落地实现。
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat as statFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve, sep } from "node:path";

const REPORT_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".txt", ".md", ".rtf", ".csv", ".xls", ".xlsx"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".log", ".rtf"]);

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function byteLength(value) {
  return Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value), "utf8");
}

export function isSessionId(value) {
  return /^[a-f0-9-]{32,64}$/i.test(String(value || ""));
}

function assertSessionId(sessionId) {
  if (!isSessionId(sessionId)) {
    const error = new Error("会话标识无效。");
    error.statusCode = 400;
    error.code = "INVALID_SESSION_ID";
    throw error;
  }
  return String(sessionId);
}

function safeFileName(name) {
  const raw = basename(String(name || "file").replace(/\\/g, "/"));
  const cleaned = raw
    .replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || "file";
}

export function multipartBoundary(contentType) {
  const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return (match?.[1] || match?.[2] || "").trim();
}

export function parseMultipartBuffer(buffer, boundary) {
  if (!boundary) {
    const error = new Error("上传请求缺少 multipart boundary。");
    error.statusCode = 400;
    error.code = "BOUNDARY_MISSING";
    throw error;
  }
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = buffer.indexOf(delimiter);
  if (cursor < 0) {
    const error = new Error("上传请求格式无效。");
    error.statusCode = 400;
    error.code = "INVALID_MULTIPART";
    throw error;
  }

  while (cursor >= 0) {
    let start = cursor + delimiter.length;
    if (buffer.subarray(start, start + 2).toString() === "--") break;
    if (buffer.subarray(start, start + 2).toString() === "\r\n") start += 2;
    else start += 1;

    const headerEnd = buffer.indexOf("\r\n\r\n", start);
    if (headerEnd < 0) break;
    const headersText = buffer.subarray(start, headerEnd).toString("utf8");
    const disposition = headersText.match(/content-disposition:[^\r\n]*/i)?.[0] || "";
    const fieldName = disposition.match(/\bname="([^"]*)"/i)?.[1] || "";
    const filename = disposition.match(/\bfilename="([^"]*)"/i)?.[1] || "";
    const contentType = headersText.match(/content-type:\s*([^\r\n;]+)/i)?.[1]?.trim() || "";

    let contentStart = headerEnd + 4;
    let contentEnd = buffer.indexOf(delimiter, contentStart);
    if (contentEnd < 0) break;
    if (buffer.subarray(contentEnd - 2, contentEnd).toString() === "\r\n") contentEnd -= 2;

    parts.push({
      fieldName,
      filename,
      contentType,
      data: Buffer.from(buffer.subarray(contentStart, contentEnd))
    });
    cursor = buffer.indexOf(delimiter, contentEnd + 2);
  }
  return parts;
}

export function createMarketFileChannel({ env = process.env } = {}) {
  const root = resolve(env.MARKET_AGENT_WORKSPACE_ROOT || join(tmpdir(), "mgc-market-agent-workspace"));
  const limits = {
    requestBytes: safeNumber(env.MARKET_AGENT_MAX_UPLOAD_BYTES, 25 * 1024 * 1024),
    fileBytes: safeNumber(env.MARKET_AGENT_MAX_FILE_BYTES, 12 * 1024 * 1024),
    reportFiles: safeNumber(env.MARKET_AGENT_MAX_REPORT_FILES, 10),
    imageFiles: safeNumber(env.MARKET_AGENT_MAX_IMAGE_FILES, 3),
    textInjectBytes: safeNumber(env.WORKBUDDY_FILE_TEXT_BYTES, 160 * 1024),
    base64InjectBytes: safeNumber(env.WORKBUDDY_FILE_BASE64_BYTES, 2 * 1024 * 1024)
  };

  function sessionDir(sessionId) {
    return join(root, "sessions", assertSessionId(sessionId));
  }

  function manifestPath(sessionId) {
    return join(sessionDir(sessionId), "manifest.json");
  }

  function fail(message, statusCode, code) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    throw error;
  }

  async function readMultipart(req, boundary) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > limits.requestBytes) {
        fail("上传内容过大，请压缩底稿或分批处理。", 413, "UPLOAD_TOO_LARGE");
      }
      chunks.push(buffer);
    }
    return parseMultipartBuffer(Buffer.concat(chunks), boundary);
  }

  function splitParts(parts) {
    const files = [];
    for (const part of parts) {
      if (!part.filename) continue;
      const ext = extname(part.filename).toLowerCase();
      let kind = part.fieldName === "image" ? "image" : part.fieldName === "report" ? "report" : "";
      if (!kind) kind = IMAGE_EXTENSIONS.has(ext) ? "image" : "report";
      if (kind === "image" && !IMAGE_EXTENSIONS.has(ext)) {
        fail(`封面图片格式不支持：${part.filename}`, 400, "INVALID_IMAGE_TYPE");
      }
      if (kind === "report" && !REPORT_EXTENSIONS.has(ext)) {
        fail(`报告底稿格式不支持：${part.filename}`, 400, "INVALID_REPORT_TYPE");
      }
      if (part.data.length > limits.fileBytes) {
        fail(`单个文件超过 ${Math.round(limits.fileBytes / 1024 / 1024)}MB：${part.filename}`, 413, "FILE_TOO_LARGE");
      }
      files.push({ kind, filename: part.filename, ext, data: part.data });
    }
    return files;
  }

  async function readManifest(sessionId) {
    const path = manifestPath(sessionId);
    if (!existsSync(path)) return { sessionId: assertSessionId(sessionId), workspace: "/workspace", files: [] };
    try {
      const parsed = JSON.parse(await readFile(path, "utf8"));
      return {
        sessionId: assertSessionId(sessionId),
        workspace: parsed.workspace || "/workspace",
        files: Array.isArray(parsed.files) ? parsed.files : []
      };
    } catch {
      return { sessionId: assertSessionId(sessionId), workspace: "/workspace", files: [] };
    }
  }

  function publicManifest(manifest) {
    return {
      sessionId: manifest.sessionId,
      workspace: manifest.workspace || "/workspace",
      files: (manifest.files || []).map(({ absolutePath, ...file }) => file)
    };
  }

  async function saveFiles(sessionId, parts) {
    const id = assertSessionId(sessionId);
    const files = splitParts(parts);
    const existing = await readManifest(id);
    const reports = files.filter(item => item.kind === "report");
    const images = files.filter(item => item.kind === "image");
    const reportCount = existing.files.filter(item => item.kind === "report").length + reports.length;
    const imageCount = existing.files.filter(item => item.kind === "image").length + images.length;
    if (reportCount < 1) fail("请先上传报告底稿文件。", 400, "REPORT_REQUIRED");
    if (reportCount > limits.reportFiles) fail("报告底稿数量过多。", 400, "TOO_MANY_REPORTS");
    if (imageCount > limits.imageFiles) fail("封面图片最多 3 张。", 400, "TOO_MANY_IMAGES");
    if (!files.length) return existing;

    const dir = sessionDir(id);
    await mkdir(join(dir, "inputs"), { recursive: true });
    const manifest = { ...existing, files: [...existing.files] };
    let index = manifest.files.length;

    for (const item of files) {
      const storedName = `${String(index + 1).padStart(2, "0")}-${safeFileName(item.filename)}`;
      const workspacePath = `inputs/${storedName}`;
      const absolutePath = join(dir, "inputs", storedName);
      await writeFile(absolutePath, item.data);
      const fileStat = await statFile(absolutePath);
      manifest.files.push({
        fileId: createHash("sha256").update(item.data).digest("hex").slice(0, 16),
        kind: item.kind,
        name: item.filename,
        ext: item.ext,
        size: fileStat.size,
        sha256: createHash("sha256").update(item.data).digest("hex"),
        workspacePath,
        absolutePath
      });
      index += 1;
    }

    await writeFile(manifestPath(id), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    return manifest;
  }

  async function deleteFiles(sessionId) {
    await rm(sessionDir(sessionId), { recursive: true, force: true });
  }

  async function buildPromptEnvelope(text, manifest, overrides = {}) {
    const files = manifest?.files || [];
    if (!files.length) return text;
    const textBytes = safeNumber(overrides.textInjectBytes, limits.textInjectBytes);
    const base64Bytes = safeNumber(overrides.base64InjectBytes, limits.base64InjectBytes);
    const lines = [
      "【本次会话已上传文件】",
      "以下文件已经进入本次会话的 workspace。请优先按真实文件路径读取和处理；如果看不到工作区文件，请使用下面注入的内容。",
      `工作区根目录：${manifest.workspace || "/workspace"}`
    ];
    for (const file of files) {
      const label = file.kind === "image" ? "封面图片" : "报告底稿";
      lines.push(`- [${label}] ${file.workspacePath} · ${file.size} 字节 · sha256:${String(file.sha256 || "").slice(0, 16)}…`);
    }
    lines.push("不要要求用户重新上传这些文件；不要把 base64 原文写进最终报告。");

    const blocks = [];
    for (const file of files) {
      const absolutePath = file.absolutePath || join(sessionDir(manifest.sessionId), file.workspacePath);
      let buffer;
      try {
        buffer = await readFile(absolutePath);
      } catch {
        continue;
      }
      const header = `--- FILE ${file.workspacePath} (${file.kind}) ---`;
      const footer = `--- END FILE ${file.workspacePath} ---`;
      if (TEXT_EXTENSIONS.has(file.ext || extname(file.name).toLowerCase())) {
        const safe = buffer.length <= textBytes
          ? buffer.toString("utf8")
          : buffer.toString("utf8", 0, textBytes) + "\n\n[正文过长，已截断；完整文件请从工作区路径读取]";
        blocks.push(`${header}\n${safe}\n${footer}`);
      } else if (buffer.length <= base64Bytes) {
        blocks.push(`${header}\n编码：base64\n${buffer.toString("base64")}\n${footer}`);
      } else {
        blocks.push(`${header}\n二进制文件过大，未内联；请从工作区路径读取。\n${footer}`);
      }
    }

    const injected = blocks.length
      ? `\n\n【文件内容注入】\n${blocks.join("\n\n")}\n\n若只看到 base64，请先把各文件解码保存到对应 workspacePath，再按 skill 规则处理。`
      : "\n\n【文件内容注入】\n当前文件未内联，请直接从 workspacePath 读取。";
    return `${text}\n\n${lines.join("\n")}${injected}`;
  }

  return {
    root,
    limits,
    multipartBoundary,
    readMultipart,
    parseMultipartBuffer,
    readManifest,
    publicManifest,
    saveFiles,
    deleteFiles,
    buildPromptEnvelope
  };
}
