"use client";

/**
 * CÂU ĐỔI GIÓ — lời sư tử nói ở màn Học.
 *
 * Chủ dự án 30/07: một câu nhắc treo mãi thì em đọc hai lần rồi thôi, mắt tự
 * lướt qua. Nên có kho câu: đồng dao/ca dao, tục ngữ, ngụ ngôn, châm ngôn học
 * hành — đổi theo mỗi lần em mở app.
 *
 * ⚠️ BẢN QUYỀN: chỉ dùng chất liệu DÂN GIAN (ca dao, tục ngữ, đồng dao — không
 * tác giả) và bài học ngụ ngôn Ê-dốp diễn đạt lại bằng lời mình. KHÔNG chép lời
 * bài hát/thơ hiện đại có tác giả vào đây.
 *
 * Sư phạm (bất biến): thưởng NỖ LỰC, không thưởng điểm tuyệt đối; không câu nào
 * được hứa "học là dễ" hay dọa "sai là dốt". Câu nào cũng phải nói được với em
 * vừa làm sai 3 lần liền.
 *
 * XOAY VÒNG (đọc kỹ trước khi sửa): chọn theo BỘ ĐẾM lưu ở máy, KHÔNG random.
 *  · Random thì cùng một lần render lại đổi câu → chữ nhảy trước mắt em.
 *  · Bộ đếm tăng 1 mỗi lần mở app ⇒ đi HẾT kho mới lặp lại (random thì câu
 *    thứ ba đã trùng câu đầu).
 *  · Đọc bộ đếm PHẢI qua `useRotation()` — xem cảnh báo hydrate ở hàm đó.
 */

import { useState } from "react";
import { usePrePaintEffect } from "./anim";

export type NudgeKind = "tucngu" | "cadao" | "dongdao" | "nguyngon" | "chamngon";

export type Nudge = {
  text: string;
  kind: NudgeKind;
};

/** Nhãn hiện dưới câu — để em biết mình vừa đọc thứ gì, không tưởng app tự bịa. */
export const KIND_LABEL: Record<NudgeKind, string> = {
  tucngu: "Tục ngữ Việt Nam",
  cadao: "Ca dao",
  dongdao: "Đồng dao",
  nguyngon: "Ngụ ngôn Ê-dốp",
  chamngon: "Châm ngôn học hành",
};

/**
 * Kho câu nhắc ở thẻ sư tử (cột phải màn Học).
 * Giữ MỖI CÂU ≤ 2 dòng ở khung 300px — dài hơn là em không đọc.
 */
