'use client';

import { useState } from 'react';
import { Message, Reaction } from '@/types';
import MessageActions from './MessageActions';
import { formatTimestamp, linkifyText, formatFileSize, getCountryFlag } from '@/lib/utils';
import { useSwipe } from '@/lib/gestures';

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  currentUserName: string;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: (newContent: string) => void;
  onDelete: () => void;
  onScrollToParent?: () => void;
}

export default function MessageItem({
  message,
  isOwn,
  currentUserName,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onScrollToParent,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  const handleReactionClick = (emoji: string) => {
    onReact(emoji);
  };

  // Group reactions by emoji
  const groupedReactions = message.reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction.userName);
    return acc;
  }, {} as Record<string, string[]>);

  const replyToMessage = typeof message.replyTo === 'object' ? message.replyTo : null;

  // Swipe gesture for reply
  const swipeHandlers = useSwipe(() => {
    onReply();
  });

  // Long press for actions on mobile
  let longPressTimer: NodeJS.Timeout | null = null;
  const handleTouchStart = () => {
    longPressTimer = setTimeout(() => {
      setShowActions(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
  };

  return (
    <div
      className="group px-4 py-3 hover:bg-opacity-50 transition-all duration-fast"
      style={{
        background: showActions ? 'var(--surface)' : 'transparent',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={(e) => {
        handleTouchStart();
        swipeHandlers.onTouchStart(e);
      }}
      onTouchEnd={(e) => {
        handleTouchEnd();
        swipeHandlers.onTouchEnd(e);
      }}
    >
      {/* Reply Context */}
      {replyToMessage && (
        <div
          className="mb-2 ml-8 pl-3 py-1 border-l-2 cursor-pointer"
          style={{
            borderColor: 'var(--accent)',
            opacity: 0.7,
          }}
          onClick={onScrollToParent}
        >
          <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent)' }}>↩️ Replying to {replyToMessage.userName}</span>
            {': '}
            {replyToMessage.content.substring(0, 100)}
            {replyToMessage.content.length > 100 && '...'}
          </p>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>
              {getCountryFlag(message.userCountry)} {message.userName}
            </span>
            <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>
              {formatTimestamp(message.timestamp)}
            </span>
            {message.edited && (
              <span className="text-caption italic" style={{ color: 'var(--text-secondary)' }}>
                (edited)
              </span>
            )}
          </div>

          {/* Message Content */}
          {isEditing ? (
            <div className="mt-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 rounded-sm resize-none"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                rows={3}
                maxLength={5000}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 text-caption rounded-sm transition-all duration-fast"
                  style={{
                    background: 'var(--accent)',
                    color: '#ffffff',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-caption rounded-sm transition-all duration-fast"
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="text-body break-words"
                style={{ color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: linkifyText(message.content) }}
              />

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment, index) => (
                    <div key={index}>
                      {attachment.type === 'image' ? (
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="max-w-md rounded-md"
                          style={{ maxHeight: '400px', objectFit: 'contain' }}
                        />
                      ) : (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-sm transition-all duration-fast"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--accent)',
                          }}
                        >
                          <span>📄</span>
                          <span className="text-caption">
                            {attachment.name} ({formatFileSize(attachment.size)})
                          </span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reactions */}
              {Object.keys(groupedReactions).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(groupedReactions).map(([emoji, users]) => {
                    const hasReacted = users.includes(currentUserName);
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReactionClick(emoji)}
                        className="px-2 py-1 rounded-sm text-caption transition-all duration-fast"
                        style={{
                          background: hasReacted ? 'var(--accent)' : 'var(--surface)',
                          border: `1px solid ${hasReacted ? 'var(--accent)' : 'var(--border)'}`,
                          color: hasReacted ? '#ffffff' : 'var(--text-primary)',
                        }}
                        title={users.join(', ')}
                      >
                        {emoji} {users.length}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {showActions && !isEditing && (
          <MessageActions
            message={message}
            isOwn={isOwn}
            onReply={onReply}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReact={onReact}
          />
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="p-6 rounded-md max-w-sm"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 className="text-heading mb-3" style={{ color: 'var(--text-primary)' }}>
              Delete Message?
            </h3>
            <p className="text-body mb-6" style={{ color: 'var(--text-secondary)' }}>
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-sm transition-all duration-fast"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-sm transition-all duration-fast"
                style={{
                  background: 'var(--error)',
                  color: '#ffffff',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
