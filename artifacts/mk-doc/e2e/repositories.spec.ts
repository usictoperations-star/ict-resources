import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

test.describe("Repositories - delete flow", () => {
  test("creates a new repository and then deletes it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `e2e-repo-${suffix}`;
    const updatedName = `e2e-repo-${suffix}-updated`;

    await page.goto("/repositories");
    await expect(page.getByRole("heading", { name: "Repository Management" })).toBeVisible();

    await page.getByRole("button", { name: "New Repository" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByRole("heading", { name: "Add Repository" })).toBeVisible();

    await createDialog.getByPlaceholder("mk-citizen-portal").fill(name);

    await createDialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "private", exact: true }).click();

    await createDialog.getByRole("button", { name: "Add Repository" }).click();
    await expect(createDialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "Edit Repository" })).toBeVisible();

    await editDialog.getByPlaceholder("mk-citizen-portal").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();

    const updatedRow = page.getByRole("row", { name: new RegExp(updatedName) });
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: new RegExp(updatedName) })).toBeHidden();
  });
});
