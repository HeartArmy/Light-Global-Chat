'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Message } from '@/types';

const EmojiPicker = dynamic(() => import('./EmojiPicker'), {
  loading: () => <div className="text-caption">Loading...</div>,
});

interface MessageActionsProps {
  message: Message;
  isOwn: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
}

const TEN_MINUTES = 10 * 60 * 1000;

export default function MessageActions({
  message,
  isOwn,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageActionsProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showExtendedPicker, setShowExtendedPicker] = useState(false);
  const [canEditDelete, setCanEditDelete] = useState(false);

  useEffect(() => {
    // Arham and Gemmie always have edit/delete permissions
    if (message.userName.toLowerCase() === 'arham' || message.userName.toLowerCase() === 'gemmie') {
      setCanEditDelete(true);
      return;
    }

    if (!isOwn) {
      setCanEditDelete(false);
      return;
    }

    const checkTime = () => {
      const messageAge = Date.now() - new Date(message.timestamp).getTime();
      setCanEditDelete(messageAge < TEN_MINUTES);
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);

    return () => clearInterval(interval);
  }, [message.timestamp, isOwn, message.userName]);

  const handleEmojiSelect = (emoji: string) => {
    onReact(emoji);
    setShowEmojiPicker(false);
    setShowExtendedPicker(false);
  };

  return (
    <div className="flex items-center gap-1 bg-opacity-90 backdrop-blur-sm rounded-full px-2 py-1 shadow-lg" style={{ background: 'var(--surface-elevated)' }}>
      {/* Reply Button */}
      <button
        onClick={onReply}
        className="p-1.5 rounded-full transition-all duration-fast text-caption hover:scale-110"
        style={{
          background: 'transparent',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        title="Reply"
      >
        ↩️
      </button>

      {/* React Button */}
      <div className="relative">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-1.5 rounded-full transition-all duration-fast text-caption hover:scale-110"
          style={{
            background: showEmojiPicker ? 'var(--surface)' : 'transparent',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            if (!showEmojiPicker) {
              e.currentTarget.style.background = 'var(--surface)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!showEmojiPicker) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
          title="React"
        >
          😊
        </button>

        {showEmojiPicker && (
          <div className={`absolute bottom-full mb-2 z-50 ${isOwn ? 'right-0' : 'left-0'}`}>
            <div className="flex flex-col gap-2 shadow-2xl">
              <EmojiPicker mode="quick" onSelect={handleEmojiSelect} />
              <button
                onClick={() => setShowExtendedPicker(!showExtendedPicker)}
                className="px-3 py-2 text-caption rounded-lg transition-all duration-fast"
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {showExtendedPicker ? '−' : '+'}
              </button>
              {showExtendedPicker && (
                <EmojiPicker mode="extended" onSelect={handleEmojiSelect} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Button (only for own messages within 10 minutes) */}
      {isOwn && canEditDelete && (
        <button
          onClick={onEdit}
          className="p-1.5 rounded-full transition-all duration-fast text-caption hover:scale-110"
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          title="Edit"
        >
          ✏️
        </button>
      )}

      {/* Delete Button (only for own messages within 10 minutes) */}
      {isOwn && canEditDelete && (
        <button
          onClick={onDelete}
          className="p-1.5 rounded-full transition-all duration-fast text-caption hover:scale-110"
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.color = 'var(--error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          title="Delete"
        >
          🗑️
        </button>
      )}

      {/* Click outside to close emoji picker */}
      {showEmojiPicker && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowEmojiPicker(false);
            setShowExtendedPicker(false);
          }}
        />
      )}
    </div>
  );
}
