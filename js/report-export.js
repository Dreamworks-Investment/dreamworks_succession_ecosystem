/* 梦工场市场专员 · 报告导出
 *
 * 纯前端、零依赖：把会话里生成的报告正文导出为 .md / .html / .docx / .pdf。
 * - .docx 由本文件自己拼 OOXML 并用「存储模式」zip 打包，浏览器即可生成合法 Word 文件
 * - .pdf 走浏览器打印面板（无内嵌中文字体时，这是唯一不引入第三方库的可靠方式）
 * - 本文件不碰 DOM，可在 Node 里直接 require 出来做单测
 */
(function (global) {
  'use strict';

  /* ---------------- 文本整理 ---------------- */

  function normalizeText(text) {
    return String(text == null ? '' : text)
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function isHeadingLine(line) {
    if (!line) return false;
    if (/^#{1,6}\s+/.test(line)) return true;
    if (/^\*\*[^*]+\*\*$/.test(line)) return true;
    if (/^[一二三四五六七八九十]+[、.．]/.test(line)) return true;
    if (/^[（(]\s*[一二三四五六七八九十\d]+\s*[）)]/.test(line)) return true;
    if (/^\d+[、.．]\s?/.test(line) && line.length <= 40) return true;
    // 短行且没有句末标点，视为标题
    if (line.length <= 26 && !/[。；，、！？：；,.!?;:]$/.test(line) && !/[。！？]/.test(line)) return true;
    return false;
  }

  function stripHeadingMarks(line) {
    return String(line)
      .replace(/^#{1,6}\s+/, '')
      .replace(/^\*\*(.+?)\*\*$/, '$1')
      .trim();
  }

  // 把正文切成 { heading, body } 块，便于挑摘要、也便于 docx 排版
  function splitBlocks(text) {
    const lines = normalizeText(text).split('\n');
    const blocks = [];
    let heading = '';
    let buffer = [];
    let sawHeading = false;

    const flush = () => {
      const body = buffer.join('\n').trim();
      if (heading || body) blocks.push({ heading, body });
      buffer = [];
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        if (buffer.length) buffer.push('');
        continue;
      }
      if (isHeadingLine(line)) {
        flush();
        heading = stripHeadingMarks(line);
        sawHeading = true;
        continue;
      }
      buffer.push(line);
    }
    flush();
    return sawHeading ? blocks : [{ heading: '', body: normalizeText(text) }];
  }

  const SUMMARY_HEADING = /(摘要|结论|核心观点|关键结论|要点|总结|概述|概要|执行摘要|投资结论|研究结论|主要发现|判断|建议)/i;

  function firstSentence(text) {
    const match = String(text).match(/^[\s\S]*?[。！？!?]/);
    return (match ? match[0] : String(text)).trim();
  }

  function clampAtSentence(text, limit) {
    if (text.length <= limit) return text;
    const sliced = text.slice(0, limit);
    const cut = Math.max(
      sliced.lastIndexOf('。'),
      sliced.lastIndexOf('！'),
      sliced.lastIndexOf('？'),
      sliced.lastIndexOf('\n')
    );
    return (cut > limit * 0.5 ? sliced.slice(0, cut + 1) : sliced).trim() + '…';
  }

  /**
   * 从详细正文里提炼简版。
   * 策略：先完整保留「摘要 / 结论 / 要点」类章节，再用其余章节的首句把篇幅补足到上限附近，
   * 这样简版读起来仍是一份完整的报告骨架，而不是只剩几句结论。
   */
  function buildBrief(text, limit) {
    const max = limit || 1800;
    const source = normalizeText(text);
    if (!source) return '';

    if (source.length <= max) {
      return clampAtSentence(source, max);
    }

    const blocks = splitBlocks(source).filter(block => block.body || block.heading);
    if (!blocks.length) return clampAtSentence(source, max);

    const pickedHeadings = new Set();
    const parts = [];

    // 第一轮：摘要 / 结论 / 要点类章节整段保留
    for (const block of blocks) {
      if (!block.heading || !block.body) continue;
      if (!SUMMARY_HEADING.test(block.heading)) continue;
      parts.push(`【${block.heading}】\n${block.body}`);
      pickedHeadings.add(block.heading);
    }

    // 第二轮：其余章节各取首句，把骨架补齐
    if (joinedLength(parts) < max * 0.7) {
      for (const block of blocks) {
        if (block.heading && pickedHeadings.has(block.heading)) continue;
        const sentence = firstSentence(block.body || '');
        if (!sentence) {
          if (block.heading) parts.push(block.heading);
          continue;
        }
        parts.push(block.heading ? `${block.heading}：${sentence}` : sentence);
        if (joinedLength(parts) >= max * 0.85) break;
      }
    }

    let brief = parts.join('\n\n').trim();
    if (brief.length < 80) brief = firstSentence(source);
    return clampAtSentence(brief, max);
  }

  function joinedLength(parts) {
    return parts.reduce((sum, part) => sum + part.length + 2, 0);
  }

  function countChars(text) {
    return String(text).replace(/\s/g, '').length;
  }

  /* ---------------- 元信息 / 文件头 ---------------- */

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function stampNow(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function compactStamp(date) {
    const d = date || new Date();
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  const VERSION_LABEL = { full: '详细版', brief: '简版' };

  function buildMetaLines(payload) {
    const version = VERSION_LABEL[payload.version] || '详细版';
    const lines = [
      `报告类型：${payload.title || '梦工场报告润览'}`,
      `版本：${version}`,
      `生成时间：${stampNow(payload.generatedAt)}`,
      `生成方：${payload.agentName || '梦工场市场专员'}`
    ];
    if (payload.body) lines.push(`正文约 ${countChars(payload.body)} 字`);
    return lines;
  }

  function buildFileName(payload) {
    const title = String(payload.title || '梦工场报告润览').replace(/[\\/:*?"<>|]/g, '');
    const version = VERSION_LABEL[payload.version] || '详细版';
    const ext = payload.extension || 'md';
    return `${title}-${version}-${compactStamp(payload.generatedAt)}.${ext}`;
  }

  /* ---------------- Markdown ---------------- */

  function toMarkdown(payload) {
    const meta = buildMetaLines(payload)
      .map(line => '> ' + line)
      .join('\n');
    const notice = payload.version === 'brief'
      ? '\n> 说明：简版由详细底稿自动提炼，仅保留结论与关键要点；完整论证、数据与证据缺口请查阅详细版。\n'
      : '';
    return `# ${payload.title || '梦工场报告润览'}\n\n${meta}\n${notice}\n---\n\n${normalizeText(payload.body)}\n`;
  }

  /* ---------------- HTML ---------------- */

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function bodyToHtmlParagraphs(text) {
    const blocks = splitBlocks(text);
    const out = [];
    for (const block of blocks) {
      if (block.heading) out.push(`<h2>${escapeHtml(block.heading)}</h2>`);
      const paragraphs = String(block.body || '').split(/\n{2,}/);
      for (const paragraph of paragraphs) {
        const lines = paragraph.split('\n').filter(Boolean);
        if (!lines.length) continue;
        const isList = lines.every(line => /^[-*•·]\s+/.test(line) || /^\d+[、.．]\s?/.test(line));
        if (isList) {
          out.push('<ul>' + lines.map(line => `<li>${escapeHtml(line.replace(/^[-*•·]\s+/, ''))}</li>`).join('') + '</ul>');
        } else {
          out.push(`<p>${escapeHtml(lines.join(' '))}</p>`);
        }
      }
    }
    return out.join('\n');
  }

  function toHtmlDocument(payload) {
    const meta = buildMetaLines(payload);
    const notice = payload.version === 'brief'
      ? '<p class="notice">简版由详细底稿自动提炼，仅保留结论与关键要点；完整论证、数据与证据缺口请查阅详细版。</p>'
      : '';
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(payload.title || '梦工场报告润览')} · ${VERSION_LABEL[payload.version] || '详细版'}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 48px 24px 72px; background: #f4f2ec; color: #16283c;
    font: 16px/1.9 "Songti SC", "Noto Serif SC", "Source Han Serif SC", Georgia, serif; }
  main { max-width: 780px; margin: 0 auto; background: #fff; padding: 56px 60px 64px;
    border: 1px solid #e2ddd1; border-radius: 4px; box-shadow: 0 18px 48px rgba(18, 40, 60, .08); }
  .kicker { margin: 0 0 10px; color: #9a7422; font-size: 11px; letter-spacing: .22em; font-weight: 700; }
  h1 { margin: 0 0 22px; font-size: 1.9rem; line-height: 1.4; color: #0a2946; letter-spacing: .01em; }
  .meta { margin: 0 0 10px; padding: 14px 18px; border-left: 3px solid #d4af37; background: #faf7ee;
    color: #4a5f74; font-size: .82rem; line-height: 1.8; }
  .meta span { display: block; }
  .notice { margin: 18px 0 0; padding: 12px 16px; border-radius: 6px; background: #f4f7fa;
    color: #50647a; font-size: .82rem; line-height: 1.7; }
  hr { margin: 28px 0 30px; border: 0; border-top: 1px solid #e4ded1; }
  h2 { margin: 34px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #eee7d8;
    font-size: 1.15rem; color: #0a2946; letter-spacing: .01em; }
  p { margin: 0 0 14px; text-align: justify; }
  ul { margin: 0 0 16px; padding-left: 22px; }
  li { margin: 0 0 7px; }
  footer { max-width: 780px; margin: 18px auto 0; color: #8a94a0; font-size: .72rem; text-align: center; }
  @page { size: A4; margin: 20mm 18mm; }
  @media print {
    body { padding: 0; background: #fff; }
    main { max-width: none; padding: 0; border: 0; box-shadow: none; }
    footer { display: none; }
    h2 { page-break-after: avoid; }
    p, li { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <p class="kicker">DREAMWORKS · MARKET INTELLIGENCE</p>
  <h1>${escapeHtml(payload.title || '梦工场报告润览')}</h1>
  <p class="meta">${meta.map(line => `<span>${escapeHtml(line)}</span>`).join('')}</p>
  ${notice}
  <hr>
  ${bodyToHtmlParagraphs(payload.body)}
</main>
<footer>本文件由梦工场市场专员生成，仅供内部研究与讨论使用。</footer>
</body>
</html>`;
  }

  /* ---------------- DOCX（自建 OOXML + 存储模式 zip） ---------------- */

  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function utf8(text) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text);
    const out = [];
    for (let i = 0; i < text.length; i += 1) {
      let code = text.codePointAt(i);
      if (code > 0xffff) i += 1;
      if (code < 0x80) out.push(code);
      else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return new Uint8Array(out);
  }

  // 只做「存储」不压缩的最小 zip 写入器：docx 只要求容器合法，不要求压缩
  function zipStore(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;

    entries.forEach(entry => {
      const nameBytes = utf8(entry.name);
      const dataBytes = entry.data;
      const checksum = crc32(dataBytes);

      const local = new Uint8Array(30);
      const view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true); // UTF-8 文件名
      view.setUint16(8, 0, true); // 存储模式
      view.setUint16(10, 0, true); // time
      view.setUint16(12, 0x21, true); // date: 1980-01-01
      view.setUint32(14, checksum, true);
      view.setUint32(18, dataBytes.length, true);
      view.setUint32(22, dataBytes.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);

      chunks.push(local, nameBytes, dataBytes);

      const header = new Uint8Array(46);
      const hview = new DataView(header.buffer);
      hview.setUint32(0, 0x02014b50, true);
      hview.setUint16(4, 0x0014, true);
      hview.setUint16(6, 20, true);
      hview.setUint16(8, 0x0800, true);
      hview.setUint16(10, 0, true);
      hview.setUint16(12, 0, true);
      hview.setUint16(14, 0x21, true);
      hview.setUint32(16, checksum, true);
      hview.setUint32(20, dataBytes.length, true);
      hview.setUint32(24, dataBytes.length, true);
      hview.setUint16(28, nameBytes.length, true);
      hview.setUint16(30, 0, true);
      hview.setUint16(32, 0, true);
      hview.setUint16(34, 0, true);
      hview.setUint16(36, 0, true);
      hview.setUint32(38, 0, true);
      hview.setUint32(42, offset, true);
      central.push(header, nameBytes);

      offset += local.length + nameBytes.length + dataBytes.length;
    });

    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const eview = new DataView(end.buffer);
    eview.setUint32(0, 0x06054b50, true);
    eview.setUint16(8, entries.length, true);
    eview.setUint16(10, entries.length, true);
    eview.setUint32(12, centralSize, true);
    eview.setUint32(16, offset, true);

    const total = offset + centralSize + end.length;
    const out = new Uint8Array(total);
    let cursor = 0;
    for (const part of [...chunks, ...central, end]) {
      out.set(part, cursor);
      cursor += part.length;
    }
    return out;
  }

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // 去掉 XML 1.0 不允许的控制字符，避免 Word 报文件损坏
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  }

  const FONT = 'w:ascii="Times New Roman" w:eastAsia="\u5b8b\u4f53" w:hAnsi="Times New Roman"';

  function docxParagraph(text, options) {
    const opts = options || {};
    const size = opts.size || 21; // 半磅：21 = 10.5pt（正文）
    const spacing = opts.spacing == null ? 160 : opts.spacing;
    const indent = opts.indent ? '<w:ind w:firstLine="480"/>' : '';
    const bold = opts.bold ? '<w:b/><w:bCs/>' : '';
    const color = opts.color ? `<w:color w:val="${opts.color}"/>` : '';
    const align = opts.align ? `<w:jc w:val="${opts.align}"/>` : '';
    const content = String(text == null ? '' : text);
    const run = content
      ? `<w:r><w:rPr><w:rFonts ${FONT}/>${bold}${color}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(content)}</w:t></w:r>`
      : '';
    return `<w:p><w:pPr><w:spacing w:after="${spacing}" w:line="320" w:lineRule="auto"/>${align}${indent}</w:pPr>${run}</w:p>`;
  }

  function buildDocumentXml(payload) {
    const parts = [];
    parts.push(docxParagraph(payload.title || '梦工场报告润览', {
      size: 36, bold: true, color: '0A2946', spacing: 200, align: 'center'
    }));
    parts.push(docxParagraph(VERSION_LABEL[payload.version] || '详细版', {
      size: 24, color: '9A7422', spacing: 160, align: 'center'
    }));
    for (const line of buildMetaLines(payload)) {
      parts.push(docxParagraph(line, { size: 16, color: '50647A', spacing: 40, align: 'center' }));
    }
    if (payload.version === 'brief') {
      parts.push(docxParagraph('说明：简版由详细底稿自动提炼，仅保留结论与关键要点；完整论证、数据与证据缺口请查阅详细版。', {
        size: 17, color: '50647A', spacing: 200
      }));
    }
    parts.push('<w:p><w:pPr><w:spacing w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="E4DED1"/></w:pBdr></w:pPr></w:p>');

    const blocks = splitBlocks(payload.body);
    for (const block of blocks) {
      if (block.heading) {
        parts.push(docxParagraph(block.heading, { size: 26, bold: true, color: '0A2946', spacing: 140 }));
      }
      const paragraphs = String(block.body || '').split(/\n{2,}/);
      for (const paragraph of paragraphs) {
        const lines = paragraph.split('\n').filter(line => line.trim());
        for (const line of lines) {
          const bullet = /^[-*•·]\s+/.test(line) || /^\d+[、.．]\s?/.test(line);
          parts.push(docxParagraph(bullet ? '· ' + line.replace(/^[-*•·]\s+/, '') : line, {
            indent: !bullet && block.heading ? true : false,
            spacing: 120
          }));
        }
      }
    }
    parts.push(docxParagraph('本文件由梦工场市场专员生成，仅供内部研究与讨论使用。', {
      size: 15, color: '8A94A0', spacing: 0, align: 'center'
    }));

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + '<w:body>' + parts.join('') 
      + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
      + '<w:pgMar w:top="1440" w:right="1418" w:bottom="1440" w:left="1418" w:header="851" w:footer="992" w:gutter="0"/>'
      + '</w:sectPr></w:body></w:document>';
  }

  function buildDocxBytes(payload) {
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '</Types>';

    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '</Relationships>';

    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

    return zipStore([
      { name: '[Content_Types].xml', data: utf8(contentTypes) },
      { name: '_rels/.rels', data: utf8(rootRels) },
      { name: 'word/document.xml', data: utf8(buildDocumentXml(payload)) },
      { name: 'word/_rels/document.xml.rels', data: utf8(docRels) }
    ]);
  }

  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  /* ---------------- 下载 / 打印 ---------------- */

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadMarkdown(payload) {
    const body = toMarkdown(payload);
    downloadBlob(new Blob([body], { type: 'text/markdown;charset=utf-8' }), buildFileName({ ...payload, extension: 'md' }));
    return buildFileName({ ...payload, extension: 'md' });
  }

  function downloadHtml(payload) {
    const body = toHtmlDocument(payload);
    downloadBlob(new Blob([body], { type: 'text/html;charset=utf-8' }), buildFileName({ ...payload, extension: 'html' }));
    return buildFileName({ ...payload, extension: 'html' });
  }

  function downloadDocx(payload) {
    const bytes = buildDocxBytes(payload);
    downloadBlob(new Blob([bytes], { type: DOCX_MIME }), buildFileName({ ...payload, extension: 'docx' }));
    return buildFileName({ ...payload, extension: 'docx' });
  }

  /**
   * PDF：把报告写进新窗口并调起打印面板，由用户选择「另存为 PDF」。
   * 不引入 PDF 库时这是能正确处理中文的唯一可靠路径。
   * 返回 { ok, reason, fileName }
   */
  function printPdf(payload) {
    const html = toHtmlDocument(payload);
    const win = global.open('', '_blank');
    if (!win) return { ok: false, reason: 'popup-blocked' };
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (error) {
      return { ok: false, reason: 'write-failed' };
    }
    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch (error) { /* 用户可手动按 Ctrl/Cmd+P */ }
    };
    if (win.document.fonts && typeof win.document.fonts.ready === 'object') {
      win.document.fonts.ready.then(() => setTimeout(triggerPrint, 120)).catch(() => setTimeout(triggerPrint, 400));
    } else {
      setTimeout(triggerPrint, 500);
    }
    return { ok: true, fileName: buildFileName({ ...payload, extension: 'pdf' }) };
  }

  const api = {
    normalizeText,
    splitBlocks,
    buildBrief,
    countChars,
    toMarkdown,
    toHtmlDocument,
    buildDocumentXml,
    buildDocxBytes,
    zipStore,
    crc32,
    buildFileName,
    buildMetaLines,
    downloadMarkdown,
    downloadHtml,
    downloadDocx,
    printPdf,
    VERSION_LABEL
  };

  global.MGCReportExport = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
