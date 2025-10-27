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
        className="flex gap-2 p-3 rounded-xl shadow-2xl"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
        }}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-12 h-12 flex items-center justify-center text-2xl rounded-lg transition-all duration-fast hover:scale-125 active:scale-95"
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
      className="w-[90vw] max-w-sm rounded-xl overflow-hidden shadow-2xl"
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
            className="flex-1 py-3 text-caption capitalize transition-all duration-fast"
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
      <div className="p-4 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-64 overflow-y-auto">
        {EXTENDED_EMOJIS[activeCategory].map((emoji, index) => (
          <button
            key={index}
            onClick={() => onSelect(emoji)}
            className="w-10 h-10 flex items-center justify-center text-xl rounded-lg transition-all duration-fast hover:scale-125 active:scale-95"
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
