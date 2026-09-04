"use client";

/**
 * KHO BÁU — học liệu của một bài, đứng CẠNH bài trên lộ trình chứ không nằm
 * trong bài, nhưng KHOÁ THEO BÀI: bài chưa mở thì kho báu cũng chưa mở (server
 * chặn theo điều kiện tiên quyết, client làm mờ nút — không mời gọi rồi từ chối).
 *
 * BA MỨC MỞ DẦN (bậc thang, không đổ ập một lần): mỗi lượt vào chỉ ăn THÊM MỘT
 * mức rồi phải quay lại — kho báu là lý do trở lại bài cũ. Mức đang mở hiện
 * SONG SONG mọi định dạng giáo viên đã tick: nghe podcast xong lướt luôn sơ đồ,
 * ai hợp kiểu nào dùng kiểu đó (dual coding).
 *
 * KHÔNG ghi mastery — đây là tự học, không phải bài kiểm tra.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BỐ CỤC (viết lại 10/08). Bản cũ là một CỘT HẸP 760px: mọi định dạng đổ chung
 * vào một dải ô giống hệt nhau, dưới là một khung trống mang dòng "Chọn một mục
 * ở trên để mở học liệu". Ba thứ sai cùng lúc:
 *   · màn 27 inch vẫn xem PDF trong một cột 760px — chỗ trống hai bên bỏ không;
 *   · nghe podcast · xem phim · đọc PDF · làm quiz là bốn việc rất khác nhau mà
 *     mặc chung một cái áo, em không đoán được bấm vào sẽ ra gì;
 *   · vào tới nơi thì thứ to nhất trên màn là một cái hộp RỖNG.
 *
 * Nay là BÀN LÀM VIỆC hai phần, cao đúng bằng màn hình:
 *   · RÃNH TRÁI — học liệu gom theo NHÓM VIỆC (Xem · Nghe · Nhìn · Đọc · Làm
 *     thử, xem `HocLieu.tsx`), mỗi mục một hàng có tên thật của thầy cô đặt +
 *     một mẩu chữ nói trước sẽ mở ra cái gì ("PDF", "YouTube", "Tệp Word — tải
 *     về"). Cuối rãnh là ĐƯỜNG NỘP BÀI, tách hẳn ra vì nó là việc chứ không
 *     phải học liệu.
 *   · SÂN KHẤU PHẢI — chiếm hết phần còn lại, nội dung là nhân vật chính.
 *     MỞ SẴN mục đầu tiên: em vào kho báu là để xem, bắt bấm thêm một nhát để
 *     nhìn thấy một cái hộp rỗng là phí một nhịp.
 * Dưới 1000px hai phần xếp chồng, rãnh thành dải cuộn ngang theo nhóm.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, FileText, Gift, Lock, Sparkles, Upload } from "lucide-react";
import { nodeResources, khoBauXong, type KhoBauResult, type NodeResource, type Subject } from "../lib/api";
import { HocLieuStage, ICON, KID_LABEL, gomTheoNhom, moTaNguon } from "./HocLieu";
import Lion from "./Lion";
import NopBaiBox from "./NopBaiBox";

/** Mục đang mở ở sân khấu: id học liệu, hoặc đường nộp bài. */
type Chon = { loai: "hoclieu"; id: string } | { loai: "nopbai" } | null;

/** "PHIẾU HỌC TẬP MỆNH ĐỀ LOGIC" → "Phiếu học tập mệnh đề logic". Chỉ đụng chuỗi
 *  VIẾT HOA TOÀN BỘ (≥6 chữ cái, không có chữ thường); tiêu đề thường giữ nguyên. */
function chuanHoaTieuDe(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  const chu = t.replace(/[^\p{L}]/gu, "");
  if (chu.length < 6 || /\p{Ll}/u.test(chu)) return t;
  const thap = t.toLocaleLowerCase("vi");
  return thap.charAt(0).toLocaleUpperCase("vi") + thap.slice(1);
}

