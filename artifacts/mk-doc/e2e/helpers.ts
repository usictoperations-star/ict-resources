import { Page, Locator, expect } from "@playwright/test";

export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function selectOption(page: Page, dialog: Locator, triggerIndex: number, optionText: string) {
  const trigger = dialog.getByRole("combobox").nth(triggerIndex);
  await trigger.click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

export async function findRowAcrossPages(page: Page, namePattern: RegExp): Promise<Locator> {
  const row = page.getByRole("row", { name: namePattern });
  for (let i = 0; i < 10; i++) {
    if (await row.count() > 0) return row;
    const nextLink = page.getByRole("link", { name: "Next" });
    if (await nextLink.count() === 0) break;
    const isDisabled = await nextLink.evaluate((el) => el.classList.contains("pointer-events-none"));
    if (isDisabled) break;
    await nextLink.click();
    await page.waitForTimeout(300);
  }
  await expect(row).toBeVisible();
  return row;
}
