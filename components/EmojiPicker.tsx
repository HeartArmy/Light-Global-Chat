'use client';

import { useState } from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  mode: 'quick' | 'extended';
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '👋', '😢'];

const EXTENDED_EMOJIS = {
  smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘'],
  gestures: ['👋', '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '👈', '👉'],
  objects: ['💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '👁️', '🗨️', '🗯️', '💭', '🔥', '⭐', '✨', '💖'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'],
};

export default function EmojiPicker({ onSelect, mode }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof EXTENDED_EMOJIS>('smileys');

  if (mode === 'quick') {
    return (
      <div
        className="flex gap-0.5 p-1.5 rounded-lg shadow-2xl border border-solid"
        style={{
          background: 'var(--surface-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-7 h-7 flex items-center justify-center text-base rounded-md transition-all duration-fast hover:scale-125 active:scale-95 select-none"
            style={{
              background: 'var(--surface)',
              minWidth: '1.75rem',
              minHeight: '1.75rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--background)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className="w-[min(76.5vw,288px)] max-w-[288px] min-w-[200px] rounded-lg overflow-hidden shadow-2xl border border-solid"
      style={{
        background: 'var(--surface-elevated)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Category Tabs */}
      <div
        className="flex border-b border-solid"
        style={{ borderColor: 'var(--border)' }}
      >
        {Object.keys(EXTENDED_EMOJIS).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category as keyof typeof EXTENDED_EMOJIS)}
            className="flex-1 py-1.5 text-xs capitalize transition-all duration-fast select-none"
            style={{
              background: activeCategory === category ? 'var(--surface)' : 'transparent',
              color: activeCategory === category ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeCategory === category ? '2px solid var(--accent)' : 'none',
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="p-1.5 grid grid-cols-6 gap-0.5 max-h-44 overflow-y-auto">
        {EXTENDED_EMOJIS[activeCategory].map((emoji, index) => (
          <button
            key={index}
            onClick={() => onSelect(emoji)}
            className="w-7 h-7 flex items-center justify-center text-sm rounded-md transition-all duration-fast hover:scale-125 active:scale-95 select-none"
            style={{
              background: 'var(--surface)',
              minWidth: '1.75rem',
              minHeight: '1.75rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--background)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
