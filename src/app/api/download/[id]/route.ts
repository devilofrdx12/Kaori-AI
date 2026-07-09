import { NextRequest, NextResponse } from "next/server";
import { getDocument } from "../../lib/db";
import { getSessionUser } from "../../lib/auth-utils";
import { Document, Packer, Paragraph, TextRun } from "docx";
// @ts-expect-error - No type definitions available for the internal server-side class
import PdfPrinter from "pdfmake/js/Printer";

function attachmentHeaders(filename: string, contentType: string) {
  const safeFilename = filename.replace(/[\r\n"]/g, "_").slice(0, 120) || "download";
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safeFilename}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!id) return new NextResponse("Document ID required", { status: 400 });

  const doc = await getDocument(id);
  if (!doc || doc.user_id !== user.id) {
    return new NextResponse("Document not found", { status: 404 });
  }

  const content = doc.content;

  if (doc.format === "md") {
    return new NextResponse(content, {
      headers: attachmentHeaders(doc.filename, "text/markdown"),
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
    return new NextResponse(new Uint8Array(buffer), {
      headers: attachmentHeaders(
        doc.filename,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ),
    });
  }

  if (doc.format === "pdf") {
    const fonts = {
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };
    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument({
      content: content.split('\n').map(line => ({ text: line, margin: [0, 5, 0, 5] })),
      defaultStyle: {
        font: 'Roboto'
      }
    });

    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    return new Promise<NextResponse>((resolve) => {
      pdfDoc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(new NextResponse(new Uint8Array(result), {
          headers: attachmentHeaders(doc.filename, "application/pdf"),
        }));
      });
      pdfDoc.end();
    });
  }

  return new NextResponse("Unsupported format", { status: 400 });
}
