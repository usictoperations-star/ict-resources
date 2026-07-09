import { test, expect } from "@playwright/test";
import { uniqueSuffix, findRowAcrossPages } from "./helpers";

test.describe("Documentation - create, edit, and delete", () => {
  test("creates a new document via form, edits and deletes it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const title = `E2E Doc ${suffix}`;
    const updatedTitle = `E2E Doc ${suffix} Updated`;

    await page.goto("/documentation");
    await expect(page.getByRole("heading", { name: "Documentation Center" })).toBeVisible();

    await page.getByRole("button", { name: "New Document" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByRole("heading", { name: "Add Document" })).toBeVisible();

    await createDialog.getByPlaceholder("MK Citizen Portal — PRD").fill(title);

    await createDialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "Guide", exact: true }).click();

    await createDialog.getByRole("button", { name: "Add Document" }).click();
    await expect(createDialog).toBeHidden();

    const row = await findRowAcrossPages(page, new RegExp(title));
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "Edit Document" })).toBeVisible();

    await editDialog.getByPlaceholder("MK Citizen Portal — PRD").fill(updatedTitle);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();

    const updatedRow = await findRowAcrossPages(page, new RegExp(updatedTitle));
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: new RegExp(updatedTitle) })).toBeHidden();
  });
});
