/**
 * PHÁT CHỮ DẦN cho lượt trò chuyện (29/07).
 *
 * Vì sao: mỗi lượt sư tử nói, học sinh nhìn màn hình trống tới khi mô hình viết
 * XONG cả câu. Quãng chờ đó là phần dài nhất của lượt và KHÔNG cách nào rút
 * ngắn bằng tiền — chỉ có cách đừng bắt em đợi trọn câu.
 *
 * Giao ước với client (đặt `stream: true` trong thân yêu cầu):
 *   event: meta   data: {...}        ← phong bì JSON như cũ, TRỪ `message`
 *   event: delta  data: {"t":"..."}  ← từng mẩu chữ
 *   event: done   data: {"message":"...trọn câu..."}
 *
 * Client KHÔNG hiểu SSE (bản cũ, hoặc lỗi mạng) thì vẫn gọi được đường JSON cũ:
 * cờ `stream` do client bật, không bật thì server trả y như trước. Nhờ vậy web
 * và edge function KHÔNG buộc phải lên cùng lúc.
 */

const enc = new TextEncoder();

export interface SseWriter {
  /** Phong bì JSON (mọi thứ trừ `message`) — gửi TRƯỚC mẩu chữ đầu tiên. */
  meta(obj: unknown): void;
  /** Một mẩu chữ. */
  delta(t: string): void;
  /** Chốt lượt kèm câu đầy đủ, rồi đóng dòng. */
  done(message: string): void;
  /** Hỏng giữa chừng: báo client rồi đóng, đừng treo em ở màn quay tròn. */
  fail(message: string): void;
}

/** Mở một dòng SSE. Trả về `response` để trả thẳng, và `writer` để bơm chữ. */
export function openSse(req: Request): { response: Response; writer: SseWriter } {
  let ctrl: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
    },
    cancel() {
      // Em đóng tab giữa chừng — đánh dấu đóng để các lượt ghi sau không ném.
      closed = true;
    },
  });

  const send = (event: string, data: unknown) => {
    if (closed || !ctrl) return;
    try {
      ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch {
      closed = true; // dòng đã đứt: nuốt, không để hỏng cả lượt xử lý phía sau
    }
  };
  const close = () => {
    if (closed || !ctrl) return;
    closed = true;
    try {
      ctrl.close();
    } catch { /* đã đóng */ }
  };

  const origin = req.headers.get("Origin") ?? "*";
  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Một số proxy gom bộ đệm rồi nhả một cục — thế thì phát dần thành vô nghĩa.
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    },
  });

  return {
    response,
    writer: {
      meta: (obj) => send("meta", obj),
      delta: (t) => send("delta", { t }),
      done: (message) => {
        send("done", { message });
        close();
      },
      fail: (message) => {
        send("done", { message });
        close();
      },
    },
  };
}
