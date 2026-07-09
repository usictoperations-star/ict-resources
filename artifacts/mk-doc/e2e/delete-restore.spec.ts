import { test, expect } from "@playwright/test";
import { uniqueSuffix, findRowAcrossPages } from "./helpers";

async function confirmDelete(page: Parameters<typeof findRowAcrossPages>[0]) {
  const deleteBtn = page.getByRole("button", { name: "Delete" });
  await expect(deleteBtn).toBeEnabled({ timeout: 10_000 });
  await deleteBtn.click();
}

test.describe("Delete and Restore - Applications", () => {
  test("soft-deletes an application and restores it from Recently Deleted", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `E2E App Del ${suffix}`;

    await page.goto("/applications");
    await expect(page.getByRole("heading", { name: "Application Registry" })).toBeVisible();

    await page.getByRole("button", { name: "New Application" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Register New Application")).toBeVisible();

    await dialog.getByPlaceholder("MK Citizen Portal").fill(name);
    await dialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "web", exact: true }).click();
    await dialog.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Web Application", exact: true }).click();
    await dialog.getByRole("combobox").nth(2).click();
    await page.getByRole("option", { name: "Testing", exact: true }).click();

    await dialog.getByRole("button", { name: "Register Application" }).click();
    await expect(dialog).toBeHidden();

    const row = await findRowAcrossPages(page, new RegExp(name));
    await expect(row).toBeVisible();

    await row.getByRole("button").last().click();
    await confirmDelete(page);
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeHidden({ timeout: 10_000 });

    await page.goto("/admin");
    await page.getByRole("tab", { name: "Recently Deleted" }).click();

    const deletedRow = page.getByRole("row", { name: new RegExp(name) });
    await expect(deletedRow).toBeVisible();
    await expect(deletedRow.getByRole("button", { name: "Restore" })).toBeVisible();

    await deletedRow.getByRole("button", { name: "Restore" }).click();
    await expect(deletedRow).toBeHidden({ timeout: 10_000 });

    await page.goto("/applications");
    const restoredRow = await findRowAcrossPages(page, new RegExp(name));
    await expect(restoredRow).toBeVisible();

    await restoredRow.getByRole("button").last().click();
    await confirmDelete(page);
  });
});

test.describe("Delete and Restore - Infrastructure", () => {
  test("soft-deletes an infrastructure record and restores it from Recently Deleted", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `e2e-server-del-${suffix}`;

    await page.goto("/infrastructure");
    await expect(page.getByRole("heading", { name: "Infrastructure Management" })).toBeVisible();

    await page.getByRole("button", { name: "New Server" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Add Infrastructure")).toBeVisible();

    await dialog.getByPlaceholder("prod-web-01").fill(name);
    await dialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "VPS", exact: true }).click();
    await dialog.getByRole("button", { name: "Add Server" }).click();
    await expect(dialog).toBeHidden();

    const row = await findRowAcrossPages(page, new RegExp(name));
    await expect(row).toBeVisible();

    await row.getByRole("button").last().click();
    await confirmDelete(page);
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeHidden({ timeout: 10_000 });

    await page.goto("/admin");
    await page.getByRole("tab", { name: "Recently Deleted" }).click();

    const deletedRow = page.getByRole("row", { name: new RegExp(name) });
    await expect(deletedRow).toBeVisible();
    await expect(deletedRow.getByRole("button", { name: "Restore" })).toBeVisible();

    await deletedRow.getByRole("button", { name: "Restore" }).click();
    await expect(deletedRow).toBeHidden({ timeout: 10_000 });

    await page.goto("/infrastructure");
    const restoredRow = await findRowAcrossPages(page, new RegExp(name));
    await expect(restoredRow).toBeVisible();

    await restoredRow.getByRole("button").last().click();
    await confirmDelete(page);
  });
});

test.describe("Delete and Restore - Databases", () => {
  test("soft-deletes a database and restores it from Recently Deleted", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `e2e-db-del-${suffix}`;

    await page.goto("/databases");
    await expect(page.getByRole("heading", { name: "Database Management" })).toBeVisible();

    await page.getByRole("button", { name: "New Database" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Database" })).toBeVisible();

    await dialog.getByPlaceholder("prod-postgres-01").fill(name);
    await dialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "PostgreSQL", exact: true }).click();
    await dialog.getByRole("button", { name: "Add Database" }).click();
    await expect(dialog).toBeHidden();

    const row = await findRowAcrossPages(page, new RegExp(name));
    await expect(row).toBeVisible();

    await row.getByRole("button").last().click();
    await confirmDelete(page);
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeHidden({ timeout: 10_000 });

    await page.goto("/admin");
    await page.getByRole("tab", { name: "Recently Deleted" }).click();

    const deletedRow = page.getByRole("row", { name: new RegExp(name) });
    await expect(deletedRow).toBeVisible();
    await expect(deletedRow.getByRole("button", { name: "Restore" })).toBeVisible();

    await deletedRow.getByRole("button", { name: "Restore" }).click();
    await expect(deletedRow).toBeHidden({ timeout: 10_000 });

    await page.goto("/databases");
    const restoredRow = await findRowAcrossPages(page, new RegExp(name));
    await expect(restoredRow).toBeVisible();

    await restoredRow.getByRole("button").last().click();
    await confirmDelete(page);
  });
});
