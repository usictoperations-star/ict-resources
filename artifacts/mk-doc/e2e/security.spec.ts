import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

test.describe("Security - create and edit vulnerability", () => {
  test("creates a new vulnerability and then edits it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const title = `E2E Vuln ${suffix}`;
    const updatedTitle = `E2E Vuln ${suffix} Updated`;

    await page.goto("/security");
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();

    await page.getByRole("button", { name: "Log Vulnerability" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByRole("heading", { name: "Log Vulnerability" })).toBeVisible();

    await createDialog.getByPlaceholder("SQL Injection in login endpoint").fill(title);

    await createDialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "high", exact: true }).click();

    await createDialog.getByRole("button", { name: "Log Vulnerability" }).click();
    await expect(createDialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByText("Edit Vulnerability")).toBeVisible();

    await editDialog.getByPlaceholder("SQL Injection in login endpoint").fill(updatedTitle);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();

    const updatedRow = page.getByRole("row", { name: new RegExp(updatedTitle) });
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: new RegExp(updatedTitle) })).toBeHidden();
  });
});
