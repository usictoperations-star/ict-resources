import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "ahmad.rashid@mk.gov";
const ADMIN_PASSWORD = "Admin@2026!";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Executive Dashboard" })).toBeVisible({ timeout: 8000 });
}

function quickStatValue(page: import("@playwright/test").Page, label: string) {
  return page.locator(`xpath=//span[normalize-space(.)='${label}']/../../div[contains(@class,'text-xl')]`);
}

function quickStatSub(page: import("@playwright/test").Page, label: string) {
  return page.locator(`xpath=//span[normalize-space(.)='${label}']/../../div[contains(@class,'text-xs') and contains(@class,'text-muted-foreground')]`);
}

test.describe("Dashboard - live stats rendering", () => {
  test("KPI cards and quick-stat tiles render numeric values from the API", async ({ page, request }) => {
    const statsRes = await request.get("/api/dashboard/stats");
    expect(statsRes.ok()).toBeTruthy();
    const stats = await statsRes.json();

    await login(page);

    const main = page.getByRole("main");

    await expect(main.getByText("Total Applications")).toBeVisible({ timeout: 10000 });
    await expect(main.getByText("Open Incidents")).toBeVisible();

    const totalAppsValue = String(stats.totalApplications ?? 0);
    const serversValue = String(stats.servers ?? 0);
    await expect(main.getByText(totalAppsValue).first()).toBeVisible();
    await expect(main.getByText(serversValue).first()).toBeVisible();

    const sslCertsValue = String(stats.sslCertificates ?? 0);
    const upcomingRenewalsValue = String(stats.upcomingRenewals ?? 0);
    const domainsValue = String(stats.domains ?? 0);
    const reposValue = String(stats.repositories ?? 0);
    const dbValue = String(stats.databases ?? 0);

    await expect(quickStatValue(page, "SSL Certs")).toHaveText(sslCertsValue);
    await expect(quickStatSub(page, "SSL Certs")).toHaveText("Monitored");

    await expect(quickStatValue(page, "Domains")).toHaveText(domainsValue);
    await expect(quickStatSub(page, "Domains")).toContainText(`${upcomingRenewalsValue} renewals due`);

    await expect(quickStatValue(page, "Repositories")).toHaveText(reposValue);
    await expect(quickStatSub(page, "Repositories")).toHaveText("Active");

    await expect(quickStatValue(page, "Databases")).toHaveText(dbValue);
    await expect(quickStatSub(page, "Databases")).toHaveText("Tracked");
  });

  test("SSL Certs and upcoming renewals fields are present in the API response", async ({ request }) => {
    const res = await request.get("/api/dashboard/stats");
    expect(res.ok()).toBeTruthy();
    const stats = await res.json();

    expect(typeof stats.sslCertificates).toBe("number");
    expect(typeof stats.upcomingRenewals).toBe("number");

    expect(stats).not.toHaveProperty("softwareItems");
    expect(stats).not.toHaveProperty("eolSoftware");
  });
});
