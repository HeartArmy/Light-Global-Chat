'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, Attachment } from '@/types';
import { useUploadThing } from '@/lib/uploadthing';

interface MessageInputProps {
  onSend: (content: string, attachments: Attachment[], replyTo?: string) => void;
  replyingTo: Message | null;
  onCancelReply: () => void;
}

export default function MessageInput({ onSend, replyingTo, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload: startImageUpload } = useUploadThing('imageUploader');
  const { startUpload: startFileUpload } = useUploadThing('fileUploader');

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && attachments.length === 0) return;

    onSend(trimmedContent, attachments, replyingTo?._id);
    setContent('');
    setAttachments([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);

    try {
      const isImage = file.type.startsWith('image/');
      const uploadFn = isImage ? startImageUpload : startFileUpload;
      
      const result = await uploadFn([file]);
      
      if (result && result[0]) {
        const attachment: Attachment = {
          type: isImage ? 'image' : 'file',
          url: result[0].url,
          name: file.name,
          size: file.size,
        };
        setAttachments([...attachments, attachment]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const charCount = content.length;
  const isOverLimit = charCount > 5000;

  return (
    <div 
      className="border-t p-4"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Reply Context */}
      {replyingTo && (
        <div 
          className="mb-3 p-3 rounded-sm flex items-start justify-between"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-caption font-semibold mb-1" style={{ color: 'var(--accent)' }}>
              Replying to {replyingTo.userName}
            </p>
            <p className="text-caption truncate" style={{ color: 'var(--text-secondary)' }}>
              {replyingTo.content}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-3 text-caption hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="relative p-2 rounded-sm flex items-center gap-2"
              style={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
              }}
            >
              {attachment.type === 'image' ? (
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="w-16 h-16 object-cover rounded"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-caption" style={{ color: 'var(--text-primary)' }}>
                    📄 {attachment.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(index)}
                className="text-caption hover:opacity-70"
                style={{ color: 'var(--error)' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt"
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-3 rounded-sm transition-all duration-fast disabled:opacity-50"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => {
            if (!isUploading) {
              e.currentTarget.style.background = 'var(--surface-elevated)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--background)';
          }}
          title="Attach file"
        >
          {isUploading ? '⏳' : '📎'}
        </button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            maxLength={5000}
            className="w-full px-4 py-3 rounded-sm resize-none transition-all duration-fast"
            style={{
              background: 'var(--background)',
              border: `1px solid ${isOverLimit ? 'var(--error)' : 'var(--border)'}`,
              color: 'var(--text-primary)',
              maxHeight: '200px',
              outline: 'none',
            }}
            onFocus={(e) => {
              if (!isOverLimit) {
                e.target.style.borderColor = 'var(--accent)';
              }
            }}
            onBlur={(e) => {
              e.target.style.borderColor = isOverLimit ? 'var(--error)' : 'var(--border)';
            }}
          />
          {charCount > 0 && (
            <span 
              className="absolute bottom-2 right-2 text-small"
              style={{ color: isOverLimit ? 'var(--error)' : 'var(--text-secondary)' }}
            >
              {charCount}/5000
            </span>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={(!content.trim() && attachments.length === 0) || isOverLimit || isUploading}
          className="p-3 rounded-sm font-semibold transition-all duration-fast disabled:opacity-50"
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
          Send
        </button>
      </div>
    </div>
  );
}
