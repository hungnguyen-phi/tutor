// Ma trận PHÁT CHỮ DẦN — chỗ dễ sai nhất của đợt 29/07.
//
// Hai khâu cắt chuỗi, cả hai đều hỏng theo kiểu KHÔNG thấy ngay:
//   1) Gói SSE tới theo từng mẩu MẠNG, không theo từng sự kiện. Cắt giữa một
//      gói rồi JSON.parse là mất nguyên mẩu chữ (mà màn hình vẫn chạy, chỉ
//      thiếu chữ — không ai để ý).
//   2) Tên thật đã đổi thành [NAME_0] trước khi gửi đi. Mô hình trả về theo
//      mẩu nên cái nhãn đó bị CẮT ĐÔI ("[NAM" | "E_0]") → học sinh đọc thấy
//      "[NAME_" nhấp nháy giữa câu rồi mới thành tên mình.
//
// Chạy: node tools/stream-matrix.mjs
let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : `  → được ${JSON.stringify(got)}, muốn ${JSON.stringify(want)}`}`);
};

// ── Bản sao 1:1 bộ đệm giữ-nhãn trong chat-turn (speak → push) ──────────────
function makeEmitter(map) {
  const out = [];
  let pend = "";
  let full = "";
  const rehydrate = (s) => s.replace(/\[NAME_(\d+)\]/g, (m) => map[m] ?? m);
  const push = (d) => {
    pend += d;
    const open = pend.lastIndexOf("[");
    let safe;
    if (open >= 0 && !pend.slice(open).includes("]")) {
      safe = pend.slice(0, open);
      pend = pend.slice(open);
    } else {
      safe = pend;
      pend = "";
    }
    if (safe) { const x = rehydrate(safe); full += x; out.push(x); }
  };
  const flush = () => { if (pend) { const x = rehydrate(pend); full += x; out.push(x); pend = ""; } };
  return { push, flush, out, full: () => full };
}

{
  const e = makeEmitter({ "[NAME_0]": "An" });
  for (const c of ["Chào ", "[NAM", "E_0]", " nhé"]) e.push(c);
  e.flush();
  t("nhãn tên bị cắt đôi → không lộ ra màn hình", e.out.join(""), "Chào An nhé");
  t("không mẩu nào chứa '[NAME'", e.out.some((x) => x.includes("[NAME")), false);
}
{
  const e = makeEmitter({ "[NAME_0]": "An" });
  for (const c of ["Bạn ", "dùng ", "công thức ", "$x^2$", " nhé"]) e.push(c);
  e.flush();
  t("không có nhãn thì chữ ra ngay, không giữ lại", e.out.length, 5);
  t("chữ không sai một ký tự", e.full(), "Bạn dùng công thức $x^2$ nhé");
}
{
  // Ngoặc vuông THẬT trong bài (khoảng đóng "[1;3]") không được kẹt lại vĩnh viễn.
  const e = makeEmitter({});
  for (const c of ["Xét ", "[1;", "3] ", "xem"]) e.push(c);
  e.flush();
  t("ngoặc vuông thật vẫn ra đủ", e.full(), "Xét [1;3] xem");
}
{
  // Mô hình câm: không mẩu nào → nhánh gọi phải lùi về câu tất định.
  const e = makeEmitter({});
  e.flush();
  t("mô hình câm → không phát gì", e.out.length, 0);
}

// ── Bản sao 1:1 bộ tách SSE phía client (callFnStream) ──────────────────────
function parseSse(chunks) {
  let buf = "";
  const deltas = [];
  let meta = {}, message = "", sawDone = false;
  for (const raw of chunks) {
    buf += raw;
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      let event = "message", data = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let j;
      try { j = JSON.parse(data); } catch { continue; }
      if (event === "meta") meta = j;
      else if (event === "delta") { const x = String(j.t ?? ""); if (x) { message += x; deltas.push(x); } }
      else if (event === "done") { message = String(j.message ?? message); sawDone = true; }
    }
  }
  return { meta, message, deltas, sawDone };
}

const ev = (name, obj) => `event: ${name}\ndata: ${JSON.stringify(obj)}\n\n`;

{
  const wire = ev("meta", { gate: "reflect", graded: false }) +
    ev("delta", { t: "Mình " }) + ev("delta", { t: "nghe rồi." }) +
    ev("done", { message: "Mình nghe rồi." });
  const r = parseSse([wire]);
  t("phong bì tới nguyên vẹn", r.meta, { gate: "reflect", graded: false });
  t("ghép đủ chữ", r.message, "Mình nghe rồi.");
  t("thấy chốt lượt", r.sawDone, true);
}
{
  // Gói mạng cắt ở chỗ HIỂM: giữa "data:", giữa JSON, giữa dấu ngăn sự kiện.
  const wire = ev("meta", { gate: "reflect" }) + ev("delta", { t: "Bạn thử " }) +
    ev("delta", { t: "lại nhé" }) + ev("done", { message: "Bạn thử lại nhé" });
  for (const size of [1, 3, 7, 13, 29, 64]) {
    const chunks = [];
    for (let i = 0; i < wire.length; i += size) chunks.push(wire.slice(i, i + size));
    const r = parseSse(chunks);
    t(`cắt gói mỗi ${size} ký tự vẫn ghép đúng`, r.message, "Bạn thử lại nhé");
  }
}
{
  // Dòng ĐỨT giữa chừng (mất mạng): không được coi là xong lượt.
  const wire = ev("meta", { gate: "reflect" }) + ev("delta", { t: "Mình đang" });
  const r = parseSse([wire]);
  t("đứt giữa chừng → chưa chốt", r.sawDone, false);
  t("đứt giữa chừng → vẫn giữ phần đã nhận", r.message, "Mình đang");
}
{
  // Câu chốt của server ĐÈ lên phần cóp nhặt (bản thật đã hoàn nguyên tên).
  const wire = ev("delta", { t: "Chào [NAME_0]" }) + ev("done", { message: "Chào An" });
  t("câu chốt đè lên phần đã bơm", parseSse([wire]).message, "Chào An");
}
{
  // Mẩu JSON hỏng lẻ không được giết cả lượt.
  const wire = ev("delta", { t: "A" }) + "event: delta\ndata: {hong\n\n" + ev("delta", { t: "B" });
  t("mẩu hỏng bị bỏ qua, phần còn lại vẫn tới", parseSse([wire]).message, "AB");
}

console.log(`\n${pass} đạt · ${fail} trượt`);
process.exit(fail ? 1 : 0);
