
import { createClient } from "@supabase/supabase-js";

export function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    auth: {
      persistSession: true,
      storageKey: "cv.auth",
    },
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  });
}
