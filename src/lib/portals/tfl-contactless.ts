import { chromium } from "playwright";
import {
  parseTflFareFromProofBytes,
  parseTflFareFromText,
} from "@/lib/portals/tfl-fare";
import type {
  TflProofFetcher,
  TflProofInput,
  TflProofResult,
} from "@/lib/portals/types";

const TFL_URL = "https://contactless.tfl.gov.uk/";

/**
 * Live Playwright adapter for TfL Contactless & Oyster journey history.
 * Downloads journey proof for PAYG Delay Repay evidence and extracts the fare.
 */
export class PlaywrightTflProofFetcher implements TflProofFetcher {
  async fetchJourneyProof(input: TflProofInput): Promise<TflProofResult> {
    const browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADED !== "1",
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(45_000);
      await page.goto(TFL_URL, { waitUntil: "domcontentloaded" });

      const signIn = page.getByRole("link", { name: /sign in/i });
      if (await signIn.count()) {
        await signIn.first().click();
        await page.waitForLoadState("domcontentloaded");
      }

      const email = page
        .locator(
          'input[type="email"], input[name*="email" i], input[id*="email" i]',
        )
        .first();
      const password = page.locator('input[type="password"]').first();

      if (!(await email.count()) || !(await password.count())) {
        return {
          ok: false,
          retryable: false,
          error: "TfL login form not found (page layout may have changed).",
        };
      }

      await email.fill(input.credentials.email);
      await password.fill(input.credentials.password);
      const loginBtn = page.getByRole("button", {
        name: /sign in|log in|continue/i,
      });
      if (await loginBtn.count()) {
        await loginBtn.first().click();
      } else {
        await password.press("Enter");
      }
      await page.waitForTimeout(3000);

      if (await page.locator('input[type="password"]').count()) {
        return {
          ok: false,
          retryable: false,
          error:
            "TfL login failed — check credentials or complete MFA manually.",
        };
      }

      const history = page.getByRole("link", {
        name: /journey.*history|payment history|journey & payment/i,
      });
      if (await history.count()) {
        await history.first().click();
        await page.waitForLoadState("domcontentloaded");
      }

      const dateInput = page
        .locator('input[type="date"], input[name*="date" i]')
        .first();
      if (await dateInput.count()) {
        await dateInput.fill(input.runDate);
      }

      const bodyText = await page.locator("body").innerText();
      const originHit = bodyText
        .toLowerCase()
        .includes(input.originName.toLowerCase().slice(0, 8));
      const destHit = bodyText
        .toLowerCase()
        .includes(input.destinationName.toLowerCase().slice(0, 8));

      if (!originHit && !destHit && !bodyText.includes(input.runDate)) {
        return {
          ok: false,
          retryable: true,
          error:
            "No matching TfL journey found yet — contactless history often lags overnight.",
        };
      }

      const downloadPromise = page
        .waitForEvent("download", { timeout: 8_000 })
        .catch(() => null);
      const downloadBtn = page.getByRole("link", {
        name: /download|pdf|csv|export|statement/i,
      });
      const downloadBtnAlt = page.getByRole("button", {
        name: /download|pdf|csv|export|statement/i,
      });
      if (await downloadBtn.count()) {
        await downloadBtn.first().click();
      } else if (await downloadBtnAlt.count()) {
        await downloadBtnAlt.first().click();
      }

      const download = await downloadPromise;
      let fileBytes: Buffer;
      let mimeType = "application/pdf";

      if (download) {
        const path = await download.path();
        if (path) {
          const fs = await import("node:fs/promises");
          fileBytes = await fs.readFile(path);
          const suggested = download.suggestedFilename().toLowerCase();
          mimeType = suggested.endsWith(".csv")
            ? "text/csv"
            : "application/pdf";
        } else {
          fileBytes = Buffer.from(bodyText, "utf8");
          mimeType = "text/plain";
        }
      } else {
        fileBytes = Buffer.from(
          [
            "TfL Journey & Payment History extract",
            `Fetched: ${new Date().toISOString()}`,
            `Target date: ${input.runDate}`,
            `Route hint: ${input.originName} → ${input.destinationName}`,
            "",
            bodyText.slice(0, 12_000),
          ].join("\n"),
          "utf8",
        );
        mimeType = "text/plain";
      }

      const farePence =
        parseTflFareFromProofBytes(fileBytes, mimeType) ??
        parseTflFareFromText(bodyText);

      if (farePence == null) {
        return {
          ok: false,
          retryable: true,
          error:
            "Matched a TfL journey but could not read the journey charge from the statement.",
          fileBytes,
          mimeType,
        };
      }

      return {
        ok: true,
        fileBytes,
        mimeType,
        farePence,
        matchedJourneySummary: `${input.runDate} ${input.originName} → ${input.destinationName} · £${(farePence / 100).toFixed(2)}`,
        tflJourneyId: `tfl-${input.runDate}-${input.originCrs}-${input.destinationCrs}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        retryable: true,
        error: `TfL proof fetch failed: ${message}`,
      };
    } finally {
      await browser.close();
    }
  }
}
