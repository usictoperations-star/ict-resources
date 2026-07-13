import { chromium, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AUTH_STATE_PATH = path.join(__dirname, ".auth/session.json");

async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:80";
  const email = process.env.E2E_EMAIL ?? "admin@mk.gov";
  const password = process.env.E2E_PASSWORD;
  if (!password) {
    throw new Error(
      "E2E_PASSWORD environment variable is required. " +
      "Set it in your .env.test file or CI secrets."
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(baseURL + "/");

  await page.fill("#email", email);
  await page.fill("#password", password);

  const [loginResponse] = await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/auth/login"), { timeout: 10_000 }),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);

  if (!loginResponse.ok()) {
    let body: { error?: string } = {};
    try { body = await loginResponse.json(); } catch { /* ignore */ }
    throw new Error(
      `E2E auth setup failed: POST /api/auth/login returned ${loginResponse.status()}. ` +
      `Server message: "${body.error ?? "unknown"}". ` +
      `Check that the user "${email}" exists in the DB with the correct password hash.`
    );
  }

  await expect(page.getByRole("navigation")).toBeVisible({ timeout: 15_000 });

  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}

export default globalSetup;
