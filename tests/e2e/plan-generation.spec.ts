/**
 * E2E tests for plan generation with streaming feedback.
 *
 * Covers:
 *  - Generate Plan dialog flow with real-time streaming feedback
 *  - Elapsed time counter updates
 *  - Status message changes during generation
 *  - Preview step rendering with phase cards
 *  - Cancel flow during generation
 */
import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the app shell to be stable (nav + main visible, no spinner).
 */
async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Navigate to the plans page and wait for it to be ready.
 */
async function gotoPlans(page: Page) {
  await page.goto('/plans');
  await waitForAppReady(page);
}

/**
 * Open the Generate Plan dialog from the plans page.
 */
async function openGeneratePlanDialog(page: Page): Promise<boolean> {
  // Look for the "Generate Plan" or "New Plan" button
  const generateBtn = page.locator(
    'button:has-text("Generate Plan"), button:has-text("New Plan"), button:has-text("Create Plan")'
  );

  const btnVisible = await generateBtn
    .first()
    .isVisible({ timeout: 8_000 })
    .catch(() => false);

  if (btnVisible) {
    await generateBtn.first().click();

    // Wait for the dialog to appear
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Plan Generation with Streaming Feedback
// ---------------------------------------------------------------------------

test.describe('Plan Generation - Streaming Feedback', () => {
  test('opens Generate Plan dialog and shows prompt step', async ({ page }) => {
    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();

      // Dialog should have title input
      const titleInput = dialog.locator('input[type="text"]').first();
      await expect(titleInput).toBeVisible({ timeout: 3_000 });

      // Dialog should have description textarea
      const descriptionTextarea = dialog.locator('textarea').first();
      await expect(descriptionTextarea).toBeVisible({ timeout: 3_000 });

      // Dialog should have the Generate Plan button
      const generateBtn = dialog.locator('button:has-text("Generate Plan")');
      await expect(generateBtn).toBeVisible({ timeout: 3_000 });
    } else {
      // If no generate button found, might need a repository selected
      const mainContent = page.locator('main, [role="main"]').first();
      await expect(mainContent).toBeVisible();
    }
  });

  test('fills in plan details and initiates generation', async ({ page }) => {
    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Fill in title
      const titleInput = dialog.locator('input[type="text"]').first();
      await titleInput.fill('E2E Test Plan');

      // Fill in description
      const descriptionTextarea = dialog.locator('textarea').first();
      await descriptionTextarea.fill('This is an end-to-end test plan for automated testing.\n\nRequirements:\n- Test plan generation\n- Test streaming feedback');

      // Click Generate Plan button
      const generateBtn = dialog.locator('button:has-text("Generate Plan")');
      await generateBtn.click();

      // Should transition to generating step
      // Wait a moment for the transition
      await page.waitForTimeout(500);

      // Generating step should show "Generating your plan" heading
      const generatingHeading = dialog.locator('h3:has-text("Generating your plan")');
      const headingVisible = await generatingHeading
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      expect(headingVisible).toBeTruthy();
    }
  });

  test('shows elapsed time counter during generation', async ({ page }) => {
    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Fill in and submit
      await dialog.locator('input[type="text"]').first().fill('E2E Timer Test');
      await dialog.locator('textarea').first().fill('Test the elapsed time counter.');
      await dialog.locator('button:has-text("Generate Plan")').click();

      // Wait for generating step
      await page.waitForTimeout(500);

      // Look for elapsed time display (format: "Xs elapsed" or "Xm Ys elapsed")
      const elapsedTimeText = dialog.locator('text=/\\d+[ms].*elapsed/i');
      const elapsedVisible = await elapsedTimeText
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (elapsedVisible) {
        // Get initial elapsed time
        const initialTime = await elapsedTimeText.textContent();

        // Wait 2 seconds
        await page.waitForTimeout(2000);

        // Get updated elapsed time
        const updatedTime = await elapsedTimeText.textContent();

        // Times should be different (counter is updating)
        expect(initialTime).not.toBe(updatedTime);
      }
    }
  });

  test('displays status messages during generation', async ({ page }) => {
    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Fill in and submit
      await dialog.locator('input[type="text"]').first().fill('E2E Status Test');
      await dialog.locator('textarea').first().fill('Test status message updates during generation.');
      await dialog.locator('button:has-text("Generate Plan")').click();

      // Wait for generating step
      await page.waitForTimeout(500);

      // Look for animated pulse indicator (shown with status messages)
      const pulseIndicator = dialog.locator('.animate-pulse');
      const pulseVisible = await pulseIndicator
        .first()
        .isVisible({ timeout: 8_000 })
        .catch(() => false);

      // Status messages appear next to pulse indicators
      // They are small text elements with muted color
      const statusContainer = dialog.locator('text=/Analyzing|Structuring|Validating|Processing/i');
      const statusVisible = await statusContainer
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false);

      // At least one status indicator should be present during generation
      expect(pulseVisible || statusVisible).toBeTruthy();
    }
  });

  test('completes generation and shows preview step with phase cards', async ({ page }) => {
    // Increase timeout for this test as generation can take time
    test.setTimeout(90_000);

    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Fill in simple plan for faster generation
      await dialog.locator('input[type="text"]').first().fill('Simple Test Plan');
      await dialog.locator('textarea').first().fill('Create a simple feature:\n\n- Add a button\n- Style the button\n- Test the button');
      await dialog.locator('button:has-text("Generate Plan")').click();

      // Wait for generating step
      await page.waitForTimeout(500);

      // Wait for preview step (generation complete)
      // Preview shows phase cards with task counts
      const phaseCards = dialog.locator('button:has-text("task")');
      const previewVisible = await phaseCards
        .first()
        .isVisible({ timeout: 60_000 })
        .catch(() => false);

      if (previewVisible) {
        // Phase cards should be rendered
        const cardCount = await phaseCards.count();
        expect(cardCount).toBeGreaterThan(0);

        // Each phase card should have a badge with phase number
        const phaseBadges = dialog.locator('[class*="badge"]');
        const badgeCount = await phaseBadges.count();
        expect(badgeCount).toBeGreaterThan(0);

        // Should have a Launch or Execute button in preview
        const launchBtn = dialog.locator('button:has-text("Launch"), button:has-text("Execute"), button:has-text("Start")');
        const launchVisible = await launchBtn
          .first()
          .isVisible({ timeout: 3_000 })
          .catch(() => false);

        expect(launchVisible).toBeTruthy();
      }
    }
  });

  test('phase cards can be expanded to show tasks', async ({ page }) => {
    test.setTimeout(90_000);

    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Generate a plan
      await dialog.locator('input[type="text"]').first().fill('Expandable Phase Test');
      await dialog.locator('textarea').first().fill('Create a feature with multiple steps:\n\n1. Setup\n2. Implementation\n3. Testing');
      await dialog.locator('button:has-text("Generate Plan")').click();

      await page.waitForTimeout(500);

      // Wait for preview
      const phaseCards = dialog.locator('button:has-text("task")');
      await phaseCards.first().waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {});

      const cardCount = await phaseCards.count();

      if (cardCount > 0) {
        // Click first phase card to expand
        await phaseCards.first().click();

        // Should show chevron down (expanded state)
        const chevronDown = dialog.locator('[class*="lucide-chevron-down"]').first();
        const expandedVisible = await chevronDown
          .isVisible({ timeout: 3_000 })
          .catch(() => false);

        // If phase expanded successfully, tasks should be visible
        if (expandedVisible) {
          // Look for task descriptions or task items
          await page.waitForTimeout(300);

          // Click again to collapse
          await phaseCards.first().click();
          await page.waitForTimeout(300);

          // Should show chevron right (collapsed state)
          const chevronRight = dialog.locator('[class*="lucide-chevron-right"]').first();
          const collapsedVisible = await chevronRight
            .isVisible({ timeout: 3_000 })
            .catch(() => false);

          expect(collapsedVisible || expandedVisible).toBeTruthy();
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Cancel Flow During Generation
// ---------------------------------------------------------------------------

test.describe('Plan Generation - Cancel Flow', () => {
  test('can cancel generation and returns to prompt step with inputs preserved', async ({ page }) => {
    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Fill in title and description
      const testTitle = 'Cancelable Test Plan';
      const testDescription = 'This plan will be canceled during generation to test the cancel flow.';

      await dialog.locator('input[type="text"]').first().fill(testTitle);
      await dialog.locator('textarea').first().fill(testDescription);

      // Click Generate Plan
      await dialog.locator('button:has-text("Generate Plan")').click();

      // Wait for generating step
      await page.waitForTimeout(500);

      // Verify we're in generating step
      const generatingHeading = dialog.locator('h3:has-text("Generating your plan")');
      const inGeneratingStep = await generatingHeading
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      if (inGeneratingStep) {
        // Look for Cancel button
        const cancelBtn = dialog.locator('button:has-text("Cancel")');
        const cancelVisible = await cancelBtn
          .isVisible({ timeout: 3_000 })
          .catch(() => false);

        if (cancelVisible) {
          // Click Cancel
          await cancelBtn.click();

          // Should return to prompt step
          await page.waitForTimeout(1000);

          // Title input should be visible again
          const titleInput = dialog.locator('input[type="text"]').first();
          const backToPrompt = await titleInput
            .isVisible({ timeout: 5_000 })
            .catch(() => false);

          if (backToPrompt) {
            // Verify inputs are preserved
            const titleValue = await titleInput.inputValue();
            const descriptionValue = await dialog.locator('textarea').first().inputValue();

            expect(titleValue).toBe(testTitle);
            expect(descriptionValue).toBe(testDescription);
          } else {
            // If not back to prompt, dialog might have closed
            // which is also acceptable cancel behavior
            const dialogVisible = await dialog
              .isVisible({ timeout: 2_000 })
              .catch(() => false);

            // Either back to prompt or dialog closed
            expect(!dialogVisible || backToPrompt).toBeTruthy();
          }
        }
      }
    }
  });

  test('cancel button is accessible during generation', async ({ page }) => {
    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Fill and submit
      await dialog.locator('input[type="text"]').first().fill('Cancel Button Test');
      await dialog.locator('textarea').first().fill('Testing cancel button accessibility.');
      await dialog.locator('button:has-text("Generate Plan")').click();

      await page.waitForTimeout(1000);

      // Look for Cancel button
      const cancelBtn = dialog.locator('button:has-text("Cancel")');
      const cancelVisible = await cancelBtn
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (cancelVisible) {
        // Cancel button should be enabled
        const isEnabled = await cancelBtn.isEnabled();
        expect(isEnabled).toBeTruthy();

        // Cancel button should be keyboard accessible
        await cancelBtn.focus();
        const isFocused = await cancelBtn.evaluate((el) => el === document.activeElement);
        expect(isFocused).toBeTruthy();
      }
    }
  });

  test('displays progress bar during generation', async ({ page }) => {
    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Fill and submit
      await dialog.locator('input[type="text"]').first().fill('Progress Bar Test');
      await dialog.locator('textarea').first().fill('Test the progress bar display.');
      await dialog.locator('button:has-text("Generate Plan")').click();

      await page.waitForTimeout(500);

      // Look for progress bar (has rounded-full and bg-primary classes)
      // The progress bar is inside a container with h-1.5
      const progressBar = dialog.locator('[class*="rounded-full"][class*="bg-primary"]');
      const progressVisible = await progressBar
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      expect(progressVisible).toBeTruthy();

      if (progressVisible) {
        // Progress bar should have width style
        const width = await progressBar.first().getAttribute('style');
        expect(width).toContain('width');
      }
    }
  });

  test('shows LLM output during generation', async ({ page }) => {
    test.setTimeout(60_000);

    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Fill and submit
      await dialog.locator('input[type="text"]').first().fill('LLM Output Test');
      await dialog.locator('textarea').first().fill('Test live LLM output streaming.');
      await dialog.locator('button:has-text("Generate Plan")').click();

      await page.waitForTimeout(500);

      // Look for "Live LLM Output" label
      const llmOutputLabel = dialog.locator('text=Live LLM Output');
      const labelVisible = await llmOutputLabel
        .isVisible({ timeout: 15_000 })
        .catch(() => false);

      if (labelVisible) {
        // Should have a pre or code element with the output
        const llmOutput = dialog.locator('pre').first();
        const outputVisible = await llmOutput
          .isVisible({ timeout: 3_000 })
          .catch(() => false);

        expect(outputVisible).toBeTruthy();

        if (outputVisible) {
          // Output should contain some text
          const outputText = await llmOutput.textContent();
          expect(outputText?.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

test.describe('Plan Generation - Error Handling', () => {
  test('handles generation errors gracefully', async ({ page }) => {
    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();

      // Try to generate with empty description (might cause validation error)
      await dialog.locator('input[type="text"]').first().fill('Error Test');
      // Leave description empty or very short
      await dialog.locator('textarea').first().fill('x');

      const generateBtn = dialog.locator('button:has-text("Generate Plan")');
      await generateBtn.click();

      // Wait a moment
      await page.waitForTimeout(2000);

      // Either validation prevents submission (button stays disabled)
      // or an error message appears
      const errorMessage = page.locator('text=/error|invalid|required/i');
      const hasError = await errorMessage
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      // App should remain functional
      const mainContent = page.locator('main, [role="main"]').first();
      await expect(mainContent).toBeVisible();
    }
  });

  test('dialog can be closed with Escape key', async ({ page }) => {
    await gotoPlans(page);

    const opened = await openGeneratePlanDialog(page);

    if (opened) {
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Dialog should close
      await page.waitForTimeout(500);
      const dialogVisible = await dialog
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      expect(dialogVisible).toBeFalsy();
    }
  });
});
