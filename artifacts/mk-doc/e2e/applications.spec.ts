import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

test.describe("Applications - create and edit", () => {
  test("creates a new application and then edits it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `E2E App ${suffix}`;
    const updatedName = `E2E App ${suffix} Updated`;

    await page.goto("/applications");
    await expect(page.getByRole("heading", { name: "Application Registry" })).toBeVisible();

    await page.getByRole("button", { name: "New Application" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByText("Register New Application")).toBeVisible();

    await createDialog.getByPlaceholder("MK Citizen Portal").fill(name);

    await createDialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "web", exact: true }).click();

    await createDialog.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Web Application", exact: true }).click();

    await createDialog.getByRole("combobox").nth(2).click();
    await page.getByRole("option", { name: "Production", exact: true }).click();

    await createDialog.getByRole("button", { name: "Register Application" }).click();
    await expect(createDialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByText("Edit Application")).toBeVisible();

    await editDialog.getByPlaceholder("MK Citizen Portal").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();

    const updatedRow = page.getByRole("row", { name: new RegExp(updatedName) });
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: new RegExp(updatedName) })).toBeHidden();
  });
});
