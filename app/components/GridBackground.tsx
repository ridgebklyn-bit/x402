// Pure CSS, no interactivity — kept as a server component so it costs
// nothing on the client bundle. A faint drifting grid-mesh plus a radial
// vignette so the mesh fades out toward the edges instead of tiling
// harshly to the viewport bounds.
export default function GridBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.35] animate-grid-drift"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 90%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(61,123,255,0.14) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}
