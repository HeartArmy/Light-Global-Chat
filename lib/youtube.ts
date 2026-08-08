import redis from '@/lib/redis';

const OEMBED_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days
const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?/g;

interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  author: string;
  url: string;
}

function getYouTubeVideoId(text: string): string | null {
  YOUTUBE_URL_REGEX.lastIndex = 0;
  const match = YOUTUBE_URL_REGEX.exec(text);
  return match ? match[1] : null;
}

async function fetchYouTubeInfo(videoId: string): Promise<YouTubeVideoInfo | null> {
  try {
    const cacheKey = `youtube:oembed:${videoId}`;
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      console.log(`⚠️ YouTube oEmbed failed (${response.status}) for video ${videoId}`);
      return null;
    }

    const data = await response.json();
    const info: YouTubeVideoInfo = {
      videoId,
      title: String(data.title || ''),
      author: String(data.author_name || ''),
      url,
    };

    await redis.set(cacheKey, JSON.stringify(info), { ex: OEMBED_CACHE_TTL });
    return info;
  } catch (error) {
    console.error('❌ YouTube oEmbed error:', error);
    return null;
  }
}

// Replace YouTube URLs in a message with enriched info so the AI knows what the video is.
// Returns the original text unchanged if no YouTube link or metadata is unavailable.
export async function enrichYouTubeLinks(text: string): Promise<string> {
  const videoId = getYouTubeVideoId(text);
  if (!videoId) return text;

  const info = await fetchYouTubeInfo(videoId);
  if (!info) return text;

  // Replace the matched URL with a descriptive form + keep the original URL
  const enriched = text.replace(
    YOUTUBE_URL_REGEX,
    (url) => `${info.url} [youtube video: "${info.title}" by ${info.author}]`
  );
  return enriched;
}
