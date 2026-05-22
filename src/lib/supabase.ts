import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ureuzkxyyozzzluzawwr.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZXV6a3h5eW96enpsdXphd3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NjYyMDYsImV4cCI6MjA4MjM0MjIwNn0.iErYt2OhF2HYiQUVHjbCkO-c9zJPRodYpJZ2DB3WIp0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
