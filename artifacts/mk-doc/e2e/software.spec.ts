import { test, expect } from "@playwright/test";
import { uniqueSuffix, findRowAcrossPages } from "./helpers";

test.describe("Software - delete flow", () => {
  test("creates a new software entry via API and deletes it via UI", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `E2E Lib ${suffix}`;
    const updatedName = `E2E Lib ${suffix} Updated`;

    const resp = await page.request.post("/api/software", {
      data: { name, type: "library" },
    });
    expect(resp.ok()).toBeTruthy();
    const sw = await resp.json();

    await page.goto("/software");
    await expect(page.getByRole("heading", { name: "Software Inventory" })).toBeVisible();

    const row = await findRowAcrossPages(page, new RegExp(name));
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "Edit Software" })).toBeVisible();

    await editDialog.getByPlaceholder("React").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();

    const updatedRow = await findRowAcrossPages(page, new RegExp(updatedName));
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole("button").last().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: new RegExp(updatedName) })).toBeHidden();

    void sw;
  });
});
