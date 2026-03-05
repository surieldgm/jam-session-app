import { test, expect } from "@playwright/test";
import { getTodayEventId, STORAGE_KEY } from "./fixtures/test-data";
import { TestWebSocketClient } from "./helpers/websocket";

const BASE_URL = "http://localhost:3000";

test.describe.serial("Participant Registration Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to participant page and wait for WebSocket full_state
    await page.goto(`${BASE_URL}/participant`);
    await page.waitForTimeout(1500); // Wait for WebSocket full_state
  });

  test.afterAll(async () => {
    const ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();
    ws.send({ type: "mc_auth", payload: { pin: "1234" } });
    ws.send({ type: "end_event" });
    await ws.waitForMessage("event_ended", 5000);
    ws.close();
  });

  test("1 - shows step 1 with grid of 6 instrument buttons, alias input, and progress bar", async ({
    page,
  }) => {
    // Verify all 6 instrument buttons are visible
    const instruments = [
      "Bateria",
      "Bajo",
      "Teclado",
      "Guitarra",
      "Voz",
      "Vientos",
    ];
    for (const label of instruments) {
      await expect(
        page.locator(`button:has-text("${label}")`)
      ).toBeVisible();
    }

    // Verify exactly 6 instrument buttons in the grid
    const grid = page.locator(".grid.grid-cols-2");
    await expect(grid).toBeVisible();
    const buttons = grid.locator("button");
    await expect(buttons).toHaveCount(6);

    // Verify alias input
    const aliasInput = page.locator('input[placeholder="Ej: Santi, El Baterista..."]');
    await expect(aliasInput).toBeVisible();

    // Verify progress bar with 3 segments
    const progressSegments = page.locator(
      ".flex.w-full.max-w-sm .rounded-full"
    );
    await expect(progressSegments).toHaveCount(3);
  });

  test("2 - Siguiente button is disabled when no instrument or alias selected", async ({
    page,
  }) => {
    const nextButton = page.locator('button:has-text("Siguiente")');
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeDisabled();

    // Only alias filled - still disabled
    await page.fill('input[placeholder="Ej: Santi, El Baterista..."]', "TestUser");
    await expect(nextButton).toBeDisabled();

    // Clear alias, only instrument selected - still disabled
    await page.fill('input[placeholder="Ej: Santi, El Baterista..."]', "");
    await page.click('button:has-text("Bateria")');
    await expect(nextButton).toBeDisabled();
  });

  test("3 - selecting an instrument highlights it with amber border", async ({
    page,
  }) => {
    const bateriaBtn = page.locator('button:has-text("Bateria")');
    await bateriaBtn.click();

    // The selected button should have amber border class
    await expect(bateriaBtn).toHaveClass(/border-\(--color-amber\)/);
    await expect(bateriaBtn).toHaveClass(/bg-\(--color-amber\)/);

    // Other buttons should NOT have the amber border class
    const bajoBtn = page.locator('button:has-text("Bajo")');
    await expect(bajoBtn).not.toHaveClass(/border-\(--color-amber\)/);

    // Clicking a different instrument switches the highlight
    await bajoBtn.click();
    await expect(bajoBtn).toHaveClass(/border-\(--color-amber\)/);
    await expect(bateriaBtn).not.toHaveClass(/border-\(--color-amber\)/);
  });

  test("4 - entering alias and selecting instrument enables Siguiente", async ({
    page,
  }) => {
    const nextButton = page.locator('button:has-text("Siguiente")');

    // Select instrument
    await page.click('button:has-text("Guitarra")');

    // Enter alias
    await page.fill('input[placeholder="Ej: Santi, El Baterista..."]', "TestGuitarist");

    // Button should be enabled
    await expect(nextButton).toBeEnabled();
  });

  test("5 - step 2 shows the catalog from the server", async ({ page }) => {
    // Complete step 1
    await page.click('button:has-text("Bateria")');
    await page.fill('input[placeholder="Ej: Santi, El Baterista..."]', "TestDrummer");
    await page.click('button:has-text("Siguiente")');

    // Wait for step 2 heading
    await expect(page.getByText("Elige tus canciones")).toBeVisible();

    // Verify search input
    await expect(
      page.locator('input[placeholder="Buscar cancion..."]')
    ).toBeVisible();

    // The catalog should have loaded via WebSocket full_state.
    // At minimum "Watermelon Man" and "Cantaloupe Island" should be present.
    await expect(
      page.locator('button:has-text("Watermelon Man")')
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('button:has-text("Cantaloupe Island")')
    ).toBeVisible();

    // There should be multiple song buttons
    const songButtons = page.locator(
      ".flex.max-h-64.flex-col button"
    );
    const count = await songButtons.count();
    expect(count).toBeGreaterThan(10);
  });

  test('6 - search filters the catalog (type "Watermelon" shows only "Watermelon Man")', async ({
    page,
  }) => {
    // Complete step 1
    await page.click('button:has-text("Bajo")');
    await page.fill('input[placeholder="Ej: Santi, El Baterista..."]', "TestBassist");
    await page.click('button:has-text("Siguiente")');

    // Wait for step 2
    await expect(page.getByText("Elige tus canciones")).toBeVisible();
    await expect(
      page.locator('button:has-text("Watermelon Man")')
    ).toBeVisible({ timeout: 10000 });

    // Type search query
    await page.fill('input[placeholder="Buscar cancion..."]', "Watermelon");

    // Only "Watermelon Man" should be visible
    await expect(
      page.locator('button:has-text("Watermelon Man")')
    ).toBeVisible();

    // Other songs should not be visible
    await expect(
      page.locator('button:has-text("Cantaloupe Island")')
    ).not.toBeVisible();
    await expect(
      page.locator('button:has-text("Blue Monk")')
    ).not.toBeVisible();

    // The song list should have exactly 1 item
    const songButtons = page.locator(
      ".flex.max-h-64.flex-col button"
    );
    await expect(songButtons).toHaveCount(1);
  });

  test("7 - toggling songs updates the selected counter", async ({
    page,
  }) => {
    // Complete step 1
    await page.click('button:has-text("Teclado")');
    await page.fill('input[placeholder="Ej: Santi, El Baterista..."]', "TestPianist");
    await page.click('button:has-text("Siguiente")');

    // Wait for catalog to load
    await expect(page.getByText("Elige tus canciones")).toBeVisible();
    await expect(
      page.locator('button:has-text("Watermelon Man")')
    ).toBeVisible({ timeout: 10000 });

    // Initially 0 selected
    await expect(page.getByText("0/3 seleccionadas")).toBeVisible();

    // Click 3 songs
    await page.locator('button:has-text("Watermelon Man")').click();
    await expect(page.getByText("1/3 seleccionada")).toBeVisible();

    await page.locator('button:has-text("Cantaloupe Island")').click();
    await expect(page.getByText("2/3 seleccionadas")).toBeVisible();

    await page.locator('button:has-text("Take Five")').click();
    await expect(page.getByText("3/3 seleccionadas")).toBeVisible();

    // At 3/3, a 4th song should be disabled and not selectable
    const blueMonkBtn = page.locator('button:has-text("Blue Monk")');
    await expect(blueMonkBtn).toBeDisabled();
    await blueMonkBtn.click({ force: true }); // force click the disabled button
    await expect(page.getByText("3/3 seleccionadas")).toBeVisible(); // still 3

    // Deselecting one decreases the count
    await page.locator('button:has-text("Take Five")').click();
    await expect(page.getByText("2/3 seleccionadas")).toBeVisible();

    // After deselecting, Blue Monk should be enabled again
    await expect(blueMonkBtn).toBeEnabled();
  });

  test("8 - Atras button preserves instrument and alias state", async ({
    page,
  }) => {
    // Complete step 1
    await page.click('button:has-text("Guitarra")');
    await page.fill(
      'input[placeholder="Ej: Santi, El Baterista..."]',
      "PreservedAlias"
    );
    await page.click('button:has-text("Siguiente")');

    // We're on step 2
    await expect(page.getByText("Elige tus canciones")).toBeVisible();

    // Click back
    await page.click('button:has-text("Atras")');

    // Verify alias is preserved
    const aliasInput = page.locator('input[placeholder="Ej: Santi, El Baterista..."]');
    await expect(aliasInput).toHaveValue("PreservedAlias");

    // Verify instrument is still selected (Guitarra should have amber border)
    const guitarraBtn = page.locator('button:has-text("Guitarra")');
    await expect(guitarraBtn).toHaveClass(/border-\(--color-amber\)/);

    // Siguiente should still be enabled
    const nextButton = page.locator('button:has-text("Siguiente")');
    await expect(nextButton).toBeEnabled();
  });

  test("9 - step 3 shows correct summary with alias, instrument, and song count", async ({
    page,
  }) => {
    // Complete step 1
    await page.click('button:has-text("Voz")');
    await page.fill('input[placeholder="Ej: Santi, El Baterista..."]', "SingerAlias");
    await page.click('button:has-text("Siguiente")');

    // Step 2: select 2 songs
    await expect(
      page.locator('button:has-text("Watermelon Man")')
    ).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Watermelon Man")').click();
    await page.locator('button:has-text("So What")').click();
    await expect(page.getByText("2/3 seleccionadas")).toBeVisible();

    // Go to step 3
    await page.locator('button:has-text("Siguiente")').last().click();

    // Verify confirmation heading
    await expect(page.getByText("Confirmar registro")).toBeVisible();

    // Verify alias is shown
    await expect(page.getByText("SingerAlias")).toBeVisible();

    // Verify instrument label is shown
    await expect(page.getByText("Voz")).toBeVisible();

    // Verify song count
    await expect(page.getByText("2 canciones seleccionadas")).toBeVisible();

    // Verify Registrarme button is present
    await expect(
      page.locator('button:has-text("Registrarme")')
    ).toBeVisible();

    // Verify "Volver a editar" link is present
    await expect(
      page.locator('button:has-text("Volver a editar")')
    ).toBeVisible();
  });

  test('10 - Registrarme shows the waiting screen with "Estas dentro" and queue position', async ({
    page,
  }) => {
    // Complete full registration flow
    await page.click('button:has-text("Bateria")');
    await page.fill('input[placeholder="Ej: Santi, El Baterista..."]', "DrummerQueue");
    await page.click('button:has-text("Siguiente")');

    // Step 2: select a song
    await expect(
      page.locator('button:has-text("Watermelon Man")')
    ).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Watermelon Man")').click();

    // Go to step 3
    await page.locator('button:has-text("Siguiente")').last().click();
    await expect(page.getByText("Confirmar registro")).toBeVisible();

    // Click register
    await page.click('button:has-text("Registrarme")');

    // Verify waiting screen
    await expect(
      page.getByText("Estas dentro, DrummerQueue!")
    ).toBeVisible({ timeout: 10000 });

    // Verify queue position text
    await expect(
      page.getByText("Tu posicion en la cola")
    ).toBeVisible();

    // Verify the position shows a number prefixed with #
    await expect(page.locator("text=/#\\d+/")).toBeVisible();

    // Verify spinner is present (animate-spin element)
    await expect(page.locator(".animate-spin")).toBeVisible();

    // Progress bar should no longer be visible
    await expect(
      page.locator(".flex.w-full.max-w-sm .rounded-full").first()
    ).not.toBeVisible();
  });

  test("11 - identity is saved in localStorage after registration", async ({
    page,
  }) => {
    // Complete full registration flow
    await page.click('button:has-text("Vientos")');
    await page.fill(
      'input[placeholder="Ej: Santi, El Baterista..."]',
      "WindPlayerStorage"
    );
    await page.click('button:has-text("Siguiente")');

    // Step 2: select songs
    await expect(
      page.locator('button:has-text("Watermelon Man")')
    ).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Chameleon")').click();

    // Go to step 3
    await page.locator('button:has-text("Siguiente")').last().click();
    await expect(page.getByText("Confirmar registro")).toBeVisible();

    // Click register
    await page.click('button:has-text("Registrarme")');

    // Wait for the waiting screen
    await expect(
      page.getByText("Estas dentro, WindPlayerStorage!")
    ).toBeVisible({ timeout: 10000 });

    // Check localStorage
    const identity = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);

    expect(identity).not.toBeNull();
    expect(identity.alias).toBe("WindPlayerStorage");
    expect(identity.instrument).toBe("winds");
    expect(identity.role).toBe("participant");
    expect(identity.eventId).toBe(getTodayEventId());
    expect(identity.musicianId).toBeTruthy();
  });
});
