import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { parse, type HTMLElement, type Node as HtmlNode, type TextNode } from "node-html-parser";

type TextAlign = "left" | "center" | "right";

type RenderStyle = {
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: RGB;
  lineHeight: number;
  marginTop: number;
  marginBottom: number;
  textAlign: TextAlign;
};

type NativeRenderState = {
  doc: PDFDocument;
  page: PDFPage;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  cursorY: number;
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
};

type ClassStyleMap = Map<string, Partial<RenderStyle>>;

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const BLOCK_TAGS = new Set([
  "html",
  "body",
  "main",
  "section",
  "article",
  "header",
  "footer",
  "aside",
  "nav",
  "div",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li"
]);

const DEFAULT_STYLE: RenderStyle = {
  fontSize: 11,
  fontWeight: "normal",
  color: rgb(0, 0, 0),
  lineHeight: 1.4,
  marginTop: 0,
  marginBottom: 0,
  textAlign: "left"
};

const HEADING_STYLES: Record<string, Partial<RenderStyle>> = {
  h1: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  h2: { fontSize: 22, fontWeight: "bold", marginBottom: 6 },
  h3: { fontSize: 18, fontWeight: "bold", marginBottom: 5 },
  h4: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  h5: { fontSize: 13, fontWeight: "bold", marginBottom: 4 },
  h6: { fontSize: 11, fontWeight: "bold", marginBottom: 3 }
};

const BLOCK_DEFAULTS: Record<string, Partial<RenderStyle>> = {
  p: { marginBottom: 6 },
  div: { marginBottom: 4 },
  section: { marginBottom: 6 },
  article: { marginBottom: 6 },
  header: { marginBottom: 8 },
  footer: { marginTop: 8 },
  li: { marginBottom: 2 },
  ul: { marginBottom: 4 },
  ol: { marginBottom: 4 }
};

function toPoints(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.endsWith("px")) {
    const px = Number.parseFloat(normalized.slice(0, -2));
    return Number.isFinite(px) ? px * 0.75 : null;
  }

  if (normalized.endsWith("pt")) {
    const pt = Number.parseFloat(normalized.slice(0, -2));
    return Number.isFinite(pt) ? pt : null;
  }

  const raw = Number.parseFloat(normalized);
  return Number.isFinite(raw) ? raw : null;
}

function parseHexColor(input: string): RGB | null {
  const value = input.trim().toLowerCase();
  if (!value.startsWith("#")) {
    return null;
  }

  const hex = value.slice(1);
  if (hex.length === 3) {
    const r = Number.parseInt(hex[0] + hex[0], 16);
    const g = Number.parseInt(hex[1] + hex[1], 16);
    const b = Number.parseInt(hex[2] + hex[2], 16);
    return rgb(r / 255, g / 255, b / 255);
  }

  if (hex.length === 6) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return rgb(r / 255, g / 255, b / 255);
  }

  return null;
}

function parseRgbColor(input: string): RGB | null {
  const match = input.trim().match(/^rgb\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\)$/i);
  if (!match) {
    return null;
  }

  const r = Number.parseInt(match[1], 10);
  const g = Number.parseInt(match[2], 10);
  const b = Number.parseInt(match[3], 10);
  if (r > 255 || g > 255 || b > 255) {
    return null;
  }

  return rgb(r / 255, g / 255, b / 255);
}

function parseColor(value: string): RGB | null {
  return parseHexColor(value) ?? parseRgbColor(value);
}

