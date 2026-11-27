const LATEX_INLINE_COMMANDS =
  "frac|dfrac|tfrac|sqrt|sum|int|oint|prod|coprod|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|ell|partial|nabla|infty|times|cdot|div|pm|mp|approx|neq|ne|leq|le|geq|ge|equiv|sim|simeq|cong|propto|in|notin|subset|subseteq|supset|supseteq|cup|cap|forall|exists|neg|wedge|vee|to|rightarrow|leftarrow|leftrightarrow|Rightarrow|Leftarrow|Leftrightarrow|mapsto|mathbf|mathrm|mathit|mathbb|mathcal|mathfrak|boldsymbol|operatorname|text|boxed|binom|dbinom|vec|hat|bar|tilde|overline|underline|dot|ddot|left|right|begin";

const UNADORNED_MATH_ENV_REGEX = new RegExp(
  "(^|\\n)([ \\t]*\\\\begin\\{(?:equation|align|aligned|alignat|gather|gathered|split|multline|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|cases|array)\\*?\\}[\\s\\S]*?\\\\end\\{(?:equation|align|aligned|alignat|gather|gathered|split|multline|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|cases|array)\\*?\\})(?=[ \\t]*(?:\\n|$))",
  "g"
);

const SAFE_HTML_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
  "var",
]);

