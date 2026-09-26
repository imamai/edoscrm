"use client";

/**
 * The last resort: a failure in the root layout itself, where the app shell
 * has not rendered and none of the normal styling exists. Everything here is
 * inline for that reason.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f8fb", color: "#12141c" }}>
        <div style={{ maxWidth: 420, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>EDOS CRM couldn&rsquo;t start</h1>
          <p style={{ fontSize: 14, color: "#6b7080", lineHeight: 1.6 }}>
            Something failed before the page could load. Reloading usually clears it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16, padding: "8px 14px", fontSize: 14, fontWeight: 600,
              background: "#1d3557", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && <p style={{ marginTop: 12, fontSize: 12, color: "#6b7080" }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
