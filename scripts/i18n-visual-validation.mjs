import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.SYNK_WEB_URL ?? "http://localhost:3000";
const outputDir = process.env.SYNK_SCREENSHOT_DIR ?? path.resolve("artifacts/i18n-screenshots");
await fs.mkdir(outputDir, { recursive: true });

const organizerLabels = {
  en: "You (organizer)",
  fr: "Vous (organisateur)",
  ar: "أنت (المنظّم)",
  ja: "あなた（主催者）",
  zh: "你（组织者）",
  es: "Tú (organizador)",
  pt: "Você (organizador)",
  ru: "Вы (организатор)",
  de: "Du (Organisator)",
  nl: "Jij (organisator)",
  hi: "आप (आयोजक)",
  it: "Tu (organizzatore)",
};

const reportedEnglishLeaks = [
  "Tap one square or paint across several. The complete timetable is always shown below.",
  "Times are fixed to Africa/Tunis (meeting timezone) · 15-minute slots",
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(`visual-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("SynkVisual1!");
  await page.getByLabel("Confirm password").fill("SynkVisual1!");
  await page.getByRole("button", { name: "Create organizer account" }).click();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 30_000 });

  await page.getByRole("link", { name: "Create meeting" }).click();
  await page.waitForURL(/\/dashboard\/meetings\/new/, { timeout: 20_000 });
  await page.getByLabel("Meeting title").fill("Localization visual validation");
  await page.getByRole("button", { name: "Create meeting" }).click();
  await page.waitForURL(/\/dashboard\/meetings\/[a-zA-Z0-9-]+$/, {
    timeout: 30_000,
  });
  await page.getByText("You (organizer)", { exact: true }).first().waitFor({ timeout: 30_000 });

  const languageSelect = page.locator("select").first();
  const options = await languageSelect.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => node.value),
  );
  const expectedLocales = Object.keys(organizerLabels);
  for (const locale of expectedLocales) {
    if (!options.includes(locale)) {
      throw new Error(`Language selector is missing locale: ${locale}`);
    }
  }

  for (const [locale, organizerLabel] of Object.entries(organizerLabels)) {
    await languageSelect.selectOption(locale);
    const organizer = page.getByText(organizerLabel, { exact: true }).first();
    await organizer.waitFor({ timeout: 10_000 });

    const htmlState = await page.locator("html").evaluate((element) => ({
      lang: element.lang,
      dir: element.dir,
    }));
    if (locale === "ar" && htmlState.dir !== "rtl") {
      throw new Error(`Arabic did not switch document direction to RTL: ${JSON.stringify(htmlState)}`);
    }
    if (locale !== "ar" && htmlState.dir !== "ltr") {
      throw new Error(`${locale} did not use LTR document direction: ${JSON.stringify(htmlState)}`);
    }

    const bodyText = await page.locator("body").innerText();
    if (locale !== "en") {
      if (bodyText.includes("You (organizer)")) {
        throw new Error(`${locale} still renders the English organizer label.`);
      }
      for (const leaked of reportedEnglishLeaks) {
        if (bodyText.includes(leaked)) {
          throw new Error(`${locale} still renders reported English text: ${leaked}`);
        }
      }
    }

    const availabilitySection = organizer.locator("xpath=ancestor::section[1]");
    await availabilitySection.scrollIntoViewIfNeeded();
    await availabilitySection.screenshot({
      path: path.join(outputDir, `organizer-${locale}.png`),
    });
    console.log(`Validated organizer localization: ${locale}`);
  }

  await languageSelect.selectOption("it");
  await page.getByText("Tu (organizzatore)", { exact: true }).first().waitFor();
  await page.screenshot({
    path: path.join(outputDir, "meeting-detail-it-full.png"),
    fullPage: true,
  });

  await page.goto(`${baseUrl}/signup`, { waitUntil: "networkidle" });
  await page.locator("select").first().selectOption("it");
  await page.getByRole("heading", { name: "Inizia a organizzare" }).waitFor();
  await page.screenshot({
    path: path.join(outputDir, "signup-it.png"),
    fullPage: true,
  });
} finally {
  await browser.close();
}
