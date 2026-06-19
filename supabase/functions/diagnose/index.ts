// diagnose — MVP stub (PRD §11, Q4): creates a session and returns the active
// questions for the subject's pilot node (full adaptive diagnostic lands at M5).
import { handleOptions, json } from "../_shared/cors.ts";
import { admin, PILOT_TENANT_SLUG } from "../_shared/supa.ts";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const jdx = Math.floor(Math.random() * (i + 1));
    [a[i], a[jdx]] = [a[jdx]!, a[i]!];
  }
  return a;
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const { studentId, subject } = await req.json();
    if (!studentId || !subject) return json({ error: "studentId and subject required" }, 400);
    const supa = admin();

    const { data: tenant } = await supa
      .from("tenants")
      .select("id")
      .eq("slug", PILOT_TENANT_SLUG)
      .single();
    if (!tenant) return json({ error: "pilot tenant not found" }, 404);

    const { data: version } = await supa
      .from("kg_versions")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("subject", subject)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!version) return json({ error: `no published KG for ${subject}` }, 404);

    const { data: questions } = await supa
      .from("questions")
      .select("id, node_key, tier, dok, do_kho, loai_danh_gia, noi_dung, dap_an, distractors, rubric, tham_so_hoa")
      .eq("kg_version_id", version.id)
      .eq("trang_thai", "active")
      .order("tier", { ascending: true })
      .order("dok", { ascending: true });

    const firstNode = questions?.[0]?.node_key ?? null;
    const { data: ses } = await supa
      .from("learning_sessions")
      .insert({
        tenant_id: tenant.id,
        student_id: studentId,
        subject,
        kg_version_id: version.id,
        current_node_id: firstNode,
        status: "active",
      })
      .select("id")
      .single();

    const items = (questions ?? []).map((q) => {
      const kind = /\[SPEAKING\]/i.test(q.noi_dung)
        ? "speaking"
        : /\[WRITING\]/i.test(q.noi_dung)
          ? "writing"
          : q.loai_danh_gia;
      const base = {
        id: q.id,
        nodeKey: q.node_key,
        tier: q.tier,
        dok: q.dok,
        doKho: q.do_kho,
        kind,
        prompt: q.noi_dung.replace(/^\[(SPEAKING|WRITING)\]\s*/i, ""),
      };
      if (q.loai_danh_gia === "objective" && !q.tham_so_hoa) {
        const opts = shuffle([
          String(q.dap_an),
          ...((q.distractors ?? []) as Array<{ phuong_an: string }>).map((d) => d.phuong_an),
        ]);
        return { ...base, options: opts };
      }
      if (q.loai_danh_gia === "rubric") return { ...base, rubric: q.rubric };
      return base; // free-input objective (e.g. parametrized)
    });

    return json({ sessionId: ses?.id, kgVersionId: version.id, node: firstNode, questions: items });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
