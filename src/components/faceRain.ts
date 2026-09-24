// Easter egg: tap the magnifying glass in a search box 5 times quickly and it rains faces.
// Press Escape (or reload the page) to stop it. Plain DOM, outside React, so it keeps going across pages.

const IMAGE = '/easter-egg.png';
let stopCurrent: (() => void) | null = null;

export function isFaceRainOn(): boolean {
  return stopCurrent !== null;
}

export function startFaceRain(): void {
  if (stopCurrent) return; // already raining

  const layer = document.createElement('div');
  layer.className = 'face-rain';
  layer.setAttribute('aria-hidden', 'true');
  layer.dataset.testid = 'face-rain';
  document.body.appendChild(layer);

  // Fewer drops on small screens.
  const every = window.innerWidth < 600 ? 220 : 110;

  function drop() {
    const img = document.createElement('img');
    img.src = IMAGE;
    img.alt = '';
    img.className = 'face-drop';
    img.dataset.testid = 'face-drop';
    const size = 36 + Math.random() * 54; // 36–90px wide
    img.style.width = `${size}px`;
    img.style.left = `${Math.random() * 100}%`;
    img.style.setProperty('--fall', `${2.2 + Math.random() * 2.8}s`); // bigger faces don't have to fall faster
    img.style.setProperty('--spin', `${Math.round(Math.random() * 720 - 360)}deg`);
    img.addEventListener('animationend', () => img.remove());
    layer.appendChild(img);
  }

  drop();
  const timer = window.setInterval(drop, every);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') stopFaceRain();
  };
  document.addEventListener('keydown', onKey);

  stopCurrent = () => {
    window.clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    layer.remove();
  };
}

export function stopFaceRain(): void {
  stopCurrent?.();
  stopCurrent = null;
}

// Counts quick taps; the 5th one in a row (each within 1.5 s of the last) starts the rain.
const TAPS_NEEDED = 5;
const MAX_GAP_MS = 1500;
let taps = 0;
let lastTap = 0;

export function countSecretTap(): void {
  const now = Date.now();
  taps = now - lastTap > MAX_GAP_MS ? 1 : taps + 1;
  lastTap = now;
  if (taps >= TAPS_NEEDED) {
    taps = 0;
    startFaceRain();
  }
}
