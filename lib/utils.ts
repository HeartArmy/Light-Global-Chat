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
    // MMM DD, HH:MM:SS UTC
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[messageDate.getUTCMonth()];
    const day = messageDate.getUTCDate();
    const hours = messageDate.getUTCHours().toString().padStart(2, '0');
    const minutes = messageDate.getUTCMinutes().toString().padStart(2, '0');
    const seconds = messageDate.getUTCSeconds().toString().padStart(2, '0');
    return `${month} ${day}, ${hours}:${minutes}:${seconds} UTC`;
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



// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Get country flag from country code
export function getCountryFlag(countryCode: string, userName?: string): string {
  // Always show USA flag for gemmie
  if (userName?.toLowerCase() === 'gemmie') {
    return '🇺🇸';
  }
  
  if (!countryCode || countryCode.length !== 2) {
    return '🌐';
  }
  
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

// Sanitize and render message content, creating YouTube embeds and linkifying URLs
export function renderMessageContent(text: string, isOwn: boolean = false): string {
  // First, escape all HTML to prevent XSS from user input
  let processedText = escapeHtml(text);

  // 1. Find YouTube URLs and replace them with inline embed component
  const youtubeUrlRegex = /\s*(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)|https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+))\s*/g;
  
  processedText = processedText.replace(youtubeUrlRegex, (match, url, id1, id2) => {
    const videoId = id1 || id2;
    if (!videoId) return match; // Should not happen, but as a safeguard
    
    // Return a React component placeholder that will be rendered by the client
    return `<div class="youtube-embed-wrapper" data-video-id="${videoId}" data-url="${url}"></div>`;
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
