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
  onTyping?: (isTyping: boolean) => void;
}

export default function MessageInput({ onSend, replyingTo, onCancelReply, onTyping }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Function to upload video to Supabase
  const uploadVideoToSupabase = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload video');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Video upload error:', error);
      throw error;
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Handle typing indicator
  useEffect(() => {
    return () => {
      // Clear timeout on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleTypingStart = () => {
    if (!isUserTyping) {
      setIsUserTyping(true);
      onTyping?.(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to clear typing indicator after user stops typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isUserTyping) {
        setIsUserTyping(false);
        onTyping?.(false);
      }
    }, 1000); // 1 second after user stops typing
  };

  const handleTypingStop = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isUserTyping) {
      setIsUserTyping(false);
      onTyping?.(false);
    }
  };

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if the textarea is focused or if we're in the message input area
      const activeElement = document.activeElement;
      const isInMessageInput = textareaRef.current?.contains(activeElement) || 
                              activeElement === textareaRef.current;
      
      if (!isInMessageInput) return;

      const clipboardData = e.clipboardData || (e as any).originalEvent?.clipboardData;
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
      // Use setTimeout to ensure Firefox handles the state update properly
      setTimeout(() => {
        handleSend();
      }, 0);
    }
  };

  const handleSend = async () => {
    const trimmedContent = content.trim();
    // Allow sending if there's content OR attachments
    if (!trimmedContent && attachments.length === 0) return;

    // Firefox fix: ensure state updates are processed before sending
    setContent('');
    setAttachments([]);
    
    // Clear typing indicator when sending
    handleTypingStop();
    
    // Use setTimeout to ensure Firefox processes state updates properly
    setTimeout(() => {
      onSend(trimmedContent, attachments, replyingTo?._id);
    }, 0);
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
      // Separate images, videos, and other files
      const imageFiles = fileArray.filter(file =>
        file.type.startsWith('image/') ||
        file.type === 'image/avif' ||
        file.type === 'image/webp'
      );
      const videoFiles = fileArray.filter(file => file.type.startsWith('video/'));
      const otherFiles = fileArray.filter(file =>
        !file.type.startsWith('image/') &&
        !file.type.startsWith('video/') &&
        file.type !== 'image/avif' &&
        file.type !== 'image/webp'
      );

      // Debug logging
      console.log('File separation results:');
      console.log('Images:', imageFiles.map(f => `${f.name} (${f.type})`));
      console.log('Videos:', videoFiles.map(f => `${f.name} (${f.type})`));
      console.log('Other files:', otherFiles.map(f => `${f.name} (${f.type})`));

      const newAttachments: Attachment[] = [];
      let completed = 0;

      // Upload images
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

      // Upload videos to Supabase
      if (videoFiles.length > 0) {
        console.log(`Uploading ${videoFiles.length} videos to Supabase...`);
        for (const videoFile of videoFiles) {
          try {
            console.log(`Uploading video: ${videoFile.name} (${videoFile.type}, ${videoFile.size} bytes)`);
            const videoData = await uploadVideoToSupabase(videoFile);
            console.log(`Video uploaded successfully: ${videoData.url}`);
            newAttachments.push({
              type: 'video',
              url: videoData.url,
              name: videoFile.name,
              size: videoFile.size,
            });
            completed++;
            setUploadProgress({ current: completed, total: fileArray.length });
          } catch (error) {
            console.error('Failed to upload video:', videoFile.name, error);
            alert(`Failed to upload video ${videoFile.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Continue with other files even if one video fails
          }
        }
      }

      // Upload other files using fileUploader (not videos)
      if (otherFiles.length > 0) {
        const fileResults = await startFileUpload(otherFiles);
        if (fileResults) {
          fileResults.forEach((result, index) => {
            if (result) {
              const originalFile = otherFiles[index];
              newAttachments.push({
                type: 'file',
                url: result.url,
                name: originalFile.name,
                size: originalFile.size,
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
      className={`border-t p-1.5 md:p-2.5 transition-all duration-200 relative ${isDragOver ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
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
          className="mb-0.5 p-0.5 rounded-lg flex items-start justify-between"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--accent)',
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-0" style={{ color: 'var(--accent)' }}>
              ↩️ Replying to {replyingTo.userName}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {replyingTo.content}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-1.5 p-0.5 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Progress Bar */}
      {isUploading && uploadProgress.total > 0 && (
        <div className="mb-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Uploading {uploadProgress.current}/{uploadProgress.total} files...
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
            </span>
          </div>
          <div 
            className="w-full h-1.5 rounded-full overflow-hidden"
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
        <div className="mb-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {attachments.length} file{attachments.length > 1 ? 's' : ''} attached
            </span>
            <button
              onClick={() => setAttachments([])}
              className="text-xs px-1.5 py-0.5 rounded transition-all duration-fast hover:opacity-70"
              style={{ color: 'var(--error)' }}
              disabled={isUploading}
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
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
                      className="w-11 h-11 object-cover"
                      title={attachment.name}
                    />
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] transition-all duration-fast hover:scale-110"
                      style={{
                        background: 'var(--error)',
                        color: '#ffffff',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : attachment.type === 'video' ? (
                  <div className="relative">
                    <video
                      src={attachment.url}
                      className="w-11 h-11 object-cover bg-black"
                      title={attachment.name}
                      disablePictureInPicture
                    />
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] transition-all duration-fast hover:scale-110"
                      style={{
                        background: 'var(--error)',
                        color: '#ffffff',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 p-1.5 pr-5 min-w-0">
                    <span className="text-base">📄</span>
                    <span className="text-xs truncate max-w-[72px]" style={{ color: 'var(--text-primary)' }} title={attachment.name}>
                      {attachment.name}
                    </span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] transition-all duration-fast hover:scale-110"
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
            <div className="text-xl mb-1.5">📁</div>
            <p className="text-xs font-semibold text-blue-600">
              Drop files here to upload
            </p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/*,.avif,.webp,.pdf,.doc,.docx,.txt,.mp4,.mov,.avi,.mkv,.webm,.ogg,.3gp,.3g2"
          multiple
          className="hidden"
        />
        
        <div className="flex-shrink-0 relative">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || attachments.length >= 8}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-fast disabled:opacity-50 hover:scale-110 active:scale-95 mb-2"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            title={`Attach files (${attachments.length}/8 used) - Supports images (including AVIF), PDFs, docs, videos (MP4, MOV, AVI, MKV, WEBM, OGG, 3GP)`}
          >
            {isUploading ? '⏳' : attachments.length > 0 ? `📎${attachments.length}` : '📎'}
          </button>
          
          {/* Upload Progress */}
          {isUploading && uploadProgress.total > 0 && (
            <div 
              className="absolute -top-7 left-1/2 transform -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap"
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
              className="absolute -top-7 left-1/2 transform -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap"
              style={{
                background: 'var(--success)',
                color: '#ffffff',
                border: '1px solid var(--border)',
              }}
            >
              📋 Please Wait!
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              handleTypingStart();
            }}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              handleTypingStart();
            }}
            onFocus={(e) => {
              handleTypingStart();
              if (!isOverLimit) {
                e.target.style.borderColor = 'var(--accent)';
              }
            }}
            onBlur={(e) => {
              // Only stop typing if not pasting or switching to file input
              setTimeout(() => {
                if (!document.activeElement?.matches('input[type="file"]')) {
                  handleTypingStop();
                }
              }, 100);
              
              e.target.style.borderColor = isOverLimit ? 'var(--error)' : 'var(--border)';
            }}
            placeholder={
              isMobile
                ? "Type a message... (tap 📎 to add files)"
                : "Type a message... (Cmd+V to paste images)"
            }
            rows={1}
            maxLength={5000}
            className="w-full px-2.5 py-1.5 rounded-full resize-none transition-all duration-fast"
            style={{
              background: 'var(--background)',
              border: `1px solid ${isOverLimit ? 'var(--error)' : 'var(--border)'}`,
              color: 'var(--text-primary)',
              maxHeight: '80px',
              outline: 'none',
            }}
          />
          {charCount > 4500 && (
            <span 
              className="absolute bottom-0.5 right-2.5 text-xs px-1.5 py-0.5 rounded-full"
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
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-all duration-fast disabled:opacity-50 hover:scale-110 active:scale-95 mb-2"
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
