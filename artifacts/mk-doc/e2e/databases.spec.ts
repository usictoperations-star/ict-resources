import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

test.describe("Databases - create and edit", () => {
  test("creates a new database and then edits it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `e2e-db-${suffix}`;
    const updatedName = `e2e-db-${suffix}-updated`;

    await page.goto("/databases");
    await expect(page.getByRole("heading", { name: "Database Management" })).toBeVisible();

    await page.getByRole("button", { name: "New Database" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByRole("heading", { name: "Add Database" })).toBeVisible();

    await createDialog.getByPlaceholder("prod-postgres-01").fill(name);

    await createDialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "PostgreSQL", exact: true }).click();

    await createDialog.getByRole("button", { name: "Add Database" }).click();
    await expect(createDialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByText("Edit Database")).toBeVisible();

    await editDialog.getByPlaceholder("prod-postgres-01").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();

    const updatedRow = page.getByRole("row", { name: new RegExp(updatedName) });
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: new RegExp(updatedName) })).toBeHidden();
  });
});
