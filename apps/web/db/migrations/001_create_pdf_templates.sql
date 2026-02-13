CREATE TABLE IF NOT EXISTS pdf_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  html_content TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_key, version)
);

INSERT OR IGNORE INTO pdf_templates (template_key, version, html_content, is_active)
VALUES (
  'basic',
  1,
  '<!doctype html>
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
</html>',
  1
);