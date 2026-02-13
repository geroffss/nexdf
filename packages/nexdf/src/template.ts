import { readFile, stat } from "node:fs/promises";
import Handlebars from "handlebars/dist/cjs/handlebars.js";

export type TemplateData = Record<string, unknown>;

type TemplateCacheItem = {
  mtimeMs: number;
  compiled: HandlebarsTemplateDelegate<TemplateData>;
};

const compiledTemplateCache = new Map<string, TemplateCacheItem>();

export function renderTemplateString(template: string, data: TemplateData): string {
  const compiled = Handlebars.compile(template, { noEscape: true });
  return compiled(data);
}

export async function renderTemplateFile(templatePath: string, data: TemplateData): Promise<string> {
  const templateStat = await stat(templatePath);
  const cached = compiledTemplateCache.get(templatePath);

  if (cached && cached.mtimeMs === templateStat.mtimeMs) {
    return cached.compiled(data);
  }

  const template = await readFile(templatePath, "utf8");
  const compiled = Handlebars.compile(template, { noEscape: true });

  compiledTemplateCache.set(templatePath, {
    mtimeMs: templateStat.mtimeMs,
    compiled
  });

  return compiled(data);
}

export function listPlaceholders(template: string): string[] {
  const parsed = Handlebars.parse(template);
  const names = new Set<string>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }
      return;
    }

    const typedNode = node as Record<string, unknown>;

    if (typedNode.type === "MustacheStatement") {
      const pathNode = typedNode.path as { original?: string } | undefined;
      if (pathNode?.original) {
        names.add(pathNode.original);
      }
    }

    for (const value of Object.values(typedNode)) {
      visit(value);
    }
  };

  visit(parsed);
  return [...names];
}