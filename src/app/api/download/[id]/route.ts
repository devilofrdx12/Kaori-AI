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

async function generatePdfBuffer(content: string): Promise<Uint8Array> {
  // Use require() to avoid ESM default-import interop issues with pdfmake
  // in the Next.js server bundle (Turbopack strips prototype methods from
  // the ESM default export in some configurations).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfmake = require("pdfmake");
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((p: string) =>
    ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"].includes(p)
  );
  pdfmake.setFonts({
    Roboto: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  });
  const pdfDoc = pdfmake.createPdf({
    content: content.split("\n").map((line: string) => ({ text: line, margin: [0, 5, 0, 5] })),
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

