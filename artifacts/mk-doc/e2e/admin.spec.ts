import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

test.describe("Admin Users - delete flow", () => {
  test("creates a new user and then deletes it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `E2E User ${suffix}`;
    const updatedName = `E2E User ${suffix} Updated`;
    const email = `e2e-${suffix}@mk.gov`;
    const updatedEmail = `e2e-${suffix}-updated@mk.gov`;

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();

    await page.getByRole("tab", { name: "Users & Roles" }).click();

    await page.getByRole("button", { name: "New User" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByRole("heading", { name: "Add User" })).toBeVisible();

    await createDialog.getByPlaceholder("John Smith").fill(name);
    await createDialog.getByPlaceholder("john.smith@mk.gov").fill(email);

    await createDialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "viewer", exact: true }).click();

    await createDialog.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "active", exact: true }).click();

    await createDialog.getByRole("button", { name: "Add User" }).click();
    await expect(createDialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "Edit User" })).toBeVisible();

    await editDialog.getByPlaceholder("John Smith").fill(updatedName);
    await editDialog.getByPlaceholder("john.smith@mk.gov").fill(updatedEmail);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();

    const updatedRow = page.getByRole("row", { name: new RegExp(updatedName) });
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: new RegExp(updatedName) })).toBeHidden();
  });
});
