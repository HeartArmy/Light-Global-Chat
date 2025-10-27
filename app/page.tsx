'use client';

import { useEffect, useState, useCallback } from 'react';
import Pusher from 'pusher-js';
import { Message, Attachment } from '@/types';
import { useTheme } from '@/components/ThemeProvider';
import NameModal from '@/components/NameModal';
import MessageList from '@/components/MessageList';
import MessageInput from '@/components/MessageInput';

export default function ChatRoom() {
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string>('XX');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Initialize user session
  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setUserName(storedName);
    } else {
      setShowNameModal(true);
    }

    // Get user country
    fetch('/api/country')
      .then((res) => res.json())
      .then((data) => {
        setUserCountry(data.countryCode);
      })
      .catch((err) => console.error('Failed to get country:', err));
  }, []);

  // Load initial messages
  useEffect(() => {
    if (!userName) return;

    setIsLoading(true);
    fetch('/api/messages?limit=50')
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages.reverse());
        setHasMore(data.hasMore);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load messages:', err);
        setIsLoading(false);
      });
  }, [userName]);

  // Set up Pusher connection
  useEffect(() => {
    if (!userName) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe('chat-room');

    // Connection status
    pusher.connection.bind('connected', () => {
      setIsConnected(true);
    });

    pusher.connection.bind('disconnected', () => {
      setIsConnected(false);
    });

    pusher.connection.bind('error', (err: any) => {
      console.error('Pusher error:', err);
      setIsConnected(false);
    });

    // Listen for new messages
    channel.bind('new-message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Listen for message updates
    channel.bind('update-message', (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, content: data.content, edited: data.edited, editedAt: data.editedAt }
            : msg
        )
      );
    });

    // Listen for message deletions
    channel.bind('delete-message', (data: any) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== data.messageId));
    });

    // Listen for reactions
    channel.bind('new-reaction', (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg
        )
      );
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [userName]);

  const handleNameSubmit = (name: string) => {
    setUserName(name);
    localStorage.setItem('userName', name);
    setShowNameModal(false);
  };

  const handleSendMessage = async (content: string, attachments: Attachment[], replyTo?: string) => {
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          userName,
          attachments,
          replyTo,
        }),
      });
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newContent,
          userName,
        }),
      });
    } catch (error) {
      console.error('Failed to edit message:', error);
      alert('Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName }),
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message');
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      // Check if user already reacted with this emoji
      const message = messages.find((m) => m._id === messageId);
      const hasReacted = message?.reactions.some(
        (r) => r.emoji === emoji && r.userName === userName
      );

      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          emoji,
          userName,
          action: hasReacted ? 'remove' : 'add',
        }),
      });
    } catch (error) {
      console.error('Failed to react:', error);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;

    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/messages?limit=50&before=${new Date(oldestMessage.timestamp).toISOString()}`
      );
      const data = await res.json();
      setMessages((prev) => [...data.messages.reverse(), ...prev]);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, hasMore, isLoading]);

  if (!userName) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <NameModal isOpen={showNameModal} onSubmit={handleNameSubmit} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-heading" style={{ color: 'var(--text-primary)' }}>
            🌐 Global Live Room
          </h1>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isConnected ? 'var(--success)' : 'var(--error)',
            }}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNameModal(true)}
            className="px-3 py-2 text-caption rounded-sm transition-all duration-fast"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            {userName}
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-sm transition-all duration-fast"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
            }}
            title="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Messages */}
      <MessageList
        messages={messages}
        currentUser={userName}
        isLoading={isLoading}
        hasMore={hasMore}
        onReply={setReplyingTo}
        onReact={handleReaction}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onLoadMore={handleLoadMore}
      />

      {/* Input */}
      <MessageInput
        onSend={handleSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Name Modal */}
      <NameModal
        isOpen={showNameModal}
        currentName={userName}
        onSubmit={handleNameSubmit}
      />
    </div>
  );
}
