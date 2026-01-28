'use client';

import { useState, useEffect, useRef } from 'react';

interface YouTubeEmbedProps {
  videoId: string;
  className?: string;
  title?: string;
}

export default function YouTubeEmbed({ videoId, className = '', title = 'YouTube Video' }: YouTubeEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // YouTube embed URL with optimized parameters for inline playback
  const embedUrl = `https://www.youtube.com/embed/${videoId}?`;
  const embedParams = new URLSearchParams({
    autoplay: '0',
    controls: '1',
    rel: '0',
    modestbranding: '1',
    showinfo: '0',
    iv_load_policy: '3',
    fs: '1',
    cc_load_policy: '1',
    playsinline: '1', // Critical for mobile inline playback
    enablejsapi: '1', // Enable API for state tracking
    origin: typeof window !== 'undefined' ? window.location.origin : '',
  });

  return (
    <div className={`youtube-embed-container ${className}`}>
      {isLoading && (
        <div className="flex items-center justify-center bg-black rounded-lg" style={{ aspectRatio: '16 / 9' }}>
          <div className="text-white text-sm">Loading video...</div>
        </div>
      )}

      {hasError && (
        <div className="flex flex-col items-center justify-center bg-black rounded-lg p-4" style={{ aspectRatio: '16 / 9' }}>
          <div className="text-5xl mb-3">❌</div>
          <div className="text-white text-sm text-center">Failed to load video</div>
          <div className="text-white/70 text-xs mt-1 text-center">Video may be unavailable or restricted</div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={`${embedUrl}${embedParams.toString()}`}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={`w-full h-full rounded-lg ${isLoading || hasError ? 'hidden' : 'block'}`}
        style={{ aspectRatio: '16 / 9' }}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />


    </div>
  );
}