import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 150,
};

// Check if credentials are real (not placeholder)
export const isSupabaseConfigured = () => {
  return (
    Boolean(config.supabaseUrl) &&
    !config.supabaseUrl.includes('your-project') &&
    Boolean(config.supabaseAnonKey) &&
    !config.supabaseAnonKey.includes('your-anon-key')
  );
};
