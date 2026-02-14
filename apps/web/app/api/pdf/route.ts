import { createPdfRouteHandler } from "nexdf";
import { getActiveTemplateHtml } from "../../../lib/template-db";

export const runtime = "nodejs";

export const POST = createPdfRouteHandler({
  templatesDir: process.cwd() + "/templates/pdf",
  defaultTemplate: "basic.html",
  defaultEngine: "chromium",
  poolSize: 2,
  resolveTemplate: async ({ body }) => {
    const templateKey = body.templateKey ?? "basic";
    return getActiveTemplateHtml(templateKey);
  }
});