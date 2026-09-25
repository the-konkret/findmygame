import { useEffect, useState } from 'react';

/**
 * Phones: true while you're scrolling down the page (the top bar slides away to give the page more room),
 * false again as soon as you scroll back up, or when you're near the top. Always false on bigger screens.
 */
export function useHideOnScroll(resetKey: unknown): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false); // a new page starts with the bar showing
    const phone = window.matchMedia('(max-width: 600px)');
    let lastY = window.scrollY;
    let frame = 0;

    const check = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      if (!phone.matches || y < 80) setHidden(false); // near the top: always show
      else if (delta > 8) setHidden(true); // scrolling down
      else if (delta < -8) setHidden(false); // scrolling up
      else return; // tiny movements: keep the last position to compare against
      lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const onResize = () => !phone.matches && setHidden(false);

    window.addEventListener('scroll', onScroll, { passive: true });
    phone.addEventListener('change', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      phone.removeEventListener('change', onResize);
      cancelAnimationFrame(frame);
    };
  }, [resetKey]);

  return hidden;
}
