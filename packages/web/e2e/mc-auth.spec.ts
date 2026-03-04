import { test, expect } from "@playwright/test";
import { MC_PIN } from "./fixtures/test-data";

test.describe.serial("MC Dashboard - PIN Authentication", () => {
  test("shows PIN gate with heading, input, and submit button", async ({
    page,
  }) => {
    await page.goto("/mc");

    // Verify the PIN gate UI elements
    await expect(page.getByText("Acceso MC")).toBeVisible();
    await expect(
      page.getByText("Ingresa el PIN del evento"),
    ).toBeVisible();

    const pinInput = page.locator('input[type="password"]');
    await expect(pinInput).toBeVisible();
    await expect(pinInput).toHaveAttribute("inputMode", "numeric");
    await expect(pinInput).toHaveAttribute("maxLength", "6");
    await expect(pinInput).toHaveAttribute("placeholder", "PIN");

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toHaveText("Entrar");
  });

  test("rejects short PIN (< 4 digits) and shows error", async ({ page }) => {
    await page.goto("/mc");

    const pinInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    // Type a short PIN (less than 4 characters)
    await pinInput.fill("12");
    await submitBtn.click();

    // Error message should appear
    await expect(page.getByText("PIN invalido")).toBeVisible();
  });

  test("correct PIN (1234) shows dashboard with MC Dashboard visible", async ({
    page,
  }) => {
    await page.goto("/mc");

    const pinInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await pinInput.fill(MC_PIN);
    await submitBtn.click();

    // Dashboard should be visible after successful auth
    await expect(page.getByText("MC Dashboard")).toBeVisible();
  });

  test("PIN input only accepts numbers (letters are stripped)", async ({
    page,
  }) => {
    await page.goto("/mc");

    const pinInput = page.locator('input[type="password"]');

    // Type a mix of letters and numbers
    await pinInput.pressSequentially("a1b2c3");

    // Only the digits should remain in the input value
    await expect(pinInput).toHaveValue("123");
  });

  test("after auth, 5 tabs are visible: En Vivo, Cola, Setlist, Catalogo, Exportar", async ({
    page,
  }) => {
    await page.goto("/mc");

    // Authenticate first
    const pinInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');
    await pinInput.fill(MC_PIN);
    await submitBtn.click();

    await expect(page.getByText("MC Dashboard")).toBeVisible();

    // Verify all 5 tabs are visible in the nav
    const tabs = ["En Vivo", "Cola", "Setlist", "Catalogo", "Exportar"];
    for (const tabLabel of tabs) {
      await expect(
        page.locator(`nav button:has-text("${tabLabel}")`),
      ).toBeVisible();
    }

    // Verify exactly 5 tab buttons exist in the nav
    const tabButtons = page.locator("nav button");
    await expect(tabButtons).toHaveCount(5);
  });

  test('default tab "En Vivo" is active and shows "Ningun bloque activo"', async ({
    page,
  }) => {
    await page.goto("/mc");

    // Authenticate
    const pinInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');
    await pinInput.fill(MC_PIN);
    await submitBtn.click();

    await expect(page.getByText("MC Dashboard")).toBeVisible();

    // "En Vivo" tab should have the active/selected styling (amber border)
    const enVivoTab = page.locator('nav button:has-text("En Vivo")');
    await expect(enVivoTab).toBeVisible();
    await expect(enVivoTab).toHaveClass(/border-\(--color-amber\)/);

    // The live tab content should show the empty state
    await expect(page.getByText("Ningun bloque activo")).toBeVisible();
  });
});
