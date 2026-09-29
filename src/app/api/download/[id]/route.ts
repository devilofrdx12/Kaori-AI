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

function parseInlineTokens(tokens?: any[]): any {
  if (!tokens) return '';
  const result = tokens.map((token: any) => {
    switch (token.type) {
      case 'strong':
        return { text: parseInlineTokens(token.tokens), bold: true };
      case 'em':
        return { text: parseInlineTokens(token.tokens), italics: true };
      case 'codespan':
        return { text: token.text, font: 'Courier', background: '#f4f4f4' };
      case 'link':
        return { text: parseInlineTokens(token.tokens), color: 'blue', decoration: 'underline', link: token.href };
      case 'text':
      case 'escape':
        return token.text;
      case 'br':
        return '\n';
      case 'del':
        return { text: parseInlineTokens(token.tokens), decoration: 'lineThrough' };
      default:
        return token.text || '';
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
          fontSize: Math.max(24 - (token.depth * 2), 12),
          bold: true,
          margin: [0, 15 - token.depth, 0, 5],
        });
        break;
      case 'paragraph':
        result.push({
          text: parseInlineTokens(token.tokens),
          margin: [0, 5, 0, 10],
        });
        break;
      case 'list':
        const listItems = token.items.map((item: any) => ({
           margin: [0, 2, 0, 2],
           text: parseTokens(item.tokens)
        }));
        if (token.ordered) {
          result.push({ ol: listItems, margin: [0, 5, 0, 10] });
        } else {
          result.push({ ul: listItems, margin: [0, 5, 0, 10] });
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
          text: token.text,
          font: 'Courier',
          margin: [0, 5, 0, 10],
          background: '#f4f4f4'
        });
        break;
      case 'hr':
        result.push({
          canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#cccccc' }],
          margin: [0, 10, 0, 10]
        });
        break;
      case 'space':
        break;
      default:
        if (token.text) {
           result.push({ text: token.text, margin: [0, 5, 0, 10] });
        }
        break;
    }
  }
  return result;
}

function markdownToPdfmake(markdownText: string) {
  const tokens = marked.lexer(markdownText);
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
    defaultStyle: { font: "Roboto" },
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

