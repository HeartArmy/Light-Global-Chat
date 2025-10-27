'use client';

import { useEffect, useRef, useState } from 'react';
import { Message } from '@/types';
import MessageItem from './MessageItem';

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
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const prevMessagesLengthRef = useRef(messages.length);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (shouldAutoScroll && listRef.current) {
      const isNewMessage = messages.length > prevMessagesLengthRef.current;
      if (isNewMessage) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, shouldAutoScroll]);

  // Check if user is near bottom to enable auto-scroll
  const handleScroll = () => {
    if (!listRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isNearBottom);

    // Load more messages when scrolling near top
    const isNearTop = scrollTop < 100;
    if (isNearTop && hasMore && !isLoading) {
      onLoadMore();
    }
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

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
      style={{
        background: 'var(--background)',
      }}
    >
      {/* Loading indicator for pagination */}
      {isLoading && hasMore && (
        <div className="flex justify-center py-4">
          <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
            Loading more messages...
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <p className="text-heading mb-2" style={{ color: 'var(--text-primary)' }}>
              No messages yet
            </p>
            <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
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
                onReact={(emoji) => onReact(message._id, emoji)}
                onEdit={(newContent) => onEdit(message._id, newContent)}
                onDelete={() => onDelete(message._id)}
                onScrollToParent={
                  replyToId ? () => scrollToMessage(replyToId) : undefined
                }
              />
            </div>
          );
        })
      )}
    </div>
  );
}
