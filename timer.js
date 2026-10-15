'use strict';
const $ = selector => document.querySelector(selector);
const panel = $('.game-panel');
const timer = $('#timer');
const toggle = $('#toggle');
const reset = $('#reset');
const progress = $('#progress');
const result = $('#result');
const detail = $('#detail');
const settingsToggle = $('#settings-toggle');
const settings = $('#settings');
let duration = 90;
try {
  const saved = Number(localStorage.getItem('midnight-puzzle-duration'));
  if (Number.isInteger(saved) && saved >= 1 && saved <= 5999) duration = saved;
} catch { /* Timer also works when storage is unavailable. */ }
let remaining = duration * 1000;
let deadline = 0;
let frame = 0;
let running = false;
let wakeLock = null;
function formatTime(milliseconds) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function render() {
  timer.textContent = formatTime(remaining);
  progress.style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, remaining / (duration * 1000))));
}
async function keepAwake() {
  if (!('wakeLock' in navigator) || document.hidden || !running) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!running) { await lock.release(); return; }
    wakeLock = lock;
  } catch { /* Screen wake lock is optional. */ }
}
function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
function closeSettings() {
  settings.hidden = true;
  settingsToggle.setAttribute('aria-expanded', 'false');
}
function finish() {
  running = false;
  remaining = 0;
  cancelAnimationFrame(frame);
  panel.dataset.state = 'expired';
  result.textContent = 'TIMES UP';
  detail.textContent = 'Time to put the pieces down.';
  $('#clock-label').textContent = 'CHALLENGE COMPLETE';
  toggle.textContent = 'Start again';
  reset.disabled = false;
  settingsToggle.disabled = false;
  render();
  releaseWakeLock();
}
function tick() {
  if (!running) return;
  remaining = Math.max(0, deadline - performance.now());
  if (remaining <= 0) { finish(); return; }
  render();
  frame = requestAnimationFrame(tick);
}
function resetTimer() {
  running = false;
  cancelAnimationFrame(frame);
  remaining = duration * 1000;
  panel.dataset.state = 'ready';
  result.textContent = 'Ready when you are.';
  detail.textContent = `${duration} ${duration === 1 ? 'second' : 'seconds'}. Make them count.`;
  $('#clock-label').textContent = 'TIME REMAINING';
  toggle.textContent = 'Start';
  reset.disabled = true;
  settingsToggle.disabled = false;
  render();
  releaseWakeLock();
}
function syncDuration() {
  $('#minutes').value = Math.floor(duration / 60);
  $('#seconds').value = duration % 60;
  $('#duration-label').textContent = formatTime(duration * 1000).replace(/^0/, '');
  document.querySelectorAll('[data-seconds]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.seconds) === duration)));
}
function setDuration(seconds) {
  duration = seconds;
  try { localStorage.setItem('midnight-puzzle-duration', String(duration)); } catch { /* Optional persistence. */ }
  syncDuration();
  resetTimer();
  $('#settings-note').textContent = 'Time updated. Ready for the next player.';
}
toggle.addEventListener('click', () => {
  if (running) {
    remaining = Math.max(0, deadline - performance.now());
    if (remaining <= 0) { finish(); return; }
    running = false;
    cancelAnimationFrame(frame);
    panel.dataset.state = 'stopped';
    result.textContent = 'Clock stopped.';
    detail.textContent = `${((duration * 1000 - remaining) / 1000).toFixed(1)} seconds used. Nice work.`;
    $('#clock-label').textContent = 'TIME REMAINING';
    toggle.textContent = 'Resume';
    reset.disabled = false;
    settingsToggle.disabled = false;
    render();
    releaseWakeLock();
    return;
  }
  if (remaining <= 0) resetTimer();
  running = true;
  deadline = performance.now() + remaining;
  panel.dataset.state = 'running';
  result.textContent = 'Piece it together.';
  detail.textContent = 'Stop the clock when your puzzle is complete.';
  toggle.textContent = 'Stop';
  reset.disabled = true;
  settingsToggle.disabled = true;
  closeSettings();
  tick();
  keepAwake();
});
reset.addEventListener('click', resetTimer);
settingsToggle.addEventListener('click', () => {
  settings.hidden = !settings.hidden;
  settingsToggle.setAttribute('aria-expanded', String(!settings.hidden));
});
document.querySelectorAll('[data-seconds]').forEach(button => button.addEventListener('click', () => setDuration(Number(button.dataset.seconds))));
settings.addEventListener('submit', event => {
  event.preventDefault();
  const minutes = Number($('#minutes').value);
  const seconds = Number($('#seconds').value);
  const total = minutes * 60 + seconds;
  if (!settings.reportValidity()) return;
  if (!Number.isInteger(total) || total < 1 || total > 5999) {
    $('#settings-note').textContent = 'Choose at least 1 second.';
    return;
  }
  setDuration(total);
  closeSettings();
  settingsToggle.focus();
});
document.addEventListener('visibilitychange', () => {
  if (!running) return;
  if (document.hidden) releaseWakeLock();
  else { cancelAnimationFrame(frame); tick(); if (running) keepAwake(); }
});
syncDuration();
resetTimer();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
