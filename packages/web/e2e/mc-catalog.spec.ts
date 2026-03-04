import { test, expect } from "@playwright/test";
import { MC_PIN, getTodayEventId } from "./fixtures/test-data";
import { TestWebSocketClient } from "./helpers/websocket";

test.describe.serial("MC Dashboard - Catalog Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/mc");

    // Authenticate through the PIN gate
    const pinInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');
    await pinInput.fill(MC_PIN);
    await submitBtn.click();

    // Wait for the dashboard to load
    await expect(page.getByText("MC Dashboard")).toBeVisible();

    // Navigate to the Catalogo tab
    await page.locator('nav button:has-text("Catalogo")').click();

    // Wait for the catalog content to appear
    await expect(page.getByText(/^Catalogo \(\d+\)$/)).toBeVisible();
  });

  test.afterAll(async () => {
    const ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();
    ws.send({ type: "mc_auth", payload: { pin: "1234" } });
    ws.send({ type: "end_event" });
    await ws.waitForMessage("event_ended", 5000);
    ws.close();
  });

  test("shows default catalog with 40 songs", async ({ page }) => {
    await expect(page.getByText("Catalogo (40)")).toBeVisible();
  });

  test('search filter works: type "Miles" filters to Miles Davis songs', async ({
    page,
  }) => {
    const searchInput = page.locator('input[placeholder="Buscar..."]');
    await searchInput.fill("Miles");

    // Wait for the filtered list to update
    await expect(page.getByText(/^Catalogo \(\d+\)$/)).toBeVisible();

    // All visible songs should be by Miles Davis
    const songItems = page.locator(
      'main .flex.max-h-\\[50vh\\] > div',
    );
    const count = await songItems.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(songItems.nth(i)).toContainText("Miles Davis");
    }
  });

  test('genre filter works: select "funk" shows only funk songs', async ({
    page,
  }) => {
    const genreSelect = page.locator("select").first();
    await genreSelect.selectOption("funk");

    // Wait for the filter to apply
    await expect(page.getByText(/^Catalogo \(\d+\)$/)).toBeVisible();

    // All visible songs should have the funk genre
    const songItems = page.locator(
      'main .flex.max-h-\\[50vh\\] > div',
    );
    const count = await songItems.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(songItems.nth(i)).toContainText("funk");
    }
  });

  test('combined filters: search "Monk" + genre "blues" shows intersection', async ({
    page,
  }) => {
    const searchInput = page.locator('input[placeholder="Buscar..."]');
    const genreSelect = page.locator("select").first();

    await searchInput.fill("Monk");
    await genreSelect.selectOption("blues");

    // Should show "Straight No Chaser" by Thelonious Monk (which is blues)
    await expect(page.getByText("Straight No Chaser")).toBeVisible();
    await expect(page.getByText("Thelonious Monk")).toBeVisible();
  });

  test('add song button opens modal with empty inputs and title "Agregar cancion"', async ({
    page,
  }) => {
    await page.locator('button:has-text("+ Agregar")').click();

    // Modal should be visible with the correct title
    await expect(page.getByText("Agregar cancion")).toBeVisible();

    // Inputs should be empty
    const titleInput = page.locator('input[placeholder="Titulo *"]');
    const artistInput = page.locator('input[placeholder="Artista *"]');
    const youtubeInput = page.locator(
      'input[placeholder="Link YouTube (opcional)"]',
    );

    await expect(titleInput).toHaveValue("");
    await expect(artistInput).toHaveValue("");
    await expect(youtubeInput).toHaveValue("");

    // Cancel and Agregar buttons should be present
    await expect(page.locator('button:has-text("Cancelar")')).toBeVisible();
    await expect(
      page.locator('form button[type="submit"]:has-text("Agregar")'),
    ).toBeVisible();
  });

  test("adding a song creates new entry in catalog", async ({ page }) => {
    // Record initial count
    const catalogHeading = page.getByText(/^Catalogo \(\d+\)$/);
    const initialText = await catalogHeading.textContent();
    const initialCount = parseInt(initialText!.match(/\((\d+)\)/)![1], 10);

    // Open add modal
    await page.locator('button:has-text("+ Agregar")').click();
    await expect(page.getByText("Agregar cancion")).toBeVisible();

    // Fill in the form
    await page.locator('input[placeholder="Titulo *"]').fill("Test Song");
    await page.locator('input[placeholder="Artista *"]').fill("Test Artist");
    await page.locator("form select").selectOption("jazz");

    // Submit the form
    await page
      .locator('form button[type="submit"]:has-text("Agregar")')
      .click();

    // Modal should close
    await expect(page.getByText("Agregar cancion")).not.toBeVisible();

    // New song should appear in the list
    await expect(page.getByText("Test Song")).toBeVisible();
    await expect(page.getByText("Test Artist")).toBeVisible();

    // Count should increase by 1
    await expect(
      page.getByText(`Catalogo (${initialCount + 1})`),
    ).toBeVisible();
  });

  test("YouTube thumbnail shows when valid URL entered in modal", async ({
    page,
  }) => {
    await page.locator('button:has-text("+ Agregar")').click();
    await expect(page.getByText("Agregar cancion")).toBeVisible();

    // Thumbnail should not be visible initially
    await expect(
      page.locator('img[alt="YouTube preview"]'),
    ).not.toBeVisible();

    // Enter a valid YouTube URL
    await page
      .locator('input[placeholder="Link YouTube (opcional)"]')
      .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    // Thumbnail preview should appear
    await expect(page.locator('img[alt="YouTube preview"]')).toBeVisible();

    // Close modal without saving
    await page.locator('button:has-text("Cancelar")').click();
  });

  test("cancel modal does not create song", async ({ page }) => {
    // Record initial count
    const catalogHeading = page.getByText(/^Catalogo \(\d+\)$/);
    const initialText = await catalogHeading.textContent();
    const initialCount = parseInt(initialText!.match(/\((\d+)\)/)![1], 10);

    // Open add modal
    await page.locator('button:has-text("+ Agregar")').click();
    await expect(page.getByText("Agregar cancion")).toBeVisible();

    // Type something in the inputs
    await page
      .locator('input[placeholder="Titulo *"]')
      .fill("Should Not Exist");
    await page
      .locator('input[placeholder="Artista *"]')
      .fill("Ghost Artist");

    // Cancel the modal
    await page.locator('button:has-text("Cancelar")').click();

    // Modal should close
    await expect(page.getByText("Agregar cancion")).not.toBeVisible();

    // Count should remain unchanged
    await expect(
      page.getByText(`Catalogo (${initialCount})`),
    ).toBeVisible();

    // The song should not appear in the list
    await expect(page.getByText("Should Not Exist")).not.toBeVisible();
  });

  test("edit opens modal with pre-filled data", async ({ page }) => {
    // Click "Editar" on the first song in the list
    const firstEditBtn = page.locator('button:has-text("Editar")').first();
    await firstEditBtn.click();

    // Modal should show with edit title
    await expect(page.getByText("Editar cancion")).toBeVisible();

    // Inputs should be pre-filled (not empty)
    const titleInput = page.locator('input[placeholder="Titulo *"]');
    const artistInput = page.locator('input[placeholder="Artista *"]');

    const titleValue = await titleInput.inputValue();
    const artistValue = await artistInput.inputValue();

    expect(titleValue.length).toBeGreaterThan(0);
    expect(artistValue.length).toBeGreaterThan(0);

    // Save button should say "Guardar" (not "Agregar")
    await expect(
      page.locator('form button[type="submit"]:has-text("Guardar")'),
    ).toBeVisible();

    // Close the modal
    await page.locator('button:has-text("Cancelar")').click();
  });

  test("edit updates the entry in the list", async ({ page }) => {
    // Click "Editar" on the first song
    const firstEditBtn = page.locator('button:has-text("Editar")').first();
    await firstEditBtn.click();

    await expect(page.getByText("Editar cancion")).toBeVisible();

    // Clear and change the title
    const titleInput = page.locator('input[placeholder="Titulo *"]');
    await titleInput.clear();
    await titleInput.fill("Edited Song Title");

    // Save the changes
    await page
      .locator('form button[type="submit"]:has-text("Guardar")')
      .click();

    // Modal should close
    await expect(page.getByText("Editar cancion")).not.toBeVisible();

    // Updated title should appear in the list
    await expect(page.getByText("Edited Song Title")).toBeVisible();
  });

  test("remove deletes a song and counter decreases", async ({ page }) => {
    // Record initial count
    const catalogHeading = page.getByText(/^Catalogo \(\d+\)$/);
    const initialText = await catalogHeading.textContent();
    const initialCount = parseInt(initialText!.match(/\((\d+)\)/)![1], 10);

    // Get the title of the first song for verification
    const firstSongTitle = page
      .locator('main .flex.max-h-\\[50vh\\] > div')
      .first()
      .locator("p.truncate");
    const songTitleText = await firstSongTitle.textContent();

    // Click the remove button on the first song
    const firstRemoveBtn = page
      .locator('main .flex.max-h-\\[50vh\\] > div')
      .first()
      .locator('button:has-text("\\2717")');
    await firstRemoveBtn.click();

    // Counter should decrease by 1
    await expect(
      page.getByText(`Catalogo (${initialCount - 1})`),
    ).toBeVisible();

    // The removed song should no longer be visible (if it was unique)
    if (songTitleText) {
      // Clean up the text (remove any trailing icons like the YouTube play button)
      const cleanTitle = songTitleText.replace(/\s*▶\s*$/, "").trim();
      // Wait a moment to ensure state has settled
      await expect(
        page.getByText(cleanTitle, { exact: true }),
      ).not.toBeVisible();
    }
  });
});
