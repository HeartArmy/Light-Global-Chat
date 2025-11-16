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

// Sanitize and render message content, allowing iframes
export function renderMessageContent(text: string): string {
  // First, escape all HTML to prevent XSS
  const escapedText = escapeHtml(text);
  
  // Then, find and allow iframes (specifically for YouTube)
  const iframeRegex = /<iframe[^&]*?src="https:\/\/www\.youtube-nocookie\.com\/embed\/[^"]*?"[^&]*?><\/iframe>/g;
  
  return escapedText.replace(iframeRegex, (match) => {
    // Unescape the iframe tag
    let unescapedIframe = match
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
      
    // Remove width and height attributes
    unescapedIframe = unescapedIframe.replace(/width="[^"]*"/g, '').replace(/height="[^"]*"/g, '');

    // Add sandbox attribute for security
    if (!unescapedIframe.includes('sandbox')) {
      unescapedIframe = unescapedIframe.replace('<iframe', '<iframe sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"');
    }

    // Add aspect ratio styling to the iframe
    if (unescapedIframe.includes('style="')) {
      unescapedIframe = unescapedIframe.replace('style="', 'style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; ');
    } else {
      unescapedIframe = unescapedIframe.replace('<iframe', '<iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"');
    }
    
    // Wrap in a container with aspect ratio padding
    return `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px;">${unescapedIframe}</div>`;
  });
}
