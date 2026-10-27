import { useEffect, useState } from 'react';

const QUERY = '(max-width: 600px)';

/** True on phone-sized screens (the same width the styles switch to the phone layout). */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => setPhone(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return phone;
}
