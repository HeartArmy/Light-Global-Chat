'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Message } from '@/types';
import { default as MessageItem } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  currentUser: string;
  isLoading: boolean;
  hasMore: boolean;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string) => void;
  onLoadMore: () => void;
}

export default function MessageList({
  messages,
  currentUser,
  isLoading,
  hasMore,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onLoadMore,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const prevMessagesLengthRef = useRef(messages.length);
  const lastMessageIdRef = useRef<string | null>(messages[messages.length - 1]?._id || null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollYRef = useRef(0);
  const isScrollingRef = useRef(false);

  // Track if user is viewing old messages (not at bottom)
  const isViewingOldMessagesRef = useRef(false);

  // Auto-scroll to bottom on new messages only if user is near bottom
  useEffect(() => {
    if (!listRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isViewingOldMessagesRef.current = distanceFromBottom > 300; // 300px threshold

    const currentLastMessageId = messages[messages.length - 1]?._id || null;
    const isNewMessage = currentLastMessageId && currentLastMessageId !== lastMessageIdRef.current;
    const addedMessages = messages.length - prevMessagesLengthRef.current;

    if (isNewMessage) {
      if (shouldAutoScroll && !isViewingOldMessagesRef.current) {
        listRef.current.scrollTop = scrollHeight;
      } else if (isViewingOldMessagesRef.current) {
        setNewMessageCount((count) => count + Math.max(addedMessages, 1));
      }
    }

    prevMessagesLengthRef.current = messages.length;
    lastMessageIdRef.current = currentLastMessageId;
  }, [messages, shouldAutoScroll]);

  // Throttled scroll handler for better mobile performance
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    
    // Throttle scroll events to reduce CPU usage on mobile
    const now = Date.now();
    if (scrollTimeoutRef.current && now - lastScrollYRef.current < 16) { // ~60fps
      return;
    }
    
    lastScrollYRef.current = now;
    
    // Use requestAnimationFrame for smoother performance
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      const { scrollTop, scrollHeight, clientHeight } = listRef.current!;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
      if (isNearBottom) {
        setNewMessageCount(0);
      }

      // Load more messages when scrolling near top
      const isNearTop = scrollTop < 100;
      if (isNearTop && hasMore && !isLoading) {
        onLoadMore();
      }
      
      scrollTimeoutRef.current = null;
    }, 16); // ~60fps
  }, [hasMore, isLoading, onLoadMore]);

  // Handle action toggle for singleton behavior
  const handleActionToggle = (messageId: string) => {
    setActiveMessageId(prevId => prevId === messageId ? null : messageId);
  };

  // Scroll to specific message
  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  const jumpToLatest = () => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    setShouldAutoScroll(true);
    setNewMessageCount(0);
  };

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="relative flex-1 overflow-y-auto"
      style={{
        background: 'var(--background)',
        // Enable GPU acceleration for smoother scrolling on mobile
        willChange: 'transform',
        WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
      }}
    >
      {newMessageCount > 0 && (
        <div
          className="pointer-events-none absolute right-3 bottom-3 z-10 flex justify-end"
          style={{ width: '100%' }}
        >
          <button
            onClick={jumpToLatest}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.96)',
              color: 'var(--text-primary)',
              borderColor: 'rgba(16,24,40,0.08)',
              boxShadow: '0 18px 50px rgba(15,23,42,0.08)',
              backdropFilter: 'blur(10px)',
            }}
            aria-label="Jump to latest messages"
          >
            <span>{newMessageCount === 1 ? 'jump to latest' : `jump to latest (${newMessageCount})`}</span>
            <span style={{ opacity: 0.72, fontSize: '0.75rem' }}>new</span>
          </button>
        </div>
      )}
      {/* Loading indicator for pagination */}
      {isLoading && hasMore && (
        <div className="flex justify-center py-3.5">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Loading more messages...
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-7">
            <p className="text-xl mb-1.5" style={{ color: 'var(--text-primary)' }}>
              No messages yet
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Be the first to say hello! 👋
            </p>
          </div>
        </div>
      ) : (
        messages.map((message) => {
          const replyToId = typeof message.replyTo === 'object' && message.replyTo?._id 
            ? message.replyTo._id 
            : typeof message.replyTo === 'string' 
            ? message.replyTo 
            : null;

          return (
            <div
              key={message._id}
              id={`message-${message._id}`}
              className="transition-all duration-normal"
              style={{
                background: highlightedMessageId === message._id ? 'var(--accent)' : 'transparent',
                opacity: highlightedMessageId === message._id ? 0.3 : 1,
              }}
            >
              <MessageItem
                message={message}
                isOwn={message.userName === currentUser}
                currentUserName={currentUser}
                onReply={() => onReply(message)}
                onReact={(emoji: string) => onReact(message._id, emoji)}
                onEdit={(newContent: string) => onEdit(message._id, newContent)}
                onDelete={() => onDelete(message._id)}
                onScrollToParent={
                  replyToId ? () => scrollToMessage(replyToId) : undefined
                }
                onActionToggle={handleActionToggle}
                isActive={activeMessageId === message._id}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
