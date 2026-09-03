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

export type NudgeKind = "tucngu" | "cadao" | "dongdao";

export type Nudge = {
  text: string;
  kind: NudgeKind;
};

/** Nhãn hiện dưới câu — để em biết mình vừa đọc thứ gì, không tưởng app tự bịa. */
export const KIND_LABEL: Record<NudgeKind, string> = {
  tucngu: "Tục ngữ Việt Nam",
  cadao: "Ca dao",
  dongdao: "Đồng dao",
};

/**
 * Kho câu nhắc ở thẻ sư tử (cột phải màn Học).
 * Giữ MỖI CÂU ≤ 2 dòng ở khung 300px — dài hơn là em không đọc.
 *
 * ⚠️ TOÀN BỘ PHẢI đúng NGUYÊN VĂN, KHÔNG TỰ VIẾT — kể cả một câu (chủ dự án
 * 03/09: đã trả giá 2 lần, lần đầu vì bịa đuôi câu, lần hai vì tự viết cả
 * mảng rồi gắn nhãn trung tính "chamngon" — vẫn bị bác, không có ngoại lệ
 * "tự viết nhưng ghi nhãn thật"). Trước khi thêm câu mới, PHẢI tra nguồn qua
 * WebSearch/WebFetch, không gõ theo trí nhớ.
 */
