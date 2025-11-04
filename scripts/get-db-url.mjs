// Quick script to get DB URL from supabase config
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

try {
  // Try to read from .env files in apps/web
  const envPath = join(rootDir, 'apps', 'web', '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=(.+)/);
  if (match) {
    const url = match[1].trim().replace(/"/g, '');
    console.log(url);
    process.exit(0);
  }
} catch (e) {
  console.error("Error reading .env.local:", e.message);
}

// If not found, exit with error
console.error("DATABASE_URL not found");
process.exit(1);

