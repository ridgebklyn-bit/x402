"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type PulseTx = {
  tx_hash: string;
  value_usd: number;
  block_timestamp: string;
  chain: string;
  facilitator: string;
};

type PulseOverview = {
  totalTransactions24h: number;
  totalVolumeUsd24h: number;
  uniqueBuyers: number;
  uniqueSellers: number;
};

type PulseResponse = {
  overview: PulseOverview | null;
  transactions: PulseTx[];
  fetchedAt: string;
};

const POLL_MS = 10_000;

// /api/pulse samples a short (1.5s) live window each time it's hit, so
// consecutive polls mostly return a *different* set of transactions, not an
// incremental update. Rather than replace the visible list wholesale every
// 10s (which was both the layout-shift trigger and needless churn — nearly
// every row would unmount/remount, restarting its entrance animation and
// resizing the panel), incoming transactions are merged into a rolling,
// deduped, capped client-side window. Existing rows keep their React key
// (tx_hash) across polls whenever the same transaction reappears or simply
// isn't evicted yet, so React only mounts DOM nodes for genuinely new rows.
const MAX_STORED_ROWS = 30;

// Fixed height for the scrollable ticker body. Keeping this constant
// (rather than sizing to content) is what stops the panel — and everything
// below it on the page — from jumping every time the row count or content
// changes.
const FEED_HEIGHT_PX = 380;

function mergeTransactions(existing: PulseTx[], incoming: PulseTx[]): PulseTx[] {
  const byHash = new Map<string, PulseTx>();
  for (const tx of existing) byHash.set(tx.tx_hash, tx);
  for (const tx of incoming) byHash.set(tx.tx_hash, tx);
  return Array.from(byHash.values())
    .sort((a, b) => new Date(b.block_timestamp).getTime() - new Date(a.block_timestamp).getTime())
    .slice(0, MAX_STORED_ROWS);
}

function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

