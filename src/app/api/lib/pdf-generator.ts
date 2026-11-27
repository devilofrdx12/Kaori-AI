import { markdownToPdfmake } from "./pdf-markdown";

let pdfMakeConfigured = false;

/**
 * Lazily configures pdfmake with bundled Roboto Unicode TrueType fonts from vfs_fonts
 * and strict URL/local-file access policies for server-side PDF rendering.
 */
export function getConfiguredPdfMake() {
  // Use require() to avoid ESM default-import interop issues with pdfmake
  // in the Next.js server bundle (Turbopack strips prototype methods from
  // the ESM default export in some configurations).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfmake = require("pdfmake");
  if (!pdfMakeConfigured) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vfsModule = require("pdfmake/build/vfs_fonts");
    const vfsFonts = vfsModule?.default ?? vfsModule;
    for (const [filename, base64] of Object.entries(vfsFonts)) {
      if (typeof base64 === "string" && !pdfmake.virtualfs.existsSync(filename)) {
        pdfmake.virtualfs.writeFileSync(filename, base64, "base64");
      }
    }
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy((p: string) =>
      ["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"].includes(p)
    );
    pdfmake.setFonts({
      Roboto: {
        normal: "Roboto-Regular.ttf",
        bold: "Roboto-Medium.ttf",
        italics: "Roboto-Italic.ttf",
        bolditalics: "Roboto-MediumItalic.ttf",
      },
      Courier: {
        normal: "Courier",
        bold: "Courier-Bold",
        italics: "Courier-Oblique",
        bolditalics: "Courier-BoldOblique",
      },
    });
    pdfMakeConfigured = true;
  }
  return pdfmake;
}

/**
 * Generates a PDF byte buffer from Markdown content using embedded Unicode Roboto fonts.
 */
export async function generatePdfBuffer(content: string): Promise<Uint8Array> {
  const pdfmake = getConfiguredPdfMake();
  const parsedContent = markdownToPdfmake(content);

  const pdfDoc = pdfmake.createPdf({
    content: parsedContent,
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25 },
    pageMargins: [40, 40, 40, 40],
  });
  const buffer = await pdfDoc.getBuffer();
  return new Uint8Array(buffer);
}
