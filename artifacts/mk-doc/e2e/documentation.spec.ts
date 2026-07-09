import { test, expect } from "@playwright/test";
import { uniqueSuffix, findRowAcrossPages } from "./helpers";

test.describe("Documentation - delete flow", () => {
  test("creates a new document via API and deletes it via UI", async ({ page }) => {
    const suffix = uniqueSuffix();
    const title = `E2E Doc ${suffix}`;
    const updatedTitle = `E2E Doc ${suffix} Updated`;

    const resp = await page.request.post("/api/documentation", {
      data: { title, type: "Guide" },
    });
    expect(resp.ok()).toBeTruthy();

    await page.goto("/documentation");
    await expect(page.getByRole("heading", { name: "Documentation Center" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

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
