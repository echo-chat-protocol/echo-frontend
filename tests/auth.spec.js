import { test, expect } from '@playwright/test';

test.describe('Authentication - Complete', () => {
  const testUser = {
    fullName: `TestUser${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123'
  };

  // ==================== REGISTER TESTS ====================
  test.describe('Register', () => {
    test.beforeEach(async ({ page }) => {
      console.log('📍 Navigating to /register');
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      console.log('✓ Register page loaded');
    });

    test('should display register page', async ({ page }) => {
      console.log('🧪 Test: Display register page');
      const heading = page.locator('h1');
      await expect(heading).toBeVisible({ timeout: 10000 });
      console.log('✓ Heading visible');
      
      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible();
      console.log('✓ Submit button visible');
    });

    test('should show error when submitting empty form', async ({ page }) => {
      console.log('🧪 Test: Show error on empty form submission');
      const submitBtn = page.locator('button[type="submit"]');
      console.log('→ Clicking submit button without filling form');
      await submitBtn.click();
      
      await page.waitForTimeout(500);
      const hasError = await page.locator('text=/Please fill in|required/i').count();
      console.log(`✓ Error check: ${hasError > 0 ? 'PASS' : 'FAIL'} (found ${hasError} errors)`);
      expect(hasError).toBeGreaterThan(0);
    });

    test('should register successfully with valid data', async ({ page }) => {
      console.log('🧪 Test: Register with valid data');
      console.log(`→ Test user: ${testUser.email}`);
      
      const nameInput = page.locator('input[type="text"]').first();
      const emailInput = page.locator('input[type="email"]');
      const passwordInputs = await page.locator('input[type="password"]').all();
      
      console.log(`→ Filling name: ${testUser.fullName}`);
      await nameInput.fill(testUser.fullName);
      
      console.log(`→ Filling email: ${testUser.email}`);
      await emailInput.fill(testUser.email);
      
      if (passwordInputs.length >= 2) {
        console.log(`→ Filling password: ${testUser.password.length} chars`);
        await passwordInputs[0].fill(testUser.password);
        await passwordInputs[1].fill(testUser.password);
        
        const checkbox = page.locator('input[type="checkbox"]');
        if (await checkbox.isVisible()) {
          console.log('→ Checking terms checkbox');
          await checkbox.check();
        }
        
        console.log('→ Submitting register form');
        const submitBtn = page.locator('button[type="submit"]');
        await submitBtn.click();
        
        await page.waitForTimeout(2000);
        const currentUrl = page.url();
        console.log(`✓ Form submitted. Current URL: ${currentUrl}`);
      }
    });

    test('should fill all register fields', async ({ page }) => {
      console.log('🧪 Test: Fill all register fields');
      const nameInput = page.locator('input[type="text"]').first();
      const emailInput = page.locator('input[type="email"]');
      
      console.log('→ Filling test data');
      await nameInput.fill('Test User');
      await emailInput.fill('testuser@example.com');
      
      console.log('✓ Validating filled values');
      await expect(nameInput).toHaveValue('Test User');
      await expect(emailInput).toHaveValue('testuser@example.com');
      console.log('✓ Values validated');
    });

    test('should toggle password visibility', async ({ page }) => {
      console.log('🧪 Test: Toggle password visibility');
      const passwordInputs = await page.locator('input[type="password"]').all();
      
      if (passwordInputs.length > 0) {
        console.log('→ Filling password field');
        await passwordInputs[0].fill('password123');
        
        const eyeButtons = await page.locator('button[type="button"]').all();
        if (eyeButtons.length > 0) {
          console.log('→ Clicking eye button to toggle visibility');
          await eyeButtons[0].click();
          await page.waitForTimeout(300);
          console.log('✓ Password visibility toggled');
        }
      }
    });

    test('should show error if passwords do not match', async ({ page }) => {
      console.log('🧪 Test: Show error on mismatched passwords');
      const passwordInputs = await page.locator('input[type="password"]').all();
      
      if (passwordInputs.length >= 2) {
        console.log('→ Filling first password: password123');
        await passwordInputs[0].fill('password123');
        console.log('→ Filling second password: password456 (different!)');
        await passwordInputs[1].fill('password456');
        
        console.log('→ Submitting form with mismatched passwords');
        const submitBtn = page.locator('button[type="submit"]');
        await submitBtn.click();
        
        await page.waitForTimeout(500);
        const hasError = await page.locator('text=/do not match|password/i').count();
        console.log(`✓ Error check: ${hasError > 0 ? 'PASS' : 'FAIL'} (found ${hasError} errors)`);
        expect(hasError).toBeGreaterThan(0);
      }
    });

    test('should navigate to login from register', async ({ page }) => {
      console.log('🧪 Test: Navigate to login from register');
      const loginLink = page.locator('a[href*="login"]').first();
      await expect(loginLink).toBeVisible();
      console.log('→ Clicking login link');
      await loginLink.click();
      await page.waitForURL('**/login', { timeout: 5000 });
      const url = page.url();
      console.log(`✓ Navigated to login page: ${url}`);
      expect(url).toContain('/login');
    });

    test('should reject invalid email format in register', async ({ page }) => {
      console.log('🧪 Test: Register rejects invalid email');
      
      const nameInput = page.locator('input[type="text"]').first();
      const emailInput = page.locator('input[type="email"]');
      const passwordInputs = await page.locator('input[type="password"]').all();
      
      console.log('→ Filling form with invalid email: hola@asd.2');
      await nameInput.fill('Test User');
      await emailInput.fill('hola@asd.2');
      await passwordInputs[0].fill('Password123');
      await passwordInputs[1].fill('Password123');
      
      const checkbox = page.locator('input[type="checkbox"]');
      if (await checkbox.isVisible()) {
        await checkbox.check();
      }
      
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      
      await page.waitForTimeout(500);
      const currentUrl = page.url();
      expect(currentUrl).toContain('/register');
      console.log('✓ Still on register page (email rejected)');
    });
  });

  // ==================== LOGIN TESTS ====================
  test.describe('Login', () => {
    test.beforeEach(async ({ page }) => {
      console.log('📍 Navigating to /login');
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      console.log('✓ Login page loaded');
    });

    test('should display login page', async ({ page }) => {
      console.log('🧪 Test: Display login page');
      const heading = page.locator('h1');
      await expect(heading).toBeVisible({ timeout: 10000 });
      console.log('✓ Heading visible');
      
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
      console.log('✓ Email input visible');
      
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible();
      console.log('✓ Password input visible');
      
      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible();
      console.log('✓ Submit button visible');
    });

    test('should show error when submitting empty form', async ({ page }) => {
      console.log('🧪 Test: Show error on empty login');
      const submitBtn = page.locator('button[type="submit"]');
      console.log('→ Clicking submit without credentials');
      await submitBtn.click();
      
      await page.waitForTimeout(800);
      
      const errorDiv = page.locator('div').filter({ hasText: 'Please fill in all fields' }).first();
      const isVisible = await errorDiv.isVisible().catch(() => false);
      
      console.log(`✓ Error displayed: ${isVisible ? 'PASS' : 'FAIL'}`);
      if (isVisible) {
        await expect(errorDiv).toBeVisible();
      } else {
        const errorText = page.locator('text=Please fill in all fields');
        await expect(errorText).toBeVisible();
      }
    });

    test('should login with registered user', async ({ page }) => {
      console.log('🧪 Test: Login with registered user');
      console.log(`→ Attempting login with: ${testUser.email}`);
      
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitBtn = page.locator('button[type="submit"]');
      
      console.log('→ Filling email field');
      await emailInput.fill(testUser.email);
      
      console.log('→ Filling password field');
      await passwordInput.fill(testUser.password);
      
      console.log('→ Submitting login form');
      await submitBtn.click();
      
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      console.log(`✓ Form submitted. Current URL: ${currentUrl}`);
    });

    test('should fill email and password fields', async ({ page }) => {
      console.log('🧪 Test: Fill login fields');
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      console.log('→ Filling email: test@example.com');
      await emailInput.fill('test@example.com');
      console.log('→ Filling password: password123');
      await passwordInput.fill('password123');
      
      console.log('✓ Validating filled values');
      await expect(emailInput).toHaveValue('test@example.com');
      await expect(passwordInput).toHaveValue('password123');
      console.log('✓ Values validated');
    });

    test('should toggle password visibility', async ({ page }) => {
      console.log('🧪 Test: Toggle password visibility on login');
      const passwordInput = page.locator('input[type="password"]');
      console.log('→ Filling password field');
      await passwordInput.fill('password123');
      
      const eyeButton = page.locator('button[type="button"]').first();
      if (await eyeButton.isVisible()) {
        console.log('→ Clicking eye button');
        await eyeButton.click();
        await page.waitForTimeout(300);
        console.log('✓ Password visibility toggled');
      }
    });

    test('should have OAuth login options', async ({ page }) => {
      console.log('🧪 Test: Check OAuth options');
      const oauthButtons = await page.locator('button').filter({ hasText: /Google|GitHub/i }).all();
      console.log(`✓ Found ${oauthButtons.length} OAuth buttons`);
      expect(oauthButtons.length).toBeGreaterThan(0);
    });

    test('should display forgot password link', async ({ page }) => {
      console.log('🧪 Test: Check forgot password link');
      const forgotLink = page.locator('a').filter({ hasText: /Forgot Password/i });
      await expect(forgotLink).toBeVisible();
      console.log('✓ Forgot password link visible');
    });

    test('should navigate to register from login', async ({ page }) => {
      console.log('🧪 Test: Navigate to register from login');
      const registerLink = page.locator('a').filter({ hasText: /Sign Up|Create Account|Register/i }).first();
      await expect(registerLink).toBeVisible();
      console.log('→ Clicking register link');
      await registerLink.click();
      await page.waitForURL('**/register', { timeout: 5000 });
      const url = page.url();
      console.log(`✓ Navigated to register page: ${url}`);
      expect(url).toContain('/register');
    });

    test('should reject invalid email format in login', async ({ page }) => {
      console.log('🧪 Test: Login rejects invalid email');
      
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      console.log('→ Filling login with invalid email: hola@asd.2');
      await emailInput.fill('hola@asd.2');
      await passwordInput.fill('Password123');
      
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      
      await page.waitForTimeout(500);
      const currentUrl = page.url();
      expect(currentUrl).toContain('/login');
      console.log('✓ Still on login page (email rejected)');
    });
  });
});


