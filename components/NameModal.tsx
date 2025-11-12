'use client';

import { useState, useEffect } from 'react';

interface NameModalProps {
  isOpen: boolean;
  currentName?: string;
  onSubmit: (name: string) => void;
}

export default function NameModal({ isOpen, currentName, onSubmit }: NameModalProps) {
  const [name, setName] = useState(currentName || '');
  const [error, setError] = useState('');
  const [showKeywordPrompt, setShowKeywordPrompt] = useState(false);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (currentName) {
      setName(currentName);
    }
  }, [currentName]);

  const validateName = (value: string): boolean => {
    if (value.length < 1 || value.length > 30) {
      setError('Name must be between 1 and 30 characters');
      return false;
    }
    if (!/^[a-zA-Z0-9\s]+$/.test(value)) {
      setError('Name must contain only letters, numbers, and spaces');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    
    if (!validateName(trimmedName)) {
      return;
    }

    // Check if trying to use protected name "Arham"
    if (trimmedName.toLowerCase() === 'arham' || trimmedName.toLowerCase() === 'gemmie') {
      // Check if already verified
      const verified = localStorage.getItem('arham_verified');
      if (verified === 'true') {
        onSubmit(trimmedName);
        return;
      }
      
      // Show keyword prompt
      setShowKeywordPrompt(true);
      return;
    }

    onSubmit(trimmedName);
  };

  const handleKeywordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verify keyword
    if (keyword === process.env.NEXT_PUBLIC_ARHAM_KEYWORD) {
      localStorage.setItem('arham_verified', 'true');
      setShowKeywordPrompt(false);
      onSubmit(name.trim());
    } else {
      setError('Incorrect keyword. This name is protected.');
      setKeyword('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="w-full max-w-md p-8 rounded-lg shadow-2xl"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
        }}
      >
        {showKeywordPrompt ? (
          <>
            <h2 className="mb-2 text-display" style={{ color: 'var(--text-primary)' }}>
              🔒 Protected Name
            </h2>
            <p className="mb-6 text-body" style={{ color: 'var(--text-secondary)' }}>
              The name "Arham" is protected. Please enter the keyword to continue.
            </p>

            <form onSubmit={handleKeywordSubmit}>
              <input
                type="password"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setError('');
                }}
                placeholder="Enter keyword"
                autoFocus
                className="w-full px-4 py-3 mb-2 text-body rounded-sm transition-all duration-fast"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              
              {error && (
                <p className="mb-4 text-caption" style={{ color: 'var(--error)' }}>
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowKeywordPrompt(false);
                    setKeyword('');
                    setError('');
                    setName('');
                  }}
                  className="px-6 py-3 text-body rounded-sm transition-all duration-fast"
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!keyword.trim()}
                  className="px-6 py-3 text-body font-semibold rounded-sm transition-all duration-fast disabled:opacity-50"
                  style={{
                    background: 'var(--accent)',
                    color: '#ffffff',
                  }}
                >
                  Verify
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-display" style={{ color: 'var(--text-primary)' }}>
              {currentName ? 'Change Your Name' : 'Welcome to Global Live Chat Room'}
            </h2>
            <p className="mb-6 text-body" style={{ color: 'var(--text-secondary)' }}>
              {currentName ? 'Enter a new display name' : 'Choose a display name to get started'}
            </p>

            <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="Enter your name"
            maxLength={30}
            autoFocus
            className="w-full px-4 py-3 mb-2 text-body rounded-sm transition-all duration-fast"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border)';
            }}
          />
          
          {error && (
            <p className="mb-4 text-caption" style={{ color: 'var(--error)' }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-6">
            {currentName && (
              <button
                type="button"
                onClick={() => onSubmit(currentName)}
                className="px-6 py-3 text-body rounded-sm transition-all duration-fast"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--background)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)';
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-6 py-3 text-body font-semibold rounded-sm transition-all duration-fast disabled:opacity-50"
              style={{
                background: 'var(--accent)',
                color: '#ffffff',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent)';
              }}
            >
              {currentName ? 'Update' : 'Continue'}
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  );
}
