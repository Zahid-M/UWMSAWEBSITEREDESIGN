import { createClient } from "@supabase/supabase-js";

// ── MSA UW Supabase project ─────────────────────────────────────────────
// These two values are safe to keep in front-end code. The publishable key
// is public by design; security is enforced by the Row Level Security (RLS)
// policies on the database, not by hiding this key.
const SUPABASE_URL = "https://rhngkfkvaecviwoezzvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_2YptlgjkaoMokG0rgRSEkQ_wq7y2iSc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load the single site-content row. Returns the stored data object, or null
// if the row is empty/missing (first run) so the app can fall back to seed.
export async function loadContent() {
  const { data, error } = await supabase
    .from("site_content")
    .select("data")
    .eq("id", 1)
    .single();
  if (error) {
    console.warn("Supabase load failed, using local seed:", error.message);
    return null;
  }
  if (!data || !data.data || Object.keys(data.data).length === 0) return null;
  return data.data;
}

// Save the whole content object back to the single row. Requires an
// authenticated session (RLS blocks anonymous writes).
export async function saveContent(contentObj) {
  const { error } = await supabase
    .from("site_content")
    .update({ data: contentObj, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) {
    console.error("Supabase save failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/* ── Image uploads (Supabase Storage) ──────────────────────────────────
   Requires a PUBLIC bucket named "gallery" plus storage policies allowing
   public read and authenticated insert/delete. Officers upload from the
   admin panel; the public URL is stored in site content.
   ───────────────────────────────────────────────────────────────────── */

const BUCKET = "gallery";

// Make an uploaded filename safe and unique.
function safeName(name) {
  const dot = name.lastIndexOf(".");
  const ext = (dot > -1 ? name.slice(dot + 1) : "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const base = (dot > -1 ? name.slice(0, dot) : name)
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";
  return `${base}-${Date.now().toString(36)}.${ext}`;
}

// Upload one image into a folder: "gallery" | "sponsors" | "events".
// Returns { ok: true, url } or { ok: false, error }.
export async function uploadImage(file, folder = "gallery") {
  if (!file) return { ok: false, error: "No file selected." };
  if (!file.type?.startsWith("image/")) return { ok: false, error: "That file isn't an image." };
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, error: "Image is larger than 5MB — please compress it first." };

  const path = `${folder}/${safeName(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) {
    const msg = /bucket/i.test(error.message)
      ? 'Storage bucket "gallery" not found. Create it in Supabase → Storage (make it Public).'
      : error.message;
    return { ok: false, error: msg };
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl, path };
}

// Given a public URL from our bucket, return its storage path (or null).
export function pathFromUrl(url) {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null; // not one of ours (e.g. a repo-hosted image)
  return decodeURIComponent(url.slice(i + marker.length));
}

// Delete an uploaded image by its storage path. Best-effort.
export async function deleteImage(path) {
  if (!path) return { ok: true };
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
