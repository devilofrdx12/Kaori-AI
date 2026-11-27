import { marked } from "marked";

const UNICODE_SYMBOL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\r\n?|\u2028|\u2029/g, "\n"],
  [/\t/g, "    "],
  [/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " "],
  [/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFE00-\uFE0F\uFEFF\uFFFD]/g, ""],
  [/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""],
  [/[→⇒➔➜➡↦]/g, " -> "],
  [/[←⇐⬅]/g, " <- "],
  [/[↔⇔]/g, " <-> "],
  [/↑/g, "^"],
  [/↓/g, "v"],
  [/[✓✔☑✅]/g, "[x]"],
  [/[✗✘☒❌]/g, "[ ]"],
  [/[├╠]/g, "|-"],
  [/[└╚]/g, "'-"],
  [/[─═]/g, "-"],
  [/[│║]/g, "|"],
  [/[┌╔┐╗┘╝┬╦┴╩┼╬]/g, "+"],
  [/∈/g, " in "],
  [/∉/g, " not in "],
  [/⊂/g, " subset "],
  [/⊆/g, " subseteq "],
  [/⊃/g, " superset "],
  [/⊇/g, " superseteq "],
  [/∪/g, " U "],
  [/∩/g, " ^ "],
  [/∧/g, " AND "],
  [/∨/g, " OR "],
  [/¬/g, "!"],
  [/∀/g, "for all "],
  [/∃/g, "exists "],
  [/∅/g, "{}"],
  [/∇/g, "grad"],
  [/≡/g, "==="],
  [/≢/g, "!=="],
  [/≪/g, "<<"],
  [/≫/g, ">>"],
  [/[▪▫▸▹▻◆◇◈★☆✦✧]/g, "*"],
  [/[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu, ""],
  [/\p{Extended_Pictographic}/gu, ""],
];

const WINANSI_FALLBACK_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/—/g, "--"],
  [/[–−‑‒―]/g, "-"],
  [/…/g, "..."],
  [/[•·]/g, "*"],
  [/≥/g, ">="],
  [/≤/g, "<="],
  [/≠/g, "!="],
  [/≈/g, "~="],
  [/∑/g, "sum"],
  [/∏/g, "prod"],
  [/√/g, "sqrt"],
  [/∞/g, "inf"],
  [/±/g, "+/-"],
  [/×/g, "*"],
  [/÷/g, "/"],
  [/∂/g, "d"],
  [/∆/g, "Delta"],
  [/∫/g, "integral"],
  [/°/g, " deg"],
  [/€/g, "EUR"],
  [/£/g, "GBP"],
  [/¥/g, "JPY"],
  [/₹/g, "INR"],
  [/™/gi, "(TM)"],
  [/©/gi, "(C)"],
  [/®/gi, "(R)"],
  [/⁰/g, "^0"],
  [/¹/g, "^1"],
  [/²/g, "^2"],
  [/³/g, "^3"],
  [/⁴/g, "^4"],
  [/⁵/g, "^5"],
  [/⁶/g, "^6"],
  [/⁷/g, "^7"],
  [/⁸/g, "^8"],
  [/⁹/g, "^9"],
  [/⁺/g, "^+"],
  [/⁻/g, "^-"],
  [/₀/g, "0"],
  [/₁/g, "1"],
  [/₂/g, "2"],
  [/₃/g, "3"],
  [/₄/g, "4"],
  [/₅/g, "5"],
  [/₆/g, "6"],
  [/₇/g, "7"],
  [/₈/g, "8"],
  [/₉/g, "9"],
  [/α/g, "alpha"],
  [/β/g, "beta"],
  [/γ/g, "gamma"],
  [/δ/g, "delta"],
  [/ε/g, "epsilon"],
  [/θ/g, "theta"],
  [/λ/g, "lambda"],
  [/μ/g, "mu"],
  [/π/g, "pi"],
  [/σ/g, "sigma"],
  [/φ/g, "phi"],
  [/ω/g, "omega"],
  [/Δ/g, "Delta"],
  [/Σ/g, "Sigma"],
  [/Ω/g, "Omega"],
];

function decodeCommonHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function applyReplacements(text: string, rules: Array<[RegExp, string]>): string {
  let out = text;
  for (const [pattern, replacement] of rules) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Normalizes prose text for embedded Roboto TTF while preserving Unicode math,
 * Greek symbols, typography, and intentional indentation.
 */
export function cleanPdfText(text: string): string {
  if (!text) return "";
  return applyReplacements(text, UNICODE_SYMBOL_REPLACEMENTS);
}

/**
 * Normalizes monospace code text so standard WinAnsi Courier never truncates
 * multi-byte code points into corrupted glyphs while keeping indentation intact.
 */
export function cleanPdfCodeText(text: string): string {
  if (!text) return "";
  const base = cleanPdfText(text);
  return applyReplacements(base, WINANSI_FALLBACK_REPLACEMENTS)
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
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
        return { text: cleanPdfCodeText(token.text), font: "Courier", background: "#f4f4f4" };
      case "link": {
        const label = parseInlineTokens(token.tokens);
        if (isSafePdfLink(token.href)) {
          return { text: label, color: "blue", decoration: "underline", link: token.href.trim() };
        }
        return label;
      }
      case "text":
      case "escape":
        return cleanPdfText(decodeCommonHtmlEntities(token.text || ""));
      case "html": {
        const raw = typeof token.raw === "string" ? token.raw : (token.text || "");
        if (/^<br\s*\/?>$/i.test(raw.trim())) return "\n";
        return cleanPdfText(decodeCommonHtmlEntities(raw));
      }
      case "br":
        return "\n";
      case "del":
        return { text: parseInlineTokens(token.tokens), decoration: "lineThrough" };
      default:
        return cleanPdfText(decodeCommonHtmlEntities(token.text || ""));
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
          const taskPrefix = item.task ? (item.checked ? "[x] " : "[ ] ") : "";
          if (parsed.length === 1 && parsed[0].text !== undefined && !parsed[0].stack) {
            return {
              ...parsed[0],
              text: taskPrefix ? [taskPrefix, parsed[0].text] : parsed[0].text,
              margin: [0, 2, 0, 2],
            };
          }
          const stack = parsed.length > 0 ? parsed : [{ text: "" }];
          if (taskPrefix && stack[0]?.text !== undefined) {
            stack[0] = { ...stack[0], text: [taskPrefix, stack[0].text] };
          }
          return {
            stack,
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
          text: cleanPdfCodeText(token.text),
          font: "Courier",
          fontSize: 8.5,
          lineHeight: 1.2,
          margin: [0, 4, 0, 8],
          background: "#f4f4f4",
          preserveLeadingSpaces: true,
        });
        break;
      case "hr":
        result.push({
          canvas: [{ type: "line", x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.75, lineColor: "#e0e0e0" }],
          margin: [0, 8, 0, 8],
        });
        break;
      case "html": {
        const raw = typeof token.raw === "string" ? token.raw.trim() : "";
        if (/^<hr\s*\/?>$/i.test(raw)) {
          result.push({
            canvas: [{ type: "line", x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.75, lineColor: "#e0e0e0" }],
            margin: [0, 8, 0, 8],
          });
        } else if (raw && !/^<\/?[a-z][^>]*>$/i.test(raw)) {
          result.push({ text: cleanPdfText(decodeCommonHtmlEntities(raw)), margin: [0, 2, 0, 4] });
        }
        break;
      }
      case "space":
        break;
      case "text":
      default:
        if (token.tokens && token.tokens.length > 0) {
          result.push({ text: parseInlineTokens(token.tokens), margin: [0, 2, 0, 4] });
        } else if (token.text) {
          result.push({ text: cleanPdfText(decodeCommonHtmlEntities(token.text)), margin: [0, 2, 0, 4] });
        }
        break;
    }
  }
  return result;
}

export function markdownToPdfmake(markdownText: string) {
  const normalizedInput = String(markdownText || "").replace(/\r\n?|\u2028|\u2029/g, "\n");
  const tokens = marked.lexer(normalizedInput);
  const parsed = parseTokens(tokens);
  return parsed.length > 0 ? parsed : [{ text: "" }];
}
