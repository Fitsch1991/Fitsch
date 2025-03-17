// src/supabaseClient.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://elywhketsxozigeycjkj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVseXdoa2V0c3hvemlnZXljamtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0OTU5MjEsImV4cCI6MjA1NjA3MTkyMX0.oIfd4wPU2UocrmRXIWeCHsofz2rFekWTD5ISMiRAQ70";

export const supabase = createClient(supabaseUrl, supabaseKey);
