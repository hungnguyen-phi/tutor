"use client";

// Đợt C — đọc to transcript cho dạng "nghe" bằng Web Speech API (SpeechSynthesis)
// ngay trong trình duyệt: zero-cost, không cần khoá TTS. Studio chưa đẩy audio_uri
// thì đây là đường nghe MVP; nâng cấp lên TTS thật / link audio là bước sau.

import { useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";

export function SpeakerButton({ text, lang = "en-US" }: { text: string; lang?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const ref = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { try { window.speechSynthesis?.cancel(); } catch { /* noop */ } };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.95; // chậm hơn chút cho học sinh nghe
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    ref.current = u;
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  return (
    <button type="button" className="listen-btn" onClick={toggle} aria-pressed={speaking}>
      {speaking ? <Square aria-hidden strokeWidth={2.25} /> : <Volume2 aria-hidden strokeWidth={2.25} />}
      {speaking ? "Dừng" : "Nghe"}
    </button>
  );
}
