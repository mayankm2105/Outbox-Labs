import fs from 'fs';
import path from 'path';

// Parse .env manually using standard Node fs
const envFilePath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envFilePath)) {
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Fallback test defaults
process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://reachinbox:reachinbox@localhost:5432/reachinbox';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'a_very_long_and_secure_session_secret_for_reachinbox_development_32chars';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-secret';
process.env.GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback';
process.env.ETHEREAL_USER = process.env.ETHEREAL_USER || 'test-ethereal-user';
process.env.ETHEREAL_PASSWORD = process.env.ETHEREAL_PASSWORD || 'test-ethereal-pass';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
