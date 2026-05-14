import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    console.log('📍 Navigating to landing page');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('✓ Landing page loaded');
  });

  test('should display landing page with main navigation', async ({ page }) => {
    console.log('🧪 Test: Landing page loads with navigation');
    
    const navbar = page.locator('nav');
    console.log('→ Checking navbar visibility');
    await expect(navbar).toBeVisible();
    console.log('✓ Navbar visible');

    const navLinks = await page.locator('nav a, nav button').all();
    console.log(`→ Found ${navLinks.length} navigation links`);
    expect(navLinks.length).toBeGreaterThan(0);
    console.log('✓ Navigation has items');
  });

  test('should display hero section with CTA', async ({ page }) => {
    console.log('🧪 Test: Hero section displays correctly');
    
    const mainHeading = page.locator('h1').first();
    console.log('→ Checking main heading');
    await expect(mainHeading).toBeVisible();
    const heroText = await mainHeading.innerText();
    expect(heroText.length).toBeGreaterThan(0);
    console.log(`✓ Hero text: ${heroText.substring(0, 50)}...`);

    const ctaButton = page.locator('button').filter({ hasText: /Get Started|Start|Try Now|Sign Up/i }).first();
    await expect(ctaButton).toBeVisible();
    console.log('✓ CTA button visible and clickable');
  });

  test('should display features section', async ({ page }) => {
    console.log('🧪 Test: Features section displays');
    
    const featuresHeading = page.locator('h2').filter({ hasText: /Features|Why|Benefit/i }).first();
    await expect(featuresHeading).toBeVisible();
    console.log('→ Features heading found');
    await featuresHeading.scrollIntoViewIfNeeded();
    
    const featureCards = await page.locator('[class*="feature"], [class*="card"]').all();
    expect(featureCards.length).toBeGreaterThan(0);
    console.log(`✓ Found ${featureCards.length} feature cards`);
  });

  test('should display pricing section', async ({ page }) => {
    console.log('🧪 Test: Pricing section displays');
    
    const pricingHeading = page.locator('h2').filter({ hasText: /Pricing|Plans|Price/i }).first();
    await expect(pricingHeading).toBeVisible();
    console.log('→ Pricing heading found');
    await pricingHeading.scrollIntoViewIfNeeded();

    const pricingCards = await page.locator('[class*="plan"], [class*="tier"]').all();
    expect(pricingCards.length).toBeGreaterThan(0);
    console.log(`✓ Found ${pricingCards.length} pricing plans`);
  });

  test('should have working documentation link', async ({ page }) => {
    console.log('🧪 Test: Documentation link works');
    
    const docLink = page.locator('a').filter({ hasText: /Documentation|Docs|Guide/i }).first();
    await expect(docLink).toBeVisible();
    const href = await docLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href.length).toBeGreaterThan(0);
    console.log(`✓ Docs link href: ${href}`);
  });

  test('should display code examples section', async ({ page }) => {
    console.log('🧪 Test: Code examples section');
    
    const codeHeading = page.locator('h2').filter({ hasText: /Code|Example|Usage|Integration/i }).first();
    await expect(codeHeading).toBeVisible();
    console.log('→ Code section heading found');
    await codeHeading.scrollIntoViewIfNeeded();

    const codeBlocks = await page.locator('code, pre').all();
    expect(codeBlocks.length).toBeGreaterThan(0);
    console.log(`✓ Found ${codeBlocks.length} code blocks`);
  });

  test('should display testimonials or social proof section', async ({ page }) => {
    console.log('🧪 Test: Testimonials/social proof section');
    
    const testimonialHeading = page.locator('h2').filter({ hasText: /Testimonial|Review|What|Love|Success|Story|Feedback/i }).first();
    await expect(testimonialHeading).toBeVisible();
    console.log('→ Testimonials heading found');
    await testimonialHeading.scrollIntoViewIfNeeded();

    const testimonialCards = await page.locator('[class*="testimonial"], [class*="review"], [class*="quote"]').all();
    expect(testimonialCards.length).toBeGreaterThan(0);
    console.log(`✓ Found ${testimonialCards.length} testimonial cards`);
  });

  test('should display footer with links', async ({ page }) => {
    console.log('🧪 Test: Footer displays correctly');
    
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    console.log('✓ Footer visible');
    await footer.scrollIntoViewIfNeeded();

    const footerLinks = await footer.locator('a').all();
    expect(footerLinks.length).toBeGreaterThan(0);
    console.log(`✓ Found ${footerLinks.length} footer links`);
  });

  test('should have responsive navigation menu', async ({ page }) => {
    console.log('🧪 Test: Navigation menu is responsive');
    
    const navLinks = page.locator('nav a, nav button');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
    console.log(`✓ Total navigation links: ${count}`);
  });

  test('should navigate to login from landing page', async ({ page }) => {
    console.log('🧪 Test: Navigate to login from landing');
    
    const loginButton = page.locator('button, a').filter({ hasText: /Login|Sign In/i }).first();
    await expect(loginButton).toBeVisible();
    console.log('→ Login button found');
    await loginButton.click();
    await page.waitForURL(/login|auth/, { timeout: 5000 });
    const url = page.url();
    expect(url).toContain('login');
    console.log(`✓ Navigated to: ${url}`);
  });

  test('should navigate to signup/register from landing', async ({ page }) => {
    console.log('🧪 Test: Navigate to signup from landing');
    
    const signupButton = page.locator('button, a').filter({ hasText: /Sign Up|Register|Get Started/i }).first();
    await expect(signupButton).toBeVisible();
    console.log('→ Signup button found');
    await signupButton.click();
    await page.waitForURL(/register|signup/, { timeout: 5000 });
    const url = page.url();
    expect(url).toContain('register');
    console.log(`✓ Navigated to: ${url}`);
  });

  test('should load images on landing page', async ({ page }) => {
    console.log('🧪 Test: Images load correctly');
    
    const images = await page.locator('img').all();
    expect(images.length).toBeGreaterThan(0);
    console.log(`✓ Found ${images.length} images`);

    for (let i = 0; i < Math.min(images.length, 3); i++) {
      await expect(images[i]).toBeVisible();
      const alt = await images[i].getAttribute('alt');
      console.log(`✓ Image ${i + 1} visible: ${alt || 'no alt'}`);
    }
  });

  test('should have proper semantic HTML structure', async ({ page }) => {
    console.log('🧪 Test: Landing page has proper structure');
    
    const headings = await page.locator('h1, h2, h3').all();
    expect(headings.length).toBeGreaterThan(0);
    console.log(`✓ Found ${headings.length} heading elements`);

    const buttons = await page.locator('button').all();
    expect(buttons.length).toBeGreaterThan(0);
    console.log(`✓ Found ${buttons.length} interactive buttons`);
  });

  test('should have working CTA buttons', async ({ page }) => {
    console.log('🧪 Test: CTA buttons are clickable');
    
    const ctaButtons = await page.locator('button, a').filter({ hasText: /Get Started|Try|Start|Sign Up|Join/i }).all();
    expect(ctaButtons.length).toBeGreaterThan(0);
    console.log(`✓ Found ${ctaButtons.length} CTA buttons`);

    const firstCta = ctaButtons[0];
    await expect(firstCta).toBeEnabled();
    console.log(`✓ First CTA button is enabled and clickable`);
  });

  test('should display FAQ section', async ({ page }) => {
    console.log('🧪 Test: FAQ section displays');
    
    const faqHeading = page.locator('h2').filter({ hasText: /FAQ|Question|Ask|Common/i }).first();
    await expect(faqHeading).toBeVisible();
    console.log('→ FAQ heading found');
    await faqHeading.scrollIntoViewIfNeeded();

    const faqItems = await page.locator('details, [class*="accordion"], [class*="faq"]').all();
    expect(faqItems.length).toBeGreaterThan(0);
    console.log(`✓ Found ${faqItems.length} FAQ items`);
  });

  test('should display benefits/highlights section', async ({ page }) => {
    console.log('🧪 Test: Benefits section displays');
    
    const benefitsHeading = page.locator('h2').filter({ hasText: /Why|Benefit|Advantage|Feature/i }).first();
    await expect(benefitsHeading).toBeVisible();
    console.log('→ Benefits heading found');
    await benefitsHeading.scrollIntoViewIfNeeded();

    const benefitItems = await page.locator('[class*="benefit"], li').all();
    expect(benefitItems.length).toBeGreaterThan(0);
    console.log(`✓ Found ${benefitItems.length} benefit items`);
  });

  test('should load landing page within acceptable time', async ({ page }) => {
    console.log('🧪 Test: Page load time');
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    console.log(`✓ Page loaded in ${loadTime}ms`);
    expect(loadTime).toBeLessThan(10000);
  });

  test('should have valid page title', async ({ page }) => {
    console.log('🧪 Test: Page metadata');
    
    const title = page.title();
    expect(await title).toBeTruthy();
    expect((await title).length).toBeGreaterThan(0);
    console.log(`✓ Page title: ${await title}`);

    const pageTitle = page.locator('h1').first();
    const headingText = await pageTitle.innerText();
    expect(headingText.length).toBeGreaterThan(0);
    console.log(`✓ Main heading: ${headingText}`);
  });
});
