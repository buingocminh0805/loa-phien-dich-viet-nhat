"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Lang = "vi" | "ja";
type Turn = { id: number; source: string; translation: string; from: Lang };
type Profile = { name: string; email: string; signedIn: boolean; autoSpeak: boolean; speechRate: number };
const defaultProfile: Profile = { name: "", email: "", signedIn: false, autoSpeak: true, speechRate: 0.92 };

const phrases: Record<string, string> = {
  "xin chào": "こんにちは", "xin chào bạn": "こんにちは", "cảm ơn": "ありがとうございます",
  "tạm biệt": "さようなら", "bạn có khỏe không": "お元気ですか", "tôi khỏe": "元気です",
  "tôi tên là": "私の名前は", "bao nhiêu tiền": "いくらですか", "nhà vệ sinh ở đâu": "トイレはどこですか",
  "こんにちは": "Xin chào", "ありがとうございます": "Cảm ơn bạn", "さようなら": "Tạm biệt",
  "お元気ですか": "Bạn có khỏe không?", "元気です": "Tôi khỏe", "いくらですか": "Bao nhiêu tiền?",
  "トイレはどこですか": "Nhà vệ sinh ở đâu?"
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/[?.!,。！？]/g, "");
const detectLang = (s: string): Lang => /[\u3040-\u30ff\u3400-\u9fff]/.test(s) ? "ja" : "vi";

async function translateText(text: string, from: Lang) {
  const local = phrases[normalize(text)] || phrases[text.trim()];
  if (local) return local;
  const pair = from === "vi" ? "vi|ja" : "ja|vi";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("translation_failed");
  const data = await response.json();
  const result = data?.responseData?.translatedText;
  if (!result) throw new Error("empty_translation");
  return result as string;
}