function parseStyleDeclarations(cssText: string): Partial<RenderStyle> {
  const out: Partial<RenderStyle> = {};
  const parts = cssText.split(";");

  for (const part of parts) {
    const index = part.indexOf(":");
    if (index === -1) {
      continue;
    }

    const property = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (!property || !value) {
      continue;
    }

    if (property === "font-size") {
      const parsed = toPoints(value);
      if (parsed !== null) {
        out.fontSize = parsed;
      }
      continue;
    }

    if (property === "font-weight") {
      if (value === "bold" || Number.parseInt(value, 10) >= 600) {
        out.fontWeight = "bold";
      } else {
        out.fontWeight = "normal";
      }
      continue;
    }

    if (property === "color") {
      const parsed = parseColor(value);
      if (parsed) {
        out.color = parsed;
      }
      continue;
    }

    if (property === "line-height") {
      const numeric = Number.parseFloat(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        out.lineHeight = numeric;
      } else {
        const parsed = toPoints(value);
        if (parsed !== null) {
          out.lineHeight = parsed;
        }
      }
      continue;
    }

    if (property === "margin-top") {
      const parsed = toPoints(value);
      if (parsed !== null) {
        out.marginTop = parsed;
      }
      continue;
    }

    if (property === "margin-bottom") {
      const parsed = toPoints(value);
      if (parsed !== null) {
        out.marginBottom = parsed;
      }
      continue;
    }

    if (property === "text-align") {
      if (value === "left" || value === "center" || value === "right") {
        out.textAlign = value;
      }
    }
  }

  return out;
}

function extractClassStyles(html: string): ClassStyleMap {
  const map: ClassStyleMap = new Map();
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;

  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleRegex.exec(html))) {
    const css = styleMatch[1] ?? "";
    const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = ruleRegex.exec(css))) {
      const selector = ruleMatch[1]?.trim() ?? "";
      const declarations = ruleMatch[2] ?? "";
      const parsed = parseStyleDeclarations(declarations);

      const selectors = selector.split(",").map((value) => value.trim());
      for (const currentSelector of selectors) {
        if (!currentSelector.startsWith(".")) {
          continue;
        }

        const className = currentSelector
          .slice(1)
          .split(/\s|:|>/)[0]
          ?.trim();

        if (!className) {
          continue;
        }

        map.set(className, {
          ...(map.get(className) ?? {}),
          ...parsed
        });
      }
    }
  }

  return map;
}

function mergeStyles(...styles: Array<Partial<RenderStyle>>): RenderStyle {
  return styles.reduce<RenderStyle>(
    (acc, item) => ({
      ...acc,
      ...item,
      color: item.color ?? acc.color
    }),
    { ...DEFAULT_STYLE }
  );
}

function getTagStyle(tag: string): Partial<RenderStyle> {
  const heading = HEADING_STYLES[tag];
  if (heading) {
    return heading;
  }
  return BLOCK_DEFAULTS[tag] ?? {};
}

function getElementStyle(element: HTMLElement, classStyles: ClassStyleMap, inherited: RenderStyle): RenderStyle {
  const tag = element.tagName.toLowerCase();
  const classAttr = element.getAttribute("class") ?? "";
  const inlineStyle = element.getAttribute("style") ?? "";
  const classes = classAttr
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const classMerged = classes.reduce<Partial<RenderStyle>>((acc, className) => {
    return {
      ...acc,
      ...(classStyles.get(className) ?? {})
    };
  }, {});

  const inlineParsed = inlineStyle ? parseStyleDeclarations(inlineStyle) : {};
  return mergeStyles(inherited, getTagStyle(tag), classMerged, inlineParsed);
}

function ensureRoom(state: NativeRenderState, heightNeeded: number): void {
  if (state.cursorY - heightNeeded >= state.marginBottom) {
    return;
  }

  state.page = state.doc.addPage([state.pageWidth, state.pageHeight]);
  state.cursorY = state.pageHeight - state.marginTop;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let current = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[index];
    }
  }

  lines.push(current);
  return lines;
}

