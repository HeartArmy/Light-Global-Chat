'use client';

import { useState } from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  mode: 'quick' | 'extended';
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

const EXTENDED_EMOJIS = {
  smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘'],
  gestures: ['👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '👈', '👉', '👆'],
  objects: ['💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '👁️', '🗨️', '🗯️', '💭', '🔥', '⭐', '✨', '💖'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'],
};

export default function EmojiPicker({ onSelect, mode }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof EXTENDED_EMOJIS>('smileys');

  if (mode === 'quick') {
    return (
      <div 
        className="flex gap-0.5 p-1.5 rounded-lg shadow-2xl"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
        }}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-7 h-7 flex items-center justify-center text-base rounded-md transition-all duration-fast hover:scale-125 active:scale-95"
            style={{
              background: 'var(--surface)',
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
      className="w-[70vw] max-w-[240px] rounded-lg overflow-hidden shadow-2xl"
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Category Tabs */}
      <div 
        className="flex border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {Object.keys(EXTENDED_EMOJIS).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category as keyof typeof EXTENDED_EMOJIS)}
            className="flex-1 py-1.5 text-small capitalize transition-all duration-fast"
            style={{
              background: activeCategory === category ? 'var(--surface)' : 'transparent',
              color: activeCategory === category ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeCategory === category ? '2px solid var(--accent)' : 'none',
            }}
          >
            {category.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="p-1.5 grid grid-cols-6 gap-0.5 max-h-40 overflow-y-auto">
        {EXTENDED_EMOJIS[activeCategory].map((emoji, index) => (
          <button
            key={index}
            onClick={() => onSelect(emoji)}
            className="w-7 h-7 flex items-center justify-center text-sm rounded-md transition-all duration-fast hover:scale-125 active:scale-95"
            style={{
              background: 'var(--surface)',
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
