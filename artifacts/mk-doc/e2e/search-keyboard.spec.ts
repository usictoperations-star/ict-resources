import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

const ADMIN_EMAIL = "ahmad.rashid@mk.gov";
const ADMIN_PASSWORD = "Admin@2026!";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Executive Dashboard" })).toBeVisible({ timeout: 8000 });
}

test.describe("Search bar - keyboard navigation", () => {
  let appId: number;
  let domainId: number;
  let suffix: string;
  let searchTerm: string;

  test.beforeAll(async ({ request }) => {
    suffix = uniqueSuffix();
    searchTerm = `srch${suffix}`;

    const appRes = await request.post("/api/applications", {
      data: {
        name: `${searchTerm} App`,
        category: "Web Application",
        classification: "Internal",
        environment: "Production",
        status: "Active",
        priority: "High",
        criticality: "High",
      },
    });
    expect(appRes.ok()).toBeTruthy();
    const app = await appRes.json();
    appId = app.id;

    const domainRes = await request.post("/api/domains", {
      data: {
        name: `${searchTerm}.example.com`,
        status: "Active",
      },
    });
    expect(domainRes.ok()).toBeTruthy();
    const domain = await domainRes.json();
    domainId = domain.id;
  });

  test.afterAll(async ({ request }) => {
    if (appId) await request.delete(`/api/applications/${appId}`);
    if (domainId) await request.delete(`/api/domains/${domainId}`);
  });

  test("typing a query shows the search dropdown", async ({ page }) => {
    await login(page);

    const searchInput = page.getByPlaceholder("Search assets, IP, domains...");
    await searchInput.click();
    await searchInput.fill(searchTerm);

    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("option").first()).toBeVisible();
  });

  test("ArrowDown highlights the first result, then the second", async ({ page }) => {
    await login(page);

    const searchInput = page.getByPlaceholder("Search assets, IP, domains...");
    await searchInput.click();
    await searchInput.fill(searchTerm);

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 5000 });

    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();

    await searchInput.press("ArrowDown");
    const firstOption = page.locator("#search-result-0");
    await expect(firstOption).toHaveAttribute("aria-selected", "true");
    await expect(searchInput).toHaveAttribute("aria-activedescendant", "search-result-0");

    await searchInput.press("ArrowDown");
    const secondOption = page.locator("#search-result-1");
    await expect(secondOption).toHaveAttribute("aria-selected", "true");
    await expect(searchInput).toHaveAttribute("aria-activedescendant", "search-result-1");
    await expect(firstOption).toHaveAttribute("aria-selected", "false");
  });

  test("Escape closes the dropdown and removes the highlight", async ({ page }) => {
    await login(page);

    const searchInput = page.getByPlaceholder("Search assets, IP, domains...");
    await searchInput.click();
    await searchInput.fill(searchTerm);

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("option").first()).toBeVisible();

    await searchInput.press("ArrowDown");
    await expect(page.locator("#search-result-0")).toHaveAttribute("aria-selected", "true");

    await searchInput.press("Escape");

    await expect(listbox).toBeHidden();
    await expect(searchInput).toHaveAttribute("aria-expanded", "false");
    await expect(searchInput).not.toHaveAttribute("aria-activedescendant");
  });

  test("Enter on a highlighted application result navigates to its detail page", async ({ page }) => {
    await login(page);

    const searchInput = page.getByPlaceholder("Search assets, IP, domains...");
    await searchInput.click();
    await searchInput.fill(searchTerm);

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole("option").first()).toBeVisible();

    await searchInput.press("ArrowDown");
    await expect(page.locator("#search-result-0")).toHaveAttribute("aria-selected", "true");

    await searchInput.press("Enter");

    await expect(listbox).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/applications/${appId}`), { timeout: 5000 });
  });

  test("Enter on a highlighted domain result navigates to its detail page", async ({ page }) => {
    await login(page);

    const searchInput = page.getByPlaceholder("Search assets, IP, domains...");
    await searchInput.click();
    await searchInput.fill(searchTerm);

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 5000 });

    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();

    const optionCount = await options.count();
    let domainIndex = -1;
    for (let i = 0; i < optionCount; i++) {
      const id = await options.nth(i).getAttribute("id");
      if (id) {
        const itemIndex = parseInt(id.replace("search-result-", ""), 10);
        const option = page.locator(`#search-result-${itemIndex}`);
        const text = await option.textContent();
        if (text && text.includes(`${searchTerm}.example.com`)) {
          domainIndex = itemIndex;
          break;
        }
      }
    }

    expect(domainIndex).toBeGreaterThanOrEqual(0);

    for (let i = 0; i <= domainIndex; i++) {
      await searchInput.press("ArrowDown");
    }

    await expect(page.locator(`#search-result-${domainIndex}`)).toHaveAttribute("aria-selected", "true");
    await searchInput.press("Enter");

    await expect(listbox).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/domains/${domainId}`), { timeout: 5000 });
  });
});
