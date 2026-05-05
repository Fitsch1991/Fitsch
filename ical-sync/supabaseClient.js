import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://elywhketsxozigeycjkj.supabase.co";
const supabaseKey = "DEIN_KEY";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    enabled: false,
  },
});
