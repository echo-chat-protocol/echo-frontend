import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should redirect to login when accessing dashboard unauthenticated', async ({ page }) => {
    console.log('🧪 Test: Dashboard requires authentication');
    console.log('→ Attempting to access /dashboard without login');
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    const currentUrl = page.url();
    
    console.log(`✓ Current URL: ${currentUrl}`);
    expect(currentUrl).not.toContain('/dashboard');
    expect(currentUrl).toContain('login');
  });

  test('should display dashboard header after login', async ({ page }) => {
    console.log('🧪 Test: Dashboard header displays');
    
    const userData = {
      name: `User${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'Test123Pass'
    };

    // Register
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    const nameInput = page.locator('input[type="text"]').first();
    const emailInput = page.locator('input[type="email"]');
    const passwordInputs = await page.locator('input[type="password"]').all();
    
    await nameInput.fill(userData.name);
    await emailInput.fill(userData.email);
    await passwordInputs[0].fill(userData.password);
    await passwordInputs[1].fill(userData.password);
    
    const checkbox = page.locator('input[type="checkbox"]');
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
    }
    
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // Login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    await page.locator('input[type="email"]').fill(userData.email);
    await page.locator('input[type="password"]').fill(userData.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);

    // Verify dashboard
    const header = page.locator('header');
    await expect(header).toBeVisible();
    console.log('✓ Dashboard header visible');
  });

  test('should display sidebar with navigation', async ({ page }) => {
    console.log('🧪 Test: Sidebar navigation');
    
    const userData = {
      name: `User${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'Test123Pass'
    };

    // Register & Login
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    const nameInput = page.locator('input[type="text"]').first();
    const emailInput = page.locator('input[type="email"]');
    const passwordInputs = await page.locator('input[type="password"]').all();
    
    await nameInput.fill(userData.name);
    await emailInput.fill(userData.email);
    await passwordInputs[0].fill(userData.password);
    await passwordInputs[1].fill(userData.password);
    
    const checkbox = page.locator('input[type="checkbox"]');
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
    }
    
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    await page.locator('input[type="email"]').fill(userData.email);
    await page.locator('input[type="password"]').fill(userData.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);

    // Check sidebar
    const sidebar = page.locator('aside, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible();
    console.log('✓ Sidebar visible');
  });

  test('should display main content area', async ({ page }) => {
    console.log('🧪 Test: Main content area');
    
    const userData = {
      name: `User${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'Test123Pass'
    };

    // Register & Login
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    const nameInput = page.locator('input[type="text"]').first();
    const emailInput = page.locator('input[type="email"]');
    const passwordInputs = await page.locator('input[type="password"]').all();
    
    await nameInput.fill(userData.name);
    await emailInput.fill(userData.email);
    await passwordInputs[0].fill(userData.password);
    await passwordInputs[1].fill(userData.password);
    
    const checkbox = page.locator('input[type="checkbox"]');
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
    }
    
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    await page.locator('input[type="email"]').fill(userData.email);
    await page.locator('input[type="password"]').fill(userData.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);

    // Check main content
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
    console.log('✓ Main content visible');
  });

  test('should have logout button', async ({ page }) => {
    console.log('🧪 Test: Logout button');
    
    const userData = {
      name: `User${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'Test123Pass'
    };

    // Register & Login
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    
    const nameInput = page.locator('input[type="text"]').first();
    const emailInput = page.locator('input[type="email"]');
    const passwordInputs = await page.locator('input[type="password"]').all();
    
    await nameInput.fill(userData.name);
    await emailInput.fill(userData.email);
    await passwordInputs[0].fill(userData.password);
    await passwordInputs[1].fill(userData.password);
    
    const checkbox = page.locator('input[type="checkbox"]');
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
    }
    
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    await page.locator('input[type="email"]').fill(userData.email);
    await page.locator('input[type="password"]').fill(userData.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);

    // Check logout button
    const logoutBtn = page.locator('button, a').filter({ hasText: /Logout|Sign Out|Exit/i }).first();
    await expect(logoutBtn).toBeVisible();
    console.log('✓ Logout button visible and clickable');
  });
});
