import { t, setLang, getLang, applyTranslations, onLangChange } from "./i18n.js";
import { storage } from "./storage.js";
import { Player, getLocalVoices, detectLang } from "./tts.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  uiLang: $("#ui-lang"),
  textInput: $("#text-input"),
  charCount: $("#char-count"),
  clearBtn: $("#clear-btn"),
  sentencePreview: $("#sentence-preview"),
  progressFill: $("#progress-fill"),
  progressBar: document.querySelector(".progress-bar"),
  progressCurrent: $("#progress-current"),
  progressTotal: $("#progress-total"),
  playBtn: $("#play-btn"),
  stopBtn: $("#stop-btn"),
  prevBtn: $("#prev-btn"),
  nextBtn: $("#next-btn"),
  playIcon: document.querySelector("#play-btn .icon-play"),
  pauseIcon: document.querySelector("#play-btn .icon-pause"),
  playLabel: document.querySelector("#play-btn .btn-label"),
  status: $("#status"),
  voiceSelect: $("#voice-select"),
  rate: $("#rate"),
  rateValue: $("#rate-value"),
  pitch: $("#pitch"),
  pitchValue: $("#pitch-value"),
  wakeLock: $("#wake-lock"),
};

const player = new Player();
let voices = [];
let wakeLock = null;
let savePositionTimer = 0;

function setStatus(text, isError = false) {
  els.status.textContent = text || "";
  els.status.classList.toggle("error", Boolean(isError));
}

function bootLang() {
  const saved = storage.getLang();
  const browser = (navigator.language || "ja").toLowerCase().startsWith("en") ? "en" : "ja";
  const lang = saved || browser;
  els.uiLang.value = lang;
  setLang(lang);
}

function renderPreview() {
  const preview = els.sentencePreview;
  if (!player.sentences.length) {
    preview.hidden = true;
    preview.textContent = "";
    return;
  }
  preview.hidden = false;
  preview.innerHTML = "";
  player.sentences.forEach((s, i) => {
    const span = document.createElement("span");
    span.className = "sentence" + (i === player.getIndex() ? " active" : "");
    span.dataset.index = String(i);
    span.textContent = s + " ";
    span.addEventListener("click", () => player.jumpTo(i));
    preview.appendChild(span);
  });
  scrollActiveIntoView();
}

function updateActiveSentence(index) {
  const nodes = els.sentencePreview.querySelectorAll(".sentence");
  nodes.forEach((n) => n.classList.toggle("active", Number(n.dataset.index) === index));
  scrollActiveIntoView();
}

function scrollActiveIntoView() {
  const active = els.sentencePreview.querySelector(".sentence.active");
  if (active) {
    active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function updateProgress(index, total) {
  els.progressCurrent.textContent = String(Math.min(index + (total ? 1 : 0), total));
  els.progressTotal.textContent = String(total);
  const pct = total ? ((index) / total) * 100 : 0;
  els.progressFill.style.width = pct + "%";
  els.progressBar.setAttribute("aria-valuenow", String(Math.round(pct)));
}

function updatePlayButton(state) {
  const playing = state === "playing";
  els.playIcon.hidden = playing;
  els.pauseIcon.hidden = !playing;
  els.playLabel.textContent = playing ? t("ctrl.pause") : t("ctrl.play");
  els.playBtn.setAttribute("aria-label", playing ? t("ctrl.pause") : t("ctrl.play"));
}

async function loadVoices() {
  setStatus(t("status.loadingVoices"));
  voices = await getLocalVoices();
  renderVoiceOptions();
  if (!voices.length) {
    setStatus(t("status.noVoices"), true);
  } else {
    setStatus(t("status.ready"));
  }
}

function renderVoiceOptions() {
  const settings = storage.getSettings();
  const currentText = els.textInput.value;
  const preferredLang = detectLang(currentText).slice(0, 2);

  els.voiceSelect.innerHTML = "";

  // Group by language, and sort so that the preferred language comes first.
  const sorted = [...voices].sort((a, b) => {
    const aMatch = a.lang.toLowerCase().startsWith(preferredLang) ? 0 : 1;
    const bMatch = b.lang.toLowerCase().startsWith(preferredLang) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
    return a.name.localeCompare(b.name);
  });

  for (const v of sorted) {
    const opt = document.createElement("option");
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    els.voiceSelect.appendChild(opt);
  }

  const savedURI = settings.voiceURI;
  const chosen = (savedURI && voices.find((v) => v.voiceURI === savedURI)) ||
                 sorted[0];
  if (chosen) {
    els.voiceSelect.value = chosen.voiceURI;
    player.setVoice(chosen);
  }
}

function persistSettings() {
  storage.setSettings({
    voiceURI: els.voiceSelect.value,
    rate: Number(els.rate.value),
    pitch: Number(els.pitch.value),
    wakeLock: els.wakeLock.checked
  });
}

function loadSettings() {
  const s = storage.getSettings();
  if (typeof s.rate === "number") els.rate.value = String(s.rate);
  if (typeof s.pitch === "number") els.pitch.value = String(s.pitch);
  if (typeof s.wakeLock === "boolean") els.wakeLock.checked = s.wakeLock;
  els.rateValue.textContent = Number(els.rate.value).toFixed(2);
  els.pitchValue.textContent = Number(els.pitch.value).toFixed(2);
  player.setRate(Number(els.rate.value));
  player.setPitch(Number(els.pitch.value));
}

function schedulePositionSave() {
  clearTimeout(savePositionTimer);
  savePositionTimer = setTimeout(() => {
    storage.setPosition(player.getIndex());
  }, 250);
}

async function requestWakeLock() {
  if (!els.wakeLock.checked) return;
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch { /* user likely denied, ignore */ }
}

async function releaseWakeLock() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch { /* ignore */ }
    wakeLock = null;
  }
}

