'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Message, Reaction } from '@/types';
import MessageActions from './MessageActions';
import MediaViewer from './ImageViewer'; // Renamed from ImageViewer
import { formatTimestamp, formatFileSize, getCountryFlag, renderMessageContent } from '@/lib/utils';
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
  onActionToggle?: (messageId: string) => void;
  isActive?: boolean;
}

// Custom comparison function for React.memo to prevent unnecessary re-renders
const arePropsEqual = (prevProps: MessageItemProps, nextProps: MessageItemProps) => {
  // Only re-render if message content, reactions, or active state changed
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.message._id !== nextProps.message._id) return false;
  if (prevProps.message.content !== nextProps.message.content) return false;
  if (prevProps.message.edited !== nextProps.message.edited) return false;
  if (prevProps.message.reactions?.length !== nextProps.message.reactions?.length) return false;
  if (JSON.stringify(prevProps.message.reactions) !== JSON.stringify(nextProps.message.reactions)) return false;
  if (prevProps.message.attachments?.length !== nextProps.message.attachments?.length) return false;
  if (prevProps.currentUserName !== nextProps.currentUserName) return false;
  if (prevProps.isOwn !== nextProps.isOwn) return false;
  
  return true;
};

function MessageItem({
  message,
  isOwn,
  currentUserName,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onScrollToParent,
  onActionToggle,
  isActive,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageViewer, setImageViewer] = useState<{ url: string; name: string; type: 'image' | 'video' } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss actions after timeout (like Telegram/WhatsApp)
  let actionsTimeout: NodeJS.Timeout | null = null;
  
  // Use isActive prop for singleton behavior
  const showActionsWithTimeout = () => {
    if (onActionToggle) {
      onActionToggle(message._id);
    }
    // Auto-hide after 3 seconds on mobile, similar to Telegram
    // REMOVED: Actions on mobile will never auto-disappear except on background click
    // if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    //   actionsTimeout = setTimeout(() => {
    //     if (onActionToggle) onActionToggle('');
    //   }, 3000);
    // }
  };

  const hideActions = () => {
    if (actionsTimeout) {
      clearTimeout(actionsTimeout);
      actionsTimeout = null;
    }
    if (onActionToggle) {
      onActionToggle('');
    }
  };

  // Handle click outside to close actions on mobile
  const handleBackgroundClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      hideActions();
    }
  };

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

  const handleMediaClick = (url: string, name: string, type: 'image' | 'video') => {
    setImageViewer({ url, name, type });
  };

  const closeImageViewer = () => {
    setImageViewer(null);
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
  const handleTouchStart = (e: React.TouchEvent) => {
    // Check if the touch target is an interactive element (link, button, etc.)
    const target = e.target as HTMLElement;
    const isInteractiveElement =
      target.tagName === 'A' ||
      target.tagName === 'BUTTON' ||
      target.closest('a') ||
      target.closest('button') ||
      target.closest('[role="button"]');
    
    // Only start long press timer for non-interactive elements
    if (!isInteractiveElement) {
      longPressTimer = setTimeout(() => {
        showActionsWithTimeout();
      }, 500);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
  };

  return (
    <div
      className="group px-2 py-0.5 transition-all duration-fast"
      onMouseEnter={showActionsWithTimeout}
      onMouseLeave={hideActions}
      onTouchStart={(e) => {
        handleTouchStart(e);
        swipeHandlers.onTouchStart(e);
      }}
      onTouchEnd={(e) => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
        }
        // Don't auto-hide on mobile - only hide on timeout or background click
        if (typeof window !== 'undefined' && window.innerWidth > 768) {
          hideActions();
        }
        swipeHandlers.onTouchEnd(e);
      }}
    >
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-start gap-1.5`}>
        {/* Actions on left for own messages - DESKTOP ONLY */}
        {isActive && !isEditing && isOwn && (
          <div className="hidden md:block">
            <MessageActions
              message={message}
              isOwn={isOwn}
              currentUserName={currentUserName}
              onReply={onReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReact={onReact}
            />
          </div>
        )}

        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-full md:max-w-[63%]`}>
          {/* User Info */}
          <div className="flex items-center gap-1.5 mb-1 px-0.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {getCountryFlag(message.userCountry, message.userName)} {message.userName}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatTimestamp(message.timestamp)}
            </span>
            {message.edited && (
              <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                (edited)
              </span>
            )}
          </div>

          {/* Reply Context */}
          {replyToMessage && (
            <div
              className="mb-1 px-2.5 py-1.5 rounded-md cursor-pointer max-w-full"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                opacity: 0.8,
              }}
              onClick={onScrollToParent}
            >
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent)' }}>↩️ {replyToMessage.userName}</span>
                {': '}
                {replyToMessage.content.substring(0, 50)}
                {replyToMessage.content.length > 50 && '...'}
              </p>
            </div>
          )}

          {/* Message Bubble */}
          <div className="relative message-bubble">
            <div
              className="rounded-2xl px-2.5 py-1 shadow-sm"
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
                    className="w-full px-2.5 py-1.5 rounded-md resize-none"
                    style={{
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    rows={3}
                    maxLength={5000}
                    autoFocus
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      onClick={handleSaveEdit}
                      className="px-3.5 py-1.5 text-xs rounded-md transition-all duration-fast"
                      style={{
                        background: 'var(--accent)',
                        color: '#ffffff',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3.5 py-1.5 text-xs rounded-md transition-all duration-fast"
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
                  {message.content && (
                    <div
                      ref={contentRef}
                      className="text-sm break-words whitespace-pre-wrap text-left"
                      style={{
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        textAlign: 'left',
                      }}
                      dangerouslySetInnerHTML={{ __html: renderMessageContent(message.content, isOwn) }}
                    />
                  )}

                  {/* Attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className={message.content ? "mt-1.5 space-y-1.5" : "space-y-1.5"}>
                      {message.attachments.map((attachment, index) => (
                        <div key={index}>
                          {attachment.type === 'image' ? (
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="rounded-md max-w-full cursor-pointer hover:opacity-90 transition-opacity duration-200"
                              style={{ maxHeight: '198px', objectFit: 'cover' }}
                              onClick={() => handleMediaClick(attachment.url, attachment.name, 'image')}
                              title="Click to view full size"
                            />
                          ) : attachment.type === 'video' ? (
                            <video
                              src={attachment.url}
                              controls
                              className="rounded-md max-w-full bg-black"
                              style={{ maxHeight: '198px' }}
                              title={attachment.name}
                            >
                              Your browser does not support the video tag.
                            </video>
                          ) : (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-fast"
                              style={{
                                background: isOwn ? 'rgba(255,255,255,0.2)' : 'var(--background)',
                                border: `1px solid ${isOwn ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`,
                                color: isOwn ? '#ffffff' : 'var(--accent)',
                              }}
                            >
                              <span>📄</span>
                              <span className="text-xs">
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

          {/* Actions below bubble - MOBILE ONLY */}
          {isActive && !isEditing && (
            <div className="md:hidden mt-0.5">
              <MessageActions
                message={message}
                isOwn={isOwn}
                currentUserName={currentUserName}
                onReply={onReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReact={onReact}
              />
            </div>
          )}

          {/* Reactions */}
          {Object.keys(groupedReactions).length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5 px-0.5">
              {Object.entries(groupedReactions).map(([emoji, users]) => {
                const hasReacted = users.includes(currentUserName);
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className="px-1.5 py-0.5 rounded-full text-xs transition-all duration-fast hover:scale-110"
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

        {/* Actions on right for other users' messages - DESKTOP ONLY */}
        {isActive && !isEditing && !isOwn && (
          <div className="hidden md:block">
            <MessageActions
              message={message}
              isOwn={isOwn}
              currentUserName={currentUserName}
              onReply={onReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReact={onReact}
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation - Rendered via Portal to avoid scroll issues */}
      {showDeleteConfirm &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/50 backdrop-blur-sm">
            <div
              className="p-5 rounded-md max-w-xs w-full"
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                maxHeight: '80vh',
                overflowY: 'auto',
              }}
            >
              <h3 className="text-xl mb-2.5" style={{ color: 'var(--text-primary)' }}>
                Delete Message?
              </h3>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                This action cannot be undone.
              </p>
              <div className="flex gap-2.5 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3.5 py-1.5 rounded-sm transition-all duration-fast"
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
                  className="px-3.5 py-1.5 rounded-sm transition-all duration-fast"
                  style={{
                    background: 'var(--error)',
                    color: '#ffffff',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.getElementById('modal-root')!
        )}

      {/* Media Viewer Modal - Rendered via Portal to ensure proper z-index */}
      {imageViewer &&
        createPortal(
          <MediaViewer
            isOpen={true}
            mediaUrl={imageViewer.url}
            mediaName={imageViewer.name}
            mediaType={imageViewer.type}
            onClose={closeImageViewer}
          />,
          document.getElementById('modal-root')!
        )}
    </div>
  );
}

export default memo(MessageItem, arePropsEqual);
