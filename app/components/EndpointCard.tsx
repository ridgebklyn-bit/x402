"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, type Variants } from "framer-motion";
import { usePaymentSimulation } from "./usePaymentSimulation";

export type EndpointParam = { name: string; example: string; required?: boolean };

export type Endpoint = {
  path: string;
  desc: string;
  price: string;
  meta?: string;
  tag?: string;
  params?: EndpointParam[];
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

const TRY_IT_STATUS: Record<string, { text: string; className: string }> = {
  requesting: { text: "calling anonymously...", className: "text-accent-strong" },
  payment_required: { text: "402 — price quoted", className: "text-danger" },
  signing: { text: "signing payment...", className: "text-purple" },
  retrying: { text: "retrying with payment...", className: "text-success" },
  success: { text: "200 OK — settled", className: "text-success font-semibold" },
};

function buildExampleUrl(path: string, params?: EndpointParam[]): string {
  if (!params || params.length === 0) return `https://x402tap.com${path}`;
  const qs = params.map((p) => `${p.name}=${encodeURIComponent(p.example)}`).join("&");
  return `https://x402tap.com${path}?${qs}`;
}

export default function EndpointCard({ endpoint, flagship = false }: { endpoint: Endpoint; flagship?: boolean }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { step, run, isRunning } = usePaymentSimulation();

  // 3D tilt: raw pointer offset -> springed rotation, so the card settles
  // instead of snapping when the pointer moves fast. Only `transform`
  // (rotateX/rotateY via a CSS 3D matrix) is animated — no layout impact.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 260, damping: 22, mass: 0.4 });
  const springY = useSpring(rawY, { stiffness: 260, damping: 22, mass: 0.4 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [7, -7]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-7, 7]);
  const glowX = useTransform(springX, [-0.5, 0.5], ["20%", "80%"]);
  const glowY = useTransform(springY, [-0.5, 0.5], ["20%", "80%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    rawX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  const status = TRY_IT_STATUS[step];
  const exampleUrl = buildExampleUrl(endpoint.path, endpoint.params);

  return (
    <motion.div variants={cardVariants} style={{ perspective: 900 }}>
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="group relative rounded-2xl"
      >
        {/* Border-beam: a rotating conic-gradient ring, revealed only on
            hover/focus via opacity so it costs nothing while idle. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px overflow-hidden rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {/* Sized generously beyond the card and centered, so the rotating
              conic-gradient's corners sweep past behind the clip — the
              parent's overflow-hidden trims it down to just a beam gliding
              around the card's rounded edge instead of a diamond blowout. */}
          <div
            className="absolute left-1/2 top-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2 animate-border-beam"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0%, var(--color-accent) 6%, transparent 16%, var(--color-purple) 28%, transparent 38%, transparent 100%)",
            }}
          />
        </div>

        <div
          className={`relative overflow-hidden rounded-2xl border p-5 transition-colors duration-300 ${
            flagship
              ? "border-accent-border bg-gradient-to-b from-accent-soft to-surface"
              : "border-border bg-surface"
          } group-hover:border-border-strong`}
        >
          {/* Pointer-reactive sheen, follows the same spring as the tilt */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: useTransform(
                [glowX, glowY],
                ([gx, gy]) => `radial-gradient(280px circle at ${gx} ${gy}, rgba(61,123,255,0.10), transparent 70%)`,
              ),
            }}
          />

          <div className="relative" style={{ transform: "translateZ(24px)" }}>
            {flagship && endpoint.tag && (
              <span className="mb-3 inline-block rounded-full border border-accent-border bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent-strong">
                {endpoint.tag}
              </span>
            )}

            <div className="flex items-start justify-between gap-3">
              <span className="break-all font-mono text-[13px] text-text-primary sm:text-sm">{endpoint.path}</span>
              <motion.span
                whileHover={{ scale: 1.08 }}
                animate={
                  isRunning
                    ? { boxShadow: "0 0 0 4px rgba(61,123,255,0.14)" }
                    : { boxShadow: "0 0 0 0px rgba(61,123,255,0)" }
                }
                transition={{ duration: 0.3 }}
                className="shrink-0 rounded-md border border-accent-border bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-medium text-accent-strong sm:text-xs"
              >
                {endpoint.price}
              </motion.span>
            </div>

            <p className="mt-2.5 text-[13px] leading-relaxed text-text-secondary sm:text-sm">{endpoint.desc}</p>
            {endpoint.meta && <p className="mt-1.5 text-xs text-text-muted">{endpoint.meta}</p>}

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-4 flex items-center gap-1.5 text-xs font-medium text-accent-strong transition-colors hover:text-accent"
            >
              <motion.span
                animate={{ rotate: open ? 90 : 0 }}
                transition={{ duration: 0.2 }}
                className="inline-block"
                aria-hidden="true"
              >
                ›
              </motion.span>
              {open ? "Hide details" : "View params & try it"}
            </button>

            {/* Smooth height accordion via a 0fr/1fr grid track — avoids
                measuring scrollHeight in JS and stays jank-free even if the
                drawer's content size changes. */}
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="mt-4 border-t border-border/60 pt-4">
                  {endpoint.params && endpoint.params.length > 0 ? (
                    <ul className="space-y-1.5">
                      {endpoint.params.map((p) => (
                        <li key={p.name} className="flex items-baseline gap-2 font-mono text-xs">
                          <span className="text-accent-strong">{p.name}</span>
                          <span className="text-text-muted">= {p.example}</span>
                          {p.required && <span className="text-[10px] text-text-muted">(required)</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-mono text-xs text-text-muted">No query params required.</p>
                  )}

                  <p className="mt-3 break-all font-mono text-[11px] text-text-muted">{exampleUrl}</p>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={run}
                      disabled={isRunning}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-default disabled:bg-surface-hover disabled:text-text-muted"
                    >
                      {isRunning ? "Running..." : "Try it"}
                    </button>
                    <span className={`font-mono text-[11px] ${status?.className ?? "text-text-muted"}`}>
                      {status?.text ?? "simulated — no real payment sent"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
