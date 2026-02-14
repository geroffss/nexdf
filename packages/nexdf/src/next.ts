import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { generatePdfBuffer, prewarmPdfEngine, type PdfEngine } from "./pdf";
import { renderTemplateFile, renderTemplateString, type TemplateData } from "./template";

export type PdfRequestBody = {
  data?: TemplateData;
  templatePath?: string;
  templateKey?: string;
  filename?: string;
  engine?: PdfEngine;
};

export type ResolveTemplateContext = {
  body: PdfRequestBody;
  templatesDir: string;
  defaultTemplate: string;
};

export type CreatePdfRouteHandlerOptions = {
  templatesDir?: string;
  defaultTemplate?: string;
  defaultEngine?: PdfEngine;
  prewarm?: boolean;
  poolSize?: number;
  resolveTemplate?: (context: ResolveTemplateContext) => Promise<string | null>;
};

const DEFAULT_TEMPLATE_NAME = "basic.html";

export function createPdfRouteHandler(options: CreatePdfRouteHandlerOptions = {}) {
  const templatesDir = options.templatesDir ?? path.join(process.cwd(), "templates", "pdf");
  const defaultTemplate = options.defaultTemplate ?? DEFAULT_TEMPLATE_NAME;
  const defaultEngine = options.defaultEngine ?? "chromium";
  const prewarm = options.prewarm ?? true;

  if (prewarm && defaultEngine === "chromium") {
    void prewarmPdfEngine({ poolSize: options.poolSize });
  }

  return async function POST(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as PdfRequestBody;
      const filename = body.filename || "document.pdf";
      const engine = body.engine ?? defaultEngine;
      const resolvedTemplate = options.resolveTemplate
        ? await options.resolveTemplate({
            body,
            templatesDir,
            defaultTemplate
          })
        : null;

      let html: string;

      if (resolvedTemplate) {
        html = renderTemplateString(resolvedTemplate, body.data ?? {});
      } else {
        const templateName = body.templatePath || defaultTemplate;
        const safeTemplatePath = path.resolve(templatesDir, templateName);

        if (!safeTemplatePath.startsWith(path.resolve(templatesDir))) {
          return Response.json(
            { error: "Invalid templatePath. Template must be inside templates directory." },
            { status: 400 }
          );
        }

        await access(safeTemplatePath, fsConstants.R_OK);

        html = await renderTemplateFile(safeTemplatePath, body.data ?? {});
      }

      const pdfBuffer = await generatePdfBuffer({
        html,
        engine
      });

      return new Response(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `inline; filename="${filename}"`
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while generating PDF";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}