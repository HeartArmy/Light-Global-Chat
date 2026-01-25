import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for client-side operations (anon key)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Client for server-side operations (service role key - full access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// Storage bucket name for videos
const VIDEO_BUCKET = 'chat-videos';

// Supported video formats and max size
export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/quicktime', 
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/ogg',
  'video/3gpp',
  'video/3gpp2'
];

export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Upload video file to Supabase storage
 */
export async function uploadVideoToSupabase(file: File): Promise<{ url: string, path: string }> {
  // Validate file type
  if (!SUPPORTED_VIDEO_FORMATS.includes(file.type)) {
    throw new Error(`Unsupported video format: ${file.type}`);
  }

  // Validate file size
  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error(`Video file too large. Maximum size is ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);
  }

  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `videos/${new Date().toISOString().split('T')[0]}/${fileName}`;

  // Upload to Supabase
  const { data, error } = await supabaseAdmin
    .storage
    .from(VIDEO_BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) {
    throw new Error(`Failed to upload video: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabaseAdmin
    .storage
    .from(VIDEO_BUCKET)
    .getPublicUrl(filePath);

  if (!publicUrlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded video');
  }

  return {
    url: publicUrlData.publicUrl,
    path: filePath
  };
}

/**
 * Delete video from Supabase storage
 */
export async function deleteVideoFromSupabase(path: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .storage
    .from(VIDEO_BUCKET)
    .remove([path]);

  return !error;
}

/**
 * Get video URL from path
 */
export function getVideoUrl(path: string): string {
  const { data } = supabaseAdmin
    .storage
    .from(VIDEO_BUCKET)
    .getPublicUrl(path);

  return data?.publicUrl || '';
}