import { createClient } from "@supabase/supabase-js";

// ── MSA UW Supabase project ─────────────────────────────────────────────
// These two values are safe to keep in front-end code. The publishable key
// is public by design; security is enforced by the Row Level Security (RLS)
// policies on the database, not by hiding this key.
// If you ever rotate keys or move projects, update these two lines.
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
  // An empty {} means the row exists but hasn't been seeded with real content.
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
