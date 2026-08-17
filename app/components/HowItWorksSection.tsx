"use client";

import { useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

type Step = {
  title: string;
  body: string;
  badge: string;
  badgeClassName: string;
  detail: string;
};

const STEPS: Step[] = [
  {
    title: "Call the endpoint",
    body: "No payment attached, so the server replies 402 with the exact price and payment instructions.",
    badge: "GET",
    badgeClassName: "border-border-strong bg-surface text-text-secondary",
    detail: "GET /api/weather?city=Austin → 402",
  },
  {
    title: "Sign a payment",
    body: "Your wallet (or agent's x402 client) signs a USDC payment for that exact amount — no on-chain transaction yet.",
    badge: "SIGN",
    badgeClassName: "border-purple/40 bg-purple-soft text-purple",
    detail: "sign $0.001 USDC → Base",
  },
  {
    title: "Retry and get paid data",
    body: "Resend the request with the signed payment attached. The route runs, settles on success, and returns the response.",
    badge: "200",
    badgeClassName: "border-success/40 bg-success-soft text-success",
    detail: "200 OK · settled on Base",
  },
];

function StepRow({
  index,
  step,
  active,
  onEnter,
}: {
  index: number;
  step: Step;
  active: boolean;
  onEnter: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-35% 0px -35% 0px" });

  // Forward the intersection result to the parent from an effect, not
  // during render — calling a parent state setter mid-render forces React
  // to throw away and redo the in-progress render pass, which on a
  // scroll-driven observer firing rapidly is what produced the jank.
  useEffect(() => {
    if (inView) onEnter(index);
  }, [inView, index, onEnter]);

  return (
    <div ref={ref} className="flex gap-4 py-5 sm:gap-5">
      <motion.span
        animate={{
          scale: active ? 1.08 : 1,
          opacity: active ? 1 : 0.45,
        }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold sm:h-10 sm:w-10 ${
          active
            ? "border-accent bg-accent-soft text-accent-strong shadow-[0_0_18px_var(--color-accent-soft)]"
            : "border-border-strong text-text-muted"
        }`}
      >
        {index + 1}
      </motion.span>
      <div>
        <h3 className={`text-base font-medium transition-colors duration-300 ${active ? "text-text-primary" : "text-text-secondary"}`}>
          {step.title}
        </h3>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-secondary">{step.body}</p>
      </div>
    </div>
  );
}

// The right-column companion to the step list: a vertical pipeline instead
// of a second terminal mock (the hero above already owns "terminal window"
// as a motif — repeating it here read as a duplicate animation). A single
// connector line grows to the active stage as the user scrolls, each node
// carries the same status-badge language used elsewhere on the page
// (danger/purple/success), and the one-line mono detail underneath echoes
// exactly what that step's text description says.
function FlowPipeline({ activeStep }: { activeStep: number }) {
  const fillFraction = (activeStep + 1) / STEPS.length;

  return (
    <div className="relative py-2 pl-2">
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border/60" aria-hidden="true" />
      <motion.div
        className="absolute left-[19px] top-2 w-px origin-top bg-gradient-to-b from-accent via-accent-strong to-success"
        style={{ bottom: 2 }}
        animate={{ scaleY: fillFraction }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-8">
        {STEPS.map((step, i) => {
          const active = activeStep === i;
          const passed = activeStep >= i;
          return (
            <div key={step.title} className="relative flex items-center gap-4 pl-0">
              <motion.span
                animate={{
                  scale: active ? 1.15 : 1,
                  borderColor: passed ? "var(--color-accent)" : "var(--color-border-strong)",
                  backgroundColor: passed ? "var(--color-accent)" : "var(--color-bg)",
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="z-10 h-2.5 w-2.5 shrink-0 rounded-full border-2 sm:h-3 sm:w-3"
              />
              <motion.div
                animate={{ opacity: active ? 1 : 0.55 }}
                transition={{ duration: 0.3 }}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-border/60 bg-bg/40 px-3.5 py-2.5 sm:px-4 sm:py-3"
              >
                <span className="truncate font-mono text-[11px] text-text-secondary sm:text-xs">{step.detail}</span>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold transition-colors duration-300 ${step.badgeClassName}`}
                >
                  {step.badge}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
      <div className="divide-y divide-border/60">
        {STEPS.map((step, i) => (
          <StepRow key={step.title} index={i} step={step} active={activeStep === i} onEnter={setActiveStep} />
        ))}
      </div>

      <div className="sticky top-24 self-start rounded-2xl border border-border bg-surface/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-6">
        <div className="mb-1">
          <h3 className="text-sm font-medium text-text-primary">Payment flow</h3>
          <p className="mt-0.5 text-xs text-text-muted">Follows the step you&apos;re reading.</p>
        </div>
        <FlowPipeline activeStep={activeStep} />
      </div>
    </div>
  );
}
