/**
 * ĐỌC BÀI LÀM RA CHỮ — một cửa duy nhất cho cả ba đường nộp.
 *
 * Chủ dự án chốt 01/08: bài tự luận nay AI chấm hết, giáo viên không chấm nữa.
 * Ba cửa vào (gõ tay / tệp Word / ảnh chụp) PHẢI quy về cùng một chuỗi trước khi
 * chấm — ba bộ chấm riêng là ba nơi để lệch nhau, và học sinh nộp cùng một bài
 * bằng hai đường lại nhận hai kết quả.
 *
 *   tệp .docx → docxToText (giải nén + OMML sang LaTeX)
 *   ảnh       → mô hình NHÌN chép lại nguyên văn (KHÔNG chấm, KHÔNG sửa)
 *   .txt      → đọc thẳng
 *   .pdf/.doc → CHƯA đọc được → nói thẳng với em, đừng chấm bừa
 *
 * Điểm sống còn: mô hình nhìn chỉ được CHÉP LẠI. Nó mà "giúp" em bằng cách sửa
 * chỗ sai trong lúc chép thì bộ chấm nhận về một bài đã được chữa, và một bài
 * sai được cho qua. Lời dặn ở OCR_SYS_VI viết ra chính là để bịt chỗ đó.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { callLLM } from "./llm.ts";
import { docxToText } from "./docx.ts";

const BUCKET = "learning-assets";

/** Trần kích thước tệp đọc được. Ảnh điện thoại hay 3–5 MB; hơn 8 MB thì gần
 *  như chắc chắn là tệp sai chứ không phải một trang giấy. */
const MAX_BYTES = 8 * 1024 * 1024;

export type NguonBai = "go" | "docx" | "anh" | "txt";

export interface BaiLamDoc {
  /** Chữ đã lấy ra được (công thức bọc trong $…$). Rỗng khi không đọc nổi. */
  text: string;
  nguon: NguonBai;
  /** Lời nhắn cho học sinh khi có chỗ đọc thiếu — nhánh gọi ghép vào phản hồi. */
  canhBao?: string;
  /** true = KHÔNG đọc được gì. Nhánh gọi PHẢI không chấm, và nói rõ vì sao. */
  khongDocDuoc?: boolean;
}

/**
 * Lời dặn cho mô hình NHÌN. Ba điều, theo đúng thứ tự quan trọng:
 *   1. CHÉP, không chấm — đây là chỗ dễ hỏng nhất.
 *   2. Sai thì chép nguyên cái sai — bài của em thế nào thì ra thế ấy.
 *   3. Không đọc được thì NÓI, đừng đoán.
 */
const OCR_SYS_VI = `Bạn là máy chép lại bài làm viết tay của học sinh lớp 10.

NHIỆM VỤ DUY NHẤT: chép lại y nguyên những gì nhìn thấy trên ảnh.

Luật bắt buộc:
- KHÔNG giải bài. KHÔNG chấm đúng sai. KHÔNG nhận xét.
- KHÔNG sửa lỗi của học sinh. Em viết sai phép tính thì chép lại đúng cái sai đó.
- Công thức toán viết bằng LaTeX, bọc trong dấu $...$. Ví dụ: $x^2 - 5x + 6 = 0$.
- Giữ nguyên thứ tự dòng và cách em xuống dòng.
- Chỗ nào mờ không đọc được, viết [không đọc được] ngay tại chỗ đó.
- Nếu cả ảnh không đọc được gì (quá mờ, không phải bài làm, trang trắng), trả về đúng một dòng: KHONG_DOC_DUOC

Chỉ trả về phần chép lại. Không thêm lời dẫn nào.`;

const OCR_SYS_EN = `You transcribe a grade-10 student's handwritten work.

ONLY TASK: copy exactly what you see in the image.

Rules:
- Do NOT solve. Do NOT grade. Do NOT comment.
- Do NOT fix the student's mistakes. If their arithmetic is wrong, copy the wrong version.
- Write maths as LaTeX inside $...$, e.g. $x^2 - 5x + 6 = 0$.
- Keep the original line order and line breaks.
- Where the writing is illegible, write [illegible] at that spot.
- If the whole image is unreadable (too blurry, not schoolwork, blank page), return exactly one line: KHONG_DOC_DUOC

Return only the transcription. No preamble.`;

const laAnh = (mime: string, path: string) =>
  /^image\//i.test(mime) || /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(path);

const laDocx = (mime: string, path: string) =>
  /wordprocessingml\.document/i.test(mime) || /\.docx$/i.test(path);

const laTxt = (mime: string, path: string) =>
  /^text\/plain/i.test(mime) || /\.txt$/i.test(path);

/** Uint8Array → data URL. Đi từng khối để không nổ ngăn xếp khi ảnh vài MB
 *  (String.fromCharCode(...arr) với 3 triệu phần tử là ném RangeError). */