const HTML_TAG_CANDIDATE_REGEX = /<(\/?)([A-Za-z][A-Za-z0-9_:-]*)(\s[^>\n]*?)?(\s*\/?)>/g;
const VALID_HTML_ATTRS_REGEX = /^(?:\s+[a-zA-Z_:][a-zA-Z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*$/;

function isValidHtmlTagSyntax(tagName: string, attrs: string | undefined): boolean {
  if (!SAFE_HTML_TAGS.has(tagName.toLowerCase())) return false;
  if (!attrs || !attrs.trim()) return true;
  return VALID_HTML_ATTRS_REGEX.test(attrs);
}

function escapeUnsafeHtmlAndGenerics(text: string): string {
  return text.replace(
    HTML_TAG_CANDIDATE_REGEX,
    (full, closingSlash: string, tagName: string, attrs: string | undefined, selfClose: string) => {
      if (tagName.toLowerCase() === "br" && !closingSlash && (!attrs || !attrs.trim())) {
        return "<br />";
      }
      if (!closingSlash && isValidHtmlTagSyntax(tagName, attrs)) {
        return full;
      }
      if (closingSlash && SAFE_HTML_TAGS.has(tagName.toLowerCase()) && (!attrs || !attrs.trim()) && !selfClose) {
        return full;
      }
      return `&lt;${full.slice(1, -1)}&gt;`;
    }
  );
}

function isEscapedAt(text: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function looksLikeNumericMath(inner: string): boolean {
  // Currency suffix right after leading number (e.g., $50k, $5M, $20/month)
  if (/^\d[\d,.]*(?:[kKmMbBtT]\b|\/(?:mo|month|yr|year|wk|week|day|hr|hour|user|seat|gb|tb|req|request|token|M|1M)\b)/i.test(inner)) {
    return false;
  }
  // A valid math expression does not end right after a dangling operator (e.g. "$100 - $150")
  if (/[+\-*/=<>]\s*$/.test(inner)) return false;
  // Has LaTeX commands, equality, exponents/subscripts, or binary arithmetic spacing
  if (/[=^_\\]/.test(inner)) return true;
  if (/\s[+\-*/<>]\s/.test(inner)) return true;
  if (/^\d+(?:\.\d+)?[a-zA-Z]\b/.test(inner) && /[+\-*/=<>^_]/.test(inner)) return true;
  return false;
}

function getLineContinuationIndent(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const before = text.slice(lineStart, offset);
  const blockquoteMatch = /^([ \t]*>[ \t]?)/.exec(before);
  if (blockquoteMatch) return blockquoteMatch[1];
  const listMatch = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)/.exec(before);
  if (listMatch) return " ".repeat(listMatch[1].length);
  const indentMatch = /^([ \t]*)/.exec(before);
  return indentMatch ? indentMatch[1] : "";
}

function formatDisplayMathBlock(text: string, offset: number, inner: string): string {
  const trimmed = inner.trim();
  if (!trimmed) return "";
  const indent = getLineContinuationIndent(text, offset);
  const bodyLines = trimmed
    .split("\n")
    .map((line) => `${indent}${line.trimStart()}`)
    .join("\n");
  return `\n${indent}$$\n${bodyLines}\n${indent}$$\n`;
}

const DISPLAY_WORTHY_TEX_REGEX =
  /\\(?:sum|int|oint|prod|coprod|frac|dfrac|tfrac|begin|lim|binom|dbinom|cases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix)(?![A-Za-z])/;

const BLOCK_GRADE_TEX_REGEX =
  /\\(?:sum|int|oint|prod|coprod|begin|lim|dfrac|cases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix)(?![A-Za-z])/;

function isTableRowAt(text: string, offset: number): boolean {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const lineEndIdx = text.indexOf("\n", offset);
  const line = text.slice(lineStart, lineEndIdx === -1 ? text.length : lineEndIdx);
  if (/^[ \t]*\|/.test(line)) return true;
  // Also catch pipe-delimited GFM tables without a leading pipe
  if (line.includes("|")) {
    const paraStart = text.lastIndexOf("\n\n", offset);
    const paraEnd = text.indexOf("\n\n", offset);
    const para = text.slice(paraStart === -1 ? 0 : paraStart, paraEnd === -1 ? text.length : paraEnd);
    if (/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*\|/m.test(para)) return true;
  }
  return false;
}

function shouldPromoteDisplayMath(beforeOnLine: string, inner: string): boolean {
  if (!DISPLAY_WORTHY_TEX_REGEX.test(inner)) {
    return false;
  }
  // Always promote after a label/heading colon (e.g., "- **Filter:** " or "Formula: ")
  if (/(?::|\*\*|__)[ \t]*$/.test(beforeOnLine) && beforeOnLine.includes(":")) {
    return true;
  }
  // Always promote heavy operators and matrix/cases environments onto their own line
  if (BLOCK_GRADE_TEX_REGEX.test(inner)) {
    return true;
  }
  // Promote full fraction/binomial equations while keeping bare inline fractions like \frac{\pi}{D} inline
  return /(?:=|\\approx|\\equiv|\\le|\\leq|\\ge|\\geq|\\propto)/.test(inner);
}

function normalizeDelimitersAndProtectMath(text: string): {
  output: string;
  mathPlaceholders: string[];
} {
  const mathPlaceholders: string[] = [];
  const stashMath = (expr: string) => {
    const token = `\uE000MATH_${mathPlaceholders.length}\uE001`;
    mathPlaceholders.push(expr);
    return token;
  };

  let out = text;

  // 1. Convert \[ ... \] to standalone display $$ ... $$ preserving list/blockquote indent
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (full, math: string, offset: number) => {
    if (isEscapedAt(out, offset)) return full;
    const block = formatDisplayMathBlock(out, offset, math);
    return block || full;
  });

  // 2. Convert \( ... \) to inline $...$
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (full, math: string, offset: number) => {
    if (isEscapedAt(out, offset)) return full;
    const trimmed = math.trim();
    return trimmed ? `$${trimmed}$` : full;
  });

  // 3. Wrap unadorned LaTeX math environments in $$ ... $$
  out = out.replace(UNADORNED_MATH_ENV_REGEX, (full, prefix: string, block: string, offset: number) => {
    const before = out.slice(0, offset + prefix.length).trimEnd();
    if (before.endsWith("$$") || before.endsWith("$")) {
      return full;
    }
    const formatted = formatDisplayMathBlock(out, offset + prefix.length, block);
    return `${prefix}${formatted}`;
  });

  // 4. Expand ALL single-line $$...$$ to multi-line $$\n...\n$$ so remark-math
  // parses them as display (flow) math instead of inline (text) math,
  // and move $$...$$ that sits on the same line as prose onto its own display block lines.
  // Never expand inside Markdown table rows, because newlines break table structure.
  // Then protect all $$...$$ blocks so inner $, <, > stay untouched.
  out = out.replace(/(^|[^\\])\$\$([^\n]+?)\$\$([ \t]*)/g, (full, lead: string, inner: string, trailingSpaces: string, offset: number) => {
    const dollarPos = offset + lead.length;
    if (isEscapedAt(out, dollarPos)) return full;
    if (isTableRowAt(out, dollarPos)) {
      return `${lead}${stashMath(`$${inner.trim()}$`)}${trailingSpaces}`;
    }
    const lineStart = out.lastIndexOf("\n", dollarPos - 1) + 1;
    const beforeOnLine = out.slice(lineStart, dollarPos);
    const formatted = formatDisplayMathBlock(out, dollarPos, inner);
    if (formatted) {
      if (beforeOnLine.trim()) {
        const indent = getLineContinuationIndent(out, dollarPos);
        const afterEnd = out.slice(offset + full.length);
        const hasInlineFollowup = /^[^\s\n]/.test(afterEnd);
        if (hasInlineFollowup) {
          return `${lead}${stashMath(formatted)}${indent}`;
        }
      }
      return `${lead}${stashMath(formatted)}${trailingSpaces}`;
    }
    return `${lead}${stashMath(`$$${inner}$$`)}${trailingSpaces}`;
  });

  // 4b. Stash already-multiline $$...$$ blocks (opening $$ and closing $$ on different lines)
  out = out.replace(/(^|[^\\])\$\$([\s\S]+?)\$\$([ \t]*)/g, (full, lead: string, inner: string, trailingSpaces: string, offset: number) => {
    const dollarPos = offset + lead.length;
    if (isEscapedAt(out, dollarPos)) return full;
    return `${lead}${stashMath(`$$${inner}$$`)}${trailingSpaces}`;
  });

  // 5. Walk paragraphs line-by-line to separate inline $...$ math from currency ($50, $20/mo, etc.)
  // and promote heavy labeled equations (after ":" with \sum/\frac/\begin/...) onto their own display lines
  const paragraphs = out.split(/(\n{2,})/);
  out = paragraphs
    .map((part, idx) => {
      if (idx % 2 === 1) return part;

      let result = "";
      let i = 0;
      while (i < part.length) {
        if (part[i] !== "$" || isEscapedAt(part, i) || part[i + 1] === "$") {
          result += part[i];
          i += 1;
          continue;
        }

        // Look for a matching closing single $ within the same line first; only cross single newlines inside the
        // same list/paragraph item when the opening isn't currency and the content is genuine multi-line LaTeX.
        const nextNewline = part.indexOf("\n", i + 1);
        const searchEnd = nextNewline === -1 ? part.length : nextNewline;
        const startsWithDigit = /^\d/.test(part.slice(i + 1));
        let closeIdx = -1;
        for (let j = i + 1; j < searchEnd; j += 1) {
          if (part[j] === "$" && !isEscapedAt(part, j) && part[j + 1] !== "$") {
            closeIdx = j;
            break;
          }
        }
        if (closeIdx === -1 && nextNewline !== -1 && !startsWithDigit) {
          for (let j = nextNewline + 1; j < part.length; j += 1) {
            if (part[j] === "$" && !isEscapedAt(part, j) && part[j + 1] !== "$") {
              const candidate = part.slice(i + 1, j);
              if (/\\[A-Za-z]{2,}/.test(candidate) && !/\n[ \t]*(?:[-*+]|\d+[.)])[ \t]+/.test(candidate)) {
                closeIdx = j;
              }
              break;
            }
          }
        }

        if (closeIdx === -1) {
          result += startsWithDigit ? "\\$" : "$";
          i += 1;
          continue;
        }

        const inner = part.slice(i + 1, closeIdx);
        if (startsWithDigit && !looksLikeNumericMath(inner)) {
          // Currency opening like ($50 to $100): escape only this $, keep scanning after it
          result += "\\$";
          i += 1;
          continue;
        }

        if (!inner.trim()) {
          result += "$";
          i += 1;
          continue;
        }

        const lineStart = part.lastIndexOf("\n", i - 1) + 1;
        const beforeOnLine = part.slice(lineStart, i);
        if (!isTableRowAt(part, i) && shouldPromoteDisplayMath(beforeOnLine, inner)) {
          const formatted = formatDisplayMathBlock(part, i, inner);
          const indent = getLineContinuationIndent(part, i);
          let nextCursor = closeIdx + 1;
          while (part[nextCursor] === " " || part[nextCursor] === "\t") nextCursor += 1;
          // Absorb a trailing sentence period/comma immediately after the promoted formula so it never orphans on a new line
          if ((part[nextCursor] === "." || part[nextCursor] === ",") && (nextCursor + 1 >= part.length || /[\s\n]/.test(part[nextCursor + 1]))) {
            nextCursor += 1;
            while (part[nextCursor] === " " || part[nextCursor] === "\t") nextCursor += 1;
          }
          const hasInlineFollowup = nextCursor < part.length && part[nextCursor] !== "\n";
          result += stashMath(formatted);
          if (hasInlineFollowup) {
            result += indent;
          }
          i = nextCursor;
          continue;
        }

        result += stashMath(`$${inner}$`);
        i = closeIdx + 1;
      }
      return result;
    })
    .join("");

  return { output: out, mathPlaceholders };
}

