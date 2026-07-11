import { MockDelayRepayPortal, MockTflProofFetcher } from "@/lib/portals/mock";
import { PlaywrightDelayRepayPortal } from "@/lib/portals/delay-repay";
import { PlaywrightTflProofFetcher } from "@/lib/portals/tfl-contactless";
import {
  claimSubmitMode,
  type DelayRepayPortal,
  type TflProofFetcher,
} from "@/lib/portals/types";

export function getDelayRepayPortal(): DelayRepayPortal {
  return claimSubmitMode() === "live"
    ? new PlaywrightDelayRepayPortal()
    : new MockDelayRepayPortal();
}

export function getTflProofFetcher(): TflProofFetcher {
  return claimSubmitMode() === "live"
    ? new PlaywrightTflProofFetcher()
    : new MockTflProofFetcher();
}