function toDataUrl(bytes: Uint8Array, mime: string): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime || "image/jpeg"};base64,${btoa(s)}`;
}

export async function docBaiLamTuTep(args: {
  supa: SupabaseClient;
  filePath: string;
  mime: string;
  en?: boolean;
  studentId: string;
  tenantId: string;
}): Promise<BaiLamDoc> {
  const { supa, filePath, mime, en = false } = args;

  const { data: blob, error } = await supa.storage.from(BUCKET).download(filePath);
  if (error || !blob) {
    return {
      text: "", nguon: "anh", khongDocDuoc: true,
      canhBao: "Mình không mở được tệp bạn vừa gửi. Bạn thử tải lên lại nhé.",
    };
  }
  if (blob.size > MAX_BYTES) {
    return {
      text: "", nguon: "anh", khongDocDuoc: true,
      canhBao: `Tệp nặng quá (${Math.round(blob.size / 1024 / 1024)} MB). Bạn chụp lại nhỏ hơn, hoặc gõ bài vào ô soạn thảo nhé.`,
    };
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // ── Word ────────────────────────────────────────────────────────────────────
  if (laDocx(mime, filePath)) {
    try {
      const r = await docxToText(bytes);
      if (!r.text.trim()) {
        return {
          text: "", nguon: "docx", khongDocDuoc: true,
          canhBao: "Tệp Word này mình mở ra thấy trống. Bạn kiểm lại tệp, hoặc gõ bài vào ô soạn thảo nhé.",
        };
      }
      return {
        text: r.text,
        nguon: "docx",
        // Đọc được chữ nhưng HỤT công thức → vẫn chấm (còn hơn chặn em lại),
        // nhưng phải nói ra: nếu bị trừ ý, em biết đường gõ lại cho đủ.
        ...(r.coMathChuaDoc
          ? { canhBao: "Trong tệp Word có công thức mình đọc chưa ra. Nếu bài bị chấm thiếu ý, bạn gõ lại công thức bằng ô soạn thảo nhé." }
          : {}),
      };
    } catch {
      return {
        text: "", nguon: "docx", khongDocDuoc: true,
        canhBao: "Tệp Word này mình không đọc được. Bạn lưu lại dạng .docx, hoặc gõ bài vào ô soạn thảo nhé.",
      };
    }
  }

  // ── Văn bản thuần ───────────────────────────────────────────────────────────
  if (laTxt(mime, filePath)) {
    const text = new TextDecoder().decode(bytes).slice(0, 12_000).trim();
    return text
      ? { text, nguon: "txt" }
      : { text: "", nguon: "txt", khongDocDuoc: true, canhBao: "Tệp bạn gửi đang trống." };
  }

  // ── Ảnh: mô hình nhìn chép lại ──────────────────────────────────────────────
  if (laAnh(mime, filePath)) {
    try {
      const res = await callLLM({
        system: en ? OCR_SYS_EN : OCR_SYS_VI,
        user: en
          ? "Transcribe this page of student work."
          : "Chép lại trang bài làm này.",
        images: [toDataUrl(bytes, mime || "image/jpeg")],
        agent: "ocr-bai-lam",
        tier: "vision",
        maxTokens: 1400,
        temperature: 0,
        // Cùng một ảnh thì cùng một bản chép: em nộp lại bài y hệt không được
        // nhận hai bản chép khác nhau rồi hai phán quyết khác nhau.
        cache: true,
        studentId: args.studentId,
        tenantId: args.tenantId,
        supa,
      });
      const text = res.text.trim();
      if (!text || /^KHONG_DOC_DUOC/i.test(text)) {
        return {
          text: "", nguon: "anh", khongDocDuoc: true,
          canhBao: "Ảnh hơi khó đọc nên mình chưa chép ra được bài của bạn. Bạn chụp lại rõ hơn (đủ sáng, thẳng trang), hoặc gõ bài vào ô soạn thảo nhé.",
        };
      }
      const soChoMo = (text.match(/\[không đọc được\]|\[illegible\]/gi) ?? []).length;
      return {
        text,
        nguon: "anh",
        ...(soChoMo > 0
          ? { canhBao: `Có ${soChoMo} chỗ trong ảnh mình đọc chưa ra. Nếu bài bị chấm thiếu ý, bạn gõ lại đoạn đó nhé.` }
          : {}),
      };
    } catch {
      // Hết ngân sách token / model nhìn hỏng — KHÔNG được coi là bài sai.
      return {
        text: "", nguon: "anh", khongDocDuoc: true,
        canhBao: "Lúc này mình chưa đọc được ảnh. Bạn thử lại sau ít phút, hoặc gõ bài vào ô soạn thảo nhé.",
      };
    }
  }

  // ── .pdf, .doc cũ và mọi thứ khác ───────────────────────────────────────────
  // Nói THẲNG là chưa đọc được, thay vì nhận bài rồi chấm một chuỗi rỗng — chấm
  // chuỗi rỗng nghĩa là đánh trượt em vì định dạng tệp, không phải vì bài làm.
  return {
    text: "", nguon: "anh", khongDocDuoc: true,
    canhBao: "Định dạng tệp này mình chưa đọc được. Bạn gửi ảnh chụp bài, tệp .docx, hoặc gõ thẳng vào ô soạn thảo nhé.",
  };
}