function unbacktickInlineMath(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (
    (/^\$\$[\s\S]+\$\$$/.test(trimmed) && trimmed.length > 4) ||
    (/^\$[^$\n]+\$$/.test(trimmed) && trimmed.length > 2) ||
    /^\\\[[\s\S]+\\\]$/.test(trimmed) ||
    /^\\\([\s\S]+\\\)$/.test(trimmed)
  ) {
    return trimmed;
  }
  const cmdRegex = new RegExp(`^\\\\(?:${LATEX_INLINE_COMMANDS})\\b[^\\n]*$`);
  if (cmdRegex.test(trimmed)) {
    return `$${trimmed}$`;
  }
  return null;
}

function transformInlineProse(segment: string): string {
  // Split around inline code spans (`...`, ``...``) while leaving code untouched unless it is accidental backticked math
  const pieces: string[] = [];
  let cursor = 0;

  while (cursor < segment.length) {
    const tickStart = segment.indexOf("`", cursor);
    if (tickStart === -1) {
      pieces.push(processPlainProse(segment.slice(cursor)));
      break;
    }

    if (tickStart > cursor) {
      pieces.push(processPlainProse(segment.slice(cursor, tickStart)));
    }

    let tickCount = 1;
    while (segment[tickStart + tickCount] === "`") tickCount += 1;
    const fence = "`".repeat(tickCount);

    let searchFrom = tickStart + tickCount;
    let closeStart = -1;
    while (searchFrom < segment.length) {
      const candidate = segment.indexOf(fence, searchFrom);
      if (candidate === -1) break;
      const beforeChar = segment[candidate - 1];
      const afterChar = segment[candidate + tickCount];
      if (beforeChar !== "`" && afterChar !== "`") {
        closeStart = candidate;
        break;
      }
      searchFrom = candidate + 1;
    }

    if (closeStart === -1) {
      pieces.push(processPlainProse(segment.slice(tickStart)));
      break;
    }

    const innerCode = segment.slice(tickStart + tickCount, closeStart);
    const maybeMath = !innerCode.includes("\n") ? unbacktickInlineMath(innerCode) : null;
    if (maybeMath) {
      pieces.push(processPlainProse(maybeMath));
    } else {
      pieces.push(segment.slice(tickStart, closeStart + tickCount));
    }
    cursor = closeStart + tickCount;
  }

  return pieces.join("");
}

