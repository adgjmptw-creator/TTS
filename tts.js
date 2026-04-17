// Text-to-speech engine wrapper.
// Splits text into sentences and speaks them one-by-one so that:
//   - Chrome's ~15s long-utterance cutoff is avoided
//   - Network loss during playback only affects at most one sentence
//   - Progress can be reported per-sentence and resumed after reload

const SENTENCE_TERMINATORS = /([。．！？!?\n]+|\.(?=\s|$))/g;
const MAX_SENTENCE_LEN = 180;

export function splitIntoSentences(text) {
  if (!text) return [];
  const normalized = text.replace(/\r\n?/g, "\n");
  const parts = [];
  let buf = "";
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    buf += ch;
    const isTerm =
      ch === "。" || ch === "．" || ch === "！" || ch === "？" ||
      ch === "!" || ch === "?" || ch === "\n" ||
      (ch === "." && (i + 1 >= normalized.length || /\s/.test(normalized[i + 1])));
    if (isTerm) {
      const trimmed = buf.trim();
      if (trimmed) parts.push(trimmed);
      buf = "";
    }
    i++;
  }
  if (buf.trim()) parts.push(buf.trim());
  // Guard against very long sentences (e.g. no punctuation) - chunk further.
  const final = [];
  for (const s of parts) {
    if (s.length <= MAX_SENTENCE_LEN) {
      final.push(s);
    } else {
      for (let k = 0; k < s.length; k += MAX_SENTENCE_LEN) {
        final.push(s.slice(k, k + MAX_SENTENCE_LEN));
      }
    }
  }
  return final;
}

export function detectLang(text) {
  // Rough heuristic: presence of CJK means ja, otherwise en-US.
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text) ? "ja-JP" : "en-US";
}

export async function getLocalVoices() {
  if (!("speechSynthesis" in window)) return [];
  let voices = speechSynthesis.getVoices();
  if (voices && voices.length) return voices.filter((v) => v.localService);
  // Wait for voiceschanged (Chrome loads them async).
  return new Promise((resolve) => {
    const done = () => {
      const list = speechSynthesis.getVoices().filter((v) => v.localService);
      speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(list);
    };
    speechSynthesis.addEventListener("voiceschanged", done);
    // Fallback timeout - some browsers never fire the event.
    setTimeout(() => {
      const list = speechSynthesis.getVoices().filter((v) => v.localService);
      resolve(list);
    }, 1500);
  });
}

export class Player {
  constructor() {
    this.sentences = [];
    this.index = 0;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.voice = null;
    this.state = "idle"; // idle | playing | paused | stopped | finished
    this.callbacks = {
      progress: null,   // (index, total, sentence) => void
      state: null,      // (state) => void
      error: null       // (err) => void
    };
    this._current = null; // current utterance, if any
    this._pendingStart = false;
  }

  on(event, fn) {
    this.callbacks[event] = fn;
    return this;
  }

  _emit(name, ...args) {
    const fn = this.callbacks[name];
    if (fn) { try { fn(...args); } catch { /* ignore */ } }
  }

  _setState(state) {
    if (this.state === state) return;
    this.state = state;
    this._emit("state", state);
  }

  setText(text) {
    this.stop();
    this.sentences = splitIntoSentences(text);
    this.index = 0;
  }

  setPosition(index) {
    const clamped = Math.max(0, Math.min(index | 0, Math.max(0, this.sentences.length - 1)));
    this.index = clamped;
    this._emit("progress", this.index, this.sentences.length, this.sentences[this.index] || "");
  }

  setVoice(v) { this.voice = v; }
  setRate(r) { this.rate = Number(r) || 1.0; }
  setPitch(p) { this.pitch = Number(p) || 1.0; }

  getTotal() { return this.sentences.length; }
  getIndex() { return this.index; }

  play() {
    if (!this.sentences.length) return;
    if (this.state === "paused") {
      // Rebuild from current sentence since resume() is unreliable cross-browser.
      this._setState("playing");
      this._speakCurrent();
      return;
    }
    if (this.state === "playing") return;
    if (this.index >= this.sentences.length) this.index = 0;
    this._setState("playing");
    this._speakCurrent();
  }

  pause() {
    if (this.state !== "playing") return;
    // Cancel current utterance but keep index; next play() will resume from here.
    this._cancel();
    this._setState("paused");
  }

  stop() {
    this._cancel();
    this.index = 0;
    this._setState("stopped");
  }

  next() {
    if (!this.sentences.length) return;
    const wasPlaying = this.state === "playing";
    this._cancel();
    this.index = Math.min(this.index + 1, this.sentences.length - 1);
    this._emit("progress", this.index, this.sentences.length, this.sentences[this.index]);
    if (wasPlaying) {
      this._setState("playing");
      this._speakCurrent();
    }
  }

  prev() {
    if (!this.sentences.length) return;
    const wasPlaying = this.state === "playing";
    this._cancel();
    this.index = Math.max(this.index - 1, 0);
    this._emit("progress", this.index, this.sentences.length, this.sentences[this.index]);
    if (wasPlaying) {
      this._setState("playing");
      this._speakCurrent();
    }
  }

  jumpTo(index) {
    const wasPlaying = this.state === "playing";
    this._cancel();
    this.index = Math.max(0, Math.min(index | 0, this.sentences.length - 1));
    this._emit("progress", this.index, this.sentences.length, this.sentences[this.index] || "");
    if (wasPlaying && this.sentences.length) {
      this._setState("playing");
      this._speakCurrent();
    }
  }

  _cancel() {
    this._current = null;
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
  }

  _speakCurrent() {
    if (this.state !== "playing") return;
    if (this.index >= this.sentences.length) {
      this._setState("finished");
      return;
    }
    const sentence = this.sentences[this.index];
    this._emit("progress", this.index, this.sentences.length, sentence);

    const utter = new SpeechSynthesisUtterance(sentence);
    if (this.voice) {
      utter.voice = this.voice;
      utter.lang = this.voice.lang;
    } else {
      utter.lang = detectLang(sentence);
    }
    utter.rate = this.rate;
    utter.pitch = this.pitch;

    utter.onend = () => {
      if (this._current !== utter) return; // cancelled / superseded
      this._current = null;
      if (this.state !== "playing") return;
      this.index += 1;
      if (this.index >= this.sentences.length) {
        this._setState("finished");
      } else {
        this._speakCurrent();
      }
    };

    utter.onerror = (e) => {
      if (this._current !== utter) return;
      this._current = null;
      // "canceled"/"interrupted" happen on stop/pause - those are expected.
      const kind = e && e.error;
      if (kind === "canceled" || kind === "interrupted") return;
      this._emit("error", e);
      if (this.state !== "playing") return;
      // Skip this sentence and continue so a single bad chunk doesn't halt playback.
      this.index += 1;
      if (this.index >= this.sentences.length) {
        this._setState("finished");
      } else {
        this._speakCurrent();
      }
    };

    this._current = utter;
    try {
      speechSynthesis.speak(utter);
    } catch (err) {
      this._emit("error", err);
    }
  }
}

// Chrome has a bug where synthesis stalls after ~15 seconds on some platforms.
// Calling pause/resume periodically keeps it alive for longer utterances.
// Since we already chunk by sentence this is usually fine, but start a safety
// heartbeat anyway when playing.
export function startHeartbeat() {
  if (!("speechSynthesis" in window)) return () => {};
  const id = setInterval(() => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      try { speechSynthesis.pause(); speechSynthesis.resume(); } catch { /* ignore */ }
    }
  }, 10000);
  return () => clearInterval(id);
}
