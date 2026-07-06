// @ts-expect-error - Types are only defined for the main export, not the deep lib path
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function extractPdfText(base64Data: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const data = await pdfParse(buffer);
    return `[BEGIN PDF DOCUMENT]\n\n${data.text}\n\n[END PDF DOCUMENT]`;
  } catch (error) {
    console.error("PDF Parsing error:", error);
    throw new Error("Failed to parse PDF document.");
  }
}
