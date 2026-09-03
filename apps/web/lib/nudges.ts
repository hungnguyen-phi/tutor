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

export type NudgeKind = "tucngu" | "cadao" | "dongdao" | "chamngon";

export type Nudge = {
  text: string;
  kind: NudgeKind;
};

/** Nhãn hiện dưới câu — để em biết mình vừa đọc thứ gì, không tưởng app tự bịa. */
export const KIND_LABEL: Record<NudgeKind, string> = {
  tucngu: "Tục ngữ Việt Nam",
  cadao: "Ca dao",
  dongdao: "Đồng dao",
  chamngon: "Châm ngôn học hành",
};

/**
 * Kho câu nhắc ở thẻ sư tử (cột phải màn Học).
 * Giữ MỖI CÂU ≤ 2 dòng ở khung 300px — dài hơn là em không đọc.
 *
 * ⚠️ tucngu/cadao/dongdao PHẢI đúng NGUYÊN VĂN — không tự thêm chữ vào rồi
 * gắn mác dân gian (đã trả giá 03/09: bịa đuôi câu, chủ dự án bắt lỗi ngay).
 * Muốn thêm lời khuyên tự viết thì dùng "chamngon".
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

  // ── Châm ngôn học hành (tự viết, diễn đạt trung tính, không gán tác giả) ──
  { kind: "chamngon", text: "Sai một câu là biết thêm một chỗ mình chưa vững — đó là lãi, không phải lỗ." },
  { kind: "chamngon", text: "Não em lớn lên đúng lúc em thấy khó. Dễ quá thì chẳng có gì mọc thêm." },
  { kind: "chamngon", text: "Mỗi ngày một bài ngắn — đều đặn thắng dốc sức." },
  { kind: "chamngon", text: "Chưa hiểu không giống là không hiểu được. Thêm một lượt nữa thôi." },
  { kind: "chamngon", text: "Người hỏi câu ngốc nghếch trong năm phút, hơn người giả vờ hiểu suốt cả năm." },
  { kind: "chamngon", text: "Đừng so với bạn bên cạnh — so với chính em hôm qua." },
  { kind: "chamngon", text: "Học là bắc thang: đứng bậc dưới cho vững rồi bậc trên tự tới." },
  { kind: "chamngon", text: "Bài khó thì chia nhỏ ra mà đi — tay đếm miệng đọc, từng bước một rồi cũng xong." },
  { kind: "chamngon", text: "Dốc lòng học hôm nay khó, để ngày sau đỡ vất hơn." },
  { kind: "chamngon", text: "Làm sai không phải làm dở — chỉ là chưa xong thôi." },
  { kind: "chamngon", text: "Một bước nhỏ hôm nay hơn một quyết tâm to để mai." },
  { kind: "chamngon", text: "Câu hỏi ngốc nhất là câu không dám hỏi." },
  { kind: "chamngon", text: "Hiểu chậm không sao — miễn là hiểu thật, không phải nhớ tạm." },
  { kind: "chamngon", text: "Sai ba lần không phải là dừng — là biết thêm ba chỗ cần sửa." },
  { kind: "chamngon", text: "Không ai giỏi ngay từ câu đầu tiên." },
  { kind: "chamngon", text: "Chăm một chút mỗi ngày hơn hẳn một đêm thức trắng." },
  { kind: "chamngon", text: "Đọc lại lần hai thường hiểu hơn đọc vội lần một." },
  { kind: "chamngon", text: "Đừng vội nản — hiểu bài là một hành trình, không phải một cú nhảy." },
  { kind: "chamngon", text: "Tự hỏi \"vì sao\" trước khi hỏi người khác — có khi tự trả lời được." },
  { kind: "chamngon", text: "Mỗi lỗi sai là một manh mối, không phải một bản án." },
  { kind: "chamngon", text: "Chững lại một lúc để nghĩ, còn hơn đoán bừa cho nhanh." },
  { kind: "chamngon", text: "Việc khó chia nhỏ ra thì việc nào cũng làm được." },
  { kind: "chamngon", text: "Không hiểu ngay không có nghĩa là không hiểu được." },
  { kind: "chamngon", text: "Cứ thử đã — sai thì sửa, còn hơn không thử." },
  { kind: "chamngon", text: "Kiên nhẫn với chính mình cũng là một kỹ năng cần luyện." },
  { kind: "chamngon", text: "Nắm chắc cái cũ thì cái mới học nhanh hơn hẳn." },
  { kind: "chamngon", text: "Một câu hỏi rõ ràng thường mở ra một câu trả lời rõ ràng." },
  { kind: "chamngon", text: "Nghỉ một chút để đầu óc lắng lại, rồi quay lại vẫn kịp." },
  { kind: "chamngon", text: "Học là quá trình sửa dần, không phải cuộc thi một lần đúng ngay." },
  { kind: "chamngon", text: "Cẩn thận hơn một chút cũng đủ tránh được nửa số lỗi sai." },
  { kind: "chamngon", text: "Chỗ nào còn ngập ngừng là chỗ cần luyện thêm, không phải chỗ để né." },
  { kind: "chamngon", text: "Làm được một bài khó hôm nay, bài tương tự mai sẽ nhẹ hơn." },
  { kind: "chamngon", text: "Nhớ bằng hiểu thì lâu quên hơn nhớ bằng học vẹt." },
  { kind: "chamngon", text: "Sai chỗ nào, sửa đúng chỗ đó — đừng làm lại từ đầu cho chắc." },
  { kind: "chamngon", text: "Tự tin không phải là luôn đúng, mà là dám thử dù chưa chắc." },
  { kind: "chamngon", text: "Một bài làm chắc còn hơn ba bài làm ẩu." },
  { kind: "chamngon", text: "Cứ hỏi khi chưa rõ — im lặng không giúp bài dễ hơn." },
  { kind: "chamngon", text: "Chậm mà chắc vẫn về đích, vội mà sai phải làm lại từ đầu." },
  { kind: "chamngon", text: "Lỗi tìm ra hôm nay là lỗi không còn gặp lại lúc kiểm tra." },
  { kind: "chamngon", text: "Đọc kỹ đề bài một lần nữa trước khi vội làm." },
  { kind: "chamngon", text: "Không có ai nhớ hết ngay lần đầu — nhắc lại vài lần là nhớ." },
  { kind: "chamngon", text: "Cứ làm hết sức mình, phần còn lại để lúc khác tiếp tục." },
  { kind: "chamngon", text: "Hỏi \"vì sao đúng\" cũng quan trọng như hỏi \"vì sao sai\"." },
  { kind: "chamngon", text: "Một buổi học chắc tay hơn ba buổi học đối phó." },
  { kind: "chamngon", text: "Khi bí, thử đổi cách nhìn bài toán — có khi lối ra ở góc khác." },
  { kind: "chamngon", text: "Cứ đi chậm cũng được, miễn đừng đứng yên." },
  { kind: "chamngon", text: "Càng luyện nhiều dạng bài, càng ít bất ngờ khi gặp bài lạ." },
  { kind: "chamngon", text: "Một điểm kiến thức nắm chắc quý hơn mười điểm học loáng thoáng." },
  { kind: "chamngon", text: "Bình tĩnh đọc lại đề — nhiều lỗi sai vì đọc vội, không phải vì không biết." },
  { kind: "chamngon", text: "Không hiểu bài không phải vì kém, chỉ là bài đó cần thêm thời gian." },
  { kind: "chamngon", text: "Học cùng bạn bè khi bí cũng là một cách học rất hay." },
  { kind: "chamngon", text: "Nghỉ tay uống nước rồi quay lại — đầu óc cũng cần thở." },
  { kind: "chamngon", text: "Một chút cố gắng thêm mỗi ngày, cộng dồn lại là một quãng đường dài." },
  { kind: "chamngon", text: "Nhìn lại bài đã làm đúng cũng đáng để hiểu, không chỉ bài làm sai." },
  { kind: "chamngon", text: "Đề khó thường chỉ khó ở một bước — tìm đúng bước đó là xong cả bài." },
  { kind: "chamngon", text: "Buổi học hôm nay chưa xong thì mai học tiếp, không cần dồn hết vào một lần." },
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
