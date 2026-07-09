import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

test.describe("Domains - create, edit, and delete", () => {
  test("creates a new domain (team unassigned), edits and deletes it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `e2e-${suffix}.mk.gov`;
    const updatedName = `e2e-${suffix}-up.mk.gov`;

    await page.goto("/domains");
    await expect(page.getByRole("heading", { name: "Domain & SSL Management" })).toBeVisible();

    await page.getByRole("button", { name: "New Domain" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByRole("heading", { name: "Add Domain" })).toBeVisible();

    await createDialog.getByPlaceholder("example.mk.gov").fill(name);
    // Team picker deliberately left as "Unassigned" to verify silent-validation regression doesn't occur

    await createDialog.getByRole("button", { name: "Add Domain" }).click();
    await expect(createDialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "Edit Domain" })).toBeVisible();

    await editDialog.getByPlaceholder("example.mk.gov").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();

    const updatedRow = page.getByRole("row", { name: new RegExp(updatedName) });
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: new RegExp(updatedName) })).toBeHidden();
  });
});
