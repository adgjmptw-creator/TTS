const DICT = {
  ja: {
    "app.title": "ながら読み上げ",
    "header.uiLang": "UI 言語",
    "text.label": "読み上げたいテキスト",
    "text.placeholder": "ここに論文やレポートを貼り付けてください。",
    "text.chars": "文字",
    "text.clear": "クリア",
    "progress.sentences": "文",
    "ctrl.play": "再生",
    "ctrl.pause": "一時停止",
    "ctrl.stop": "停止",
    "settings.title": "設定",
    "settings.voice": "音声",
    "settings.voiceHint": "端末に保存されているオフライン音声のみ表示されます。",
    "settings.rate": "速度",
    "settings.pitch": "ピッチ",
    "settings.wakeLock": "再生中は画面をスリープさせない",
    "offline.note": "このアプリはオフラインでも動作します。初回アクセス時にキャッシュされ、電波圏外でも起動できます。",
    "footer.shortcut": "ショートカット:",
    "footer.playPause": "再生/一時停止",
    "footer.skip": "文スキップ",
    "status.ready": "準備完了",
    "status.loadingVoices": "音声を読み込み中…",
    "status.noVoices": "利用可能なオフライン音声が見つかりません。ブラウザの設定を確認してください。",
    "status.playing": "再生中",
    "status.paused": "一時停止中",
    "status.stopped": "停止しました",
    "status.finished": "読み上げ完了",
    "status.empty": "テキストを入力してください",
    "status.resumed": "前回の続きから再生します",
    "status.error": "エラーが発生しました。文をスキップして続行します。"
  },
  en: {
    "app.title": "Listen On-the-Go",
    "header.uiLang": "UI Language",
    "text.label": "Text to read",
    "text.placeholder": "Paste your paper or report here.",
    "text.chars": "chars",
    "text.clear": "Clear",
    "progress.sentences": "sentences",
    "ctrl.play": "Play",
    "ctrl.pause": "Pause",
    "ctrl.stop": "Stop",
    "settings.title": "Settings",
    "settings.voice": "Voice",
    "settings.voiceHint": "Only offline voices installed on your device are shown.",
    "settings.rate": "Rate",
    "settings.pitch": "Pitch",
    "settings.wakeLock": "Keep screen awake while playing",
    "offline.note": "This app works offline. It is cached on first visit so you can launch it without network.",
    "footer.shortcut": "Shortcuts:",
    "footer.playPause": "play/pause",
    "footer.skip": "skip sentence",
    "status.ready": "Ready",
    "status.loadingVoices": "Loading voices…",
    "status.noVoices": "No offline voices available. Please check your browser settings.",
    "status.playing": "Playing",
    "status.paused": "Paused",
    "status.stopped": "Stopped",
    "status.finished": "Finished",
    "status.empty": "Please enter some text",
    "status.resumed": "Resuming from last position",
    "status.error": "An error occurred. Skipping to next sentence."
  }
};

let currentLang = "ja";
const listeners = new Set();

export function t(key) {
  const d = DICT[currentLang] || DICT.ja;
  return d[key] ?? key;
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!DICT[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  applyTranslations(document);
  listeners.forEach((fn) => {
    try { fn(lang); } catch { /* ignore */ }
  });
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyTranslations(root) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
  });
}
