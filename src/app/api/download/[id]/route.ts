import { NextRequest, NextResponse } from "next/server";
import { getDocument } from "../../lib/db";
import { Document, Packer, Paragraph, TextRun } from "docx";
// @ts-expect-error - No type definitions available for the internal server-side class
import PdfPrinter from "pdfmake/js/Printer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return new NextResponse("Document ID required", { status: 400 });

  const doc = await getDocument(id);
  if (!doc) return new NextResponse("Document not found", { status: 404 });

  const content = doc.content;

  if (doc.format === "md") {
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${doc.filename}"`,
      },
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
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${doc.filename}"`,
      },
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
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${doc.filename}"`,
          },
        }));
      });
      pdfDoc.end();
    });
  }

  return new NextResponse("Unsupported format", { status: 400 });
}
