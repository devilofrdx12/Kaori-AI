import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import katex from "katex";
import { preprocessMarkdown } from "./markdown-preprocess";

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).join("");
  if (value && typeof value === "object" && "props" in value) {
    const props = (value as { props?: { children?: unknown } }).props;
    if (props?.children) return extractText(props.children);
  }
  return "";
}

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-/, "math-inline", "math-display"]],
    span: [...(defaultSchema.attributes?.span || []), "className"],
    div: [...(defaultSchema.attributes?.div || []), "className"],
  },
};

function renderMarkdownHtml(md: string): string {
  const pre = preprocessMarkdown(md);
  return renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, sanitizeSchema],
        [rehypeHighlight, { plainText: ["math"] }],
      ] as any}
      components={{
        pre: ({ children }: any) => {
          if (React.isValidElement<{ className?: string; children?: unknown }>(children)) {
            const cls = children.props.className || "";
            if (cls.includes("language-math") || cls.includes("math-display")) {
              const html = katex.renderToString(extractText(children.props.children).trim(), {
                displayMode: true,
                throwOnError: false,
                maxSize: 20,
                maxExpand: 500,
              });
              return <span className="math-display-block" dangerouslySetInnerHTML={{ __html: html }} />;
            }
            return <pre><code>{children.props.children as React.ReactNode}</code></pre>;
          }
          return <pre>{children}</pre>;
        },
        code: ({ className, children }: any) => {
          const classes = (className || "").split(/\s+/).filter(Boolean);
          const isInlineMath = classes.includes("math-inline");
          const isDisplayMath = classes.includes("math-display");
          if (isInlineMath || isDisplayMath) {
            const html = katex.renderToString(extractText(children).trim(), {
              displayMode: isDisplayMath,
              throwOnError: false,
              maxSize: 20,
              maxExpand: 500,
            });
            return <span className={isDisplayMath ? "math-display-block" : "inline-math"} dangerouslySetInnerHTML={{ __html: html }} />;
          }
          return <code className={className}>{children}</code>;
        },
      }}
    >
      {pre}
    </ReactMarkdown>
  );
}

test("preprocessMarkdown preserves numeric equations while escaping currency amounts cleanly", () => {
  const currencyOnly = preprocessMarkdown("Cost is $500 and budget is $1,200.50.");
  assert.equal(currencyOnly, "Cost is \\$500 and budget is \\$1,200.50.");

  const pre = preprocessMarkdown("Solve $1 + 2 = 3$ and $5 \\times 10^3$, costing ($50 to $100) or $20/month to $40/month or $100 - $150.");
  assert.ok(pre.includes("\\$50") && pre.includes("\\$100"), "Should escape currency amounts");
  assert.ok(pre.includes("\\$20/month") && pre.includes("\\$40/month"), "Should escape rate currency");
  assert.ok(pre.includes("$1 + 2 = 3$"), "Should preserve numeric equation");
  assert.ok(pre.includes("$5 \\times 10^3$"), "Should preserve scientific equation");

  const html = renderMarkdownHtml("Solve $1 + 2 = 3$ and $5 \\times 10^3$, costing ($50 to $100).");
  assert.ok(html.includes("katex"), "Equations should render with KaTeX");
  assert.ok(!html.includes("katex-error"), "Must not produce KaTeX parse errors");
  assert.ok(html.includes("($50 to $100)"), "Currency text should stay literal");
});

