// Keep-alive: a silent looping <audio> element so mobile browsers (Android
// Chrome in particular) treat the page as actively playing media and don't
// suspend the tab when the user switches apps. This also lets us register
// MediaSession action handlers for lock-screen / notification controls.
//
// We synthesise a 1-second silent WAV at runtime as a Blob URL, so no extra
// asset needs to be shipped or cached.

let audio = null;

function buildSilentBlobUrl() {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);  // fmt chunk size
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, 1, true);   // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);   // block align
  view.setUint16(34, 16, true);  // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  // sample data is already zero-filled (silence)
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio(buildSilentBlobUrl());
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 1.0; // samples are 0 so output is silent regardless
  // Keep the source attached even after pauses.
  audio.addEventListener("ended", () => { /* loop=true handles this */ });
  return audio;
}

export const keepalive = {
  // Must be called from a user-gesture handler the first time, otherwise
  // mobile autoplay policies will reject play().
  async start() {
    const a = ensureAudio();
    if (!a.paused) return;
    try { await a.play(); } catch { /* gesture missing or denied - ignore */ }
  },
  stop() {
    if (audio && !audio.paused) audio.pause();
  },
  isRunning() {
    return !!audio && !audio.paused;
  }
};
