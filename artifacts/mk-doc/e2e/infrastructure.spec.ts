import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

test.describe("Infrastructure - create and edit", () => {
  test("creates a new server and then edits it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `e2e-server-${suffix}`;
    const updatedName = `e2e-server-${suffix}-updated`;

    await page.goto("/infrastructure");
    await expect(page.getByRole("heading", { name: "Infrastructure Management" })).toBeVisible();

    await page.getByRole("button", { name: "New Server" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByText("Add Infrastructure")).toBeVisible();

    await createDialog.getByPlaceholder("prod-web-01").fill(name);

    await createDialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "VPS", exact: true }).click();

    await createDialog.getByRole("button", { name: "Add Server" }).click();
    await expect(createDialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByText("Edit Server")).toBeVisible();

    await editDialog.getByPlaceholder("prod-web-01").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();

    const updatedRow = page.getByRole("row", { name: new RegExp(updatedName) });
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: new RegExp(updatedName) })).toBeHidden();
  });
});
