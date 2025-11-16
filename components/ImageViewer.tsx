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

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      // Reset states when opening
      setIsLoading(true);
      setHasError(false);
    } else {
      // Restore body scroll when modal is closed
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
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

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
        title="Close (Esc)"
      >
        ✕
      </button>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="absolute top-4 right-16 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
        title="Download media"
      >
        ⬇️
      </button>

      {/* Media container */}
      <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {isLoading && (
          <div className="flex items-center justify-center">
            <div className="text-white text-lg">Loading...</div>
          </div>
        )}

        {hasError && (
          <div className="flex flex-col items-center justify-center text-white">
            <div className="text-6xl mb-4">❌</div>
            <div className="text-lg mb-2">Failed to load {mediaType}</div>
            <div className="text-sm opacity-70">{mediaName}</div>
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
          <video
            src={mediaUrl}
            controls
            className={`max-w-full max-h-full rounded-lg shadow-2xl ${isLoading || hasError ? 'hidden' : 'block'}`}
            onLoad={handleMediaLoad}
            onError={handleMediaError}
            onClick={(e) => e.stopPropagation()}
          >
            Your browser does not support the video tag.
          </video>
        )}

        {/* Media info */}
        {!isLoading && !hasError && (
          <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-2 rounded-lg backdrop-blur-sm">
            <div className="text-sm font-medium">{mediaName}</div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 text-white/70 text-sm">
        Click outside or press Esc to close
      </div>
    </div>
  );
}