function wireEvents() {
  // UI language
  els.uiLang.addEventListener("change", () => {
    const lang = els.uiLang.value;
    setLang(lang);
    storage.setLang(lang);
  });
  onLangChange(() => {
    // Re-render dynamic strings.
    updatePlayButton(player.state);
    if (player.state === "idle") setStatus(t("status.ready"));
  });

  // Text input
  els.textInput.addEventListener("input", () => {
    const text = els.textInput.value;
    els.charCount.textContent = String(text.length);
    storage.setText(text);
    storage.clearPosition();
    player.setText(text);
    renderPreview();
    updateProgress(player.getIndex(), player.getTotal());
    // Reorder voices if language changed.
    renderVoiceOptions();
  });

  els.clearBtn.addEventListener("click", () => {
    els.textInput.value = "";
    els.charCount.textContent = "0";
    storage.setText("");
    storage.clearPosition();
    player.setText("");
    renderPreview();
    updateProgress(0, 0);
    setStatus(t("status.ready"));
  });

  // Controls
  els.playBtn.addEventListener("click", () => {
    if (!els.textInput.value.trim()) {
      setStatus(t("status.empty"), true);
      return;
    }
    if (!voices.length) {
      setStatus(t("status.noVoices"), true);
      return;
    }
    if (player.state === "playing") {
      player.pause();
    } else {
      if (!player.sentences.length) player.setText(els.textInput.value);
      player.play();
      requestWakeLock();
    }
  });

  els.stopBtn.addEventListener("click", () => {
    player.stop();
    releaseWakeLock();
  });

  els.prevBtn.addEventListener("click", () => player.prev());
  els.nextBtn.addEventListener("click", () => player.next());

  // Settings
  els.voiceSelect.addEventListener("change", () => {
    const v = voices.find((x) => x.voiceURI === els.voiceSelect.value);
    if (v) player.setVoice(v);
    persistSettings();
  });

  els.rate.addEventListener("input", () => {
    els.rateValue.textContent = Number(els.rate.value).toFixed(2);
    player.setRate(Number(els.rate.value));
    persistSettings();
  });

  els.pitch.addEventListener("input", () => {
    els.pitchValue.textContent = Number(els.pitch.value).toFixed(2);
    player.setPitch(Number(els.pitch.value));
    persistSettings();
  });

  els.wakeLock.addEventListener("change", () => {
    persistSettings();
    if (!els.wakeLock.checked) releaseWakeLock();
    else if (player.state === "playing") requestWakeLock();
  });

  // Player callbacks
  player.on("progress", (index, total) => {
    updateProgress(index, total);
    updateActiveSentence(index);
    schedulePositionSave();
  });
  player.on("state", (state) => {
    updatePlayButton(state);
    if (state === "playing") setStatus(t("status.playing"));
    else if (state === "paused") setStatus(t("status.paused"));
    else if (state === "stopped") setStatus(t("status.stopped"));
    else if (state === "finished") {
      setStatus(t("status.finished"));
      storage.clearPosition();
      releaseWakeLock();
    }
  });
  player.on("error", () => setStatus(t("status.error"), true));

  // Keyboard shortcuts (skip when focus is inside text input or settings)
  document.addEventListener("keydown", (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    const isEditing = tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT";
    if (isEditing) return;
    if (e.code === "Space") {
      e.preventDefault();
      els.playBtn.click();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      player.prev();
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      player.next();
    }
  });

  // Re-acquire wake lock on visibility restore.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" &&
        player.state === "playing" && els.wakeLock.checked && !wakeLock) {
      requestWakeLock();
    }
  });

  // Safety: cancel any in-flight speech on unload.
  window.addEventListener("beforeunload", () => {
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
  });
}

async function init() {
  if (!("speechSynthesis" in window)) {
    setStatus("SpeechSynthesis is not supported in this browser.", true);
    els.playBtn.disabled = true;
    return;
  }

  bootLang();
  loadSettings();

  // Restore text and position.
  const savedText = storage.getText();
  if (savedText) {
    els.textInput.value = savedText;
    els.charCount.textContent = String(savedText.length);
    player.setText(savedText);
    const pos = storage.getPosition();
    if (pos > 0 && pos < player.getTotal()) {
      player.setPosition(pos);
      setStatus(t("status.resumed"));
    }
    renderPreview();
    updateProgress(player.getIndex(), player.getTotal());
  }

  wireEvents();
  await loadVoices();
  updatePlayButton(player.state);

  // Register service worker (PWA).
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // SW registration is best-effort; still works without it.
      });
    });
  }
}

init();