function Icon({ name }: { name: "menu" | "settings" | "volume" | "mic" | "history" | "send" | "stop" }) {
  const paths = {
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.1.4.3.7.6 1 .3.3.7.4 1.1.4h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/></>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    send: <><path d="m21 3-8.5 18-2.4-7.1L3 11.5 21 3Z"/><path d="m10.1 13.9 5-5"/></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2"/>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function Wave({ active, red = false }: { active: boolean; red?: boolean }) {
  return <div className={`wave ${active ? "active" : ""} ${red ? "red" : ""}`} aria-hidden="true">
    {Array.from({ length: 31 }, (_, i) => <i key={i} style={{ "--h": `${12 + ((i * 17) % 34)}px`, "--d": `${(i % 9) * 45}ms` } as React.CSSProperties} />)}
  </div>;
}

export default function Home() {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    { id: 1, source: "Xin chào, bạn có khỏe không?", translation: "こんにちは、お元気ですか？", from: "vi" }
  ]);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [loginName, setLoginName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const recognitionRef = useRef<any>(null);
  const shouldContinue = useRef(false);
  const latest = turns[turns.length - 1];

  const speak = useCallback((text: string, lang: Lang) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "ja" ? "ja-JP" : "vi-VN";
    utterance.rate = profile.speechRate;
    window.speechSynthesis.speak(utterance);
  }, [profile.speechRate]);

  const processText = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setProcessing(true); setError("");
    const from = detectLang(text);
    try {
      const translation = await translateText(text, from);
      setTurns(prev => [...prev, { id: Date.now(), source: text, translation, from }].slice(-30));
      if (profile.autoSpeak) speak(translation, from === "vi" ? "ja" : "vi");
    } catch {
      setError("Chưa thể kết nối dịch vụ dịch. Vui lòng thử lại.");
    } finally { setProcessing(false); }
  }, [speak, profile.autoSpeak]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome hoặc nhập văn bản."); return; }
    setError(""); shouldContinue.current = true;
    const recognition = new SpeechRecognition();
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = "vi-VN";
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: any) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      if (finalText) processText(finalText);
    };
    recognition.onerror = (event: any) => { if (event.error !== "no-speech" && event.error !== "aborted") setError("Không nghe rõ. Hãy thử nói lại gần micro hơn."); };
    recognition.onend = () => {
      if (shouldContinue.current) { try { recognition.start(); } catch {} }
      else setListening(false);
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch {}
  }, [processText]);

  const stopListening = () => {
    shouldContinue.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setListening(false);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("loa-profile");
      if (saved) setProfile({ ...defaultProfile, ...JSON.parse(saved) });
    } catch {}
    return () => { shouldContinue.current = false; recognitionRef.current?.abort(); };
  }, []);

  const saveProfile = (next: Profile) => {
    setProfile(next);
    try { localStorage.setItem("loa-profile", JSON.stringify(next)); } catch {}
  };

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginEmail.trim()) return;
    saveProfile({ ...profile, name: loginName.trim(), email: loginEmail.trim(), signedIn: true });
    setLoginName(""); setLoginEmail("");
  };

  const logout = () => saveProfile({ ...defaultProfile });

  const submit = (e: React.FormEvent) => { e.preventDefault(); const value = input; setInput(""); processText(value); };

  return <main className="app-shell">
    <section className="phone" aria-label="Loa phiên dịch Việt Nhật">
      <header>
        <button className="icon-button" aria-label="Mở menu"><Icon name="menu" /></button>
        <div className="brand"><strong>VI <span>↔</span> 日本語</strong><small className={listening ? "live" : ""}><b />{listening ? "Đang nghe liên tục…" : processing ? "Đang dịch…" : "Sẵn sàng"}</small></div>
        <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Cài đặt"><Icon name="settings" /></button>
      </header>

      <div className="conversation" aria-live="polite">
        <article className="speech-card vi-card">
          <div className="card-head"><span className="lang-pill vi">VI</span><span>Tiếng Việt</span></div>
          <p>{latest?.from === "vi" ? latest.source : latest?.translation}</p>
          <div className="audio-row"><Wave active={listening && !processing} /><button onClick={() => speak(latest?.from === "vi" ? latest.source : latest?.translation || "", "vi")} aria-label="Phát tiếng Việt"><Icon name="volume" /></button></div>
        </article>

        <button className={`main-mic ${listening ? "listening" : ""}`} onClick={listening ? stopListening : startListening} aria-label={listening ? "Dừng nghe" : "Bắt đầu nghe"}><Icon name={listening ? "stop" : "mic"} /></button>

        <article className="speech-card ja-card">
          <div className="card-head"><span className="lang-pill ja">JA</span><span>日本語</span></div>
          <p lang="ja">{latest?.from === "ja" ? latest.source : latest?.translation}</p>
          <div className="audio-row"><Wave active={processing} red /><button onClick={() => speak(latest?.from === "ja" ? latest.source : latest?.translation || "", "ja")} aria-label="Phát tiếng Nhật"><Icon name="volume" /></button></div>
        </article>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      <form onSubmit={submit} className="text-entry">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Nhập tiếng Việt hoặc tiếng Nhật…" aria-label="Văn bản cần dịch" />
        <button disabled={!input.trim() || processing} aria-label="Dịch văn bản"><Icon name="send" /></button>
      </form>

      <nav className="bottom-nav">
        <button onClick={() => document.querySelector(".history-panel")?.classList.toggle("open")}><Icon name="history"/><span>Lịch sử</span></button>
        <button className={listening ? "danger" : ""} onClick={listening ? stopListening : startListening}><Icon name={listening ? "stop" : "mic"}/><span>{listening ? "Dừng" : "Bắt đầu"}</span></button>
        <button onClick={() => setSettingsOpen(true)}><Icon name="settings"/><span>Cài đặt</span></button>
      </nav>

      <aside className="history-panel">
        <div><strong>Lịch sử gần đây</strong><button onClick={() => document.querySelector(".history-panel")?.classList.remove("open")}>Đóng</button></div>
        {turns.slice().reverse().map(t => <button className="history-item" key={t.id} onClick={() => speak(t.translation, t.from === "vi" ? "ja" : "vi")}><span>{t.source}</span><b>{t.translation}</b></button>)}
      </aside>

      <aside className={`settings-panel ${settingsOpen ? "open" : ""}`} aria-hidden={!settingsOpen}>
        <div className="panel-title"><div><small>TÀI KHOẢN</small><strong>Cài đặt</strong></div><button onClick={() => setSettingsOpen(false)} aria-label="Đóng cài đặt">Đóng</button></div>

        {!profile.signedIn ? <section className="login-card">
          <div className="login-mark">VI<span>↔</span>日</div>
          <h2>Chào mừng trở lại</h2>
          <p>Đăng nhập để lưu tùy chọn phiên dịch và cá nhân hóa trải nghiệm của bạn.</p>
          <form onSubmit={login}>
            <label>Họ và tên<input value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" required /></label>
            <label>Email<input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} type="email" placeholder="tenban@email.com" autoComplete="email" required /></label>
            <button className="primary-login" type="submit">Đăng nhập</button>
          </form>
          <div className="privacy-note"><b>✓</b><span>Thông tin chỉ được lưu trên thiết bị này.</span></div>
        </section> : <>
          <section className="profile-card">
            <div className="avatar">{profile.name.split(" ").filter(Boolean).slice(-2).map(x => x[0]).join("").toUpperCase() || "U"}<i /></div>
            <div className="profile-copy"><small>TÀI KHOẢN CÁ NHÂN</small><h2>{profile.name}</h2><p>{profile.email}</p></div>
          </section>

          <section className="settings-group">
            <h3>Thông tin người dùng</h3>
            <label className="setting-field"><span>Họ và tên</span><input value={profile.name} onChange={e => saveProfile({ ...profile, name: e.target.value })} /></label>
            <label className="setting-field"><span>Email</span><input value={profile.email} onChange={e => saveProfile({ ...profile, email: e.target.value })} type="email" /></label>
          </section>
        </>}

        <section className="settings-group preferences">
          <h3>Tùy chọn phiên dịch</h3>
          <div className="setting-row"><div><b>Tự động đọc bản dịch</b><span>Phát âm thanh sau mỗi câu</span></div><button className={`switch ${profile.autoSpeak ? "on" : ""}`} onClick={() => saveProfile({ ...profile, autoSpeak: !profile.autoSpeak })} aria-label="Tự động đọc bản dịch"><i /></button></div>
          <label className="rate-row"><div><b>Tốc độ giọng đọc</b><span>{profile.speechRate < .85 ? "Chậm" : profile.speechRate > 1.05 ? "Nhanh" : "Tự nhiên"}</span></div><input type="range" min="0.65" max="1.25" step="0.05" value={profile.speechRate} onChange={e => saveProfile({ ...profile, speechRate: Number(e.target.value) })} /></label>
          <div className="language-row"><div><b>Cặp ngôn ngữ</b><span>Tự động nhận diện đầu vào</span></div><strong><em>VI</em> ↔ <em>JA</em></strong></div>
        </section>

        {profile.signedIn && <button className="logout-button" onClick={logout}>Đăng xuất</button>}
        <p className="app-version">Loa phiên dịch Việt–Nhật · Phiên bản 1.1</p>
      </aside>
    </section>
  </main>;
}
