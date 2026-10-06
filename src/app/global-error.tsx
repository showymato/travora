"use client";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#fbfbfd", color: "#141a2e" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: "#5f6678", fontSize: 14 }}>Please try again. {error.digest ? `Reference: ${error.digest}` : null}</p>
          <button onClick={() => retry()} style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, border: 0, background: "#232c63", color: "white", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
