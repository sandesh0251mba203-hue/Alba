import { useState } from 'react';
import { Compass } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className = '', fallbackTitle }: SafeImageProps) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={`bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 flex flex-col items-center justify-center text-white/80 p-4 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Compass className="w-8 h-8 text-blue-400 mb-2" />
        <span className="text-xs font-medium text-center text-slate-200 line-clamp-2">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