test("markdown math pipeline renders inline, display, bracketed, aligned, and table equations", () => {
  const md = [
    "Inline $ x + y = z $, single-line $$E = mc^2$$, parens \\(a^2 + b^2 = c^2\\), and $x < y$.",
    "",
    "\\[",
    "\\int_0^1 x^2 \\, dx = \\frac{1}{3}",
    "\\]",
    "",
    "\\begin{aligned}",
    "a &= 1 \\\\",
    "b &= 2",
    "\\end{aligned}",
    "",
    "| Expr | Notes |",
    "|---|---|",
    "| $a < b$ | 1<br>2 |",
  ].join("\n");

  const html = renderMarkdownHtml(md);
  const katexMatches = html.match(/class="katex"/g) || [];
  assert.ok(katexMatches.length >= 6, `Expected >= 6 rendered KaTeX formulas, got ${katexMatches.length}`);
  assert.ok(html.includes("katex-sizing"), "KaTeX JS output must emit 0.18.x katex-sizing classes matching CSS");
  assert.ok(html.includes("<br/>") || html.includes("<br />"), "Should preserve <br> in table cells");

  const inlineMathHtml = renderMarkdownHtml("Rational Sampling Rate Conversion ($I/D$). Cutoff $\\omega_c = \\pi/D$ uses $M$ and $L$, or take $\\frac{\\pi}{D}$.");
  assert.ok(inlineMathHtml.includes('class="inline-math"'), "Inline $I/D$, $\\omega_c = \\pi/D$, and bare fractions must render inline");
  assert.ok(!inlineMathHtml.includes('class="math-display-block"'), "Inline math must not promote to centered display block");

  const listDisplayHtml = renderMarkdownHtml("- **Filter:** $$v(n) = \\sum_{k=-\\infty}^{\\infty} h(k)$$\n- **Response:** \\[H(\\omega) = 1\\]");
  assert.ok(listDisplayHtml.includes("<li>"), "Should remain inside bullet list");
  assert.equal((listDisplayHtml.match(/class="math-display-block"/g) || []).length, 2, "Display $$...$$ and \\[...\\] after labels should break onto display block lines");

  const dspHtml = renderMarkdownHtml([
    "- **Anti-aliasing filtering:** Convolve $x(n)$ with low-pass filter $h(n)$ (cutoff $\\omega_c = \\pi/D$) before downsampling to prevent aliasing. $v(n) = \\sum_{k=-\\infty}^{\\infty} h(k) x(n-k)$.",
    "- **Time-domain output:** Retain every $D$-th sample to get $y(m) = v(mD) = \\sum_{k=-\\infty}^{\\infty} h(k) x(mD - k)$ (Pure down-sampling is $y(m) = x(mD)$.)",
    "- **$z$-domain:** $Y(z) = \\frac{1}{D}\\sum_{k=0}^{D-1} V(z^{1/D}e^{-j2\\pi k/D})$",
  ].join("\n"));
  assert.equal((dspHtml.match(/class="math-display-block"/g) || []).length, 3, "Heavy prose/labeled bullet equations should break onto their own display lines");
  assert.equal((dspHtml.match(/class="inline-math"/g) || []).length, 6, "Inline variables ($x(n)$, $h(n)$, $\\omega_c$, $D$, $y(m)=x(mD)$, $z$) should remain inline");
  assert.ok(!dspHtml.includes("<p>.</p>"), "Trailing period after promoted equation must not create an orphan line");

  const wrappedBulletHtml = renderMarkdownHtml([
    "- **Ideal LPF Frequency Response:** $H(\\omega) = \\begin{cases}",
    "  1, & |\\omega| \\le \\frac{\\pi}{D} \\\\",
    "  0, & \\text{otherwise}",
    "  \\end{cases}$",
  ].join("\n"));
  assert.equal((wrappedBulletHtml.match(/class="math-display-block"/g) || []).length, 1, "Multi-line wrapped bullet equation should promote to display block");

  const indentedSingleLineDisplayHtml = renderMarkdownHtml([
    "* **Anti-aliasing Filter (Time-domain):**",
    "  $$v(n) = \\sum_{k=-\\infty}^{\\infty} h(k)\\, x(n - k)$$",
    "* **Ideal LPF Frequency Response:**",
    "  $$H(\\omega) = \\begin{cases} 1, & |\\omega| \\le \\dfrac{\\pi}{D} \\\\ 0, & \\text{otherwise} \\end{cases}$$",
    "* **Down-sampler Output (Time-domain):**",
    "  $$y(m) = v(mD) = \\sum_{k=-\\infty}^{\\infty} h(k)\\, x(mD - k)$$",
    "  *(Without the pre-filter, pure down-sampling is simply $y(m) = x(mD)$.)*",
  ].join("\n"));
  assert.equal(
    (indentedSingleLineDisplayHtml.match(/class="math-display-block"/g) || []).length,
    3,
    "Indented single-line $$...$$ on bullet continuation lines must render as centered display blocks"
  );
  assert.equal(
    (indentedSingleLineDisplayHtml.match(/class="inline-math"/g) || []).length,
    1,
    "Inline $y(m) = x(mD)$ in follow-up note must remain inline"
  );

  const tableWithHeavyMathHtml = renderMarkdownHtml([
    "| Name | Formula | Typical use |",
    "|---|---|---|",
    "| **Autocorrelation** | $R_{xx}[k] = \\sum_n x[n]\\,x[n + k]$ | Detect periodicity, power spectrum |",
    "| **Cross-power spectral density** | $$S_{xy}(\\omega) = \\sum_{k} R_{xy}[k] e^{-j\\omega k}$$ | Frequency-domain view |",
    "| **Zero-lag correlation** | $R_{xy}[0] = \\sum_n x[n]y[n]$ | Simple similarity measure |",
  ].join("\n"));
  assert.ok(tableWithHeavyMathHtml.includes("<table>") && tableWithHeavyMathHtml.includes("<tbody>"), "Table structure must remain intact");
  assert.equal((tableWithHeavyMathHtml.match(/<tr>/g) || []).length, 4, "Header + 3 data rows must all render as table rows");
  assert.equal((tableWithHeavyMathHtml.match(/class="math-display-block"/g) || []).length, 0, "Table cell math must not promote to display blocks");
  assert.equal((tableWithHeavyMathHtml.match(/class="inline-math"/g) || []).length, 3, "All 3 table formulas must render as inline math inside cells");
});

