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
    // Allow sending if there's content OR attachments
    if (!trimmedContent && attachments.length === 0) return;

    // Pass the trimmed content (can be empty string if only attachments)
    onSend(trimmedContent, attachments, replyingTo?._id);
    setContent('');
    setAttachments([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setIsUploading(true);

    try {
      // Separate images and other files
      const imageFiles = fileArray.filter(file => 
        file.type.startsWith('image/') || 
        file.type === 'image/avif' || 
        file.type === 'image/webp'
      );
      const otherFiles = fileArray.filter(file => 
        !file.type.startsWith('image/') && 
        file.type !== 'image/avif' && 
        file.type !== 'image/webp'
      );

      const newAttachments: Attachment[] = [];

      // Upload images
      if (imageFiles.length > 0) {
        const imageResults = await startImageUpload(imageFiles);
        if (imageResults) {
          imageResults.forEach((result, index) => {
            if (result) {
              newAttachments.push({
                type: 'image',
                url: result.url,
                name: imageFiles[index].name,
                size: imageFiles[index].size,
              });
            }
          });
        }
      }

      // Upload other files
      if (otherFiles.length > 0) {
        const fileResults = await startFileUpload(otherFiles);
        if (fileResults) {
          fileResults.forEach((result, index) => {
            if (result) {
              newAttachments.push({
                type: 'file',
                url: result.url,
                name: otherFiles[index].name,
                size: otherFiles[index].size,
              });
            }
          });
        }
      }

      setAttachments([...attachments, ...newAttachments]);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload files');
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
      className="border-t p-3 md:p-4"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Reply Context */}
      {replyingTo && (
        <div 
          className="mb-2 p-2 rounded-lg flex items-start justify-between"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--accent)',
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-small font-semibold mb-0.5" style={{ color: 'var(--accent)' }}>
              ↩️ Replying to {replyingTo.userName}
            </p>
            <p className="text-small truncate" style={{ color: 'var(--text-secondary)' }}>
              {replyingTo.content}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 p-1 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
              {attachments.length} file{attachments.length > 1 ? 's' : ''} attached
            </span>
            <button
              onClick={() => setAttachments([])}
              className="text-small px-2 py-1 rounded transition-all duration-fast hover:opacity-70"
              style={{ color: 'var(--error)' }}
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="relative rounded-lg overflow-hidden flex-shrink-0"
                style={{
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                }}
              >
                {attachment.type === 'image' ? (
                  <div className="relative">
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="w-16 h-16 object-cover"
                      title={attachment.name}
                    />
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all duration-fast hover:scale-110"
                      style={{ 
                        background: 'var(--error)',
                        color: '#ffffff',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 pr-6 min-w-0">
                    <span className="text-lg">📄</span>
                    <span className="text-small truncate max-w-[80px]" style={{ color: 'var(--text-primary)' }} title={attachment.name}>
                      {attachment.name}
                    </span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all duration-fast hover:scale-110"
                      style={{ 
                        background: 'var(--error)',
                        color: '#ffffff',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/*,.avif,.webp,.pdf,.doc,.docx,.txt"
          multiple
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || attachments.length >= 8}
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-fast disabled:opacity-50 hover:scale-110 active:scale-95"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          title={`Attach files (${attachments.length}/8 used) - Supports images (including AVIF), PDFs, docs`}
        >
          {isUploading ? '⏳' : attachments.length > 0 ? `📎${attachments.length}` : '📎'}
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
            className="w-full px-4 py-2.5 rounded-full resize-none transition-all duration-fast"
            style={{
              background: 'var(--background)',
              border: `1px solid ${isOverLimit ? 'var(--error)' : 'var(--border)'}`,
              color: 'var(--text-primary)',
              maxHeight: '120px',
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
          {charCount > 4500 && (
            <span 
              className="absolute bottom-1 right-3 text-small px-2 py-0.5 rounded-full"
              style={{ 
                color: isOverLimit ? 'var(--error)' : 'var(--text-secondary)',
                background: 'var(--surface)',
              }}
            >
              {charCount}/5000
            </span>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={(!content.trim() && attachments.length === 0) || isOverLimit || isUploading}
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-fast disabled:opacity-50 hover:scale-110 active:scale-95"
          style={{
            background: 'var(--accent)',
            color: '#ffffff',
          }}
          title="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
