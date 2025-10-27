// Country code to flag emoji mapping
const countryCodeToFlag = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) {
    return '🌐'; // Globe emoji as default
  }
  
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
};

// Cache for IP to country lookups
const ipCache = new Map<string, { countryCode: string; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function getCountryFromIP(ip: string): Promise<{ countryCode: string; countryFlag: string }> {
  // Check cache first
  const cached = ipCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return {
      countryCode: cached.countryCode,
      countryFlag: countryCodeToFlag(cached.countryCode),
    };
  }

  try {
    // Use ip-api.com (free, no API key required)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch country data');
    }

    const data = await response.json();
    const countryCode = data.countryCode || 'XX';

    // Cache the result
    ipCache.set(ip, { countryCode, timestamp: Date.now() });

    return {
      countryCode,
      countryFlag: countryCodeToFlag(countryCode),
    };
  } catch (error) {
    console.error('Error fetching country:', error);
    // Return default globe emoji on error
    return {
      countryCode: 'XX',
      countryFlag: '🌐',
    };
  }
}

export function getClientIP(request: Request): string {
  // Try various headers that might contain the real IP
  const headers = request.headers;
  
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to a default (localhost)
  return '127.0.0.1';
}
