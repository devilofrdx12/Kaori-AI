import { NextRequest, NextResponse } from "next/server";
import { getDocument } from "../../lib/db";
import { getSessionUser } from "../../lib/auth-utils";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { logger } from "../../lib/logger";

function attachmentHeaders(filename: string, contentType: string, contentLength?: number) {
  const safeFilename = filename.replace(/[^\w .()-]/g, "_").slice(0, 120) || "download";
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safeFilename}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  // Mobile browsers (especially Safari/iOS) need Content-Length to trigger
  // a proper file download instead of showing a blank page.
  if (contentLength !== undefined) {
    headers["Content-Length"] = String(contentLength);
  }
  return headers;
}

const TEXT_DOCUMENT_FORMATS: Record<string, string> = {
  md: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
  css: "text/plain; charset=utf-8",
  js: "text/plain; charset=utf-8",
  ts: "text/plain; charset=utf-8",
  tsx: "text/plain; charset=utf-8",
  jsx: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
};

import { marked } from 'marked';

/**
 * Clean text for standard PDF Type-1 fonts (Helvetica/Courier).
 * Standard PDF fonts only support ASCII/Latin-1 (WinAnsiEncoding).
 * Multi-byte UTF-8 characters like emojis, Greek letters, and math symbols
 * cause byte-misinterpretation (mojibake) and overlapping text rendering.
 */
function cleanPdfText(text: string): string {
  if (!text) return "";
  return text
    // Mathematical & technical symbols -> readable ASCII
    .replace(/[→⇒➔➜]/g, " -> ")
    .replace(/[←⇐]/g, " <- ")
    .replace(/[↔⇔]/g, " <-> ")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≠/g, "!=")
    .replace(/≈/g, "~=")
    .replace(/∑/g, "sum")
    .replace(/∏/g, "prod")
    .replace(/√/g, "sqrt")
    .replace(/∞/g, "inf")
    .replace(/±/g, "+/-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[·•]/g, "*")
    .replace(/°/g, " deg")
    // Typographic quotes & punctuation
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, " -- ")
    .replace(/–/g, " - ")
    .replace(/…/g, "...")
    .replace(/™/gi, "(TM)")
    .replace(/©/gi, "(C)")
    .replace(/®/gi, "(R)")
    .replace(/[✓✔]/g, "[x]")
    .replace(/[✗✘]/g, "[ ]")
    // Strip emojis & extended pictographs (surrogates and symbols)
    .replace(/\p{Extended_Pictographic}/gu, "")
    // Strip invisible formatting characters
    .replace(/[\u200B-\u200D\uFE0E\uFE0F]/g, "")
    // Normalize leftover multiple spaces into single space
    .replace(/[ \t]{2,}/g, " ");
}

function parseInlineTokens(tokens?: any[]): any {
  if (!tokens) return '';
  const result = tokens.map((token: any) => {
    switch (token.type) {
      case 'strong':
        return { text: parseInlineTokens(token.tokens), bold: true };
      case 'em':
        return { text: parseInlineTokens(token.tokens), italics: true };
      case 'codespan':
        return { text: cleanPdfText(token.text), font: 'Courier', background: '#f4f4f4' };
      case 'link':
        return { text: parseInlineTokens(token.tokens), color: 'blue', decoration: 'underline', link: token.href };
      case 'text':
      case 'escape':
        return cleanPdfText(token.text);
      case 'br':
        return '\n';
      case 'del':
        return { text: parseInlineTokens(token.tokens), decoration: 'lineThrough' };
      default:
        return cleanPdfText(token.text || '');
    }
  });
  return result.length === 1 ? result[0] : result;
}

