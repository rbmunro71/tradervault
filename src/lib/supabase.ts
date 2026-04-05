import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://umcxzgdpxrglehatkmgw.supabase.co';
const supabaseKey = 'sb_publishable_swv-7NWUpPrHk1qvL8kGNQ_LUGCvfl_';

export const supabase = createClient(supabaseUrl, supabaseKey);
