// @ts-expect-error - Types are only defined for the main export, not the deep lib path
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { logger } from "./logger";

export async function extractPdfText(base64Data: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const data = await pdfParse(buffer);
    return `[BEGIN PDF DOCUMENT]\n\n${data.text}\n\n[END PDF DOCUMENT]`;
  } catch (error) {
    logger.error({ err: error }, "PDF parsing error");
    throw new Error("Failed to parse PDF document.");
  }
}
