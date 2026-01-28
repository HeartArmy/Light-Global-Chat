'use client';

import { useState, useEffect, useRef } from 'react';

interface YouTubeEmbedProps {
  videoId: string;
  className?: string;
  title?: string;
}

export default function YouTubeEmbed({ videoId, className = '', title = 'YouTube Video' }: YouTubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
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

  // Handle play state changes from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from YouTube iframe
      if (event.origin !== 'https://www.youtube.com') return;
      
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.event === 'infoDelivery' && data.info) {
          setIsPlaying(data.info.playerState === 1); // 1 = playing
        }
      } catch (error) {
        // Ignore parsing errors
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

      {/* Play button overlay for better UX */}
      {!isPlaying && !isLoading && !hasError && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20 rounded-lg transition-opacity hover:bg-black/30"
          style={{ aspectRatio: '16 / 9' }}
          onClick={() => {
            if (iframeRef.current) {
              // Try to play via API first
              try {
                iframeRef.current.contentWindow?.postMessage(
                  JSON.stringify({ event: 'command', func: 'playVideo' }),
                  '*'
                );
              } catch (error) {
                // Fallback: just focus the iframe which might trigger autoplay
                iframeRef.current.focus();
              }
            }
          }}
        >
          <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg transform transition-transform hover:scale-110">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}