export default function KhoBauView({
  subject,
  nodeKey,
  nodeLabel,
  onBack,
}: {
  subject: Subject;
  nodeKey: string;
  nodeLabel: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<KhoBauResult | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [vuaXong, setVuaXong] = useState(false);
  const [chon, datChon] = useState<Chon>(null);
  /** Lời nhắc khi bấm mức đang khoá — tự tắt. */
  const [nhacMuc, setNhacMuc] = useState<string | null>(null);
  useEffect(() => {
    if (!nhacMuc) return;
    const t = window.setTimeout(() => setNhacMuc(null), 2800);
    return () => window.clearTimeout(t);
  }, [nhacMuc]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setLoi(null);
    datChon(null);
    nodeResources(subject, nodeKey)
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (alive) setLoi(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [subject, nodeKey]);

  async function xongMuc() {
    if (!data || busy) return;
    setBusy(true);
    try {
      const r = await khoBauXong(subject, nodeKey, data.mucDangMo);
      setData(r);
      setVuaXong(true);
    } catch (e) {
      setLoi(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const mucCoSan = data?.mucCoSan ?? [];
  // Học liệu ĐÃ MỞ — mức đang mở VÀ mọi mức trước đó.
  //
  // ⚠️ `<=` chứ KHÔNG phải `===` (lỗi #1, rà 31/07). Bậc thang "mỗi lượt mở thêm
  // một mức" trước đây lọc bằng `===`, nên ngay sau khi em bấm đúng cái nút mà
  // app mời bấm ("XEM XONG MỨC 1") thì TOÀN BỘ học liệu mức 1 — kể cả phiếu bài
  // tập và khối nộp bài của nó — biến mất khỏi màn Kho báu. Đúng kịch bản "tải
  // phiếu về làm ở nhà, mai vào nộp": hôm sau mở lại thì không còn gì.
  // Server vốn đã trả `tier <= mucDangMo` (resources/index.ts) — chỉ có client
  // giấu đi. Mở khoá thì phải MỞ, không phải đổi chỗ giấu.
  const moRa: NodeResource[] = useMemo(
    () => (data?.resources ?? []).filter(
      (r) => (r.tier ?? 1) <= (data?.mucDangMo ?? 1) && typeof r.uri === "string" && r.uri.length > 0,
    ),
    [data],
  );
  const nhomList = useMemo(() => gomTheoNhom(moRa), [moRa]);
  const coPhieu = moRa.some((r) => r.format === "worksheet");
  const coDuongNop = !!data?.nopBaiQuestionId && coPhieu;
  const daXongHet = !!data && data.mucDaQua >= Math.max(1, ...(mucCoSan.length ? mucCoSan : [1]));
  // NODE CHỈ CÓ MỘT MỨC = tài nguyên ĐẠI DIỆN CHO CẢ NODE (chủ dự án 04/09: mỗi
  // node mới có một bộ NotebookLM, chưa chia theo DOK). Khi đó cơ chế "xem xong
  // mức" là nhiễu: không pip, không nút XEM XONG, không dòng nhắc "mở thêm một
  // mức" — vào là thấy hết. Có ≥2 mức (sau này sinh theo DOK) thì cơ chế tự về.
  const motMuc = mucCoSan.length <= 1;

  // MỞ SẴN mục đầu tiên khi rổ học liệu đổi (vào màn, hoặc vừa mở thêm mức).
  // Khác cột phụ trong bài học — ở đó phải giữ nhẹ để không cản đường tới câu
  // hỏi; còn vào Kho báu thì xem học liệu CHÍNH LÀ việc em định làm.
  useEffect(() => {
    if (!moRa.length) { datChon(null); return; }
    datChon((cu) => {
      if (cu?.loai === "nopbai") return cu;
      if (cu && moRa.some((r) => r.id === cu.id)) return cu;
      // Mục ĐẦU THEO THỨ TỰ HIỆN TRÊN MÀN (nhóm → mục), không phải mục đầu theo
      // thứ tự DB (audit 04/09: tự chọn mục thứ 7 — phiếu PDF — dù danh sách bày
      // "Xem" trước). Em nhìn danh sách và thấy đúng mục đầu đang mở.
      const dau = nhomList[0]?.muc[0] ?? moRa[0]!;
      return { loai: "hoclieu", id: dau.id };
    });
  }, [moRa, nhomList]);

  const dangMo = chon?.loai === "hoclieu" ? moRa.find((r) => r.id === chon.id) ?? null : null;

  /* ── Trạng thái không có gì để bày ─────────────────────────────────────── */

  if (loi) {
    return (
      <div className="kb kb-thong-bao">
        <NutVe onBack={onBack} />
        <div className="banner err">{loi}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="kb kb-thong-bao">
        <NutVe onBack={onBack} />
        <p className="muted">Đang mở kho…</p>
      </div>
    );
  }

  // Server chặn (bài chưa mở) — nói rõ vì sao, đừng để màn hình trống.
  if (data.khoa) {
    return (
      <div className="kb kb-thong-bao">
        <NutVe onBack={onBack} />
        <div className="kb-trong" role="status">
          <Lion mood="thinking" size={112} decorative />
          <b>Kho báu này còn khoá</b>
          <p className="muted">Học xong bài phía trước là mở được nhé!</p>
        </div>
      </div>
    );
  }

  if (!mucCoSan.length || !moRa.length) {
    return (
      <div className="kb kb-thong-bao">
        <NutVe onBack={onBack} />
        <div className="kb-trong" role="status">
          <Lion mood="idle" size={112} decorative />
          <b>{mucCoSan.length ? "Mức này chưa có học liệu nào" : "Bài này chưa có học liệu"}</b>
          <p className="muted">Thầy cô sẽ bổ sung sau nhé!</p>
        </div>
      </div>
    );
  }

  /* ── Bàn làm việc ───────────────────────────────────────────────────────── */

  return (
    <div className="kb">
      <header className="kb-bar">
        <NutVe onBack={onBack} />
        <div className="kb-bar-title">
          <Gift aria-hidden strokeWidth={2} />
          <div>
            <b>Kho báu của bài</b>
            <span>{nodeLabel}</span>
          </div>
        </div>

        {/* Bậc thang chỉ có nghĩa khi bài có TỪ HAI MỨC trở lên. Một mức mà vẫn
            vẽ dải bậc thang thì vừa thừa vừa xấu. */}
        {mucCoSan.length > 1 && (
          <div className="kb-pips" role="list" aria-label="Các mức của kho báu">
            {mucCoSan.map((m) => {
              const state = m <= data.mucDaQua ? "done" : m === data.mucDangMo ? "now" : "locked";
              // Mức khoá nói rõ VÌ SAO khi bấm (audit lượt 2: bấm "Mức 2" không phản
              // hồi gì) — title cho chuột, và là <button> để bàn phím/máy đọc tới được.
              const nhan = state === "locked"
                ? `Mức ${m} — mở sau khi bạn xem xong mức ${data.mucDangMo}`
                : state === "done" ? `Mức ${m} — đã xem xong` : `Mức ${m} — đang mở`;
              return (
                <button
                  key={m}
                  type="button"
                  role="listitem"
                  className="kb-pip"
                  data-state={state}
                  title={nhan}
                  aria-label={nhan}
                  onClick={() => { if (state === "locked") setNhacMuc(`Mức ${m} mở sau khi bạn xem xong mức ${data.mucDangMo} nhé.`); }}
                >
                  {state === "done" ? <Check aria-hidden strokeWidth={3} />
                    : state === "locked" ? <Lock aria-hidden strokeWidth={2.5} /> : null}
                  Mức {m}
                </button>
              );
            })}
          </div>
        )}

        {nhacMuc && <p className="kb-nhac" role="status">{nhacMuc}</p>}
        {!daXongHet && !motMuc && (
          <button
            className="btn btn-check kb-done"
            disabled={busy}
            data-loading={busy || undefined}
            onClick={xongMuc}
          >
            XEM XONG MỨC {data.mucDangMo}
          </button>
        )}
      </header>

      {vuaXong && (
        <div className="kb-khen" role="status">
          <Lion mood="cheer" size={44} decorative />
          <b>
            {data.conMucSau
              ? "Giỏi lắm! Mức sau đã mở — quay lại bất cứ lúc nào nhé."
              : "Bạn đã lấy hết kho báu của bài này rồi!"}
          </b>
        </div>
      )}

      <div className="kb-body">
        <nav className="kb-rail" aria-label="Học liệu của bài">
          {nhomList.map(({ nhom, muc }) => (
            <section key={nhom.id} className="kb-group" data-nhom={nhom.id}>
              {/* Bỏ nhãn+mô tả nhóm ("Xem — Phim và hoạt hình"...) theo phản hồi
                  chủ dự án (09/2026): rãnh có nhiều mục hơn hẳn từ khi nạp học
                  liệu NotebookLM, hai dòng chữ mở đầu mỗi nhóm cộng dồn thành
                  chật — TÊN từng học liệu mới là thứ em cần đọc, tên nhóm chỉ
                  là phụ. Icon riêng của từng mục vẫn đủ phân biệt "xem" khác
                  "nghe" khác "đọc" mà không cần nhãn chữ dẫn trước. */}
              <ul className="kb-items">
                {muc.map((r) => {
                  const Icon = ICON[r.format] ?? FileText;
                  const nhan = KID_LABEL[r.format] ?? r.format;
                  const mo = chon?.loai === "hoclieu" && chon.id === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="kb-item"
                        aria-current={mo || undefined}
                        onClick={() => datChon({ loai: "hoclieu", id: r.id })}
                      >
                        <span className="kb-item-ico" aria-hidden>
                          <Icon strokeWidth={2} />
                        </span>
                        <span className="kb-item-text">
                          {/* Tên thầy cô đặt đứng trước — "Phim ngắn" là LOẠI,
                              không phải tên. Chỉ khi thầy cô không đặt tên thì
                              mới lấy tên loại thay. */}
                          {/* Tiêu đề soạn VIẾT HOA TOÀN BỘ ("PHIẾU HỌC TẬP MỆNH ĐỀ LOGIC")
                              lệch 9 mục còn lại và bị cắt sớm (audit lượt 2) — chuẩn
                              hoá về dạng câu lúc hiện, không đụng dữ liệu. */}
                          <b>{chuanHoaTieuDe(r.tieuDe) || nhan}</b>
                          <small>{r.tieuDe ? `${nhan} · ${moTaNguon(r.uri!)}` : moTaNguon(r.uri!)}</small>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {/* NỘP BÀI tách khỏi danh sách học liệu: nó là VIỆC, không phải thứ để
              xem. Chỉ hiện khi có phiếu bài tập ĐANG MỞ và bài có câu nộp. */}
          {coDuongNop && (
            <section className="kb-group kb-group-nop">
              <ul className="kb-items">
                <li>
                  <button
                    type="button"
                    className="kb-item kb-item-nop"
                    aria-current={chon?.loai === "nopbai" || undefined}
                    onClick={() => datChon({ loai: "nopbai" })}
                  >
                    <span className="kb-item-ico" aria-hidden>
                      <Upload strokeWidth={2} />
                    </span>
                    <span className="kb-item-text">
                      <b>Nộp bài đã làm</b>
                      <small>Gõ bài, hoặc chụp ảnh bài trên giấy</small>
                    </span>
                  </button>
                </li>
              </ul>
            </section>
          )}
        </nav>

        <div className="kb-stage">
          {chon?.loai === "nopbai" && data.nopBaiQuestionId ? (
            <div className="kb-nop-wrap">
              <NopBaiBox subject={subject} nodeKey={nodeKey} questionId={data.nopBaiQuestionId} />
            </div>
          ) : dangMo ? (
            <HocLieuStage
              key={dangMo.id}
              r={dangMo}
              label={KID_LABEL[dangMo.format] ?? dangMo.format}
              bienThe="san"
            />
          ) : null}
        </div>
      </div>

      {/* Câu giải thích chung ("Học liệu do thầy cô chọn...") đã bỏ theo yêu cầu
          chủ dự án (09/2026) — nhường thêm không gian cho rãnh học liệu. Chỉ
          giữ lại gợi ý MỚI-mở-mức khi còn mức để mở, vì đó là thông tin em
          cần biết để quay lại, không phải chữ trang trí. */}
      {!daXongHet && !motMuc && (
        <footer className="kb-foot">
          <Sparkles aria-hidden strokeWidth={2} />
          <span>Mỗi lần vào kho báu bạn mở thêm được MỘT mức.</span>
        </footer>
      )}

      {/* CÓ phiếu nhưng bài này KHÔNG có câu nộp → phải NÓI RA (lỗi #1). Đường
          nộp bám vào một câu mang nhãn [NOPBAI] cùng node, mà 85/204 node không
          hề có câu nào như vậy — trong khi thầy cô gắn phiếu được vào bất kỳ
          node nào. Rơi vào nhóm đó thì trước đây màn hình im lặng tuyệt đối: em
          tải phiếu về, làm xong, quay lại tìm chỗ nộp và không hiểu vì sao chẳng
          có gì. Thà nói thật một câu. */}
      {coPhieu && !data.nopBaiQuestionId && (
        <p className="muted kb-khong-nop">
          Phiếu này bạn làm để luyện thêm — bài chưa mở đường nộp trên app. Làm xong cứ nộp
          trực tiếp cho thầy cô nhé.
        </p>
      )}
    </div>
  );
}

function NutVe({ onBack }: { onBack: () => void }) {
  return (
    <button className="btn btn-ghost kb-ve" onClick={onBack}>
      <ArrowLeft aria-hidden strokeWidth={2.5} />
      Về lộ trình
    </button>
  );
}
