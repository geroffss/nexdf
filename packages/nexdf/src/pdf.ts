import puppeteer, { type Browser, type PDFOptions, type Page } from "puppeteer-core";
import { generateNativePdfBuffer } from "./native";

export type PdfEngine = "chromium" | "native";

export type GeneratePdfInput = {
  html: string;
  engine?: PdfEngine;
  pdf?: PDFOptions;
  executablePath?: string;
};

export type PrewarmPdfEngineOptions = {
  executablePath?: string;
  poolSize?: number;
};

const DEFAULT_EXECUTABLE_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/snap/bin/chromium"
].filter((value): value is string => Boolean(value));

let sharedBrowserPromise: Promise<Browser> | null = null;
const idlePages: Page[] = [];
const allPages = new Set<Page>();
const waitQueue: Array<() => void> = [];
let sharedPoolSize = 2;

function getBrowser(executablePath: string): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = puppeteer.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
  }

  return sharedBrowserPromise;
}

function getExecutablePath(inputPath?: string): string {
  const executablePath = inputPath || DEFAULT_EXECUTABLE_PATHS[0];

  if (!executablePath) {
    throw new Error(
      "Chrome/Chromium executable not found. Set PUPPETEER_EXECUTABLE_PATH or pass executablePath."
    );
  }

  return executablePath;
}

async function acquirePage(browser: Browser): Promise<Page> {
  while (true) {
    const cached = idlePages.pop();
    if (cached && !cached.isClosed()) {
      return cached;
    }

    if (allPages.size < sharedPoolSize) {
      const page = await browser.newPage();
      allPages.add(page);
      return page;
    }

    await new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
  }
}

function releasePage(page: Page) {
  if (page.isClosed()) {
    allPages.delete(page);
    const next = waitQueue.shift();
    if (next) {
      next();
    }
    return;
  }

  idlePages.push(page);
  const next = waitQueue.shift();
  if (next) {
    next();
  }
}

export async function prewarmPdfEngine(options: PrewarmPdfEngineOptions = {}): Promise<void> {
  const executablePath = getExecutablePath(options.executablePath);
  sharedPoolSize = Math.max(1, options.poolSize ?? sharedPoolSize);

  const browser = await getBrowser(executablePath);
  if (idlePages.length > 0 || allPages.size > 0) {
    return;
  }

  const page = await browser.newPage();
  await page.setContent("<html><body></body></html>", { waitUntil: "domcontentloaded" });
  allPages.add(page);
  idlePages.push(page);
}

async function closeSharedBrowser() {
  if (!sharedBrowserPromise) {
    return;
  }

  const browser = await sharedBrowserPromise;
  sharedBrowserPromise = null;
  idlePages.length = 0;
  allPages.clear();
  waitQueue.length = 0;
  await browser.close();
}

process.once("exit", () => {
  void closeSharedBrowser();
});

process.once("SIGINT", () => {
  void closeSharedBrowser().finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void closeSharedBrowser().finally(() => process.exit(0));
});

export async function generatePdfBuffer(input: GeneratePdfInput): Promise<Buffer> {
  if (input.engine === "native") {
    return generateNativePdfBuffer(input.html);
  }

  const executablePath = getExecutablePath(input.executablePath);

  const browser = await getBrowser(executablePath);
  const page = await acquirePage(browser);

  try {
    await page.emulateMediaType("print");
    await page.setContent(input.html, {
      waitUntil: "domcontentloaded"
    });

    const output = await page.pdf({
      format: "A4",
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm"
      },
      printBackground: true,
      preferCSSPageSize: true,
      ...(input.pdf ?? {})
    });

    return Buffer.from(output);
  } finally {
    releasePage(page);
  }
}