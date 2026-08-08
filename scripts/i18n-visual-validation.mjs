import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.SYNK_WEB_URL ?? "http://localhost:3000";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
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
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

page.on("response", async (response) => {
  if (!response.url().startsWith(apiUrl) || response.ok()) return;
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "<response body unavailable>";
  }
  console.error(
    `API ${response.status()} ${response.request().method()} ${response.url()}\n${body}`,
  );
});

async function mutateApi(pathname, body) {
  return page.evaluate(
    async ({ apiUrl: browserApiUrl, pathname: browserPath, body: browserBody }) => {
      const csrfResponse = await fetch(`${browserApiUrl}/auth/csrf`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!csrfResponse.ok) {
        throw new Error(`CSRF request failed: ${csrfResponse.status}`);
      }
      const csrfBody = await csrfResponse.json();
      const response = await fetch(`${browserApiUrl}${browserPath}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfBody.token,
        },
        body: JSON.stringify(browserBody),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`${browserPath} failed (${response.status}): ${text}`);
      }
      return text ? JSON.parse(text) : null;
    },
    { apiUrl, pathname, body },
  );
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const email = `visual-${Date.now()}@example.com`;
  await mutateApi("/auth/signup", { email, password: "SynkVisual1!" });
  const meeting = await mutateApi("/meetings", {
    title: "Localization visual validation",
    description: "",
    startDate: "2026-08-09",
    endDate: "2026-08-10",
    workdayStart: "08:00",
    workdayEnd: "12:00",
    slotIntervalMinutes: 15,
    meetingDurationMinutes: 60,
    timezone: "Africa/Tunis",
  });
  if (!meeting?.id) throw new Error("Meeting creation did not return an id.");

  await page.goto(`${baseUrl}/dashboard/meetings/${meeting.id}`, {
    waitUntil: "networkidle",
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

  await context.clearCookies();
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
