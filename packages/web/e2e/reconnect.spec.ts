import { test, expect } from "@playwright/test";
import { getTodayEventId, STORAGE_KEY, MC_PIN } from "./fixtures/test-data";
import { TestWebSocketClient } from "./helpers/websocket";

test.describe.serial("Reconnect and session persistence", () => {
  let registeredAlias: string;
  let registeredMusicianId: string;

  test("identity persists after page reload for a registered participant", async ({
    page,
  }) => {
    registeredAlias = "E2E Drummer";

    // Go to participant registration
    await page.goto("/participant");

    // Step 1: Select instrument (Bateria = drums)
    await page.getByText("Bateria").click();

    // Enter alias
    await page.fill('input[placeholder="Ej: Santi, El Baterista..."]', registeredAlias);

    // Click Siguiente to go to step 2 (song selection)
    await page.getByText("Siguiente").click();

    // Step 2: Song selector - click Siguiente to skip to confirmation
    await page.getByText("Siguiente").click();

    // Step 3: Confirmation - click Registrarme
    await page.getByText("Registrarme").click();

    // Should see the success screen
    await expect(
      page.getByText(`Estas dentro, ${registeredAlias}!`),
    ).toBeVisible();

    // Grab the musicianId from localStorage for later tests
    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);

    expect(stored).not.toBeNull();
    expect(stored.alias).toBe(registeredAlias);
    expect(stored.role).toBe("participant");
    expect(stored.instrument).toBe("drums");
    registeredMusicianId = stored.musicianId;

    // Reload and go to welcome
    await page.goto("/");

    // Should show returning user UI
    await expect(page.getByText("Reconectar")).toBeVisible();
    await expect(page.getByText(registeredAlias)).toBeVisible();
  });

  test("reconnect button navigates to the correct route", async ({ page }) => {
    const eventId = getTodayEventId();

    // Seed localStorage with a known participant identity
    await page.goto("/");
    await page.evaluate(
      ({ key, identity }) => {
        localStorage.setItem(key, JSON.stringify(identity));
      },
      {
        key: STORAGE_KEY,
        identity: {
          eventId,
          musicianId: "reconnect-test-id-001",
          alias: "ReconnectUser",
          instrument: "guitar",
          role: "participant" as const,
        },
      },
    );

    await page.reload();

    await expect(page.getByText("Reconectar")).toBeVisible();
    await page.getByText("Reconectar").click();

    // Should navigate to /participant based on role
    await expect(page).toHaveURL(/\/participant$/);
  });

  test("identity_not_found is handled gracefully with a fabricated musicianId", async ({
    page,
  }) => {
    const eventId = getTodayEventId();

    // Seed with a musicianId that does not exist on the server
    await page.goto("/");
    await page.evaluate(
      ({ key, identity }) => {
        localStorage.setItem(key, JSON.stringify(identity));
      },
      {
        key: STORAGE_KEY,
        identity: {
          eventId,
          musicianId: "fabricated-nonexistent-id-999",
          alias: "FakeUser",
          instrument: "winds",
          role: "participant" as const,
        },
      },
    );

    // Navigate to /participant directly (simulating reconnect destination)
    await page.goto("/participant");

    // Should show the registration form (step 1 with instrument picker)
    // The instrument picker heading indicates we are on step 1
    await expect(page.getByText("instrumento")).toBeVisible();
    await expect(page.getByText("Bateria")).toBeVisible();
  });

  test("MC identity persists and reconnect navigates to /mc", async ({
    page,
  }) => {
    // Go to MC page and authenticate
    await page.goto("/mc");

    // Should see the PIN gate
    await expect(page.getByText("Acceso MC")).toBeVisible();

    // Fill in the PIN
    await page.fill('input[type="password"]', MC_PIN);

    // Submit
    await page.click('button[type="submit"]');

    // Should see MC Dashboard after authentication
    await expect(page.getByText("MC Dashboard")).toBeVisible();

    // Verify identity was saved
    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);

    expect(stored).not.toBeNull();
    expect(stored.role).toBe("mc");

    // Navigate back to welcome
    await page.goto("/");

    // Should show returning user UI with Reconectar
    await expect(page.getByText("Reconectar")).toBeVisible();

    // Click Reconectar
    await page.getByText("Reconectar").click();

    // Should navigate to /mc
    await expect(page).toHaveURL(/\/mc$/);
  });

  test("identity from a different day is ignored", async ({ page }) => {
    // Compute yesterday's date for an old eventId
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const oldEventId = `jam-${yesterday.toISOString().split("T")[0]}`;

    await page.goto("/");
    await page.evaluate(
      ({ key, identity }) => {
        localStorage.setItem(key, JSON.stringify(identity));
      },
      {
        key: STORAGE_KEY,
        identity: {
          eventId: oldEventId,
          musicianId: "yesterday-musician-001",
          alias: "YesterdayUser",
          instrument: "keys",
          role: "participant" as const,
        },
      },
    );

    await page.reload();

    // Should show new user UI (buttons), not returning user UI
    await expect(page.getByText("Vengo a escuchar")).toBeVisible();
    await expect(page.getByText("Vengo a tocar")).toBeVisible();
    await expect(page.getByText("Reconectar")).not.toBeVisible();
  });

  test.afterAll(async () => {
    // Clean up: send end_event to reset the PartyKit room state
    const eventId = getTodayEventId();
    const ws = new TestWebSocketClient(eventId);
    await ws.waitForOpen();
    ws.send({ type: "end_event" });
    // Give the server a moment to process
    await new Promise((resolve) => setTimeout(resolve, 1000));
    ws.close();
  });
});
