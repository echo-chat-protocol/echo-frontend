import { test, expect } from "@playwright/test";

import { ensureUnlocked, login, register, uniqueUser } from "./helpers";

test("register -> login -> dashboard loads", async ({ page }) => {
  const username = uniqueUser("pwUser");
  const password = "Testpass1!";

  await register(page, username, password);
  await login(page, username, password);
  await ensureUnlocked(page, password);

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId("nav-friends")).toBeVisible();
});
