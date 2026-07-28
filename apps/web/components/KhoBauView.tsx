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
 */

import { useEffect, useState } from "react";
import { ArrowLeft, Gift, Check, Sparkles } from "lucide-react";
import { nodeResources, khoBauXong, type KhoBauResult, type NodeResource, type Subject } from "../lib/api";
import Lion from "./Lion";
import LessonView from "./LessonView";

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

  useEffect(() => {
    let alive = true;
    setData(null);
    setLoi(null);
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
  const soMuc = mucCoSan.length;
  // Học liệu của MỨC ĐANG MỞ — hiện song song mọi định dạng đã tick.
  const cuaMucNay: NodeResource[] = (data?.resources ?? []).filter(
    (r) => (r.tier ?? 1) === (data?.mucDangMo ?? 1),
  );
  const daXongHet = !!data && data.mucDaQua >= Math.max(1, ...(mucCoSan.length ? mucCoSan : [1]));

  return (
    <div className="stack">
      <button className="btn btn-ghost" onClick={onBack} style={{ alignSelf: "flex-start" }}>
        <ArrowLeft aria-hidden strokeWidth={2.5} />
        Về lộ trình
      </button>

      <header className="kb-head">
        <Gift aria-hidden strokeWidth={2} />
        <div>
          <b className="h3">Kho báu của bài</b>
          <p className="muted">{nodeLabel}</p>
        </div>
      </header>

      {loi && <div className="banner err">{loi}</div>}
      {!data && !loi && <p className="muted">Đang mở kho…</p>}

      {/* Server chặn (bài chưa mở) — nói rõ vì sao, đừng để màn hình trống. */}
      {data?.khoa && (
        <div className="lfoot-says" role="status">
          <Lion mood="thinking" size={48} decorative />
          <b className="lfoot-title">Kho báu này còn khoá — học xong bài phía trước là mở được nhé!</b>
        </div>
      )}

      {data && !data.khoa && soMuc > 0 && (
        <>
          {/* Bậc thang: chỉ vẽ đúng số mức bài này THẬT SỰ có — bài chỉ có một
              mức thì đừng vẽ ba bậc rồi để em chờ mức không bao giờ tới. */}
          <div className="kb-steps" role="list">
            {mucCoSan.map((m) => (
              <div
                key={m}
                role="listitem"
                className="kb-step"
                data-state={m <= data.mucDaQua ? "done" : m === data.mucDangMo ? "now" : "locked"}
              >
                {m <= data.mucDaQua ? <Check aria-hidden strokeWidth={3} /> : null} Mức {m}
              </div>
            ))}
          </div>

          {cuaMucNay.length > 0 ? (
            <LessonView
              resources={cuaMucNay}
              subtitle="Xem, nghe, làm thử — phần này không tính điểm, cứ thoải mái khám phá."
            />
          ) : (
            <p className="muted">Mức này chưa có học liệu nào. Thầy cô sẽ bổ sung sau nhé!</p>
          )}

          {vuaXong && (
            <div className="lfoot-says" role="status">
              <Lion mood="cheer" size={48} decorative />
              <b className="lfoot-title">
                {data.conMucSau
                  ? "Giỏi lắm! Mức sau đã mở — quay lại bất cứ lúc nào nhé."
                  : "Em đã lấy hết kho báu của bài này rồi!"}
              </b>
            </div>
          )}

          {!daXongHet && cuaMucNay.length > 0 && (
            <>
              <button className="btn btn-block btn-check" disabled={busy} data-loading={busy || undefined} onClick={xongMuc}>
                XEM XONG MỨC {data.mucDangMo}
              </button>
              <p className="muted kb-note">
                <Sparkles aria-hidden strokeWidth={2} /> Mỗi lần vào kho báu em mở thêm được MỘT mức.
                {data.conMucSau ? " Hôm sau quay lại là có phần mới." : ""}
              </p>
            </>
          )}
        </>
      )}

      {data && !data.khoa && soMuc === 0 && (
        <p className="muted">Bài này chưa có học liệu. Thầy cô sẽ thêm sau nhé!</p>
      )}
    </div>
  );
}
