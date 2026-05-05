import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://elywhketsxozigeycjkj.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  throw new Error("SUPABASE_KEY fehlt in den Environment Variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
