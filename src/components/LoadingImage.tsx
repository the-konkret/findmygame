import { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  alt: string;
  className?: string;
  /** 'lazy' (default) waits until the picture is near the screen; 'eager' starts at once. */
  loading?: 'lazy' | 'eager';
  /** Called when the picture can't be loaded (e.g. to try another address). */
  onError?: () => void;
  /** Text shown if the picture fails for good. */
  fallback?: string;
}

/**
 * A picture with a skeleton: a softly shimmering placeholder fills its spot while it downloads,
 * then the picture fades in. The parent element needs `position: relative` (the placeholder covers it).
 */
export default function LoadingImage({ src, alt, className = '', loading = 'lazy', onError, fallback = 'No image' }: Props) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const imgRef = useRef<HTMLImageElement>(null);

  // A new picture address starts again from the skeleton. Pictures already in the browser's
  // memory are complete straight away, so they skip the skeleton entirely.
  useEffect(() => {
    const img = imgRef.current;
    setState(img?.complete && img.naturalWidth > 0 ? 'loaded' : 'loading');
  }, [src]);

  return (
    <>
      {state !== 'loaded' && (
        <span className={`img-skeleton ${state === 'loading' ? 'skeleton' : 'img-failed'}`} aria-hidden data-testid="image-skeleton">
          {state === 'error' && fallback}
        </span>
      )}
      {state !== 'error' && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={loading}
          className={`${className} fade-in ${state === 'loaded' ? 'loaded' : ''}`}
          onLoad={() => setState('loaded')}
          onError={() => {
            if (onError) onError();
            else setState('error');
          }}
        />
      )}
    </>
  );
}
