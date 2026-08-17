// This page is gated by the `proxy.ts` middleware (matcher: "/protected/:path*").
// A request only reaches this component after a valid x402 payment has been
// verified, so anything rendered here is content the visitor has paid for.
export default function ProtectedPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "3rem" }}>
      <h1>🎉 Payment verified</h1>
      <p>
        This page is protected by the <code>x402</code> payment proxy. If
        you&apos;re seeing this, your request came with a valid payment
        signature.
      </p>
    </main>
  );
}
