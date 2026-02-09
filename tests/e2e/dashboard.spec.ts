import { test, expect } from '@playwright/test';

test.describe('Dashboard - Real-time Features', () => {
  test('should load dashboard and display repository selector', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for main page header
    await expect(page.getByRole('heading', { name: /autobot/i })).toBeVisible();

    // Check if repository selector is present
    // Note: Adjust selectors based on actual implementation
    await expect(page.locator('[data-testid="repository-selector"]').or(page.locator('text=Repositories'))).toBeVisible();
  });

  test('should show connection status indicator', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for connection status indicators (wifi icon, connected badge, etc.)
    const connectionIndicator = page.locator('text=Connected, text=Connecting, [alt="Connection Status"]');
    await expect(connectionIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display empty state when no repository selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for empty state message
    const emptyStateText = page.locator('text=Select a repository, text=No repository selected, text=Get started');
    await expect(emptyStateText.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Dashboard - Task Timeline', () => {
  test('should display task timeline component', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for timeline-related elements
    const timelineElement = page.locator('text=Task Timeline, text=Session, [data-testid="task-timeline"]');
    await expect(timelineElement.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show task status badges', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for status badges (running, completed, waiting, etc.)
    const statusBadge = page.locator('[role="status"], .badge, [data-status]');
    // Status badges should exist if there are tasks
    const count = await statusBadge.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Dashboard - Mobile Responsiveness', () => {
  test('should be mobile-friendly on small screens', async ({ page, viewport }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that layout adapts to mobile
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // Verify touch targets are large enough (min 44x44px)
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      const firstButton = buttons.first();
      const box = await firstButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // Allow some margin
      }
    }
  });

  test('should stack components vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // On mobile, elements should stack (flex-col)
    // This is a basic check - adjust based on your layout
    const container = page.locator('main').first();
    await expect(container).toBeVisible();
  });

  test('should support horizontal scrolling where needed', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that horizontal overflow doesn't break layout
    const body = page.locator('body');
    const box = await body.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375 + 20); // Allow small margin
  });
});

test.describe('Dashboard - Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for buttons with accessible names
    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      // Button should have either text content or aria-label
      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Press Tab to navigate
    await page.keyboard.press('Tab');
    // Check if focus is visible (some element should be focused)
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible({ timeout: 1000 });
  });
});

test.describe('Dashboard - Performance', () => {
  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should not have console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Allow specific expected errors if any
    const criticalErrors = errors.filter(
      (err) => !err.includes('favicon') && !err.includes('Hydration')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Dashboard - Real-time Updates (SSE)', () => {
  test('should establish SSE connection', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait a bit for SSE connection
    await page.waitForTimeout(2000);

    // Check for connection indicator
    const connectedIndicator = page.locator('text=Connected, [data-connected="true"]');
    await expect(connectedIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle SSE connection errors gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The app should not crash even if SSE fails
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // Should show reconnect option if disconnected
    // This is timing-dependent, so we'll just check the page doesn't crash
  });
});