export const TIPS: Nudge[] = [
  // ── Dân gian: kiên trì, tích tiểu thành đại ───────────────────────────────
  { kind: "tucngu", text: "Có công mài sắt, có ngày nên kim. Hôm nay em mài thêm một đường." },
  { kind: "tucngu", text: "Nước chảy đá mòn — không phải nhờ mạnh, mà nhờ đều." },
  { kind: "tucngu", text: "Đi một ngày đàng, học một sàng khôn." },
  { kind: "tucngu", text: "Học ăn, học nói, học gói, học mở — việc gì cũng phải học mới nên." },
  { kind: "tucngu", text: "Dao sắc không gọt được chuôi. Bí chỗ nào thì hỏi, đừng ngồi im." },
  { kind: "tucngu", text: "Muốn biết phải hỏi, muốn giỏi phải học." },
  { kind: "tucngu", text: "Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao." },
  { kind: "cadao", text: "Ai ơi giữ chí cho bền\nDù ai xoay hướng đổi nền mặc ai." },
  {
    kind: "cadao",
    text: "Non cao cũng có đường trèo\nĐường dù hiểm nghèo cũng có lối đi.",
  },
  { kind: "dongdao", text: "Lúa ngô là cô đậu nành, đậu nành là anh dưa chuột, dưa chuột là ruột dưa gang." },

  // ── Ngụ ngôn Ê-dốp: kể lại bằng lời mình, giữ đúng bài học ────────────────
  {
    kind: "nguyngon",
    text: "Con quạ khát nước thả từng viên sỏi vào bình cho nước dâng lên. Từng viên nhỏ, nhưng đủ để uống.",
  },
  {
    kind: "nguyngon",
    text: "Rùa và thỏ: thỏ chạy nhanh rồi ngủ, rùa đi chậm mà không dừng — về đích là rùa.",
  },
  {
    kind: "nguyngon",
    text: "Con cáo khen chùm nho xanh là chua vì với không tới. Bài khó không xấu — bỏ ngang mới đáng tiếc.",
  },
  {
    kind: "nguyngon",
    text: "Người cha bảo các con bó những cây roi lại: một cây thì gãy, cả bó thì không. Kiến thức cũng vậy — buộc lại mới chắc.",
  },
  {
    kind: "nguyngon",
    text: "Con lừa chở muối qua sông tưởng ngã là nhẹ gánh, lần sau chở bông thì ướt nặng gấp đôi. Mẹo tắt không thay được hiểu bài.",
  },

  // ── Châm ngôn học hành (diễn đạt trung tính, không gán tác giả) ───────────
  { kind: "chamngon", text: "Sai một câu là biết thêm một chỗ mình chưa vững — đó là lãi, không phải lỗ." },
  { kind: "chamngon", text: "Não em lớn lên đúng lúc em thấy khó. Dễ quá thì chẳng có gì mọc thêm." },
  { kind: "chamngon", text: "Mỗi ngày một bài ngắn — đều đặn thắng dốc sức." },
  { kind: "chamngon", text: "Chưa hiểu không giống là không hiểu được. Thêm một lượt nữa thôi." },
  { kind: "chamngon", text: "Người hỏi câu ngốc nghếch trong năm phút, hơn người giả vờ hiểu suốt cả năm." },
  { kind: "chamngon", text: "Đừng so với bạn bên cạnh — so với chính em hôm qua." },
  { kind: "chamngon", text: "Học là bắc thang: đứng bậc dưới cho vững rồi bậc trên tự tới." },
  { kind: "chamngon", text: "Bài khó thì chia nhỏ ra mà đi — tay đếm miệng đọc, từng bước một rồi cũng xong." },
  { kind: "chamngon", text: "Dốc lòng học hôm nay khó, để ngày sau đỡ vất hơn." },
];

/**
 * Lời CHÀO đầu màn Học. Chia theo BỐI CẢNH (đừng trộn): mỗi bối cảnh là một sự
 * thật khác nhau về em, nói sai là app hoá ra không biết em là ai.
 *  · first  — chưa thành thạo điểm nào: phải nêu luật "mình hỏi, em nghĩ".
 *  · cold   — chuỗi ngày đã nguội: mời quay lại, KHÔNG mắng.
 *  · back   — đang đi đều: ghi nhận số điểm đã chắc rồi đi tiếp.
 * `{ten}` → tên em, `{n}` → số điểm kiến thức đã thành thạo.
 */
