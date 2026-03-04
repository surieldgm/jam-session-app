import type { Page } from "@playwright/test";

/**
 * Wait a fixed delay for WebSocket messages to propagate.
 * Prefer waitForText or waitForElement when possible.
 */
export async function waitForSync(
  page: Page,
  timeoutMs = 2000,
): Promise<void> {
  await page.waitForTimeout(timeoutMs);
}

/**
 * Wait for a selector to appear in the DOM.
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeoutMs = 5000,
): Promise<void> {
  await page.waitForSelector(selector, { timeout: timeoutMs });
}

/**
 * Wait for text content to appear on the page.
 */
export async function waitForText(
  page: Page,
  text: string,
  timeoutMs = 5000,
): Promise<void> {
  await page.getByText(text).waitFor({ timeout: timeoutMs });
}

/**
 * Navigate to a page and wait for the WebSocket full_state to arrive.
 * This is useful for pages that depend on WebSocket state (participant, companion, MC).
 */
export async function gotoAndWaitForWs(
  page: Page,
  path: string,
  waitMs = 2000,
): Promise<void> {
  await page.goto(path);
  await page.waitForTimeout(waitMs);
}
