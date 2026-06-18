// Runs in the Cloudflare Worker (nodejs_compat) under OpenNext — no edge runtime needed.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "tutor-web",
    milestone: "M0",
    ts: new Date().toISOString(),
  });
}