export const GREETINGS: Record<"first" | "cold" | "back", string[]> = {
  first: [
    "Chào {ten}! Hôm nay mình với bạn bắt đầu điểm kiến thức đầu tiên nhé. Mình sẽ không đưa đáp án — mình hỏi, bạn nghĩ.",
    "Chào {ten}! Luật của mình đơn giản: mình hỏi, bạn nghĩ. Sai cũng được — sai là lúc mình biết phải giúp bạn chỗ nào.",
    "Bắt đầu thôi {ten}! Mình không phải cái máy tra đáp án, mình là bạn học cùng — mình gợi, bạn tự tìm ra.",
    "Chào {ten}! Điểm đầu tiên đây. Bạn cứ nói ra bạn đang nghĩ gì, kể cả chưa chắc — mình đi từ đó.",
    "Chào {ten}! Mình sẽ hỏi bạn từng bước nhỏ. Bạn trả lời được bước nào thì cả bài tự sáng dần ra.",
  ],
  cold: [
    "Lâu rồi mình không gặp bạn! Học một bài ngắn thôi cũng đủ nhóm lại chuỗi ngày.",
    "Bạn quay lại rồi! Mình không hỏi bạn đi đâu — mình chỉ giữ chỗ cho bạn ở đây thôi. Bắt đầu nhẹ nhé.",
    "Mừng bạn trở lại! Nghỉ mấy hôm là chuyện thường. Một bài ngắn hôm nay là chuỗi ngày nhóm lại được.",
    "Mình chờ bạn nãy giờ! Hôm nay mình đi một bài dễ trước cho ấm tay đã.",
  ],
  back: [
    "Bạn đã thành thạo {n} điểm kiến thức rồi. Mình với bạn tiếp tục nhé!",
    "{n} điểm đã chắc tay. Cứ nhịp này thì chương này sớm xong thôi!",
    "Mình đếm được {n} điểm bạn đã nắm vững. Hôm nay mình thêm một điểm nữa nhé?",
    "Đi đều thật đấy — {n} điểm rồi. Bài kế tiếp mình đã chờ sẵn.",
    "Được {n} điểm rồi {ten} ạ. Người đi đều là người về đích, bạn nhớ không?",
  ],
};

// ── Bộ đếm xoay vòng ───────────────────────────────────────────────────────
const ROT_KEY = "va-nudge-rot";

/**
 * BỘ ĐẾM XOAY VÒNG dùng trong component — cách DUY NHẤT đúng để lấy nó.
 *
 * ⚠️ Vì sao là hook chứ không phải gọi thẳng `nextRotation()`: bộ đếm sống ở
 * localStorage, tức server prerender ra 0 mà client ra N ⇒ hai bên dựng HAI CÂU
 * KHÁC NHAU ⇒ hydration mismatch (đã trả giá 30/07 với `const ROT =
 * nextRotation()` ở tầng module trong /demo). Hook này trả 0 ở khung hình đầu
 * (khớp HTML tĩnh) rồi nhảy sang số thật trong layout effect — trước khi trình
 * duyệt vẽ, nên người dùng không thấy chữ đổi.
 *
 * Trả về giá trị CỐ ĐỊNH suốt phiên: chữ không nhảy giữa các lần vẽ lại.
 */
export function useRotation(): number {
  const [rot, setRot] = useState(0);
  usePrePaintEffect(() => {
    setRot(nextRotation());
  }, []);
  return rot;
}

/**
 * Đọc bộ đếm rồi TĂNG 1. Dùng trong component thì gọi `useRotation()` thay vì
 * gọi hàm này trực tiếp (xem cảnh báo hydrate ở trên).
 * Không có localStorage (SSR / chế độ ẩn danh) → luôn trả 0.
 */
export function nextRotation(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number.parseInt(window.localStorage.getItem(ROT_KEY) ?? "0", 10);
    const cur = Number.isFinite(n) && n >= 0 ? n : 0;
    window.localStorage.setItem(ROT_KEY, String((cur + 1) % 100_000));
    return cur;
  } catch {
    return 0;
  }
}

/** Lấy phần tử thứ `rot` của một kho, xoay vòng. `offset` để hai chỗ trên cùng
 *  một màn không bao giờ rơi vào cùng nhịp (số nguyên tố → lệch pha bền). */
export function rotate<T>(pool: T[], rot: number, offset = 0): T {
  if (pool.length === 0) throw new Error("rotate: kho rỗng");
  const i = (((rot + offset) % pool.length) + pool.length) % pool.length;
  return pool[i]!;
}

/** Câu nhắc cho thẻ sư tử. */
export function pickTip(rot: number): Nudge {
  return rotate(TIPS, rot, 7);
}

/** Lời chào theo bối cảnh, đã thay {ten}/{n}. */
export function pickGreeting(
  bucket: "first" | "cold" | "back",
  rot: number,
  vars: { ten?: string | null; n?: number },
): string {
  return rotate(GREETINGS[bucket], rot)
    .replaceAll("{ten}", vars.ten?.trim() || "bạn")
    .replaceAll("{n}", String(vars.n ?? 0));
}
