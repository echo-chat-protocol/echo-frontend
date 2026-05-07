import { expect, type Page } from "@playwright/test";

export function uniqueUser(prefix: string) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `${prefix}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, "_");
}

export async function register(page: Page, username: string, password: string) {
  await page.goto("/register");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByRole("alert")).toContainText("Registration successful", { timeout: 60_000 });
  await expect(page).toHaveURL(/\/login$/, { timeout: 60_000 });
}

export async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });

  // After login, remember ELD password for this tab to survive reloads.
  await page.evaluate((pw) => {
    const userId = localStorage.getItem("userId");
    if (userId) sessionStorage.setItem(`eld-pass-${userId}`, pw);
  }, password);
}

export async function ensureUnlocked(page: Page, password: string) {
  const navFriends = page.getByTestId("nav-friends");
  const dashboardSearch = page.getByTestId("dashboard-search");
  const unlockField = page.locator("#eld-password");

  // Gate can appear asynchronously; wait for either the dashboard shell or the unlock form.
  await Promise.race([
    navFriends.waitFor({ state: "visible", timeout: 60_000 }),
    dashboardSearch.waitFor({ state: "visible", timeout: 60_000 }),
    unlockField.waitFor({ state: "visible", timeout: 60_000 }),
  ]);

  if (
    (await navFriends.isVisible().catch(() => false)) ||
    (await dashboardSearch.isVisible().catch(() => false))
  ) {
    return;
  }

  if (await unlockField.isVisible().catch(() => false)) {
    try {
      await unlockField.fill(password, { timeout: 5_000 });
      await page.getByRole("button", { name: /^Unlock$/ }).click();
    } catch (error) {
      const message = String(error);
      if (
        !message.includes("detached") &&
        !message.includes("Timeout") &&
        !message.includes("Target page")
      ) {
        throw error;
      }
    }
  }

  await expect(dashboardSearch).toBeVisible({ timeout: 60_000 });
}

export async function openChatWith(page: Page, friendUsername: string) {
  await page.getByTestId("nav-friends").click();
  await page.getByTestId("dashboard-search").fill(friendUsername);

  const result = page.getByTestId("friend-result").filter({ hasText: friendUsername }).first();
  await expect(result).toBeVisible({ timeout: 60_000 });
  await result.click();

  await expect(page.getByTestId("chat-input")).toBeVisible({ timeout: 60_000 });
}

export async function sendMessage(page: Page, text: string) {
  await page.getByTestId("chat-input").fill(text);
  await page.getByTestId("chat-send").click();
  await expect(page.getByText(text)).toBeVisible({ timeout: 60_000 });
}

export async function expectEventuallyVisibleInChat(opts: {
  page: Page;
  peerUsername: string;
  password: string;
  text: string;
}) {
  const { page, peerUsername, password, text } = opts;
  const locator = page.getByText(text);

  try {
    await locator.first().waitFor({ state: "visible", timeout: 15_000 });
    return;
  } catch {
    // Flake fallback: reload + unlock + re-open chat to force ELD re-hydration.
    await page.reload();
    await ensureUnlocked(page, password);
    await openChatWith(page, peerUsername);
    await expect(locator).toBeVisible({ timeout: 60_000 });
  }
}

export function attachPageDebug(page: Page, label: string) {
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    // eslint-disable-next-line no-console
    if (type === "error" || type === "warning") {
      process.stderr.write(`[${label} console.${type}] ${text}\n`);
    }
  });
  page.on("pageerror", (err) => {
    // eslint-disable-next-line no-console
    process.stderr.write(`[${label} pageerror] ${String(err)}\n`);
  });
}
