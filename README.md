# nexdf

Plug-and-play npm library for Next.js that lets users create PDFs from customizable HTML/HTMX templates with unlimited Handlebars placeholders.

## What this gives you

- Ready endpoint at `/api/pdf` (via one-time scaffold command)
- Default template with Tailwind CSS classes and placeholders
- Unlimited placeholders using Handlebars (`{{anyField}}`)
- Server-side PDF generation in Node.js runtime
- User-editable template files in their own app
- Optional DB-backed template loading (`templateKey`) with file fallback

## Workspace structure

- `packages/nexdf`: workspace library folder (published on npm as `nexdf`)
- `apps/web`: demo Next.js app using the library

## Library usage in any Next.js app

1. Install package:

```bash
npm install nexdf
```

2. Scaffold route + template files in your app root:

```bash
npx nexdf
```

This creates:

- `app/api/pdf/route.ts`
- `templates/pdf/basic.html`

3. Call the endpoint:

```bash
curl -X POST http://localhost:3000/api/pdf \
  -H "content-type: application/json" \
  -d '{
    "filename": "invoice.pdf",
    "templateKey": "basic",
    "data": {
      "title": "Invoice #001",
      "subtitle": "Example",
      "fromName": "Acme",
      "fromEmail": "billing@acme.com",
      "toName": "Jane",
      "toEmail": "jane@example.com",
      "summary": "Line items summary",
      "generatedAt": "2026-02-13"
    }
  }' --output invoice.pdf
```

## Tailwind customization

Edit `templates/pdf/basic.html` directly and change/add Tailwind classes.

You can add as many placeholders as needed:

```html
<p>{{customerName}}</p>
<p>{{orderId}}</p>
<p>{{anyNewField}}</p>
```

Then provide those values in the JSON body under `data`.

## HTMX compatibility

Templates are regular HTML and support HTMX attributes (`hx-*`) in markup.

## Database templates (migration-based)

You can keep templates in a DB table and render from DB on each request.

- Demo includes SQL migration: `apps/web/db/migrations/001_create_pdf_templates.sql`
- Demo route resolves templates from DB first, then falls back to file templates
- Use `templateKey` in request body to pick which DB template to render

Resolution order used by the demo route:

1. Try DB template via `templateKey`
2. If not found, fallback to file template via `templatePath` / `defaultTemplate`

Example request body:

```json
{
  "filename": "document.pdf",
  "templateKey": "basic",
  "data": {
    "title": "Any value"
  }
}
```

## Local development

From repository root:

```bash
npm install
npm run build
npm run dev:web
```

Demo endpoint: `http://localhost:3000/api/pdf`

## Runtime requirement

Use `runtime = "nodejs"` for the route handler.

Also ensure Chrome/Chromium is available and set:

```bash
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## Speed tuning

The route prewarms Chromium automatically and reuses hot pages, so warm requests are fast.

You can tune concurrency:

```ts
export const POST = createPdfRouteHandler({
  templatesDir: process.cwd() + "/templates/pdf",
  defaultTemplate: "basic.html",
  poolSize: 2
});
```

Note: true zero cold start is not possible when a server process/container is newly started by the platform. This package minimizes it by prewarming on boot and keeping browser/pages hot for subsequent requests.

## API body

`POST /api/pdf`

```json
{
  "filename": "document.pdf",
  "templateKey": "basic",
  "templatePath": "basic.html",
  "data": {
    "title": "Any value"
  }
}
```

- `templateKey`: optional, used by DB resolver
- `templatePath`: optional, file template fallback
- `data`: placeholder values for Handlebars