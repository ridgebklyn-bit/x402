"use client";

import { useCallback, useRef, useState } from "react";

// Shared timeline for every "watch the x402 handshake happen" animation on
// the page — the full hero visualizer and each endpoint card's compact "Try
// it" replay both drive off this one hook so the pacing (and the story it
// tells: anonymous call -> 402 -> sign -> retry -> paid data) stays
// consistent everywhere it appears instead of drifting out of sync.
export type PaymentStep =
  | "idle"
  | "requesting"
  | "payment_required"
  | "signing"
  | "retrying"
  | "success";

const STEP_DURATIONS: Record<Exclude<PaymentStep, "idle">, number> = {
  requesting: 700,
  payment_required: 1100,
  signing: 1100,
  retrying: 700,
  success: 2600, // how long "success" holds before the caller can reset/replay
};

const SEQUENCE: Exclude<PaymentStep, "idle">[] = [
  "requesting",
  "payment_required",
  "signing",
  "retrying",
  "success",
];

export function usePaymentSimulation() {
  const [step, setStep] = useState<PaymentStep>("idle");
  const runToken = useRef(0);

  const run = useCallback(() => {
    // Bump a token so a stale in-flight timeout chain from a previous click
    // can't clobber state after a fresh run has already started.
    const token = ++runToken.current;
    let cancelled = false;

    const advance = async () => {
      for (const next of SEQUENCE) {
        if (cancelled || runToken.current !== token) return;
        setStep(next);
        await new Promise((resolve) => setTimeout(resolve, STEP_DURATIONS[next]));
      }
      if (!cancelled && runToken.current === token) setStep("idle");
    };

    void advance();
    return () => {
      cancelled = true;
    };
  }, []);

  const isRunning = step !== "idle";

  return { step, run, isRunning };
}
