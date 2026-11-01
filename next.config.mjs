import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const weaponsDirectory = new URL('./public/weapons/', import.meta.url);
const weaponHash = createHash('sha256');
for (const path of readdirSync(weaponsDirectory, { recursive: true }).filter(path => path.endsWith('.svg')).sort()) {
  weaponHash.update(path).update(readFileSync(new URL(path.replaceAll('\\', '/'), weaponsDirectory)));
}
const weaponVersion = weaponHash.digest('hex').slice(0, 16);

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  env: { NEXT_PUBLIC_WEAPON_ASSET_VERSION: weaponVersion },
  async headers() {
    return [{
      source: '/weapons/:path*',
      has: [{ type: 'query', key: 'v', value: weaponVersion }],
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
  },
  distDir: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" ? ".next-emulator" : ".next",
};

export default nextConfig;
