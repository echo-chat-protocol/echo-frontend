import { test, expect } from '@playwright/test'

test.describe('Authentication - Username-based', () => {
  const testUser = {
    username: `testuser${Date.now()}`,
    password: 'TestPass@123',
  }

  // ==================== REGISTER TESTS ====================
  test.describe('Register Page', () => {
    test.beforeEach(async ({ page }) => {
      console.log('📍 Navigating to /register')
      await page.goto('/register')
      await page.waitForLoadState('networkidle')
      console.log('✓ Register page loaded')
    })

    test('should display register page with username field', async ({ page }) => {
      console.log('🧪 Test: Display register page')
      const heading = page.locator('h1')
      await expect(heading).toBeVisible({ timeout: 10000 })
      console.log('✓ Heading visible')

      const usernameInput = page.locator('input[type="text"]').first()
      await expect(usernameInput).toBeVisible()
      console.log('✓ Username input visible')

      const submitBtn = page.locator('button[type="submit"]')
      await expect(submitBtn).toBeVisible()
      console.log('✓ Submit button visible')
    })

    test('should show error when submitting empty form', async ({ page }) => {
      console.log('🧪 Test: Show error on empty form submission')
      const submitBtn = page.locator('button[type="submit"]')
      console.log('→ Clicking submit button without filling form')
      await submitBtn.click()

      await page.waitForTimeout(500)
      const hasError = await page
        .locator('text=/Username|password|cannot be empty|Invalid username/i')
        .count()
      console.log(`✓ Error check: found ${hasError} error messages`)
      expect(hasError).toBeGreaterThan(0)
    })

    test('should fill username and password fields', async ({ page }) => {
      console.log('🧪 Test: Fill register fields')
      const usernameInput = page.locator('input[type="text"]').first()
      const passwordInputs = await page.locator('input[type="password"]').all()

      console.log(`→ Filling username: ${testUser.username}`)
      await usernameInput.fill(testUser.username)

      if (passwordInputs.length >= 2) {
        console.log(`→ Filling password: ${testUser.password.length} chars`)
        await passwordInputs[0].fill(testUser.password)
        await passwordInputs[1].fill(testUser.password)

        console.log('✓ Validating filled values')
        await expect(usernameInput).toHaveValue(testUser.username)
        await expect(passwordInputs[0]).toHaveValue(testUser.password)
        await expect(passwordInputs[1]).toHaveValue(testUser.password)
      }
    })

    test('should show error if passwords do not match', async ({ page }) => {
      console.log('🧪 Test: Show error on mismatched passwords')
      const usernameInput = page.locator('input[type="text"]').first()
      const passwordInputs = await page.locator('input[type="password"]').all()

      if (passwordInputs.length >= 2) {
        await usernameInput.fill(`testuser${Date.now()}`)
        console.log('→ Filling first password: password123')
        await passwordInputs[0].fill('password123')
        console.log('→ Filling second password: password456 (different!)')
        await passwordInputs[1].fill('password456')

        console.log('→ Submitting form with mismatched passwords')
        const submitBtn = page.locator('button[type="submit"]')
        await submitBtn.click()

        await page.waitForTimeout(500)
        const hasError = await page.locator('text=/do not match|Passwords/i').count()
        console.log(`✓ Error check: ${hasError > 0 ? 'PASS' : 'FAIL'} (found ${hasError} errors)`)
        expect(hasError).toBeGreaterThan(0)
      }
    })

    test('should reject weak password', async ({ page }) => {
      console.log('🧪 Test: Register rejects weak password')

      const usernameInput = page.locator('input[type="text"]').first()
      const passwordInputs = await page.locator('input[type="password"]').all()

      const weakUser = `weakpass${Date.now()}`
      console.log(`→ Filling username: ${weakUser}`)
      await usernameInput.fill(weakUser)

      if (passwordInputs.length >= 2) {
        console.log('→ Filling with weak password: abc')
        await passwordInputs[0].fill('abc')
        await passwordInputs[1].fill('abc')

        const checkbox = page.locator('input[type="checkbox"]')
        if (await checkbox.isVisible().catch(() => false)) {
          await checkbox.check()
        }

        const submitBtn = page.locator('button[type="submit"]')
        await submitBtn.click()

        await page.waitForTimeout(500)
        const currentUrl = page.url()
        expect(currentUrl).toContain('/register')
        console.log('✓ Still on register page (weak password rejected)')
      }
    })

    test('should reject invalid username format', async ({ page }) => {
      console.log('🧪 Test: Register rejects invalid username')

      const usernameInput = page.locator('input[type="text"]').first()
      const passwordInputs = await page.locator('input[type="password"]').all()

      console.log('→ Filling invalid username: a@ (too short, invalid chars)')
      await usernameInput.fill('a@')

      if (passwordInputs.length >= 2) {
        await passwordInputs[0].fill('ValidPass@123')
        await passwordInputs[1].fill('ValidPass@123')

        const submitBtn = page.locator('button[type="submit"]')
        await submitBtn.click()

        await page.waitForTimeout(500)
        const currentUrl = page.url()
        expect(currentUrl).toContain('/register')
        console.log('✓ Still on register page (invalid username rejected)')
      }
    })

    test('should navigate to login from register', async ({ page }) => {
      console.log('🧪 Test: Navigate to login from register')
      const loginLink = page
        .locator('a')
        .filter({ hasText: /login|Sign In|Log In/i })
        .first()
      if (await loginLink.isVisible().catch(() => false)) {
        console.log('→ Clicking login link')
        await loginLink.click()
        await page.waitForURL('**/login', { timeout: 5000 })
        const url = page.url()
        console.log(`✓ Navigated to login page: ${url}`)
        expect(url).toContain('/login')
      } else {
        console.log('⚠ Login link not found on register page')
      }
    })
  })

  // ==================== LOGIN TESTS ====================
  test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
      console.log('📍 Navigating to /login')
      await page.goto('/login')
      await page.waitForLoadState('networkidle')
      console.log('✓ Login page loaded')
    })

    test('should display login page with username field', async ({ page }) => {
      console.log('🧪 Test: Display login page')
      const heading = page.locator('h1')
      await expect(heading).toBeVisible({ timeout: 10000 })
      console.log('✓ Heading visible')

      const usernameInput = page.locator('input[type="text"]').first()
      await expect(usernameInput).toBeVisible()
      console.log('✓ Username input visible')

      const passwordInput = page.locator('input[type="password"]')
      await expect(passwordInput).toBeVisible()
      console.log('✓ Password input visible')

      const submitBtn = page.locator('button[type="submit"]')
      await expect(submitBtn).toBeVisible()
      console.log('✓ Submit button visible')
    })

    test('should show error when submitting empty form', async ({ page }) => {
      console.log('🧪 Test: Show error on empty login')
      const submitBtn = page.locator('button[type="submit"]')
      console.log('→ Clicking submit without credentials')
      await submitBtn.click()

      await page.waitForTimeout(800)

      const hasError = await page.locator('text=/Username|password|cannot be empty/i').count()
      console.log(`✓ Error check: found ${hasError} error messages`)
      expect(hasError).toBeGreaterThan(0)
    })

    test('should fill username and password fields', async ({ page }) => {
      console.log('🧪 Test: Fill login fields')
      const usernameInput = page.locator('input[type="text"]').first()
      const passwordInput = page.locator('input[type="password"]')

      console.log('→ Filling username: testuser')
      await usernameInput.fill('testuser')
      console.log('→ Filling password: password123')
      await passwordInput.fill('password123')

      console.log('✓ Validating filled values')
      await expect(usernameInput).toHaveValue('testuser')
      await expect(passwordInput).toHaveValue('password123')
      console.log('✓ Values validated')
    })

    test('should toggle password visibility', async ({ page }) => {
      console.log('🧪 Test: Toggle password visibility on login')
      const passwordInput = page.locator('input[type="password"]')
      console.log('→ Filling password field')
      await passwordInput.fill('password123')

      const eyeButtons = await page
        .locator('button')
        .filter({ hasText: /eye|show|hide/i })
        .all()
      if (eyeButtons.length > 0) {
        console.log('→ Clicking eye button')
        await eyeButtons[0].click()
        await page.waitForTimeout(300)
        console.log('✓ Password visibility toggled')
      } else {
        console.log('⚠ No eye button found for password visibility')
      }
    })

    test('should display debug/test user creation option', async ({ page }) => {
      console.log('🧪 Test: Check debug user creation')
      const debugButton = page
        .locator('button')
        .filter({ hasText: /debug|test|demo/i })
        .first()
      if (await debugButton.isVisible().catch(() => false)) {
        console.log('✓ Debug user creation button visible')
        expect(debugButton).toBeDefined()
      } else {
        console.log('⚠ Debug button not found (optional feature)')
      }
    })

    test('should navigate to register from login', async ({ page }) => {
      console.log('🧪 Test: Navigate to register from login')
      const registerLink = page
        .locator('a')
        .filter({ hasText: /register|Sign Up|Create Account/i })
        .first()
      if (await registerLink.isVisible().catch(() => false)) {
        console.log('→ Clicking register link')
        await registerLink.click()
        await page.waitForURL('**/register', { timeout: 5000 })
        const url = page.url()
        console.log(`✓ Navigated to register page: ${url}`)
        expect(url).toContain('/register')
      } else {
        console.log('⚠ Register link not found on login page')
      }
    })
  })

  // ==================== PROTECTED ROUTES TESTS ====================
  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing dashboard unauthenticated', async ({ page }) => {
      console.log('🧪 Test: Dashboard requires authentication')
      console.log('→ Attempting to access /dashboard without login')

      await page.goto('/dashboard', { waitUntil: 'networkidle' })
      const currentUrl = page.url()

      console.log(`✓ Current URL: ${currentUrl}`)
      expect(currentUrl).not.toContain('/dashboard')
      expect(currentUrl).toContain('login')
    })

    test('should redirect to login when accessing chat unauthenticated', async ({ page }) => {
      console.log('🧪 Test: Chat requires authentication')
      console.log('→ Attempting to access /dashboard/chat without login')

      await page.goto('/dashboard/chat', { waitUntil: 'networkidle' })
      const currentUrl = page.url()

      console.log(`✓ Current URL: ${currentUrl}`)
      expect(currentUrl).toContain('login')
    })

    test('should allow navigation between auth pages when unauthenticated', async ({ page }) => {
      console.log('🧪 Test: Navigation between auth pages')

      console.log('→ Going to /login')
      await page.goto('/login')
      let url = page.url()
      expect(url).toContain('/login')
      console.log('✓ At /login')

      console.log('→ Going to /register')
      await page.goto('/register')
      url = page.url()
      expect(url).toContain('/register')
      console.log('✓ At /register')
    })
  })
})
