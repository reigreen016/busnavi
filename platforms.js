// Keep every upcoming platform in one visible row, reducing digits only as needed.
export function fitPlatformStrips(root = document) {
 for (const strip of root.querySelectorAll('.platform-strip')) {
  const count = strip.querySelectorAll('.overview-number').length;
  if (!count) continue;
  const gap = count >= 7 ? 4 : 8;
  strip.style.setProperty('--platform-count', count);
  strip.style.setProperty('--platform-gap', `${gap}px`);
  strip.style.setProperty('--platform-max-width', `${count * 64 + (count - 1) * gap}px`);
  const cell = Math.max(0, (strip.clientWidth - (count - 1) * gap) / count);
  strip.style.setProperty('--number-size', `${Math.min(56, cell * .88)}px`);
 }
}
