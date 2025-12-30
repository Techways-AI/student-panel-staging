/** @type {import('next').NextConfig} */
console.log('NEXT_MSG91_BUILD_ENV', {
  hasProcessWidgetId: !!process.env.NEXT_PUBLIC_MSG91_WIDGET_ID,
  hasProcessTokenAuth: !!process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH,
});
const path = require('path');

const nextConfig = {
  // ✅ Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
    NEXT_PUBLIC_FASTAPI_URL: process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://127.0.0.1:8001',
    FASTAPI_BACKEND_URL: process.env.FASTAPI_BACKEND_URL || 'http://127.0.0.1:8001',
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    NEXT_PUBLIC_PAYMENT_CURRENCY: process.env.NEXT_PUBLIC_PAYMENT_CURRENCY || 'INR',
    NEXT_PUBLIC_PAYMENT_MODE: process.env.NEXT_PUBLIC_PAYMENT_MODE || 'live',
    NEXT_PUBLIC_MSG91_WIDGET_ID: process.env.NEXT_PUBLIC_MSG91_WIDGET_ID,
    NEXT_PUBLIC_MSG91_TOKEN_AUTH: process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH,
  },

  // ✅ Performance & Safety
  reactStrictMode: process.env.NODE_ENV !== 'development',
  compress: process.env.NODE_ENV !== 'development',
  poweredByHeader: false,

  swcMinify: true,

  // ✅ TypeScript & ESLint fast builds
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ Experimental optimizations
  experimental: {
    optimizePackageImports: ['react-icons', 'lucide-react', '@tanstack/react-query'],
    optimizeCss: false, // faster dev builds
  },

  skipMiddlewareUrlNormalize: true,
  skipTrailingSlashRedirect: true,

  // ✅ Static optimization
  trailingSlash: false,
  output: 'standalone',

  // ✅ Image optimization
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
    domains: ['localhost'],
    minimumCacheTTL: process.env.NODE_ENV === 'development' ? 0 : 31536000,
    dangerouslyAllowSVG: true,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128],
  },

  // ✅ Headers (CORS + cache control)
  async headers() {
    return [
      // 🔹 CORS for backend APIs + No-cache for dynamic data
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Content-Type, Authorization' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      // 🔹 Static assets cache control
      {
        source: '/assets/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/css/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },

  // ✅ Redirects
  async redirects() {
    return [];
  },

  // ✅ Webpack optimizations
  webpack: (config, { dev }) => {
    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/apps/api/**',
        '**/Redis/**',
        '**/dist/**',
        '**/.next/**',
      ],
    };

    // Ensure proper module resolution
    config.resolve = {
      ...config.resolve,
      extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    };

    // Ensure alias resolution for "@/..." imports in both local and CI builds
    config.resolve = {
      ...(config.resolve || {}),
      alias: {
        ...(config.resolve?.alias || {}),
        '@': path.join(__dirname, 'src'),
      },
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    };

    if (dev) {
      // Force CSS reload every time for development
      config.cache = false;
    }

    return config;
  },
};

module.exports = nextConfig;

