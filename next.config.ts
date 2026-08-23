import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next's dev-origin guard 403s asset requests whose Origin does not match the
  // dev host, which silently breaks hydration when a test runner or a device on
  // the LAN opens the app by IP rather than by name.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    // Enables forbidden()/unauthorized() + forbidden.tsx, which is how the
    // admin panel refuses under-privileged roles.
    authInterrupts: true,
  },
  images: {
    // Seeded cover art is procedurally generated SVG. Uploaded media is raster,
    // but the optimiser still has to be told SVG is allowed — sandboxed and
    // script-free, per Next's guidance.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.blob.vercel-storage.com' },
    ],
    formats: ['image/webp'],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
