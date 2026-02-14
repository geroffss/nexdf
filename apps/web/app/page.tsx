"use client";

import { useState } from "react";

type PdfEngine = "chromium" | "native";

export default function HomePage() {
  const [engine, setEngine] = useState<PdfEngine>("chromium");
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
          filename: `invoice-${engine}.pdf`,
          engine,
          templatePath: engine === "native" ? "native.html" : "basic.html",
          templateKey: engine === "native" ? "native" : "basic",
          data: {
            title: "Invoice #INV-2026-001",
            subtitle: "Thank you for your business",
            fromName: "Acme Studio",
            fromEmail: "billing@acme.studio",
            toName: "Jane Doe",
            toEmail: "jane@example.com",
            summary:
              engine === "native"
                ? "Fast native renderer with classic CSS classes."
                : "Chromium renderer with Tailwind and full browser CSS support.",
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
      anchor.download = `invoice-${engine}.pdf`;
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
      <p className="mt-3 text-gray-700">Pick engine, then generate and compare output/speed.</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => setEngine("chromium")}
          disabled={isLoading}
          className={`rounded border px-4 py-2 text-sm ${
            engine === "chromium" ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black"
          }`}
        >
          Chromium (Tailwind, slower)
        </button>
        <button
          type="button"
          onClick={() => setEngine("native")}
          disabled={isLoading}
          className={`rounded border px-4 py-2 text-sm ${
            engine === "native" ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black"
          }`}
        >
          Native (classic CSS, fast)
        </button>
      </div>
      <button
        type="button"
        onClick={createPdf}
        disabled={isLoading}
        className="mt-6 rounded bg-black px-5 py-3 text-white disabled:opacity-60"
      >
        {isLoading ? "Generating..." : `Generate ${engine} PDF`}
      </button>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    </main>
  );
}