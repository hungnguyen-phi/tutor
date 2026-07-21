/**
 * Dấu chân sư tử — hình dạng node lộ trình, BẢN ARTWORK CHÍNH CHỦ.
 *
 * Chủ dự án cung cấp artwork (assets-src/mascot/df74c0d3…, xử lý bởi
 * slice-paw.mjs): dấu chân gold viền navy, có sẵn tích V trong đệm.
 * Hai sprite: paw-check.png (nguyên bản — node ĐÃ THÀNH THẠO) và
 * paw-plain.png (đã xoá tích — các trạng thái còn lại, icon overlay đè lên).
 *
 * "Cho hình tròn hoặc bầu dục làm layer bên dưới thêm cho dày dặn" — đĩa
 * ellipse 2 lớp bên dưới chân: lớp MẶT tô màu trạng thái (--paw-face) và lớp
 * ĐÙN tối (--paw-edge) giữ hiệu ứng phím vật lý của hi-fi; vòng gold quanh
 * node hiện tại là ellipse ring quanh đĩa (đúng ngữ pháp hi-fi 3a).
 */

const DISC = { rx: 46, ry: 26 }; // viewBox 100×66

export default function PawNode({
  width = 74,
  mastered = false,
}: {
  width?: number;
  /** Node đã thành thạo → dùng bản artwork CÓ TÍCH V, không cần icon overlay. */
  mastered?: boolean;
}) {
  return (
    <span className="paw" style={{ width, height: Math.round(width * 0.96) }} aria-hidden>
      <svg className="paw-disc" viewBox="0 0 100 66" focusable="false">
        {/* Vòng nhấn node hiện tại — bật/tắt bằng CSS theo data-state */}
        <ellipse
          className="paw-ring"
          cx="50"
          cy="33"
          rx={DISC.rx + 6}
          ry={DISC.ry + 6}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="3.5"
        />
        {/* Lớp đùn — phím vật lý (0 7px 0 của hi-fi, bản ellipse) */}
        <ellipse className="paw-edge" cx="50" cy="40" rx={DISC.rx} ry={DISC.ry} fill="var(--paw-edge)" />
        {/* Lớp mặt — bấm thì tụt xuống đè lớp đùn (CSS) */}
        <ellipse className="paw-face" cx="50" cy="33" rx={DISC.rx} ry={DISC.ry} fill="var(--paw-face)" />
      </svg>
      <img
        className="paw-img"
        src={mastered ? "/brand/lion/paw-check.png" : "/brand/lion/paw-plain.png"}
        width={Math.round(width * 0.76)}
        height={Math.round(width * 0.76 * 0.945)} /* tỉ lệ thật 256×242 */
        alt=""
        draggable={false}
        /* Path dài: paw dưới fold hoãn tải; 2 file dùng chung nên node sau ăn cache */
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