test("preprocessMarkdown preserves fenced code blocks and escapes unsafe XML/generics cleanly", () => {
  const md = [
    "Return Promise<void>, Map<string, number>, or pass <user_id> into <input>.",
    "",
    "<answer>Hello <b>world</b></answer>",
    "",
    "- [x] GFM Task",
    "",
    "```js",
    "const p = \"$50\";",
    "const r = /\\[0\\]/;",
    "```",
  ].join("\n");

  const html = renderMarkdownHtml(md);
  assert.ok(html.includes("Promise&lt;void&gt;"), "Should preserve <void> generic as visible text");
  assert.ok(html.includes("Map&lt;string, number&gt;"), "Should preserve <string, number> generic");
  assert.ok(html.includes("&lt;user_id&gt;") && html.includes("&lt;input&gt;"), "Should render prose XML tags safely as text");
  assert.ok(html.includes("<b>world</b>"), "Should allow safe inline HTML like <b>");
  assert.ok(html.includes('type="checkbox"'), "Should keep GFM task list checkboxes working");
  assert.ok(html.includes("$50") && html.includes("\\[0\\]"), "Should not corrupt code block contents");
  assert.ok(!html.includes("$$\n0\n$$"), "Must not turn JS regex into display math");
});

test("unlabeled fenced ASCII diagrams keep pre/code structure intact for CodeBlock", () => {
  const diagram = [
    "```",
    "┌──────────────────────────┐",
    "│  GROUND CONTROL STATION  │",
    "└──────────────────────────┘",
    "```",
  ].join("\n");

  const html = renderMarkdownHtml(diagram);
  assert.ok(html.includes("<pre><code>"), "Unlabeled fence should emit <pre><code> so newlines/spaces stay preserved");
  assert.ok(html.includes("┌──────────────────────────┐\n│  GROUND CONTROL STATION  │"), "Diagram alignment must stay intact");
});
