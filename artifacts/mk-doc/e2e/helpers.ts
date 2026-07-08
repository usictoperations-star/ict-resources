import { Page, Locator } from "@playwright/test";

export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function selectOption(page: Page, dialog: Locator, triggerIndex: number, optionText: string) {
  const trigger = dialog.getByRole("combobox").nth(triggerIndex);
  await trigger.click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}
