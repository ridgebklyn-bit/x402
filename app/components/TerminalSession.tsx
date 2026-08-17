"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type TermLine = {
  type: "prompt" | "call" | "tree" | "response" | "receipt";
  text: string;
  href?: string;
};

type TermSession = { lines: TermLine[] };

// Three real request/response shapes pulled straight from this server's own
// endpoints. The weather and /protected sessions end in transaction hashes
// from actual settlements run and independently verified against Vercel's
// runtime logs earlier in this project (not fabricated) — click either to
// check it on Basescan. The crypto-price session's response payload is
// illustrative (that endpoint's real response varies call to call), so it
// intentionally doesn't carry a settlement hash the way the other two do.
const SESSIONS: TermSession[] = [
  {
    lines: [
      { type: "prompt", text: "curl https://x402tap.com/api/weather?city=Austin" },
      { type: "call", text: "GET /api/weather?city=Austin" },
      { type: "tree", text: "402 → $0.001 USDC on Base → signed → verified" },
      { type: "response", text: '{ "city": "Austin", "temp_f": 91, "conditions": "clear" }' },
      {
        type: "receipt",
        text: "$0.001 · settled on Base · 0x21f1fb70…ab08fb",
        href: "https://basescan.org/tx/0x21f1fb70c1733b06013ccc69313c6e3ac442f63f50b1116ac422bac77eab08fb",
      },
    ],
  },
  {
    lines: [
      { type: "prompt", text: "curl https://x402tap.com/protected" },
      { type: "call", text: "GET /protected" },
      { type: "tree", text: "402 → $0.001 USDC on Base → signed → verified" },
      { type: "response", text: '"Payment verified — protected HTML content unlocked."' },
      {
        type: "receipt",
        text: "$0.001 · settled on Base · 0xafc472a4…b86261",
        href: "https://basescan.org/tx/0xafc472a4230f29a5e5729aa7323f1005f7d14e4e75a8196336791580d2b86261",
      },
    ],
  },
  {
    lines: [
      { type: "prompt", text: "curl https://x402tap.com/api/crypto-price?symbol=BTC" },
      { type: "call", text: "GET /api/crypto-price?symbol=BTC" },
      { type: "tree", text: "402 → $0.001 USDC on Base → signed → verified" },
      { type: "response", text: '{ "symbol": "BTC", "price_usd": 71234.50, "change_24h": "+2.1%" }' },
      { type: "receipt", text: "$0.001 · settled on Base" },
    ],
  },
];

const TYPE_SPEED_MS = 24;
const LINE_GAP_MS = 320;
const HOLD_MS = 2400;
const RESET_GAP_MS = 500;

function useTerminalTyping(sessions: TermSession[]) {
  const [sessionIndex, setSessionIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const tokenRef = useRef(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const token = ++tokenRef.current;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const run = async () => {
      // Deferred one microtask so nothing here runs synchronously inside the
      // effect body itself (matches the async-closure pattern used by
      // usePaymentSimulation.ts elsewhere in this codebase).
      await Promise.resolve();
      if (tokenRef.current !== token) return;

      if (reducedMotion) {
        // Show the first session fully revealed, statically — no typing,
        // no looping.
        const promptLen = sessions[0].lines[0].text.length;
        setSessionIndex(0);
        setTypedChars(promptLen);
        setRevealedCount(sessions[0].lines.length);
        return;
      }

      let s = 0;
      while (tokenRef.current === token) {
        const session = sessions[s % sessions.length];
        setSessionIndex(s % sessions.length);
        setTypedChars(0);
        setRevealedCount(0);

        const prompt = session.lines[0].text;
        for (let i = 1; i <= prompt.length; i++) {
          if (tokenRef.current !== token) return;
          setTypedChars(i);
          await sleep(TYPE_SPEED_MS);
        }
        setRevealedCount(1);

        for (let line = 2; line <= session.lines.length; line++) {
          if (tokenRef.current !== token) return;
          await sleep(LINE_GAP_MS);
          setRevealedCount(line);
        }

        await sleep(HOLD_MS);
        if (tokenRef.current !== token) return;
        setRevealedCount(0);
        setTypedChars(0);
        await sleep(RESET_GAP_MS);
        s += 1;
      }
    };

    void run();
    return () => {
      tokenRef.current += 1;
    };
  }, [sessions]);

  return { sessionIndex, typedChars, revealedCount };
}

function LineContent({ line }: { line: TermLine }) {
  const inner = (() => {
    switch (line.type) {
      case "call":
        return (
          <>
            <span className="mr-2 text-accent-strong">●</span>
            <span className="text-text-primary">{line.text}</span>
          </>
        );
      case "tree":
        return (
          <>
            <span className="mr-2 text-text-muted">└</span>
            <span className="text-purple">{line.text}</span>
          </>
        );
      case "response":
        return (
          <>
            <span className="mr-2 text-text-muted">└</span>
            <span className="text-text-secondary">{line.text}</span>
          </>
        );
      case "receipt":
        return (
          <>
            <span className="mr-2 text-success">✓</span>
            <span className="font-medium text-success">{line.text}</span>
          </>
        );
      default:
        return null;
    }
  })();

  if (line.type === "receipt" && line.href) {
    return (
      <a
        href={line.href}
        target="_blank"
        rel="noreferrer"
        className="block rounded transition-colors hover:bg-success-soft"
      >
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

export default function TerminalSession() {
  const { sessionIndex, typedChars, revealedCount } = useTerminalTyping(SESSIONS);
  const session = SESSIONS[sessionIndex];
  const prompt = session.lines[0].text;
  const isPromptDone = typedChars >= prompt.length;
  const statusIs200 = revealedCount >= session.lines.length;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface/60 shadow-2xl shadow-black/40 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-bg/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f0b429]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <span className="font-mono text-[11px] text-text-muted">agent session · MicroTap</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold transition-colors duration-300 ${
              statusIs200
                ? "border-success/30 bg-success-soft text-success"
                : "border-danger/30 bg-danger-soft text-danger"
            }`}
          >
            {statusIs200 ? "200" : "402"}
          </span>
          <span className="rounded-md border border-border-strong px-2 py-0.5 font-mono text-[10px] text-text-muted">
            x402 · usdc
          </span>
        </div>
      </div>

      <div className="min-h-[190px] px-4 py-4 font-mono text-[12px] leading-relaxed sm:min-h-[210px] sm:px-5 sm:text-[13px]">
        <div>
          <span className="mr-2 text-text-muted">$</span>
          <span className="text-text-primary">{prompt.slice(0, typedChars)}</span>
          {!isPromptDone && (
            <span className="ml-0.5 inline-block h-[1em] w-[7px] translate-y-[2px] animate-pulse-dot bg-accent-strong align-middle" />
          )}
        </div>

        <div className="mt-2.5 space-y-2">
          <AnimatePresence>
            {session.lines.slice(1, revealedCount).map((line, i) => (
              <motion.div
                key={`${sessionIndex}-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <LineContent line={line} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
