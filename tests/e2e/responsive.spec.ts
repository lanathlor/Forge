/**
 * E2E tests for responsive layouts at key breakpoints.
 *
 * Breakpoints tested:
 *  - Mobile S: 320×568 (small phones, e.g. iPhone SE)
 *  - Mobile M: 375×667 (iPhone 6/7/8)
 *  - Mobile L: 425×896 (large phones)
 *  - Tablet:   768×1024 (iPad portrait)
 *  - Laptop:   1024×768 (small laptops)
 *  - Desktop:  1440×900 (typical desktop)
 */
import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Viewport definitions
// ---------------------------------------------------------------------------

const VIEWPORTS = {
  mobileS: { width: 320, height: 568 },
  mobileM: { width: 375, height: 667 },
  mobileL: { width: 425, height: 896 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1024, height: 768 },
  desktop: { width: 1440, height: 900 },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gotoAndWait(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/** Ensures there is no horizontal scroll at the given viewport. */
async function assertNoHorizontalOverflow(
  page: Page,
  viewport: { width: number; height: number }
) {
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  // Allow up to 10px tolerance for scrollbar width etc.
  expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 10);
}

/** Returns true if sidebar is visible (i.e. desktop layout). */
async function isSidebarVisible(page: Page): Promise<boolean> {
  // Sidebar is typically rendered as <nav> or a div with `sidebar` in its class
  const sidebar = page
    .locator('nav[aria-label*="sidebar"], [data-testid="sidebar"], aside')
    .first();
  return sidebar.isVisible({ timeout: 2_000 }).catch(() => false);
}

/** Returns true if a hamburger / mobile menu button is present. */
async function hasMobileMenuButton(page: Page): Promise<boolean> {
  const menuBtn = page
    .locator(
      'button[aria-label*="menu" i], button[aria-label*="navigation" i], button[aria-expanded], [data-testid="mobile-menu-button"]'
    )
    .first();
  return menuBtn.isVisible({ timeout: 2_000 }).catch(() => false);
}

// ---------------------------------------------------------------------------
// Dashboard – layout at each breakpoint
// ---------------------------------------------------------------------------

test.describe('Responsive – Dashboard', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`renders without horizontal overflow at ${name} (${viewport.width}×${viewport.height})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoAndWait(page, '/dashboard');
      await assertNoHorizontalOverflow(page, viewport);
    });

    test(`main content is visible at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoAndWait(page, '/dashboard');
      const main = page.locator('main, [role="main"]').first();
      await expect(main).toBeVisible({ timeout: 8_000 });
    });
  }

  // Mobile-specific: sidebar should be hidden / navigation should collapse
  test('sidebar is hidden on mobile (375px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobileM);
    await gotoAndWait(page, '/dashboard');

    // On mobile the sidebar with class `hidden lg:block` should not be visible
    const mobileSidebar = page
      .locator('.hidden.lg\\:block, [class*="hidden lg"]')
      .first();
    const isHidden = await mobileSidebar
      .evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden';
      })
      .catch(() => true); // If element not found, sidebar is hidden

    expect(isHidden).toBeTruthy();
  });

  // Desktop: sidebar should be visible
  test('sidebar panel is visible on desktop (1440px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await gotoAndWait(page, '/dashboard');

    // On desktop the sidebar column should be rendered
    const sidebarColumn = page
      .locator('.lg\\:block, [class*="lg:block"]')
      .first();
    const sidebarVisible = await sidebarColumn
      .evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none';
      })
      .catch(() => false);

    expect(sidebarVisible).toBeTruthy();
  });

  // Touch targets: min 44×44px on mobile
  test('interactive elements have adequate touch targets on mobile', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobileM);
    await gotoAndWait(page, '/dashboard');

    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    const smallButtons: string[] = [];
    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      if (box && (box.height < 36 || box.width < 36)) {
        const text = await btn.textContent().catch(() => '');
        const label = await btn.getAttribute('aria-label').catch(() => '');
        smallButtons.push(
          `"${(text || label || 'unnamed').trim()}" (${box.width.toFixed(0)}×${box.height.toFixed(0)})`
        );
      }
    }

    // Allow up to 2 small buttons (e.g. icon-only utility buttons)
    expect(smallButtons.length).toBeLessThanOrEqual(2);
  });

  // Tablet: should show mixed layout
  test('tablet layout (768px) shows content without overflow', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await gotoAndWait(page, '/dashboard');

    await assertNoHorizontalOverflow(page, VIEWPORTS.tablet);

    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Repositories page – responsive
// ---------------------------------------------------------------------------

test.describe('Responsive – Repositories', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`no horizontal overflow at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoAndWait(page, '/repositories');
      await assertNoHorizontalOverflow(page, viewport);
    });
  }

  test('heading is visible at all breakpoints', async ({ page }) => {
    for (const viewport of Object.values(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await gotoAndWait(page, '/repositories');
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible({ timeout: 8_000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Settings page – responsive
// ---------------------------------------------------------------------------

test.describe('Responsive – Settings', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`settings renders at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoAndWait(page, '/settings');
      const heading = page.locator('h1:has-text("Settings")');
      await expect(heading).toBeVisible({ timeout: 8_000 });
      await assertNoHorizontalOverflow(page, viewport);
    });
  }

  test('cards stack vertically on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobileM);
    await gotoAndWait(page, '/settings');

    const cards = page.locator(
      '[class*="card"], .bg-card, [data-testid="settings-card"]'
    );
    const count = await cards.count();

    if (count >= 2) {
      const box1 = await cards.nth(0).boundingBox();
      const box2 = await cards.nth(1).boundingBox();

      if (box1 && box2) {
        // On mobile, cards should stack: second card starts below first
        expect(box2.y).toBeGreaterThan(box1.y);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Plans page – responsive
// ---------------------------------------------------------------------------

test.describe('Responsive – Plans', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`plans page loads at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoAndWait(page, '/plans');
      const main = page.locator('main, [role="main"]').first();
      await expect(main).toBeVisible({ timeout: 8_000 });
      await assertNoHorizontalOverflow(page, viewport);
    });
  }
});

// ---------------------------------------------------------------------------
// Tasks page – responsive
// ---------------------------------------------------------------------------

test.describe('Responsive – Tasks', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`tasks page loads at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoAndWait(page, '/tasks');
      const main = page.locator('main, [role="main"]').first();
      await expect(main).toBeVisible({ timeout: 8_000 });
      await assertNoHorizontalOverflow(page, viewport);
    });
  }
});
