"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePaymentSimulation, type PaymentStep } from "./usePaymentSimulation";

const GATE_LABEL: Record<PaymentStep, { text: string; className: string }> = {
  idle: { text: "402", className: "text-text-muted" },
  requesting: { text: "402", className: "text-text-muted" },
  payment_required: { text: "402", className: "text-danger" },
  signing: { text: "402", className: "text-purple" },
  retrying: { text: "200", className: "text-success" },
  success: { text: "200", className: "text-success" },
};

const STATUS_COPY: Partial<Record<PaymentStep, { text: string; className: string }>> = {
  requesting: {
    text: "GET /api/weather?city=Austin — calling the route anonymously...",
    className: "text-accent-strong",
  },
  payment_required: {
    text: "HTTP 402 Payment Required — server wants $0.001 USDC on Base.",
    className: "text-danger",
  },
  signing: {
    text: "Agent wallet signing the micropayment authorization...",
    className: "text-purple",
  },
  retrying: {
    text: "Retrying with the signed payment attached...",
    className: "text-success",
  },
  success: {
    text: "HTTP 200 OK — payment settled, weather data returned.",
    className: "text-success font-semibold",
  },
};

export default function PacketFlowDemo() {
  const { step, run, isRunning } = usePaymentSimulation();
  const autoStarted = useRef(false);

  useEffect(() => {
    if (autoStarted.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    autoStarted.current = true;
    // Small delay so the hero has already faded in before the demo starts —
    // this is the "on page load" hook telling the 402 -> paid story.
    const timeout = setTimeout(() => run(), 900);
    return () => clearTimeout(timeout);
  }, [run]);

  const gate = GATE_LABEL[step];
  const status = STATUS_COPY[step];

  return (
    <div className="relative w-full rounded-2xl border border-border bg-surface/60 p-5 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Live handshake preview</h3>
          <p className="mt-0.5 text-xs text-text-muted">Every call on this page works exactly like this.</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={isRunning}
          className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-default disabled:bg-surface-hover disabled:text-text-muted"
        >
          {isRunning ? "Running..." : "Replay"}
        </button>
      </div>

      <div className="relative flex h-24 items-center justify-between overflow-hidden rounded-xl border border-border/60 bg-bg/50 px-6 sm:h-28 sm:px-10">
        {/* Node: agent */}
        <div className="z-10 text-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg border text-base transition-colors duration-300 sm:h-11 sm:w-11 ${
              step === "signing"
                ? "border-purple bg-purple-soft text-purple shadow-[0_0_16px_rgba(163,116,255,0.25)]"
                : "border-border-strong bg-surface text-text-secondary"
            }`}
          >
            <span aria-hidden="true">agent</span>
          </div>
          <span className="mt-1.5 block font-mono text-[10px] text-text-muted">client</span>
        </div>

        {/* Track */}
        <div className="absolute left-16 right-16 top-[38px] h-px bg-border-strong sm:left-24 sm:right-24 sm:top-[46px]">
          <AnimatePresence>
            {step === "requesting" && (
              <motion.span
                key="pkt-request"
                initial={{ left: "0%", opacity: 1 }}
                animate={{ left: "50%" }}
                exit={{ opacity: 0, scale: 1.4 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]"
              />
            )}
            {step === "retrying" && (
              <motion.span
                key="pkt-retry"
                initial={{ left: "0%" }}
                animate={{ left: "100%" }}
                transition={{ duration: 0.65, ease: "easeInOut" }}
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-success shadow-[0_0_10px_var(--color-success)]"
              />
            )}
            {step === "success" && (
              <motion.span
                key="pkt-return"
                initial={{ left: "100%" }}
                animate={{ left: "0%" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-gradient-to-r from-accent to-success shadow-[0_0_14px_var(--color-success)]"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Node: gate */}
        <div className="absolute left-1/2 top-[18px] z-10 -translate-x-1/2 text-center sm:top-[22px]">
          <motion.div
            animate={{
              scale: step === "payment_required" ? [1, 1.12, 1] : 1,
            }}
            transition={{ duration: 0.5 }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-bg font-mono text-[11px] font-bold sm:h-10 sm:w-10"
          >
            <span className={gate.className}>{gate.text}</span>
          </motion.div>
          <span className="mt-1.5 block font-mono text-[9px] uppercase tracking-wider text-text-muted">gate</span>
        </div>

        {/* Node: API */}
        <div className="z-10 text-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg border text-base transition-colors duration-300 sm:h-11 sm:w-11 ${
              step === "success"
                ? "border-success bg-success-soft text-success shadow-[0_0_16px_rgba(34,197,139,0.25)]"
                : "border-border-strong bg-surface text-text-secondary"
            }`}
          >
            <span aria-hidden="true">api</span>
          </div>
          <span className="mt-1.5 block font-mono text-[10px] text-text-muted">route</span>
        </div>
      </div>

      <div className="mt-4 flex min-h-[40px] items-center rounded-lg border border-border/60 bg-bg/40 px-3 py-2.5 font-mono text-[11px] sm:text-xs">
        <AnimatePresence mode="wait">
          {status ? (
            <motion.span
              key={step}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={status.className}
            >
              {status.text}
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-text-muted"
            >
              Click replay to watch a 402 → sign → 200 round trip.
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