function processPlainProse(prose: string): string {
  if (!prose) return prose;
  const { output, mathPlaceholders } = normalizeDelimitersAndProtectMath(prose);
  const htmlSafe = escapeUnsafeHtmlAndGenerics(output);
  return htmlSafe.replace(/\uE000MATH_(\d+)\uE001/g, (_, idx: string) => mathPlaceholders[Number(idx)] ?? "");
}

/**
 * Normalizes model Markdown before ReactMarkdown parses it:
 * - Preserves fenced code blocks and inline code verbatim (no $ or \[ corruption inside code)
 * - Un-backticks inline math expressions wrapped in backticks
 * - Normalizes \[...\], \(...\), and unadorned \begin{...} environments
 * - Escapes currency dollar amounts without breaking numeric equations like $1 + 2 = 3$
 * - Escapes type generics (Promise<void>) and unknown XML/pseudo-HTML tags while keeping safe HTML
 */
export function preprocessMarkdown(content: string): string {
  if (!content) return content;

  const normalized = content.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const segments: Array<{ isFence: boolean; text: string }> = [];

  let buffer: string[] = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;

  const flush = (isFence: boolean) => {
    if (buffer.length > 0) {
      segments.push({ isFence, text: buffer.join("\n") });
      buffer = [];
    }
  };

  for (const line of lines) {
    if (!inFence) {
      const openMatch = /^[ ]{0,3}(`{3,}|~{3,})([^\n]*)$/.exec(line);
      if (openMatch) {
        const marker = openMatch[1];
        const info = openMatch[2] || "";
        if (!(marker[0] === "`" && info.includes("`"))) {
          flush(false);
          inFence = true;
          fenceChar = marker[0];
          fenceLen = marker.length;
          buffer.push(line);
          continue;
        }
      }
      buffer.push(line);
    } else {
      buffer.push(line);
      const closeMatch = /^[ ]{0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (closeMatch && closeMatch[1][0] === fenceChar && closeMatch[1].length >= fenceLen) {
        flush(true);
        inFence = false;
        fenceChar = "";
        fenceLen = 0;
      }
    }
  }
  flush(inFence);

  return segments
    .map((seg) => (seg.isFence ? seg.text : transformInlineProse(seg.text)))
    .join("\n");
}
