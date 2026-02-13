"use client";

import { useState } from "react";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPdf = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          filename: "invoice.pdf",
          data: {
            title: "Invoice #INV-2026-001",
            subtitle: "Thank you for your business",
            fromName: "Acme Studio",
            fromEmail: "billing@acme.studio",
            toName: "Jane Doe",
            toEmail: "jane@example.com",
            summary: "You can customize this template freely with Tailwind classes and unlimited Handlebars placeholders.",
            generatedAt: new Date().toISOString().slice(0, 10)
          }
        })
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "PDF generation failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "invoice.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-3xl font-bold">Next PDF Templater</h1>
      <p className="mt-3 text-gray-700">Edit templates in templates/pdf/basic.html and hit the endpoint.</p>
      <button
        type="button"
        onClick={createPdf}
        disabled={isLoading}
        className="mt-6 rounded bg-black px-5 py-3 text-white disabled:opacity-60"
      >
        {isLoading ? "Generating..." : "Generate PDF"}
      </button>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    </main>
  );
}