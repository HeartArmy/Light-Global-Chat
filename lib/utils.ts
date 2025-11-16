// Format timestamp in UTC
export function formatTimestamp(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);
  
  const isToday = 
    now.getUTCFullYear() === messageDate.getUTCFullYear() &&
    now.getUTCMonth() === messageDate.getUTCMonth() &&
    now.getUTCDate() === messageDate.getUTCDate();

  if (isToday) {
    // HH:MM:SS UTC here
    const hours = messageDate.getUTCHours().toString().padStart(2, '0');
    const minutes = messageDate.getUTCMinutes().toString().padStart(2, '0');
    const seconds = messageDate.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds} UTC`;
  } else {
    // MMM DD, HH:MM UTC
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[messageDate.getUTCMonth()];
    const day = messageDate.getUTCDate();
    const hours = messageDate.getUTCHours().toString().padStart(2, '0');
    const minutes = messageDate.getUTCMinutes().toString().padStart(2, '0');
    return `${month} ${day}, ${hours}:${minutes} UTC`;
  }
}

// Escape HTML to prevent XSS attacks
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#x27;'
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

// Detect and linkify URLs in text (with XSS protection)
export function linkifyText(text: string, isOwnMessage: boolean = false): string {
  // First, escape all HTML to prevent XSS
  const escapedText = escapeHtml(text);
  
  // Then linkify URLs (only http:// and https://)
  const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
  return escapedText.replace(urlRegex, (url) => {
    // Sanitize the URL to prevent javascript: or data: URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return url; // Don't linkify if not http/https
    }
    
    // Use white color for own messages (blue bubble), accent color for others
    const linkColor = isOwnMessage ? '#ffffff' : 'var(--accent)';
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: ${linkColor}; text-decoration: underline; font-weight: 600;">${url}</a>`;
  });
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Get country flag from country code
export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) {
    return '🌐';
  }
  
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

// Sanitize and render message content, creating YouTube previews and linkifying URLs
export function renderMessageContent(text: string, isOwn: boolean = false): string {
  // First, escape all HTML to prevent XSS from user input
  let processedText = escapeHtml(text);

  // 1. Find YouTube URLs and replace them with a facade
  const youtubeUrlRegex = /\s*(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)|https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+))\s*/g;
  
  processedText = processedText.replace(youtubeUrlRegex, (match, url, id1, id2) => {
    const videoId = id1 || id2;
    if (!videoId) return match; // Should not happen, but as a safeguard

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const linkColor = isOwn ? '#ffffff' : 'var(--accent)';
    
    // The original URL is replaced by this facade.
    return `
      <div class="youtube-preview-container" style="display: block; margin: 0; width: 100%;">
        <a href="${url}" target="_blank" rel="noopener noreferrer" style="display: block; color: ${linkColor}; text-decoration: underline; font-size: 12px; margin-bottom: 0;">${url}</a>
        <div class="youtube-facade" data-video-id="${videoId}" style="position: relative; aspect-ratio: 16 / 9; max-width: 100%; border-radius: 12px; overflow: hidden; cursor: pointer; background-image: url(${thumbnailUrl}); background-size: cover; background-position: center;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 68px; height: 48px; background-color: rgba(0, 0, 0, 0.8); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <svg width="100%" height="100%" viewBox="0 0 68 48">
              <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55C3.97,2.33,2.27,4.81,1.48,7.74,0.09,13.25,0,24,0,24s0.09,10.75,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.91,34.75,68,24,68,24S67.91,13.25,66.52,7.74z" fill="#f00"></path>
              <path d="M 45,24 27,14 27,34" fill="#fff"></path>
            </svg>
          </div>
        </div>
      </div>
    `;
  });

  // 2. Linkify any other remaining URLs
  // This regex is designed to not match URLs within HTML attributes (like href or style)
  const urlRegex = /(?<!href="|url\()https?:\/\/[^\s<>"]+/g;
  processedText = processedText.replace(urlRegex, (url) => {
    const linkColor = isOwn ? '#ffffff' : 'var(--accent)';
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: ${linkColor}; text-decoration: underline;">${url}</a>`;
  });

  return processedText;
}
