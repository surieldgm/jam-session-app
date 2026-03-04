import { test, expect } from "@playwright/test";
import { getTodayEventId, STORAGE_KEY } from "./fixtures/test-data";

test.describe("Welcome page", () => {
  test("shows title JAM SESSION and event ID in jam-YYYY-MM-DD format", async ({
    page,
  }) => {
    await page.goto("/");

    const heading = page.locator("h1");
    await expect(heading).toHaveText("JAM SESSION");

    const eventId = getTodayEventId();
    await expect(page.getByText(eventId)).toBeVisible();

    // Verify event ID format matches jam-YYYY-MM-DD
    expect(eventId).toMatch(/^jam-\d{4}-\d{2}-\d{2}$/);
  });

  test("shows two role buttons for new users", async ({ page }) => {
    await page.goto("/");

    const companionBtn = page.getByText("Vengo a escuchar");
    const participantBtn = page.getByText("Vengo a tocar");

    await expect(companionBtn).toBeVisible();
    await expect(participantBtn).toBeVisible();
  });

  test('navigates to /companion on "Vengo a escuchar" click', async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByText("Vengo a escuchar").click();

    await expect(page).toHaveURL(/\/companion$/);
  });

  test('navigates to /participant on "Vengo a tocar" click', async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByText("Vengo a tocar").click();

    await expect(page).toHaveURL(/\/participant$/);
  });

  test('shows MC access link "Acceso MC" that navigates to /mc', async ({
    page,
  }) => {
    await page.goto("/");

    const mcLink = page.getByText("Acceso MC");
    await expect(mcLink).toBeVisible();

    await mcLink.click();

    await expect(page).toHaveURL(/\/mc$/);
  });

  test("shows reconnect UI when localStorage has saved identity for today", async ({
    page,
  }) => {
    const eventId = getTodayEventId();

    // Seed localStorage before navigating
    await page.goto("/");
    await page.evaluate(
      ({ key, identity }) => {
        localStorage.setItem(key, JSON.stringify(identity));
      },
      {
        key: STORAGE_KEY,
        identity: {
          eventId,
          musicianId: "test-musician-123",
          alias: "Carlos",
          instrument: "drums",
          role: "participant" as const,
        },
      },
    );

    // Reload to pick up the seeded identity
    await page.reload();

    await expect(page.getByText("Hola")).toBeVisible();
    await expect(page.getByText("Carlos")).toBeVisible();
    await expect(page.getByText("Reconectar")).toBeVisible();
    await expect(page.getByText("Entrar como alguien m")).toBeVisible();

    // New user buttons should NOT be visible
    await expect(page.getByText("Vengo a escuchar")).not.toBeVisible();
    await expect(page.getByText("Vengo a tocar")).not.toBeVisible();
  });

  test("reconnect navigates to correct route based on role", async ({
    page,
  }) => {
    const eventId = getTodayEventId();

    await page.goto("/");
    await page.evaluate(
      ({ key, identity }) => {
        localStorage.setItem(key, JSON.stringify(identity));
      },
      {
        key: STORAGE_KEY,
        identity: {
          eventId,
          musicianId: "test-musician-456",
          alias: "Lucia",
          instrument: "bass",
          role: "participant" as const,
        },
      },
    );

    await page.reload();

    await expect(page.getByText("Reconectar")).toBeVisible();
    await page.getByText("Reconectar").click();

    await expect(page).toHaveURL(/\/participant$/);
  });

  test("ignores identity saved for a different eventId", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(
      ({ key, identity }) => {
        localStorage.setItem(key, JSON.stringify(identity));
      },
      {
        key: STORAGE_KEY,
        identity: {
          eventId: "jam-2020-01-01",
          musicianId: "old-musician-789",
          alias: "Ghost",
          instrument: "keys",
          role: "participant" as const,
        },
      },
    );

    await page.reload();

    // Should show new user UI, not returning user UI
    await expect(page.getByText("Vengo a escuchar")).toBeVisible();
    await expect(page.getByText("Vengo a tocar")).toBeVisible();
    await expect(page.getByText("Reconectar")).not.toBeVisible();
  });
});
