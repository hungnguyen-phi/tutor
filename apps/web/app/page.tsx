export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: ".5rem" }}>AI Tutor — Trường Việt Anh</h1>
      <p style={{ opacity: 0.85, lineHeight: 1.6 }}>
        Adaptive Customizable AI Tutor &amp; School Learning Operations. M0 scaffold is live on
        Cloudflare Workers via OpenNext.
      </p>
      <ul style={{ lineHeight: 1.9, opacity: 0.85 }}>
        <li>Toán 9–10 · objective + CAS + Socratic</li>
        <li>Tiếng Anh · objective + rubric writing + speaking</li>
        <li>Chat serving: Supabase Edge Functions · Async: n8n</li>
      </ul>
      <p style={{ opacity: 0.6, marginTop: "2rem", fontSize: ".9rem" }}>
        Health check: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
