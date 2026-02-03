import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://csbwrttrdvapdmiuavpj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYndydHRyZHZhcGRtaXVhdnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTgyNDMsImV4cCI6MjA4NTY5NDI0M30.Z6eY0LvTrspZ3A1B8uIkXa8d_YmO0HSwrzBP9R0LV1w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);