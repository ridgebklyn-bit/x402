"use client";

import { useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

type Step = {
  title: string;
  body: string;
  terminalLines: string[]; // indices into TERMINAL_LINES this step highlights
};

const STEPS: Step[] = [
  {
    title: "Call the endpoint",
    body: "No payment attached, so the server replies 402 with the exact price and payment instructions.",
    terminalLines: ["request", "response402"],
  },
  {
    title: "Sign a payment",
    body: "Your wallet (or agent's x402 client) signs a USDC payment for that exact amount — no on-chain transaction yet.",
    terminalLines: ["retryComment"],
  },
  {
    title: "Retry and get paid data",
    body: "Resend the request with the signed payment attached. The route runs, settles on success, and returns the response.",
    terminalLines: ["retry", "response200"],
  },
];

// One line of the terminal mock. `id` is what a step's terminalLines array
// references to decide whether this line should be highlighted right now.
const TERMINAL_LINES: { id: string; node: React.ReactNode }[] = [
  { id: "comment1", node: <span className="text-text-muted"># 1. call without payment</span> },
  {
    id: "request",
    node: <span className="text-text-primary">curl https://x402tap.com/api/weather?city=Austin</span>,
  },
  { id: "blank1", node: <span>&nbsp;</span> },
  {
    id: "response402",
    node: (
      <span>
        <span className="text-danger">HTTP/1.1</span> 402 Payment Required
      </span>
    ),
  },
  {
    id: "response402b",
    node: (
      <span className="text-text-secondary">
        payment-required: {"{"} <span className="text-success">&quot;accepts&quot;</span>: [{"{"}{" "}
        <span className="text-success">&quot;price&quot;</span>:{" "}
        <span className="text-success">&quot;$0.001&quot;</span>, ... {"}"}] {"}"}
      </span>
    ),
  },
  { id: "blank2", node: <span>&nbsp;</span> },
  {
    id: "retryComment",
    node: <span className="text-text-muted"># 2+3. sign + retry (handled by an x402 client)</span>,
  },
  {
    id: "retry",
    node: (
      <span className="text-text-primary">npx @x402/fetch https://x402tap.com/api/weather?city=Austin</span>
    ),
  },
  { id: "blank3", node: <span>&nbsp;</span> },
  {
    id: "response200",
    node: (
      <span>
        <span className="text-success">HTTP/1.1</span> 200 OK
      </span>
    ),
  },
  {
    id: "response200b",
    node: (
      <span className="text-text-secondary">
        {"{"} <span className="text-success">&quot;location&quot;</span>:{" "}
        <span className="text-success">&quot;Austin, Texas&quot;</span>,{" "}
        <span className="text-success">&quot;report&quot;</span>: {"{"} ... {"}"} {"}"}
      </span>
    ),
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

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const activeLineIds = new Set(STEPS[activeStep].terminalLines);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
      <div className="divide-y divide-border/60">
        {STEPS.map((step, i) => (
          <StepRow key={step.title} index={i} step={step} active={activeStep === i} onEnter={setActiveStep} />
        ))}
      </div>

      <div className="sticky top-24 self-start rounded-2xl border border-border bg-surface/70 shadow-2xl shadow-black/30 backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-purple/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-2 font-mono text-xs text-text-muted">curl</span>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-[12px] leading-relaxed sm:text-[13px]">
          {TERMINAL_LINES.map((line) => (
            <motion.div
              key={line.id}
              animate={{
                opacity: activeLineIds.has(line.id) ? 1 : 0.42,
                backgroundColor: activeLineIds.has(line.id) ? "rgba(61,123,255,0.08)" : "rgba(0,0,0,0)",
              }}
              transition={{ duration: 0.35 }}
              className="-mx-2 rounded px-2 py-0.5"
            >
              {line.node}
            </motion.div>
          ))}
        </pre>
      </div>
    </div>
  );
}
