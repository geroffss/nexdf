import { createPdfRouteHandler } from "nexdf";

export const runtime = "nodejs";

export const POST = createPdfRouteHandler({
  templatesDir: process.cwd() + "/templates/pdf",
  defaultTemplate: "basic.html",
  poolSize: 2
});