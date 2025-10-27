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
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="relative rounded-lg overflow-hidden"
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
                    className="w-20 h-20 object-cover"
                  />
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-small transition-all duration-fast hover:scale-110"
                    style={{ 
                      background: 'var(--error)',
                      color: '#ffffff',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 pr-8">
                  <span className="text-xl">📄</span>
                  <span className="text-small truncate max-w-[100px]" style={{ color: 'var(--text-primary)' }}>
                    {attachment.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-small transition-all duration-fast hover:scale-110"
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
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-fast disabled:opacity-50 hover:scale-110 active:scale-95"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
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