function parseTokens(tokens: any[]): any[] {
  const result: any[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        result.push({
          text: parseInlineTokens(token.tokens),
          fontSize: Math.max(22 - (token.depth * 2), 12),
          bold: true,
          margin: [0, token.depth === 1 ? 16 : 12, 0, 6],
        });
        break;
      case 'paragraph':
        result.push({
          text: parseInlineTokens(token.tokens),
          margin: [0, 4, 0, 8],
          lineHeight: 1.25,
        });
        break;
      case 'list':
        const listItems = token.items.map((item: any) => {
          const parsed = parseTokens(item.tokens);
          if (parsed.length === 1 && parsed[0].text !== undefined) {
            return {
              text: parsed[0].text,
              margin: [0, 2, 0, 2],
            };
          }
          return {
            stack: parsed,
            margin: [0, 2, 0, 2],
          };
        });
        if (token.ordered) {
          result.push({ ol: listItems, margin: [0, 4, 0, 8] });
        } else {
          result.push({ ul: listItems, margin: [0, 4, 0, 8] });
        }
        break;
      case 'table':
        const headerRow = token.header.map((cell: any) => ({
          text: parseInlineTokens(cell.tokens),
          bold: true,
          fillColor: '#eeeeee',
          margin: [5, 5, 5, 5]
        }));
        
        const bodyRows = token.rows.map((row: any) => 
          row.map((cell: any) => ({
            text: parseInlineTokens(cell.tokens),
            margin: [5, 5, 5, 5]
          }))
        );
        
        result.push({
          table: {
            headerRows: 1,
            body: [headerRow, ...bodyRows]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 10, 0, 10]
        });
        break;
      case 'blockquote':
        result.push({
          text: parseTokens(token.tokens),
          italics: true,
          color: '#555555',
          margin: [10, 5, 0, 10],
        });
        break;
      case 'code':
        result.push({
          text: cleanPdfText(token.text),
          font: 'Courier',
          fontSize: 8.5,
          lineHeight: 1.2,
          margin: [0, 4, 0, 8],
          background: '#f4f4f4'
        });
        break;
      case 'hr':
        result.push({
          canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.75, lineColor: '#e0e0e0' }],
          margin: [0, 8, 0, 8]
        });
        break;
      case 'space':
        break;
      case 'text':
      default:
        if (token.tokens && token.tokens.length > 0) {
          result.push({ text: parseInlineTokens(token.tokens), margin: [0, 2, 0, 4] });
        } else if (token.text) {
          result.push({ text: cleanPdfText(token.text), margin: [0, 2, 0, 4] });
        }
        break;
    }
  }
  return result;
}

function markdownToPdfmake(markdownText: string) {
  const sanitized = cleanPdfText(markdownText);
  const tokens = marked.lexer(sanitized);
  return parseTokens(tokens);
}

async function generatePdfBuffer(content: string): Promise<Uint8Array> {
  // Use require() to avoid ESM default-import interop issues with pdfmake
  // in the Next.js server bundle (Turbopack strips prototype methods from
  // the ESM default export in some configurations).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfmake = require("pdfmake");
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((p: string) =>
    ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique", "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"].includes(p)
  );
  pdfmake.setFonts({
    Roboto: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
    Courier: {
      normal: "Courier",
      bold: "Courier-Bold",
      italics: "Courier-Oblique",
      bolditalics: "Courier-BoldOblique",
    }
  });
  
  const parsedContent = markdownToPdfmake(content);

  const pdfDoc = pdfmake.createPdf({
    content: parsedContent,
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25 },
    pageMargins: [40, 40, 40, 40],
  });
  const buffer = await pdfDoc.getBuffer();
  return new Uint8Array(buffer);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!id) return new NextResponse("Document ID required", { status: 400 });

  try {
    const doc = await getDocument(id, user.id);
    if (!doc || doc.user_id !== user.id) {
      return new NextResponse("Document not found", { status: 404 });
    }

    const content = doc.content;

    const textDocumentContentType = TEXT_DOCUMENT_FORMATS[doc.format];
    if (textDocumentContentType) {
      const encoded = new TextEncoder().encode(content);
      return new NextResponse(encoded, {
        headers: attachmentHeaders(doc.filename, textDocumentContentType, encoded.byteLength),
      });
    }

    if (doc.format === "docx") {
      // Very basic markdown to docx mapping
      const paragraphs = content.split('\n').map(line => 
        new Paragraph({
          children: [new TextRun(line)],
        })
      );

      const docxFile = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
      });

      const buffer = await Packer.toBuffer(docxFile);
      const bytes = new Uint8Array(buffer);
      return new NextResponse(bytes, {
        headers: attachmentHeaders(
          doc.filename,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bytes.byteLength
        ),
      });
    }

    if (doc.format === "pdf") {
      const bytes = await generatePdfBuffer(content);
      return new NextResponse(Buffer.from(bytes), {
        headers: attachmentHeaders(doc.filename, "application/pdf", bytes.byteLength),
      });
    }

    return new NextResponse("Unsupported format", { status: 400 });
  } catch (err) {
    console.error("[GET /api/download] Error:", err);
    logger.error({ err }, "[GET /api/download] Error");
    return new NextResponse("Unable to generate download", { status: 500 });
  }
}

