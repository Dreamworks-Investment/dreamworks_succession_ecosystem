import http from "node:http";
import { createReadStream, statSync, existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const HOST = "0.0.0.0";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(ROOT, "." + normalized);
  return candidate.startsWith(resolve(ROOT)) ? candidate : null;
}

function sendFile(req, res, filePath) {
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return false;

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": extname(filePath).toLowerCase() === ".html"
        ? "no-cache"
        : "public, max-age=3600"
    });

    if (req.method === "HEAD") {
      res.end();
    } else {
      createReadStream(filePath).pipe(res);
    }
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method || "")) {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }

  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  let filePath = safePath(pathname);

  if (!filePath) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad Request");
    return;
  }

  if (pathname === "/" || (existsSync(filePath) && statSync(filePath).isDirectory())) {
    filePath = join(pathname === "/" ? ROOT : filePath, "index.html");
  }

  if (sendFile(req, res, filePath)) return;

  // SPA fallback: unknown browser routes return index.html.
  const fallback = join(ROOT, "index.html");
  if (sendFile(req, res, fallback)) return;

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, HOST, () => {
  console.log(`Dreamworks site listening on http://${HOST}:${PORT}`);
});
