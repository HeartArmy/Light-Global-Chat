'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, Attachment } from '@/types';
import { useUploadThing } from '@/lib/uploadthing';

// Hook to detect mobile device
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

interface MessageInputProps {
  onSend: (content: string, attachments: Attachment[], replyTo?: string) => void;
  replyingTo: Message | null;
  onCancelReply: () => void;
}

export default function MessageInput({ onSend, replyingTo, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const { startUpload: startImageUpload } = useUploadThing('imageUploader', {
    onUploadProgress: (progress) => {
      console.log('Image upload progress:', progress);
    },
  });
  const { startUpload: startFileUpload } = useUploadThing('fileUploader', {
    onUploadProgress: (progress) => {
      console.log('File upload progress:', progress);
    },
  });

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if the textarea is focused or if we're in the message input area
      const activeElement = document.activeElement;
      const isInMessageInput = textareaRef.current?.contains(activeElement) || 
                              activeElement === textareaRef.current;
      
      if (!isInMessageInput) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = Array.from(clipboardData.items);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      
      if (imageItems.length === 0) return;

      // Prevent default paste behavior for images
      e.preventDefault();

      // Check if adding these files would exceed the limit
      if (attachments.length + imageItems.length > 8) {
        alert(`Cannot paste ${imageItems.length} images. Maximum 8 attachments total (currently have ${attachments.length}).`);
        return;
      }

      if (isUploading) {
        alert('Please wait for current upload to finish before pasting more files.');
        return;
      }

      // Convert clipboard items to files
      const files: File[] = [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }

      if (files.length > 0) {
        // Show brief paste confirmation
        setShowPasteHint(true);
        setTimeout(() => setShowPasteHint(false), 2000);
        
        await handleFilesUpload(files);
      }
    };

    // Add event listener to document
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [attachments.length, isUploading]);

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFilesUpload(files);
    }
  };

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

  // Reusable function to handle file uploads
  const handleFilesUpload = async (fileArray: File[]) => {
    // Check if adding these files would exceed the limit
    if (attachments.length + fileArray.length > 8) {
      alert(`Cannot add ${fileArray.length} files. Maximum 8 attachments total (currently have ${attachments.length}).`);
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: fileArray.length });

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
      let completed = 0;

      // Upload images in batches if needed
      if (imageFiles.length > 0) {
        setUploadProgress({ current: completed, total: fileArray.length });
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
              completed++;
              setUploadProgress({ current: completed, total: fileArray.length });
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
              completed++;
              setUploadProgress({ current: completed, total: fileArray.length });
            }
          });
        }
      }

      setAttachments([...attachments, ...newAttachments]);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    await handleFilesUpload(fileArray);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const charCount = content.length;
  const isOverLimit = charCount > 5000;

  return (
    <div 
      className={`border-t p-2 md:p-3 transition-all duration-200 relative ${isDragOver ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Reply Context */}
      {replyingTo && (
        <div 
          className="mb-1 p-1 rounded-lg flex items-start justify-between"
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

      {/* Upload Progress Bar */}
      {isUploading && uploadProgress.total > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
              Uploading {uploadProgress.current}/{uploadProgress.total} files...
            </span>
            <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
              {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
            </span>
          </div>
          <div 
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--background)' }}
          >
            <div 
              className="h-full transition-all duration-300 rounded-full"
              style={{ 
                background: 'var(--accent)',
                width: `${(uploadProgress.current / uploadProgress.total) * 100}%`
              }}
            />
          </div>
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
              disabled={isUploading}
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
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
                      className="w-12 h-12 object-cover"
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

      {/* Drag Overlay */}
      {isDragOver && (
        <div 
          className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 z-10 bg-blue-50 bg-opacity-90"
        >
          <div className="text-center">
            <div className="text-2xl mb-2">📁</div>
            <p className="text-small font-semibold text-blue-600">
              Drop files here to upload
            </p>
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
        
          <div className="flex-shrink-0 relative">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || attachments.length >= 8}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-fast disabled:opacity-50 hover:scale-110 active:scale-95"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            title={`Attach files (${attachments.length}/8 used) - Supports images (including AVIF), PDFs, docs`}
          >
            {isUploading ? '⏳' : attachments.length > 0 ? `📎${attachments.length}` : '📎'}
          </button>
          
          {/* Upload Progress */}
          {isUploading && uploadProgress.total > 0 && (
            <div 
              className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap"
              style={{
                background: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              {uploadProgress.current}/{uploadProgress.total}
            </div>
          )}
          
          {/* Paste Hint */}
          {showPasteHint && (
            <div 
              className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap"
              style={{
                background: 'var(--success)',
                color: '#ffffff',
                border: '1px solid var(--border)',
              }}
            >
              📋 Pasted!
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isMobile 
                ? "Type a message... (tap 📎 to add files)" 
                : "Type a message... (Cmd+V to paste images)"
            }
            rows={1}
            maxLength={5000}
            className="w-full px-3 py-2 rounded-full resize-none transition-all duration-fast"
            style={{
              background: 'var(--background)',
              border: `1px solid ${isOverLimit ? 'var(--error)' : 'var(--border)'}`,
              color: 'var(--text-primary)',
              maxHeight: '90px',
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
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-semibold transition-all duration-fast disabled:opacity-50 hover:scale-110 active:scale-95"
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
