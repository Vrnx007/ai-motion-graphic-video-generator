import { chromium } from "playwright";

export type PlaywrightBrandSnapshot = {
  title: string | null;
  h1Font: string | null;
  bodyFont: string | null;
  html: string;
};

/** Headless capture for SPAs — falls back silently on failure. */
export async function captureBrandPage(url: string): Promise<PlaywrightBrandSnapshot | null> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
    const title = await page.title();
    const h1Font = await page
      .locator("h1")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)
      .catch(() => null);
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    const html = await page.content();
    return { title, h1Font, bodyFont, html };
  } catch {
    return null;
  } finally {
    await browser?.close();
  }
}
