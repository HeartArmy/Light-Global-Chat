'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Pusher from 'pusher-js';
import { Message, Attachment, QueuedMessage } from '@/types';
import { useTheme } from '@/components/ThemeProvider';
import NameModal from '@/components/NameModal';
import MessageList from '@/components/MessageList';
import MessageInput from '@/components/MessageInput';

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
  
  // Optimistic UI states
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_DELAY = 8000; // 8 seconds

  // Constants for localStorage
  const STORAGE_KEY = "gemmie_pending_messages";

  const saveToLocalStorage = (message: QueuedMessage) => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    // Convert QueuedMessage to a storable format (remove actualFiles if needed, or use a reviver)
    const storableMessage = { ...message, actualFiles: undefined }; 
    stored.push(storableMessage);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  };

  const loadPendingMessages = (): QueuedMessage[] => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    // Convert stored messages back to QueuedMessage format
    // This is a simplified conversion; you might need a more robust one
    return stored.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
      actualFiles: [] // Placeholder, actual files are not stored
    }));
  };

  const clearFromLocalStorage = (messageIds: string[]) => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const filtered = stored.filter((m: any) => !messageIds.includes(m.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    inactivityTimerRef.current = setTimeout(() => {
      processMessageQueue();
    }, INACTIVITY_DELAY);
  };

  const processMessageQueue = async () => {
    if (messageQueue.length === 0) return;

    const messagesToSend = [...messageQueue];
    setMessageQueue([]); // Clear queue immediately

    try {
      // Simulate sending - replace with actual API call
      const response = await fetch('/api/messages/batch', { // Assuming a new batch endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesToSend.map(m => ({
            content: m.content,
            attachments: m.attachments, // These should be pre-uploaded URLs
            userName: m.sender,
            timestamp: m.timestamp,
            replyTo: m.replyTo // if applicable
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send batched messages');
      }

      // If successful, remove from localStorage
      clearFromLocalStorage(messagesToSend.map(m => m.id));
      console.log('Batched messages sent successfully.');

    } catch (error) {
      console.error('Failed to process message queue:', error);
      // Optionally, re-add failed messages to the queue or handle error
      setMessageQueue(prev => [...prev, ...messagesToSend]);
      // You might want to implement retry logic or notify the user
    }
  };


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

  // Load pending messages from localStorage on mount
  useEffect(() => {
    if (!userName) return;

    const pending = loadPendingMessages();
    if (pending.length > 0) {
      // Add to UI (optimistic)
      setMessages(prev => [...prev, ...pending.map(qm => ({
        _id: qm.id,
        content: qm.content,
        userName: qm.sender,
        userCountry: userCountry, // or try to get stored country if available
        timestamp: qm.timestamp,
        attachments: qm.attachments,
        replyTo: qm.replyTo,
        reactions: [],
        edited: false,
        editedAt: undefined
      }))]);
      setMessageQueue(pending);
      resetInactivityTimer();
    }
  }, [userName, userCountry]);


  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (messageQueue.length > 0) {
        processMessageQueue();
      }
    };
  
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [messageQueue]);


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

    // Listen for new messages (from other clients or server)
    channel.bind('new-message', (message: Message) => {
      // Avoid re-adding messages that were sent from this client's queue
      const isFromThisQueue = messageQueue.some(qm => qm.id === message._id);
      if (!isFromThisQueue) {
        setMessages((prev) => [...prev, message]);
      }

      // Increment unread count if tab is hidden
      if (document.hidden) {
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          document.title = `(${newCount}) Global Live Chat Room`;
          return newCount;
        });
      }
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
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [userName, messageQueue]);


  const handleNameSubmit = (name: string) => {
    setUserName(name);
    localStorage.setItem('userName', name);
    setShowNameModal(false);
  };

  const handleSendMessage = async (content: string, attachments: Attachment[], replyTo?: string) => {
    const tempMessage: QueuedMessage = {
      id: `temp-${Date.now()}`,
      content,
      attachments: attachments.map(att => ({...att})), // Create a copy
      timestamp: new Date(),
      sender: userName || 'unknown', // Ensure sender is defined
      replyTo // if applicable
    };

    // Optimistically add to UI
    const optimisticMessage: Message = {
        _id: tempMessage.id,
        content: tempMessage.content,
        userName: tempMessage.sender,
        userCountry: userCountry,
        timestamp: tempMessage.timestamp,
        attachments: tempMessage.attachments,
        replyTo: tempMessage.replyTo, // Ensure this matches Message type
        reactions: [],
        edited: false,
        editedAt: undefined
    };
    setMessages(prev => [...prev, optimisticMessage]);

    // Add to queue
    setMessageQueue(prev => [...prev, tempMessage]);
    saveToLocalStorage(tempMessage);
    resetInactivityTimer();
    
    setReplyingTo(null); // Clear reply state
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      // This might need adjustment if messageId is from the queue
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
      // This might need adjustment if messageId is from the queue
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
        className="flex items-center justify-between px-3.5 py-2.5 border-b"
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
              title={isConnected ? 'Connected' : 'Disconnected'}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: isConnected ? 'var(--success)' : 'var(--error)',
                }}
              />
              {isConnected ? 'Connected' : 'Disconnected'}
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
            className="p-1.5 rounded-sm transition-all duration-fast"
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
