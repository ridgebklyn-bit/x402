"use client";

import { useEffect, useRef } from "react";

// Ambient pointer-follow radial glow. Deliberately implemented with a raw
// ref + rAF loop instead of React state — state updates on every mousemove
// would re-render the whole tree at 60-120hz. Only `transform` is written
// per frame (GPU-accelerated, no layout/paint cost), and the two coordinate
// refs are updated directly by the listener with no re-render in between.
export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Skip entirely for touch-only / reduced-motion users — there's no
    // pointer to follow, and it's pure decoration, not functionality.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (prefersReducedMotion || isCoarsePointer) return;

    current.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    target.current = { ...current.current };

    const handleMove = (e: PointerEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", handleMove, { passive: true });

    const tick = () => {
      // Light easing so the glow trails the cursor rather than snapping to
      // it — reads as "fluid" instead of jittery, still hardware-accelerated
      // since only a translate3d transform is touched.
      current.current.x += (target.current.x - current.current.x) * 0.12;
      current.current.y += (target.current.y - current.current.y) * 0.12;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0)`;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-0 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 mix-blend-screen will-change-transform"
      style={{
        background:
          "radial-gradient(circle, rgba(61,123,255,0.16) 0%, rgba(163,116,255,0.10) 38%, rgba(9,11,16,0) 70%)",
      }}
    />
  );
}
