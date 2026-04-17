const PREFIX = "tts-reader:";

function safeGet(key) {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

function safeSet(key, value) {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* quota or disabled */ }
}

function safeRemove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

export const storage = {
  getText() {
    return safeGet("text") || "";
  },
  setText(text) {
    if (text && text.length > 0) safeSet("text", text);
    else safeRemove("text");
  },

  getPosition() {
    const raw = safeGet("position");
    const n = raw == null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  },
  setPosition(index) {
    safeSet("position", String(index | 0));
  },
  clearPosition() {
    safeRemove("position");
  },

  getSettings() {
    try {
      const raw = safeGet("settings");
      if (!raw) return {};
      return JSON.parse(raw);
    } catch { return {}; }
  },
  setSettings(obj) {
    try { safeSet("settings", JSON.stringify(obj)); } catch { /* ignore */ }
  },

  getLang() {
    return safeGet("lang") || "";
  },
  setLang(lang) {
    safeSet("lang", lang);
  }
};
