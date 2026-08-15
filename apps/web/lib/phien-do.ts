/**
 * BUỔI HỌC ĐANG DỞ — nhặt lại được sau khi văng.
 *
 * VÌ SAO (nợ 14/08). Màn "Phiên đăng nhập đã hết hạn" hứa với học sinh: *"Bài
 * em đang gõ dở đã được giữ lại"*. Lời hứa đó mới đúng MỘT NỬA: `luuNhap` giữ
 * chữ em đang gõ theo từng câu, nhưng CẢ BUỔI HỌC — 20 câu server vừa phục vụ,
 * đang ở câu thứ mấy, XP kiếm được, mạch vá nền đang đi tới đâu — chỉ sống
 * trong state React. Đăng nhập lại, tải lại trang, hay iOS thu hồi tab lúc em
 * chuyển sang app khác: buổi bay sạch, em rơi về lộ trình và phải làm lại từ
 * câu 1. Em đang làm trắc nghiệm (không gõ chữ) thì chẳng giữ được gì cả.
 *
 * CÁCH CHỮA. Đóng gói buổi học xuống localStorage sau mỗi lần trạng thái đổi;
 * mở app lên thì lộ trình mời "Học tiếp". Điểm quan trọng: gói này giữ NGUYÊN
 * `sessionId`, tức nối lại ĐÚNG hàng `learning_sessions` đang active chứ không
 * mở buổi mới — bằng chứng mastery, XP, lịch sử đối thoại của buổi vẫn thuộc
 * về một buổi duy nhất, và hàng phiên đó không bị bỏ hoang.
 *
 * NỐI LẠI NỬA CHỪNG CÓ AN TOÀN KHÔNG? Có, và không nhờ may:
 *   · `mastery_evidence` có UNIQUE(session_id, question_id) + on-conflict-do-
 *     nothing ⇒ làm lại đúng câu vừa làm không đẻ bằng chứng thứ hai;
 *   · XP có unique index chống cộng trùng, và XP "đúng" chỉ phát ở lần thử ĐẦU;
 *   · số lần thử do server đếm từ bảng `attempts`, không tin `attempts` của
 *     client ⇒ khôi phục về 0 không mở được cửa nào để lách cổng nỗ lực.
 *
 * KHOÁ THEO NGƯỜI DÙNG. Máy dùng chung (phòng máy, điện thoại của anh chị em)
 * là chuyện có thật ở trường: buổi của em này tuyệt đối không được hiện ra cho
 * em khác. Mọi khoá đều mang uid.
 *
 * GIỚI HẠN ĐÃ BIẾT: gói nằm ở MÁY, nên văng ở điện thoại rồi mở máy tính thì
 * không nối lại được — muốn vậy phải có endpoint đọc `learning_sessions` active
 * và phục vụ lại đúng bộ câu. Chưa làm: ca thật của pilot là cùng một máy.
 */

import type { DiagnoseQuestion, DiagnoseResult } from "./api";

/** Đổi số này khi hình dạng gói đổi — gói bản cũ bị bỏ qua thay vì dựng sai. */
export const BAN_GOI = 1;

/** Quá hạn thì thôi mời: buổi của hôm kia nối lại chỉ làm em bối rối, mà số
 *  liệu trong đó (XP buổi, thời gian học) cũng đã hết ý nghĩa. */
export const HAN_MS = 24 * 60 * 60 * 1000;

/** Trần số lời giữ lại. Mạch hội thoại chỉ cần đủ để em nhớ "mình đang nói tới
 *  đâu"; giữ cả buổi thì gói phình ra vô ích. */
export const TRAN_LOI = 40;

export interface LoiPhien {
  role: string;
  text: string;
}

export interface PhienDo {
  v: number;
  /** Lúc lưu lần cuối = lúc em thao tác lần cuối (chỉ lưu khi trạng thái đổi). */
  luuLuc: number;
  /** Đã học bao lâu tính tới lần lưu cuối. Cố ý KHÔNG phải `now − lúc bắt đầu`:
   *  quãng em offline (đi ngủ, hết phiên) không phải thời gian học, cộng vào là
   *  màn hoàn thành khoe "58 phút" cho một buổi mười phút. */
  daHocMs: number;
  subject: string;
  ses: DiagnoseResult;
  qi: number;
  earned: number;
  /** Câu từng trả lời sai — nuôi con số "đúng x/y" ở màn hoàn thành. */
  sai: string[];
  /** Ngăn xếp câu vá nền (engine tiêm khi em kẹt), đáy là câu chính. */
  tiem: DiagnoseQuestion[];
  nhanTiem: string | null;
  loi: LoiPhien[];
}

export interface NguyenLieuGoi {
  subject: string;
  ses: DiagnoseResult;
  qi: number;
  earned: number;
  sai: string[];
  tiem: DiagnoseQuestion[];
  nhanTiem: string | null;
  loi: LoiPhien[];
  batDauLuc: number | null;
  now: number;
}

export const khoaPhien = (uid: string) => `tutor:phien-do:${uid}`;

