import { existsSync } from "node:fs";

import type { Act } from "@/lib/db/schema/acts";

const LOCAL_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

async function resolveChromiumPath(): Promise<string> {
  const local = LOCAL_CHROME_PATHS.find((p) => existsSync(p));
  if (local) return local;

  const chromium = await import("@sparticuz/chromium");
  return chromium.default.executablePath();
}

function getFopDetails() {
  return {
    name: process.env.FOP_NAME ?? "ФОП Не вказано",
    legalId: process.env.FOP_LEGAL_ID ?? "",
    address: process.env.FOP_ADDRESS ?? "",
    bankAccount: process.env.FOP_BANK_ACCOUNT ?? "",
    bankName: process.env.FOP_BANK_NAME ?? "",
  };
}

export async function renderActPdf(act: Act): Promise<Buffer> {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ActTemplate } = await import("./act-template");

  const fop = getFopDetails();
  const html = renderToStaticMarkup(createElement(ActTemplate, { act, fop }));
  const fullHtml = `<!DOCTYPE html>${html}`;

  const puppeteer = await import("puppeteer-core");
  const executablePath = await resolveChromiumPath();

  const browser = await puppeteer.default.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 794, height: 1123 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
