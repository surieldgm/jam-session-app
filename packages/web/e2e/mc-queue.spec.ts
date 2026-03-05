import { test, expect } from "@playwright/test";
import { MC_PIN, getTodayEventId } from "./fixtures/test-data";
import { TestWebSocketClient } from "./helpers/websocket";

test.describe.serial("MC Dashboard – Queue management (Cola)", () => {
  let ws: TestWebSocketClient;

  test.beforeAll(async () => {
    // Reset room state
    const reset = new TestWebSocketClient(getTodayEventId());
    await reset.waitForOpen();
    await reset.waitForMessage("full_state", 5000);
    reset.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 2000));
    reset.close();
  });

  /**
   * Helper: authenticate MC and navigate to Cola tab.
   */
  async function setupMcQueue(page: import("@playwright/test").Page) {
    await page.goto("/mc");
    await page.locator('input[type="password"]').fill(MC_PIN);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("MC Dashboard")).toBeVisible({ timeout: 5000 });
    await page.locator('nav button:has-text("Cola")').click();
    await page.waitForTimeout(500);
  }

  /**
   * Helper: register a musician via WebSocket.
   */
  async function registerMusician(
    alias: string,
    instrument: string,
    mcWs?: TestWebSocketClient
  ) {
    const client = new TestWebSocketClient(getTodayEventId());
    await client.waitForOpen();
    await client.waitForMessage("full_state", 5000);
    client.send({
      type: "register",
      payload: { alias, instrument, topSongs: [] },
    });
    if (mcWs) {
      await mcWs.waitForMessage("musician_joined", 5000);
    } else {
      await new Promise((r) => setTimeout(r, 500));
    }
    return client;
  }

  test.afterAll(async () => {
    try {
      ws?.close();
    } catch { /* already closed */ }

    const cleanup = new TestWebSocketClient(getTodayEventId());
    await cleanup.waitForOpen();
    await cleanup.waitForMessage("full_state", 5000);
    cleanup.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 1000));
    cleanup.close();
  });

  test("MC can remove a musician from the waiting queue", async ({ page }) => {
    // Reset state
    const reset = new TestWebSocketClient(getTodayEventId());
    await reset.waitForOpen();
    await reset.waitForMessage("full_state", 5000);
    reset.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 2000));
    reset.close();

    // Setup MC on Cola tab
    await setupMcQueue(page);

    // Register a musician via WebSocket
    ws = new TestWebSocketClient(getTodayEventId());
    await ws.waitForOpen();
    await ws.waitForMessage("full_state", 5000);

    // Authenticate as MC on the WebSocket too (for monitoring)
    ws.send({ type: "mc_auth", payload: { pin: MC_PIN } });
    await ws.waitForMessage("mc_auth_ok", 5000);
    await ws.waitForMessage("full_state", 5000);

    const musician1 = await registerMusician("Remove Me", "drums", ws);

    // Verify the musician appears in the queue
    await expect(page.getByText("Remove Me")).toBeVisible({ timeout: 5000 });

    // Click the remove button (✕) next to the musician
    const musicianRow = page.locator('div:has(> span:has-text("Remove Me"))');
    const removeBtn = musicianRow.locator('button:has-text("✕")');
    await expect(removeBtn).toBeVisible({ timeout: 3000 });
    await removeBtn.click();

    // Verify the musician is removed from the queue
    await expect(page.getByText("Remove Me")).not.toBeVisible({
      timeout: 5000,
    });

    // Verify queue shows empty state or reduced count
    musician1.close();
    ws.close();
  });

  test("MC can emergency-add a musician to the queue", async ({ page }) => {
    // Reset state
    const reset = new TestWebSocketClient(getTodayEventId());
    await reset.waitForOpen();
    await reset.waitForMessage("full_state", 5000);
    reset.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 2000));
    reset.close();

    // Setup MC on Cola tab
    await setupMcQueue(page);

    // Verify queue is empty
    await expect(page.getByText("No hay musicos en espera")).toBeVisible();

    // Click the "+ Emergencia" button
    await page.click('button:has-text("+ Emergencia")');

    // Fill in the emergency add form
    await page.fill('input[placeholder="Nombre o alias"]', "Emergency Player");

    // Select instrument (bass)
    await page.selectOption(
      'div:has(> h4:has-text("Agregar musico de emergencia")) select',
      "bass"
    );

    // Click "Agregar a la cola"
    await page.click('button:has-text("Agregar a la cola")');

    // Verify the musician appears in the queue
    await expect(page.getByText("Emergency Player")).toBeVisible({
      timeout: 5000,
    });

    // The empty state message should no longer be visible
    await expect(
      page.getByText("No hay musicos en espera")
    ).not.toBeVisible();
  });

  test("emergency-added musician appears in queue count", async ({ page }) => {
    // Reset state
    const reset = new TestWebSocketClient(getTodayEventId());
    await reset.waitForOpen();
    await reset.waitForMessage("full_state", 5000);
    reset.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 2000));
    reset.close();

    await setupMcQueue(page);

    // Add 2 musicians via emergency
    for (const name of ["Quick Drummer", "Quick Bassist"]) {
      await page.click('button:has-text("+ Emergencia")');
      await page.fill('input[placeholder="Nombre o alias"]', name);
      if (name === "Quick Bassist") {
        await page.selectOption(
          'div:has(> h4:has-text("Agregar musico de emergencia")) select',
          "bass"
        );
      }
      await page.click('button:has-text("Agregar a la cola")');
      await page.waitForTimeout(500);
    }

    // Verify count shows 2
    await expect(page.getByText("2 musicos en espera")).toBeVisible({
      timeout: 5000,
    });

    // Both musicians should be visible
    await expect(page.getByText("Quick Drummer")).toBeVisible();
    await expect(page.getByText("Quick Bassist")).toBeVisible();
  });

  test("removing a musician updates the count", async ({ page }) => {
    // Reset state
    const reset = new TestWebSocketClient(getTodayEventId());
    await reset.waitForOpen();
    await reset.waitForMessage("full_state", 5000);
    reset.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 2000));
    reset.close();

    await setupMcQueue(page);

    // Add 2 musicians via emergency
    for (const [name, inst] of [
      ["Temp Drummer", "drums"],
      ["Temp Bassist", "bass"],
    ]) {
      await page.click('button:has-text("+ Emergencia")');
      await page.fill('input[placeholder="Nombre o alias"]', name);
      await page.selectOption(
        'div:has(> h4:has-text("Agregar musico de emergencia")) select',
        inst
      );
      await page.click('button:has-text("Agregar a la cola")');
      await page.waitForTimeout(500);
    }

    await expect(page.getByText("2 musicos en espera")).toBeVisible({
      timeout: 5000,
    });

    // Remove Temp Drummer
    const drummerRow = page.locator(
      'div:has(> span:has-text("Temp Drummer"))'
    );
    await drummerRow.locator('button:has-text("✕")').click();

    // Count should update to 1
    await expect(page.getByText("1 musico en espera")).toBeVisible({
      timeout: 5000,
    });

    // Only Temp Bassist should remain
    await expect(page.getByText("Temp Drummer")).not.toBeVisible();
    await expect(page.getByText("Temp Bassist")).toBeVisible();
  });

  test("emergency-added musicians can be used in lineup suggestions", async ({
    page,
  }) => {
    // Reset state
    const reset = new TestWebSocketClient(getTodayEventId());
    await reset.waitForOpen();
    await reset.waitForMessage("full_state", 5000);
    reset.send({ type: "end_event" });
    await new Promise((r) => setTimeout(r, 2000));
    reset.close();

    await setupMcQueue(page);

    // Emergency-add a drummer and bassist (required for suggestions)
    for (const [name, inst] of [
      ["Sug Drummer", "drums"],
      ["Sug Bassist", "bass"],
    ]) {
      await page.click('button:has-text("+ Emergencia")');
      await page.fill('input[placeholder="Nombre o alias"]', name);
      await page.selectOption(
        'div:has(> h4:has-text("Agregar musico de emergencia")) select',
        inst
      );
      await page.click('button:has-text("Agregar a la cola")');
      await page.waitForTimeout(500);
    }

    // Switch to Setlist tab and request suggestions
    await page.locator('nav button:has-text("Setlist")').click();
    await page.waitForTimeout(500);

    await page.click('button:has-text("Sugerir alineacion")');

    // Wait for suggestions to appear
    const confirmBtn = page.locator('button:has-text("Confirmar")').first();
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });

    // At least one of the emergency-added musicians should appear
    const mainContent = await page.locator("main").textContent();
    const hasDrummer = mainContent?.includes("Sug Drummer");
    const hasBassist = mainContent?.includes("Sug Bassist");
    expect(hasDrummer || hasBassist).toBe(true);
  });
});