function formatUsd(n: number): string {
  if (n < 1) return `$${n.toFixed(4)}`;
  if (n < 1000) return `$${n.toFixed(2)}`;
  return `$${(n / 1000).toFixed(1)}k`;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function explorerUrl(chain: string, hash: string): string | null {
  if (chain === "base") return `https://basescan.org/tx/${hash}`;
  if (chain === "solana") return `https://solscan.io/tx/${hash}`;
  return null;
}

function ageLabel(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export default function ProtocolPulse() {
  const [data, setData] = useState<PulseResponse | null>(null);
  const [hasErrored, setHasErrored] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const loadedOnce = useRef(false);

  // Scroll-position preservation across prepends: captured just before each
  // state update (still reflects pre-update DOM), then reconciled in a
  // layout effect once the new rows have actually mounted.
  const scrollRef = useRef<HTMLDivElement>(null);
  const preUpdateScrollRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/pulse", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as PulseResponse;
        if (cancelled) return;

        if (scrollRef.current) {
          preUpdateScrollRef.current = {
            scrollTop: scrollRef.current.scrollTop,
            scrollHeight: scrollRef.current.scrollHeight,
          };
        }

        setData((prev) => ({
          ...json,
          transactions: mergeTransactions(prev?.transactions ?? [], json.transactions),
        }));
        setHasErrored(false);
        loadedOnce.current = true;
      } catch {
        if (cancelled) return;
        // Keep showing the last-known-good data if we have any; only flip
        // to the error state if we've never successfully loaded.
        if (!loadedOnce.current) setHasErrored(true);
      }
    };

    void load();
    const poll = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  // Runs after the merged rows have committed to the DOM. If the user had
  // scrolled down into the feed (reading older entries), new rows prepended
  // above would otherwise silently shift what's under their cursor — this
  // keeps the same content anchored under the viewport by offsetting
  // scrollTop by exactly how much taller the content got. If they were
  // pinned to the top, it deliberately leaves scrollTop alone so the newest
  // row animates in at the top, which is the expected "ticker" feel.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const pre = preUpdateScrollRef.current;
    preUpdateScrollRef.current = null;
    if (!el || !pre) return;

    const wasPinnedToTop = pre.scrollTop <= 4;
    if (wasPinnedToTop) return;

    const delta = el.scrollHeight - pre.scrollHeight;
    if (delta !== 0) {
      el.scrollTop = pre.scrollTop + delta;
    }
  }, [data]);

  // Client-only ticking clock for "Xs ago" labels — kept separate from data
  // polling so the age labels update every second without refetching. `now`
  // already starts at Date.now() via its lazy initializer above, so this
  // effect only needs to set up the interval, not perform an initial
  // synchronous setState itself.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const rows = data?.transactions ?? [];
  const overview = data?.overview ?? null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface/60 shadow-2xl shadow-black/40 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse-dot rounded-full bg-success" />
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
              Live · x402 protocol, every seller
            </h3>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Real ecosystem-wide activity — not just this server. Data via{" "}
            <a
              href="https://agentic.market"
              target="_blank"
              rel="noreferrer"
              className="text-text-secondary underline decoration-border-strong underline-offset-2 transition-colors hover:text-accent-strong"
            >
              agentic.market
            </a>
            .
          </p>
        </div>
        {overview && (
          <div className="flex gap-5 font-mono text-xs text-text-muted sm:gap-6">
            <div>
              <div className="text-base font-semibold text-text-primary sm:text-lg">
                {formatInt(overview.totalTransactions24h)}
              </div>
              <div>txns · 24h</div>
            </div>
            <div>
              <div className="text-base font-semibold text-text-primary sm:text-lg">
                {formatUsd(overview.totalVolumeUsd24h)}
              </div>
              <div>volume · 24h</div>
            </div>
            <div className="hidden sm:block">
              <div className="text-base font-semibold text-text-primary sm:text-lg">
                {formatInt(overview.uniqueSellers)}
              </div>
              <div>sellers</div>
            </div>
          </div>
        )}
      </div>

      {/*
        Fixed height + overflow-y auto + CSS containment: this is what makes
        the feed a self-contained ticker instead of something that reflows
        the whole page. The panel's total height is constant from the very
        first render — connecting state, error state, and populated state
        all occupy the same box — so nothing below it (How it works,
        footer) ever moves, whether the feed is loading, erroring, or
        updating. New rows scroll *inside* this box, never outside it.
        `contain: content` (layout + style + paint containment) tells the
        browser this subtree's internal reflows can never affect anything
        outside it, so updates here don't trigger a layout pass on the rest
        of the page. The column-header row lives inside this same box
        (rather than above it) specifically so its appearance/disappearance
        can't change the panel's total height either.
      */}
      <div
        ref={scrollRef}
        className="overflow-y-auto px-2 py-2 sm:px-3"
        style={{ height: FEED_HEIGHT_PX, contain: "content" }}
      >
        {hasErrored && rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-text-muted">
            Live feed temporarily unavailable — check back shortly.
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-text-muted">Connecting to the live feed…</div>
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted sm:grid">
              <span>Tx</span>
              <span>Amount</span>
              <span>Chain</span>
              <span className="text-right">Age</span>
            </div>
            <AnimatePresence initial={false}>
            {rows.map((tx) => {
              const link = explorerUrl(tx.chain, tx.tx_hash);
              const Row = link ? "a" : "div";
              return (
                <motion.div
                  key={tx.tx_hash}
                  layout="position"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <Row
                    {...(link ? { href: link, target: "_blank", rel: "noreferrer" } : {})}
                    className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-lg px-3 py-2 font-mono text-xs sm:grid-cols-[1fr_auto_auto_auto] ${
                      link ? "transition-colors hover:bg-surface-hover" : ""
                    }`}
                  >
                    <span className="truncate text-text-secondary">{truncateHash(tx.tx_hash)}</span>
                    <span className="text-text-primary">{formatUsd(tx.value_usd)}</span>
                    <span className="hidden text-text-muted sm:inline">{tx.chain}</span>
                    <span className="text-right text-text-muted">{now ? ageLabel(tx.block_timestamp, now) : "—"}</span>
                  </Row>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </>
        )}
      </div>

      {overview && (
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3 text-[11px] text-text-muted sm:px-6">
          <span>
            {formatInt(overview.uniqueBuyers)} buyers · {formatInt(overview.uniqueSellers)} sellers, past 24h across
            the whole protocol
          </span>
          <a
            href="https://agentic.market"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 whitespace-nowrap text-accent-strong transition-colors hover:text-accent"
          >
            View live feed →
          </a>
        </div>
      )}
    </div>
  );
}
