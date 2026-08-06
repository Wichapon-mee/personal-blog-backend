import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const BUCKET_NAME = "my-personal-blog";

export async function uploadImageFile(file, storagePath, { upsert = false } = {}) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);

  return publicUrl;
}

export function buildPostImagePath(originalname) {
  return `posts/${Date.now()}_${originalname}`;
}

export function buildProfileImagePath(userId, originalname) {
  const extension = originalname.includes(".")
    ? originalname.slice(originalname.lastIndexOf("."))
    : "";

  return `profiles/${userId}/avatar_${Date.now()}${extension}`;
}