export const TIPS: Nudge[] = [
  // ── Tục ngữ (nguyên văn — nguồn: quantrimang.com, appongtho.com) ──────────
  { kind: "tucngu", text: "Có công mài sắt, có ngày nên kim." },
  { kind: "tucngu", text: "Nước chảy đá mòn." },
  { kind: "tucngu", text: "Đi một ngày đàng, học một sàng khôn." },
  { kind: "tucngu", text: "Học ăn, học nói, học gói, học mở." },
  { kind: "tucngu", text: "Muốn biết phải hỏi, muốn giỏi phải học." },
  { kind: "tucngu", text: "Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao." },
  { kind: "tucngu", text: "Có chí thì nên." },
  { kind: "tucngu", text: "Thua keo này, bày keo khác." },
  { kind: "tucngu", text: "Chớ thấy sóng cả mà ngã tay chèo." },
  { kind: "tucngu", text: "Cần cù bù thông minh." },
  { kind: "tucngu", text: "Kiến tha lâu cũng đầy tổ." },
  { kind: "tucngu", text: "Không thầy đố mày làm nên." },
  { kind: "tucngu", text: "Năng nhặt chặt bị." },
  { kind: "tucngu", text: "Có sức người sỏi đá cũng thành cơm." },
  { kind: "tucngu", text: "Lửa thử vàng, gian nan thử sức." },
  { kind: "tucngu", text: "Trăm hay không bằng tay quen." },
  { kind: "tucngu", text: "Không có việc gì khó, chỉ sợ lòng không bền." },
  { kind: "tucngu", text: "Học một biết mười." },
  { kind: "tucngu", text: "Có cày có thóc, có học có chữ." },
  { kind: "tucngu", text: "Hay học thì sang, hay làm thì có." },
  { kind: "tucngu", text: "Luyện mãi thành tài, miệt mài tất giỏi." },
  { kind: "tucngu", text: "Ăn vóc học hay." },
  { kind: "tucngu", text: "Dao có mài mới sắc, người có học mới nên." },
  { kind: "tucngu", text: "Học khôn đến chết, học nết đến già." },
  { kind: "tucngu", text: "Có học có khôn." },
  { kind: "tucngu", text: "Có học mới biết, có đi mới đến." },
  { kind: "tucngu", text: "Có học thì mới biết, không học thì tối dạ." },
  { kind: "tucngu", text: "Bảy mươi còn học bảy mươi mốt." },
  { kind: "tucngu", text: "Đi một buổi chợ học được mớ khôn." },

  // ── Ca dao (nguyên văn — nguồn: quantrimang.com) ──────────────────────────
  { kind: "cadao", text: "Ai ơi giữ chí cho bền\nDù ai xoay hướng đổi nền mặc ai." },
  {
    kind: "cadao",
    text: "Non cao cũng có đường trèo\nĐường dù hiểm nghèo cũng có lối đi.",
  },
  {
    kind: "cadao",
    text: "Muốn sang thì bắc cầu Kiều\nMuốn con hay chữ thì yêu lấy thầy.",
  },
  {
    kind: "cadao",
    text: "Học là học biết giữ giàng\nBiết điều nhân nghĩa biết đàng hiếu trung.",
  },
  {
    kind: "cadao",
    text: "Học là học để làm người\nBiết điều hơn thiệt biết lời thị phi.",
  },
  { kind: "cadao", text: "Nhân bất học bất tri lý\nNgọc bất trác bất thành khí." },
  {
    kind: "cadao",
    text: "Người ta là ngọc là vàng\nAi ơi hãy học cho sàng mới hay.",
  },
  {
    kind: "cadao",
    text: "Dốt kia thì phải cậy thầy\nVụng kia cậy thợ thì mày làm nên.",
  },
  { kind: "cadao", text: "Biết thì thưa thì thốt\nKhông biết thì dựa cột mà nghe." },
  {
    kind: "cadao",
    text: "Ai ơi bưng bát cơm đầy\nNhớ công học tập, ơn thầy, nghĩa cha.",
  },

  // ── Đồng dao (nguyên văn — nguồn: thivien.net, tổng hợp đồng dao dân gian) ─
  { kind: "dongdao", text: "Lúa ngô là cô đậu nành, đậu nành là anh dưa chuột, dưa chuột là ruột dưa gang." },
  { kind: "dongdao", text: "Dung dăng dung dẻ\nDắt trẻ đi chơi." },
  { kind: "dongdao", text: "Nu na nu nống\nĐánh trống phất cờ." },
  { kind: "dongdao", text: "Kéo cưa lừa xẻ\nÔng thợ nào khỏe." },
  { kind: "dongdao", text: "Chi chi chành chành\nCái đanh thổi lửa." },

  { kind: "dongdao", text: "Rồng rắn lên mây\nCó cây xúc sắc." },
  { kind: "dongdao", text: "Tập tầm vông\nTay nào không." },
  { kind: "dongdao", text: "Thả đỉa ba ba\nChớ bắt đàn bà." },

  // ── Tục ngữ, đợt 2: đoàn kết, trung thực, khiêm tốn, ý chí (nguyên văn —
  //    nguồn: quantrimang.com, farmvietnguyen.com, rdsic.edu.vn) ────────────
  { kind: "tucngu", text: "Ăn quả nhớ kẻ trồng cây." },
  { kind: "tucngu", text: "Đói cho sạch, rách cho thơm." },
  { kind: "tucngu", text: "Lá lành đùm lá rách." },
  { kind: "tucngu", text: "Một con ngựa đau, cả tàu bỏ cỏ." },
  { kind: "tucngu", text: "Bẻ đũa chẳng bẻ được cả nắm." },
  { kind: "tucngu", text: "Quân tử nhất ngôn, tứ mã nan truy." },
  { kind: "tucngu", text: "Giấy rách phải giữ lấy lề." },
  { kind: "tucngu", text: "Thương nhau như thể tay chân." },
  { kind: "tucngu", text: "Một giọt máu đào hơn ao nước lã." },
  { kind: "tucngu", text: "Tấc đất tấc vàng." },
  { kind: "tucngu", text: "Biết người biết ta, trăm trận trăm thắng." },
  { kind: "tucngu", text: "Núi cao còn có núi cao hơn." },
  { kind: "tucngu", text: "Ăn nói cho có đầu có đũa." },
  { kind: "tucngu", text: "Mưu cao chẳng bằng chí dày." },

  // ── Ca dao, đợt 2 (nguyên văn — nguồn: quantrimang.com, rdsic.edu.vn) ─────
  {
    kind: "cadao",
    text: "Nhiễu điều phủ lấy giá gương\nNgười trong một nước phải thương nhau cùng.",
  },
  {
    kind: "cadao",
    text: "Bầu ơi thương lấy bí cùng\nTuy rằng khác giống nhưng chung một giàn.",
  },
  {
    kind: "cadao",
    text: "Lời nói chẳng mất tiền mua\nLựa lời mà nói cho vừa lòng nhau.",
  },
  {
    kind: "cadao",
    text: "Những người tính nết thật thà\nĐi đâu cũng được người ta tin dùng.",
  },
  {
    kind: "cadao",
    text: "Công cha như núi Thái Sơn\nNghĩa mẹ như nước trong nguồn chảy ra.",
  },
  {
    kind: "cadao",
    text: "Khôn ngoan đối đáp người ngoài\nGà cùng một mẹ chớ hoài đá nhau.",
  },
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