/** Đóng gói — THUẦN (không đụng localStorage) để bộ kiểm chạy được. */
export function dongGoi(x: NguyenLieuGoi): PhienDo {
  const daHoc = x.batDauLuc ? Math.max(0, x.now - x.batDauLuc) : 0;
  return {
    v: BAN_GOI,
    luuLuc: x.now,
    daHocMs: daHoc,
    subject: x.subject,
    ses: x.ses,
    qi: x.qi,
    earned: x.earned,
    sai: x.sai,
    tiem: x.tiem,
    nhanTiem: x.nhanTiem,
    // Chỉ phần đuôi: lời cũ hơn không còn giúp em định vị mạch chuyện.
    loi: x.loi.slice(-TRAN_LOI),
  };
}

const laChuoi = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const laSo = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Câu hỏi tối thiểu phải dựng được màn làm bài: có id để chấm và đề để đọc. */
const laCauHop = (v: unknown): v is DiagnoseQuestion => {
  if (!v || typeof v !== "object") return false;
  const q = v as Record<string, unknown>;
  return laChuoi(q.id) && typeof q.prompt === "string";
};

/**
 * Đọc + KIỂM gói. Trả null nếu không dùng được — mọi lối vào đều phải đi qua
 * đây, vì dữ liệu ở localStorage là thứ người dùng sửa được và bản cũ của app
 * cũng ghi vào cùng khoá. Thà không mời học tiếp còn hơn dựng một buổi méo.
 */
export function docTuChuoi(raw: string | null, now: number): PhienDo | null {
  if (!raw) return null;
  let x: unknown;
  try {
    x = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.v !== BAN_GOI) return null;
  if (!laSo(o.luuLuc) || now - o.luuLuc > HAN_MS) return null;
  if (!laChuoi(o.subject)) return null;

  const ses = o.ses as Record<string, unknown> | undefined;
  if (!ses || typeof ses !== "object") return null;
  if (!laChuoi(ses.sessionId)) return null;
  const cau = Array.isArray(ses.questions) ? ses.questions.filter(laCauHop) : [];
  // Mất hết câu thì không còn gì để học tiếp — mời là mời vào buổi rỗng.
  if (cau.length === 0 || cau.length !== (ses.questions as unknown[]).length) return null;

  // Đồng hồ máy chạy lùi (đổi múi giờ, chỉnh tay) cho ra tuổi âm — coi như vừa
  // lưu, đừng vứt buổi học của em vì cái đồng hồ.
  const daHoc = laSo(o.daHocMs) && o.daHocMs >= 0 ? o.daHocMs : 0;
  // qi vượt mảng = văng đúng lúc đang đóng buổi ⇒ kẹp về câu cuối. Làm lại câu
  // cuối rồi bấm tiếp là xong buổi (end-session tất định + idempotent).
  const qi = laSo(o.qi) ? Math.min(Math.max(0, Math.floor(o.qi)), cau.length - 1) : 0;

  return {
    v: BAN_GOI,
    luuLuc: o.luuLuc,
    daHocMs: daHoc,
    subject: o.subject,
    ses: {
      sessionId: ses.sessionId,
      kgVersionId: laChuoi(ses.kgVersionId) ? ses.kgVersionId : "",
      node: laChuoi(ses.node) ? ses.node : null,
      questions: cau,
    },
    qi,
    earned: laSo(o.earned) && o.earned >= 0 ? Math.floor(o.earned) : 0,
    sai: Array.isArray(o.sai) ? o.sai.filter(laChuoi) : [],
    tiem: Array.isArray(o.tiem) ? o.tiem.filter(laCauHop) : [],
    nhanTiem: laChuoi(o.nhanTiem) ? o.nhanTiem : null,
    loi: Array.isArray(o.loi)
      ? (o.loi.filter(
          (m): m is LoiPhien =>
            !!m && typeof m === "object" && laChuoi((m as LoiPhien).role) &&
            typeof (m as LoiPhien).text === "string",
        ).slice(-TRAN_LOI))
      : [],
  };
}

/** Câu đang làm khi nối lại = câu vá nền trên cùng (nếu đang vá), không thì câu
 *  chính. Cùng luật với `injectedQ ?? ses.questions[qi]` ở màn học — để nhãn
 *  trên thẻ "Học tiếp" nói đúng câu em sẽ thấy khi bấm. */
export function cauDangLam(p: PhienDo): DiagnoseQuestion | null {
  return p.tiem[p.tiem.length - 1] ?? p.ses.questions[p.qi] ?? null;
}

// ── Ba cửa đụng localStorage (bọc try/catch: chế độ riêng tư chặn) ──────────
export function docPhienDo(uid: string, now: number = Date.now()): PhienDo | null {
  if (typeof window === "undefined") return null;
  try {
    return docTuChuoi(window.localStorage.getItem(khoaPhien(uid)), now);
  } catch {
    return null;
  }
}

export function luuPhienDo(uid: string, p: PhienDo): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(khoaPhien(uid), JSON.stringify(p));
  } catch {
    /* riêng tư / hết quota — mất chỗ nối lại thì tiếc, nhưng KHÔNG được phép
       làm hỏng buổi học đang chạy. Im lặng đúng chỗ này. */
  }
}

export function xoaPhienDo(uid: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(khoaPhien(uid));
  } catch {
    /* như trên */
  }
}
