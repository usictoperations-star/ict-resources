import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./helpers";

test.describe("Releases - create, edit, and delete", () => {
  test("creates a new release via form, edits and deletes it", async ({ page }) => {
    const suffix = uniqueSuffix();
    const version = `0.0.${suffix}`;
    const updatedVersion = `0.0.${suffix}-p`;

    const appResp = await page.request.post("/api/applications", {
      data: {
        name: `E2E App ${suffix}`,
        type: "web",
        category: "Web Application",
        classification: "Internal",
        environment: "Development",
        status: "Development",
        priority: "low",
        criticality: "low",
      },
    });
    expect(appResp.ok()).toBeTruthy();
    const app = await appResp.json();
    const appId = String(app.id);

    try {
      await page.goto("/releases");
      await expect(page.getByRole("heading", { name: "Release Management" })).toBeVisible();

      await page.getByRole("button", { name: "New Release" }).click();
      const createDialog = page.getByRole("dialog");
      await expect(createDialog.getByRole("heading", { name: "Log New Release" })).toBeVisible();

      await createDialog.getByPlaceholder("1", { exact: true }).fill(appId);
      await createDialog.getByPlaceholder("1.2.0").fill(version);

      await createDialog.getByRole("combobox").nth(0).click();
      await page.getByRole("option", { name: "Production", exact: true }).click();

      await createDialog.getByRole("button", { name: "Log Release" }).click();
      await expect(createDialog).toBeHidden();

      const row = page.getByRole("row", { name: new RegExp(version) });
      await expect(row).toBeVisible();

      await row.getByRole("button").first().click();
      const editDialog = page.getByRole("dialog");
      await expect(editDialog.getByRole("heading", { name: "Edit Release" })).toBeVisible();

      await editDialog.getByPlaceholder("1.2.0").fill(updatedVersion);
      await editDialog.getByRole("button", { name: "Save Changes" }).click();
      await expect(editDialog).toBeHidden();

      const updatedRow = page.getByRole("row", { name: new RegExp(updatedVersion) });
      await expect(updatedRow).toBeVisible();

      await updatedRow.getByRole("button").last().click();
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("row", { name: new RegExp(updatedVersion) })).toBeHidden();
    } finally {
      await page.request.delete(`/api/applications/${appId}`);
    }
  });
});
