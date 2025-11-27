'use client';

import { useEffect, useState, useCallback } from 'react';
import Pusher from 'pusher-js';
import { Message, Attachment } from '@/types';
import { useTheme } from '@/components/ThemeProvider';
import NameModal from '@/components/NameModal';
import MessageList from '@/components/MessageList';
import MessageInput from '@/components/MessageInput';
import { setSelectedImageUrl } from '@/lib/gemmie-timer';

export default function ChatRoomClient() {
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string>('XX');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [gemmieEnabled, setGemmieEnabled] = useState(true);

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

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Track tab visibility for notifications
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTabVisible(false);
      } else {
        setIsTabVisible(true);
        setUnreadCount(0);
        document.title = 'Global Live Chat Room';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Handle arham leaving (tab close, navigation, etc.)
  // NOTE: removed automatic arham-disconnect calls on unload so Gemmie
  // preference persists across sessions. Leaving the page will no
  // longer force a re-enable.

  // Load initial messages and Gemmie status
  useEffect(() => {
    if (!userName) return;

    setIsLoading(true);
    Promise.all([
      fetch('/api/messages?limit=50').then(res => res.json()),
      fetch('/api/gemmie-status').then(res => res.json())
    ])
      .then(([messagesData, gemmieData]) => {
        setMessages(messagesData.messages.reverse());
        setHasMore(messagesData.hasMore);
        setGemmieEnabled(gemmieData.enabled);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setIsLoading(false);
      });
  }, [userName]);

  // Set up Pusher connection
  useEffect(() => {
    if (!userName) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
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

      // Increment unread count if tab is hidden
      if (document.hidden) {
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          document.title = `(${newCount}) Global Live Chat Room`;
          return newCount;
        });
      }
    });

    // Listen for message edits
    channel.bind('edit-message', (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, content: data.newContent, edited: true, editedAt: new Date() }
            : msg
        )
      );
    });

    // Listen for message deletions
    channel.bind('delete-message', (data: any) => {
      console.log('🗑️ Received delete-message event:', data);
      console.log('🗑️ Current messages count before delete:', messages.length);
      console.log('🗑️ Looking for message to delete:', data.messageId);
      
      // Check if the message actually exists in our current state
      const messageExists = messages.some((msg) => msg._id === data.messageId);
      console.log('🗑️ Message exists in current state:', messageExists);
      
      if (messageExists) {
        const filteredMessages = messages.filter((msg) => msg._id !== data.messageId);
        console.log('🗑️ Messages count after delete:', filteredMessages.length);
        console.log('🗑️ Message was found and removed:', filteredMessages.length < messages.length);
        setMessages(filteredMessages);
      } else {
        console.log('🗑️ Message not found in current state, possibly already deleted or not loaded yet');
        // Force a refresh of messages from the server
        fetchMessages();
      }
    });

    // Listen for reactions
    channel.bind('new-reaction', (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg
        )
      );
    });

    // Subscribe to presence channel for online count
    const presenceChannel = pusher.subscribe('presence-chat-room');

    presenceChannel.bind('pusher:subscription_succeeded', (members: any) => {
      console.log('Presence channel subscribed, member count:', members.count);
      setOnlineCount(members.count);
    });

    presenceChannel.bind('pusher:member_added', () => {
      setOnlineCount((prev) => {
        const newCount = prev + 1;
        console.log('Member added, new count:', newCount);
        return newCount;
      });
    });

    presenceChannel.bind('pusher:member_removed', () => {
      setOnlineCount((prev) => {
        const newCount = Math.max(0, prev - 1);
        console.log('Member removed, new count:', newCount);
        return newCount;
      });
    });

    presenceChannel.bind('pusher:subscription_error', (status: any) => {
      console.error('Presence channel subscription error:', status);
    });

    return () => {
      // Do not automatically change Gemmie state on disconnect; persist preference.
      channel.unbind_all();
      channel.unsubscribe();
      presenceChannel.unbind_all();
      presenceChannel.unsubscribe();
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
      console.log('Sending message:', { content, attachments, userName, replyTo });

      // Select the first image for AI processing if any
      const imageAttachment = attachments.find(att => att.type === 'image');
      if (imageAttachment) {
        await setSelectedImageUrl(imageAttachment.url);
        console.log('🖼️ Selected image for AI processing:', imageAttachment.url);
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          userName,
          attachments,
          replyTo,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Server error:', error);
        alert(`Failed to send message: ${error.error}`);
        return;
      }

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
      // First check if the message exists in current state
      const messageExists = messages.some((msg) => msg._id === messageId);
      console.log('🗑️ Manual delete - message exists in state:', messageExists);
      
      await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName }),
      });
      
      // Only update local state if message exists
      if (messageExists) {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      } else {
        // If message doesn't exist in state, refresh from server
        fetchMessages();
      }
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

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages?limit=50');
      const data = await res.json();
      setMessages(data.messages.reverse());
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to refresh messages:', error);
    }
  }, []);

  const handleToggleGemmie = async () => {
    if (userName !== 'arham') return;

    try {
      const response = await fetch('/api/gemmie-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName,
          enabled: !gemmieEnabled,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGemmieEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Failed to toggle Gemmie:', error);
    }
  };

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
        className="flex items-center justify-between px-2.5 py-1.5 border-b"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-heading" style={{ color: 'var(--text-primary)' }}>
            🌐 Global Live Chat Room
          </h1>
          <div className="flex items-center gap-1.5">
            <span
              className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1"
              style={{
                background: 'var(--surface-elevated)',
                color: 'var(--text-secondary)',
              }}
              title={isConnected ? 'Online' : 'Away'}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: isConnected ? 'var(--success)' : 'var(--error)',
                }}
              />
              {isConnected ? 'Online' : 'Away'}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: 'var(--surface-elevated)',
                color: 'var(--text-secondary)',
              }}
              title="Users online"
            >
              👥 {onlineCount ? onlineCount + 1 : 1}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-mono"
              style={{
                background: 'var(--surface-elevated)',
                color: 'var(--text-secondary)',
              }}
              title="Current UTC date and time"
            >
              📅 {currentTime.toUTCString().slice(0, 16)} • {currentTime.toUTCString().slice(17, 25)} UTC
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Social Links */}
          <div className="hidden md:flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
            <a
              href="https://arhamx.vercel.app?ref=chatapp"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-sm transition-all duration-fast hover:scale-110"
              style={{ color: 'var(--text-secondary)' }}
              title="Check out my other curiosities"
            >
              🌍
            </a>
            <a
              href="https://github.com/HeartArmy/Light-Global-Chat?ref=chatapp"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-sm transition-all duration-fast hover:scale-110"
              style={{ color: 'var(--text-secondary)' }}
              title="View source on GitHub"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
            <a
              href="mailto:arhampersonal@icloud.com"
              className="p-1 rounded-sm transition-all duration-fast hover:scale-110"
              style={{ color: 'var(--text-secondary)' }}
              title="Contact via email"
            >
              ✉️
            </a>
          </div>

          {/* Gemmie Toggle - Only for arham */}
          {userName === 'arham' && (
            <button
              onClick={handleToggleGemmie}
              className="px-2.5 py-1.5 text-xs rounded-sm transition-all duration-fast"
              style={{
                background: gemmieEnabled ? 'var(--success)' : 'var(--error)',
                border: '1px solid var(--border)',
                color: 'white',
              }}
              title={`Gemmie is ${gemmieEnabled ? 'enabled' : 'disabled'}. Preference persists across sessions.`}
            >
              🤖 {gemmieEnabled ? 'ON' : 'OFF'}
            </button>
          )}

          <button
            onClick={() => setShowNameModal(true)}
            className="px-2.5 py-1.5 text-xs rounded-sm transition-all duration-fast"
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
            className="px-2.5 py-1.5 rounded-sm transition-all duration-fast"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              height: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
