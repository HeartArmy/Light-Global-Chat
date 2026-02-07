'use client';

import { useEffect, useState } from 'react';

interface MediaViewerProps {
  isOpen: boolean;
  mediaUrl: string;
  mediaName: string;
  mediaType: 'image' | 'video';
  onClose: () => void;
}

export default function MediaViewer({ isOpen, mediaUrl, mediaName, mediaType, onClose }: MediaViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [showPlayButton, setShowPlayButton] = useState(true);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoading(true);
      setHasError(false);
      
      // Reset video state when modal opens
      if (mediaType === 'video') {
        setVideoSrc(null);
        setShowPlayButton(true);
      }
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, mediaType]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleMediaLoad = () => {
    setIsLoading(false);
  };

  const handleMediaError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = mediaName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePlayClick = () => {
    // Only load the video when user clicks play
    setVideoSrc(mediaUrl);
    setShowPlayButton(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <button
        onClick={onClose}
        className="absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
        title="Close (Esc)"
      >
        ✕
      </button>

      <button
        onClick={handleDownload}
        className="absolute top-3.5 right-14 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
        title="Download media"
      >
        ⬇️
      </button>

      <div className="relative max-w-[81vw] max-h-[81vh] flex items-center justify-center">
        {isLoading && mediaType === 'image' && (
          <div className="flex items-center justify-center">
            <div className="text-base text-white">Loading...</div>
          </div>
        )}

        {hasError && (
          <div className="flex flex-col items-center justify-center text-white">
            <div className="text-5xl mb-3.5">❌</div>
            <div className="text-base mb-1.5">Failed to load {mediaType}</div>
            <div className="text-xs opacity-70">{mediaName}</div>
          </div>
        )}

        {mediaType === 'image' ? (
          <img
            src={mediaUrl}
            alt={mediaName}
            className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${isLoading || hasError ? 'hidden' : 'block'}`}
            onLoad={handleMediaLoad}
            onError={handleMediaError}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="relative max-w-full max-h-full">
            {showPlayButton && !videoSrc && (
              <div 
                className="flex items-center justify-center bg-gray-900 rounded-lg cursor-pointer min-w-[400px] min-h-[300px]"
                onClick={handlePlayClick}
              >
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all duration-200">
                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                  <div className="text-white text-sm">Click to load and play</div>
                </div>
              </div>
            )}
            
            {videoSrc && (
              <video
                src={videoSrc}
                controls
                autoPlay
                playsInline
                webkit-playsinline="true"
                preload="metadata"
                className={`max-w-full max-h-full rounded-lg shadow-2xl ${hasError ? 'hidden' : 'block'}`}
                onLoadedMetadata={handleMediaLoad}
                onError={handleMediaError}
                onClick={(e) => e.stopPropagation()}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        )}

        {!isLoading && !hasError && (mediaType === 'image' || videoSrc) && (
          <div className="absolute bottom-3.5 left-3.5 bg-black/50 text-white px-2.5 py-1.5 rounded-lg backdrop-blur-sm">
            <div className="text-xs font-medium">{mediaName}</div>
          </div>
        )}
      </div>

      <div className="absolute bottom-3.5 right-3.5 text-white/70 text-xs">
        Click outside or press Esc to close
      </div>
    </div>
  );
}