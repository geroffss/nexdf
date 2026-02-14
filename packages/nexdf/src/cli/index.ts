#!/usr/bin/env node
import { mkdir, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const routeFilePath = path.join(cwd, "app", "api", "pdf", "route.ts");
const templateDir = path.join(cwd, "templates", "pdf");
const templatePath = path.join(templateDir, "basic.html");
const nativeTemplatePath = path.join(templateDir, "native.html");

const routeTemplate = `import { createPdfRouteHandler } from "nexdf";

export const runtime = "nodejs";

export const POST = createPdfRouteHandler({
  templatesDir: process.cwd() + "/templates/pdf",
  defaultTemplate: "basic.html",
  defaultEngine: "chromium",
  poolSize: 2
});
`;

const defaultHtmlTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{title}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      html,
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body class="bg-white">
    <main class="mx-auto box-border h-[297mm] w-[210mm] overflow-hidden bg-white px-[12mm] py-[14mm]">
      <header class="mb-8 border-b border-slate-200 pb-6">
        <h1 class="text-2xl font-bold text-slate-900">{{title}}</h1>
        <p class="mt-1 text-sm text-slate-500">{{subtitle}}</p>
      </header>

      <section class="grid grid-cols-2 gap-6 text-sm">
        <article>
          <h2 class="mb-2 font-semibold text-slate-700">From</h2>
          <p class="text-slate-600">{{fromName}}</p>
          <p class="text-slate-500">{{fromEmail}}</p>
        </article>
        <article>
          <h2 class="mb-2 font-semibold text-slate-700">To</h2>
          <p class="text-slate-600">{{toName}}</p>
          <p class="text-slate-500">{{toEmail}}</p>
        </article>
      </section>

      <section class="mt-8 rounded-xl bg-slate-50 p-5">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
        <p class="mt-2 text-slate-700">{{summary}}</p>
      </section>

      <footer class="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-400">
        Generated on {{generatedAt}}
      </footer>
    </main>
  </body>
</html>
`;

const nativeHtmlTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{title}}</title>
    <style>
      body {
        font-size: 11pt;
        color: #111827;
      }

      .document-title {
        font-size: 24pt;
        font-weight: 700;
        margin-bottom: 4pt;
      }

      .document-subtitle {
        font-size: 11pt;
        color: #4b5563;
        margin-bottom: 14pt;
      }

      .section-title {
        font-size: 13pt;
        font-weight: 700;
        margin-top: 10pt;
        margin-bottom: 4pt;
      }

      .muted {
        color: #6b7280;
      }

      .small {
        font-size: 10pt;
      }

      .row {
        margin-bottom: 2pt;
      }

      .summary {
        margin-top: 8pt;
        margin-bottom: 10pt;
        line-height: 1.55;
      }

      .footer {
        margin-top: 18pt;
        font-size: 9pt;
        color: #9ca3af;
      }
    </style>
  </head>
  <body>
    <h1 class="document-title">{{title}}</h1>
    <p class="document-subtitle">{{subtitle}}</p>

    <h2 class="section-title">From</h2>
    <p class="row">{{fromName}}</p>
    <p class="row muted">{{fromEmail}}</p>

    <h2 class="section-title">To</h2>
    <p class="row">{{toName}}</p>
    <p class="row muted">{{toEmail}}</p>

    <h2 class="section-title">Summary</h2>
    <p class="summary">{{summary}}</p>

    <p class="footer">Generated on {{generatedAt}}</p>
  </body>
</html>
`;

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(path.dirname(routeFilePath), { recursive: true });
  await mkdir(templateDir, { recursive: true });

  if (!(await exists(routeFilePath))) {
    await writeFile(routeFilePath, routeTemplate, "utf8");
    console.log("Created app/api/pdf/route.ts");
  } else {
    console.log("Skipped app/api/pdf/route.ts (already exists)");
  }

  if (!(await exists(templatePath))) {
    await writeFile(templatePath, defaultHtmlTemplate, "utf8");
    console.log("Created templates/pdf/basic.html");
  } else {
    console.log("Skipped templates/pdf/basic.html (already exists)");
  }

  if (!(await exists(nativeTemplatePath))) {
    await writeFile(nativeTemplatePath, nativeHtmlTemplate, "utf8");
    console.log("Created templates/pdf/native.html");
  } else {
    console.log("Skipped templates/pdf/native.html (already exists)");
  }

  console.log("PDF endpoint is ready at /api/pdf");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});