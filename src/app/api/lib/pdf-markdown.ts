import { marked } from "marked";

/**
 * Clean text for standard PDF Type-1 fonts (Helvetica/Courier).
 * Standard PDF fonts only support ASCII/Latin-1 (WinAnsiEncoding).
 */
export function cleanPdfText(text: string): string {
  if (!text) return "";
  return text
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
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u200B-\u200D\uFE0E\uFE0F]/g, "")
    .replace(/[ \t]{2,}/g, " ");
}

function isSafePdfLink(href: unknown): href is string {
  if (typeof href !== "string") return false;
  try {
    const parsed = new URL(href.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseInlineTokens(tokens?: any[]): any {
  if (!tokens) return "";
  const result = tokens.map((token: any) => {
    switch (token.type) {
      case "strong":
        return { text: parseInlineTokens(token.tokens), bold: true };
      case "em":
        return { text: parseInlineTokens(token.tokens), italics: true };
      case "codespan":
        return { text: cleanPdfText(token.text), font: "Courier", background: "#f4f4f4" };
      case "link": {
        const label = parseInlineTokens(token.tokens);
        if (isSafePdfLink(token.href)) {
          return { text: label, color: "blue", decoration: "underline", link: token.href.trim() };
        }
        return label;
      }
      case "text":
      case "escape":
        return cleanPdfText(token.text);
      case "br":
        return "\n";
      case "del":
        return { text: parseInlineTokens(token.tokens), decoration: "lineThrough" };
      default:
        return cleanPdfText(token.text || "");
    }
  });
  return result.length === 1 ? result[0] : result;
}

export function parseTokens(tokens: any[]): any[] {
  const result: any[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        result.push({
          text: parseInlineTokens(token.tokens),
          fontSize: Math.max(22 - token.depth * 2, 12),
          bold: true,
          margin: [0, token.depth === 1 ? 16 : 12, 0, 6],
        });
        break;
      case "paragraph":
        result.push({
          text: parseInlineTokens(token.tokens),
          margin: [0, 4, 0, 8],
          lineHeight: 1.25,
        });
        break;
      case "list": {
        const listItems = (token.items || []).map((item: any) => {
          const parsed = parseTokens(item.tokens || []);
          if (parsed.length === 1 && parsed[0].text !== undefined) {
            return {
              text: parsed[0].text,
              margin: [0, 2, 0, 2],
            };
          }
          return {
            stack: parsed.length > 0 ? parsed : [{ text: "" }],
            margin: [0, 2, 0, 2],
          };
        });
        if (listItems.length > 0) {
          if (token.ordered) {
            result.push({ ol: listItems, margin: [0, 4, 0, 8] });
          } else {
            result.push({ ul: listItems, margin: [0, 4, 0, 8] });
          }
        }
        break;
      }
      case "table": {
        const rawHeader = Array.isArray(token.header) ? token.header : [];
        if (rawHeader.length === 0) break;

        const colCount = rawHeader.length;
        const headerRow = rawHeader.map((cell: any) => ({
          text: parseInlineTokens(cell?.tokens),
          bold: true,
          fillColor: "#eeeeee",
          margin: [5, 5, 5, 5],
        }));

        const bodyRows = (Array.isArray(token.rows) ? token.rows : []).map((row: any) => {
          const cells = Array.isArray(row) ? row : [];
          const normalized = [];
          for (let col = 0; col < colCount; col += 1) {
            normalized.push({
              text: parseInlineTokens(cells[col]?.tokens),
              margin: [5, 5, 5, 5],
            });
          }
          return normalized;
        });

        result.push({
          table: {
            headerRows: 1,
            body: [headerRow, ...bodyRows],
          },
          layout: "lightHorizontalLines",
          margin: [0, 10, 0, 10],
        });
        break;
      }
      case "blockquote": {
        const inner = parseTokens(token.tokens || []);
        result.push({
          stack: inner.length > 0 ? inner : [{ text: "" }],
          italics: true,
          color: "#555555",
          margin: [10, 5, 0, 10],
        });
        break;
      }
      case "code":
        result.push({
          text: cleanPdfText(token.text),
          font: "Courier",
          fontSize: 8.5,
          lineHeight: 1.2,
          margin: [0, 4, 0, 8],
          background: "#f4f4f4",
        });
        break;
      case "hr":
        result.push({
          canvas: [{ type: "line", x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.75, lineColor: "#e0e0e0" }],
          margin: [0, 8, 0, 8],
        });
        break;
      case "space":
        break;
      case "text":
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

export function markdownToPdfmake(markdownText: string) {
  const sanitized = cleanPdfText(markdownText);
  const tokens = marked.lexer(sanitized);
  return parseTokens(tokens);
}