function drawTextBlock(state: NativeRenderState, text: string, style: RenderStyle): void {
  const cleaned = collapseWhitespace(text);
  if (!cleaned) {
    return;
  }

  const font = style.fontWeight === "bold" ? state.fontBold : state.fontRegular;
  const fontSize = style.fontSize;
  const resolvedLineHeight = style.lineHeight > 3 ? style.lineHeight : style.lineHeight * fontSize;
  const maxWidth = state.pageWidth - state.marginLeft - state.marginRight;
  const lines = wrapText(cleaned, font, fontSize, maxWidth);

  for (const line of lines) {
    ensureRoom(state, resolvedLineHeight);
    const lineWidth = font.widthOfTextAtSize(line, fontSize);

    let x = state.marginLeft;
    if (style.textAlign === "center") {
      x = state.marginLeft + (maxWidth - lineWidth) / 2;
    } else if (style.textAlign === "right") {
      x = state.pageWidth - state.marginRight - lineWidth;
    }

    state.page.drawText(line, {
      x,
      y: state.cursorY - resolvedLineHeight,
      size: fontSize,
      font,
      color: style.color
    });

    state.cursorY -= resolvedLineHeight;
  }
}

function addVerticalGap(state: NativeRenderState, points: number): void {
  if (points <= 0) {
    return;
  }

  ensureRoom(state, points);
  state.cursorY -= points;
}

function renderNode(
  node: HtmlNode,
  state: NativeRenderState,
  inheritedStyle: RenderStyle,
  classStyles: ClassStyleMap,
  listDepth = 0
): void {
  if ((node as TextNode).nodeType === 3) {
    const textNode = node as TextNode;
    drawTextBlock(state, textNode.rawText, inheritedStyle);
    return;
  }

  if ((node as HTMLElement).nodeType !== 1) {
    return;
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (tag === "style" || tag === "script" || tag === "head") {
    return;
  }

  const style = getElementStyle(element, classStyles, inheritedStyle);

  if (tag === "br") {
    const resolvedLineHeight = style.lineHeight > 3 ? style.lineHeight : style.lineHeight * style.fontSize;
    addVerticalGap(state, resolvedLineHeight);
    return;
  }

  if (tag === "hr") {
    addVerticalGap(state, 4);
    ensureRoom(state, 8);
    state.page.drawLine({
      start: { x: state.marginLeft, y: state.cursorY },
      end: { x: state.pageWidth - state.marginRight, y: state.cursorY },
      thickness: 0.8,
      color: rgb(0.82, 0.82, 0.82)
    });
    addVerticalGap(state, 8);
    return;
  }

  const isBlock = BLOCK_TAGS.has(tag);
  if (isBlock) {
    addVerticalGap(state, style.marginTop);
  }

  if (tag === "li") {
    const bulletIndent = 10 + listDepth * 8;
    drawTextBlock(state, `${" ".repeat(Math.max(0, bulletIndent / 4))}• ${element.textContent}`, style);
  } else if (tag === "ul" || tag === "ol") {
    for (const child of element.childNodes) {
      renderNode(child, state, style, classStyles, listDepth + 1);
    }
  } else if (element.childNodes.length > 0) {
    for (const child of element.childNodes) {
      renderNode(child, state, style, classStyles, listDepth);
    }
  } else {
    drawTextBlock(state, element.textContent, style);
  }

  if (isBlock) {
    addVerticalGap(state, style.marginBottom);
  }
}

export async function generateNativePdfBuffer(html: string): Promise<Buffer> {
  const classStyles = extractClassStyles(html);
  const root = parse(html);
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

  const state: NativeRenderState = {
    doc: pdfDoc,
    page,
    fontRegular,
    fontBold,
    cursorY: A4_HEIGHT - 36,
    pageWidth: A4_WIDTH,
    pageHeight: A4_HEIGHT,
    marginLeft: 36,
    marginRight: 36,
    marginTop: 36,
    marginBottom: 36
  };

  const body = root.querySelector("body");
  const startNode = body ?? root;

  for (const child of startNode.childNodes) {
    renderNode(child, state, DEFAULT_STYLE, classStyles);
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}