/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  distDir: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" ? ".next-emulator" : ".next",
};

export default nextConfig;
