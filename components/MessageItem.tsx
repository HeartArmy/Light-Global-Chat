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
      className="group px-4 py-2 transition-all duration-fast"
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
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-start gap-2`}>
        {/* Actions on left for own messages */}
        {showActions && !isEditing && isOwn && (
          <MessageActions
            message={message}
            isOwn={isOwn}
            onReply={onReply}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReact={onReact}
          />
        )}

        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%]`}>
          {/* User Info */}
          <div className="flex items-center gap-2 mb-1 px-2">
            <span className="text-caption font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {getCountryFlag(message.userCountry)} {message.userName}
            </span>
            <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
              {formatTimestamp(message.timestamp)}
            </span>
            {message.edited && (
              <span className="text-small italic" style={{ color: 'var(--text-secondary)' }}>
                (edited)
              </span>
            )}
          </div>

          {/* Reply Context */}
          {replyToMessage && (
            <div
              className="mb-1 px-3 py-2 rounded-lg cursor-pointer max-w-full"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                opacity: 0.8,
              }}
              onClick={onScrollToParent}
            >
              <p className="text-caption truncate" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent)' }}>↩️ {replyToMessage.userName}</span>
                {': '}
                {replyToMessage.content.substring(0, 50)}
                {replyToMessage.content.length > 50 && '...'}
              </p>
            </div>
          )}

          {/* Message Bubble */}
          <div className="relative">
            <div
              className="rounded-2xl px-4 py-2 shadow-sm"
              style={{
                background: isOwn ? 'var(--accent)' : 'var(--surface)',
                color: isOwn ? '#ffffff' : 'var(--text-primary)',
              }}
            >

              {/* Message Content */}
              {isEditing ? (
                <div className="w-full">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg resize-none"
                    style={{
                      background: 'var(--background)',
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
                      className="px-4 py-2 text-caption rounded-lg transition-all duration-fast"
                      style={{
                        background: 'var(--accent)',
                        color: '#ffffff',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-caption rounded-lg transition-all duration-fast"
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
                    className="text-body break-words whitespace-pre-wrap"
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
                              className="rounded-lg max-w-full"
                              style={{ maxHeight: '300px', objectFit: 'cover' }}
                            />
                          ) : (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-fast"
                              style={{
                                background: isOwn ? 'rgba(255,255,255,0.2)' : 'var(--background)',
                                border: `1px solid ${isOwn ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`,
                                color: isOwn ? '#ffffff' : 'var(--accent)',
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
                </>
              )}
            </div>

          </div>

          {/* Reactions */}
          {Object.keys(groupedReactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 px-2">
              {Object.entries(groupedReactions).map(([emoji, users]) => {
                const hasReacted = users.includes(currentUserName);
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className="px-2 py-1 rounded-full text-caption transition-all duration-fast hover:scale-110"
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
        </div>

        {/* Actions on right for other users' messages */}
        {showActions && !isEditing && !isOwn && (
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
