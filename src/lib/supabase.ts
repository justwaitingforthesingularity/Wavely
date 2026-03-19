import { createClient } from "@supabase/supabase-js";

// These are public/anon keys - safe to expose client-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mvqodxnmebxouybxtezx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12cW9keG5tZWJ4b3V5Ynh0ZXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzA3OTcsImV4cCI6MjA4Njc0Njc5N30.cBKX6yvVGmN0MQ4VS0_pXGMNY5r8Lk2cg8N2bkCkpB4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
