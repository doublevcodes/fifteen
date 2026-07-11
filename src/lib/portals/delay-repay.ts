import { chromium, type Page } from "playwright";
import { OPERATOR_PORTAL_URLS } from "@/lib/eligibility/dr15";
import type {
  DelayRepayPortal,
  PortalClaimInput,
  PortalSubmitResult,
} from "@/lib/portals/types";

/**
 * Live Playwright adapter for the white-label Delay Repay portals.
 * Selectors are best-effort against current CX portal markup; failures
 * surface as needs_attention so the user can finish manually.
 */
export class PlaywrightDelayRepayPortal implements DelayRepayPortal {
  async submit(input: PortalClaimInput): Promise<PortalSubmitResult> {
    const baseUrl = OPERATOR_PORTAL_URLS[input.operator];
    const browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADED !== "1",
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(45_000);
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

      if (input.credentials) {
        const loggedIn = await tryLogin(page, input.credentials);
        if (!loggedIn) {
          return {
            ok: false,
            needsAttention: true,
            error:
              "Could not log in to operator Delay Repay portal (check credentials or CAPTCHA/MFA).",
          };
        }
      } else {
        const guest = page.getByRole("link", {
          name: /claim as guest|start a claim|guest/i,
        });
        if (await guest.count()) {
          await guest.first().click();
        }
      }

      await fillIfPresent(page, [
        { label: /from|origin|departure station/i, value: input.journey.originName },
        {
          label: /to|destination|arrival station/i,
          value: input.journey.destinationName,
        },
        { label: /journey date|travel date|date of travel/i, value: input.journey.runDate },
        {
          label: /delay|minutes delayed|length of delay/i,
          value: String(input.journey.delayMinutes),
        },
      ]);

      if (input.claimant.legalName) {
        await fillIfPresent(page, [
          { label: /full name|name/i, value: input.claimant.legalName },
        ]);
      }
      if (input.claimant.postcode) {
        await fillIfPresent(page, [
          { label: /postcode|postal code/i, value: input.claimant.postcode },
        ]);
      }

      if (input.evidenceFile) {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count()) {
          await fileInput.setInputFiles({
            name: input.evidenceFile.filename,
            mimeType: input.evidenceFile.mimeType,
            buffer: input.evidenceFile.bytes,
          });
        }
      }

      const submit = page.getByRole("button", {
        name: /submit|continue|next|confirm/i,
      });
      if (await submit.count()) {
        await submit.first().click();
        await page.waitForTimeout(2000);
      }

      const bodyText = (await page.locator("body").innerText()).slice(0, 4000);
      const refMatch =
        bodyText.match(/reference[:\s#]*([A-Z0-9-]{6,})/i) ??
        bodyText.match(/claim\s*(?:id|number)[:\s#]*([A-Z0-9-]{6,})/i);

      if (
        /thank you|submitted|received your claim|confirmation/i.test(bodyText) ||
        refMatch
      ) {
        return {
          ok: true,
          claimRef: refMatch?.[1] ?? `LIVE-${Date.now()}`,
        };
      }

      return {
        ok: false,
        needsAttention: true,
        error:
          "Portal submit did not reach a confirmation page. Claim may need manual completion.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        needsAttention: true,
        error: `Playwright portal submit failed: ${message}`,
      };
    } finally {
      await browser.close();
    }
  }
}

async function tryLogin(
  page: Page,
  credentials: { email: string; password: string },
): Promise<boolean> {
  const email = page
    .locator('input[type="email"], input[name*="email" i], input[id*="email" i]')
    .first();
  const password = page
    .locator(
      'input[type="password"], input[name*="password" i], input[id*="password" i]',
    )
    .first();

  if (!(await email.count()) || !(await password.count())) {
    return false;
  }

  await email.fill(credentials.email);
  await password.fill(credentials.password);

  const loginBtn = page.getByRole("button", { name: /log\s*in|sign\s*in|login/i });
  if (await loginBtn.count()) {
    await loginBtn.first().click();
  } else {
    await password.press("Enter");
  }

  await page.waitForTimeout(2500);

  const stillLogin =
    (await page.locator('input[type="password"]').count()) > 0 &&
    /log\s*in|sign\s*in/i.test(await page.locator("body").innerText());

  return !stillLogin;
}

async function fillIfPresent(
  page: Page,
  fields: { label: RegExp; value: string }[],
) {
  for (const field of fields) {
    const byLabel = page.getByLabel(field.label);
    if (await byLabel.count()) {
      await byLabel.first().fill(field.value);
      continue;
    }
    const byPlaceholder = page.getByPlaceholder(field.label);
    if (await byPlaceholder.count()) {
      await byPlaceholder.first().fill(field.value);
    }
  }
}
