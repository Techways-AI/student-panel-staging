import './globals.css';
import Image from 'next/image';
import { Suspense } from 'react';
import { Poppins, Baloo_2 } from 'next/font/google';

// DISABLED: Prevent ALL static generation and caching
export const dynamic = process.env.NODE_ENV === 'development' ? 'force-dynamic' : 'auto';
export const revalidate = process.env.NODE_ENV === 'development' ? 0 : 3600;
export const fetchCache = process.env.NODE_ENV === 'development' ? 'force-no-store' : 'default-cache';
export const runtime = 'nodejs';

// Import components directly to prevent hydration issues
import RootLayoutClient from '../components/RootLayoutClient';
import { AuthProvider } from '../context/AuthContext';
import ClientSideInitializer from '../components/ClientSideInitializer';
import ServiceWorkerRegistration from '../components/ServiceWorkerRegistration';

// DISABLED: Font optimizations removed to prevent caching
const poppins = Poppins({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-poppins',
    display: 'swap',
    preload: true,
    fallback: ['system-ui', 'arial'],
    adjustFontFallback: false, // Disabled font fallback adjustments
});

const baloo = Baloo_2({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-baloo',
    display: 'swap',
    preload: true,
    fallback: ['system-ui', 'arial'],
    adjustFontFallback: false, // Disabled font fallback adjustments
});

export const metadata = {
    title: "Durrani's AI",
    description: 'Interactive learning platform for students',
    // PWA manifest
    manifest: '/manifest.json',
    // Performance optimizations
    other: {
        'X-DNS-Prefetch-Control': 'on',
    },
};

// Separate viewport export to fix warnings
export const viewport = {
    width: 'device-width',
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 1,
    viewportFit: 'cover',
    userScalable: false,
    themeColor: '#F6F1E8',
};

function StartupFallback() {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                minHeight: '100vh',
                backgroundColor: '#F6F1E8',
            }}
        >
            <Image
                src="/assets/logo-name.png"
                alt="Durrani's Pharma logo"
                width={260}
                height={260}
                priority
            />
        </div>
    );
}

export default function RootLayout({ children }) {
    return (
        <html lang="en" className={`${poppins.variable} ${baloo.variable}`}>
        <head>
            {/* Favicon */}
            <link rel="icon" type="image/png" sizes="196x196" href="/assets/logo.png" />
            <link rel="icon" href="/assets/favicon.ico" />
            
            {/* Basic meta tags */}
            <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
            
            {/* iOS PWA enhancements */}
            <link rel="apple-touch-icon" href="/assets/logo.png" />
            <meta name="apple-mobile-web-app-title" content="Durrani's AI" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-touch-fullscreen" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            
            {/* iOS Splash Screens - Portrait */}
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2048-2732.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1668-2388.png" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1536-2048.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1640-2360.png" media="(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1668-2224.png" media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1620-2160.png" media="(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1488-2266.png" media="(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1320-2868.png" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1206-2622.png" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1260-2736.png" media="(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1290-2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1179-2556.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1170-2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1284-2778.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1125-2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1242-2688.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-828-1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1242-2208.png" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-750-1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-640-1136.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
            
            {/* iOS Splash Screens - Landscape */}
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2732-2048.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2388-1668.png" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2048-1536.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2360-1640.png" media="(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2224-1668.png" media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2160-1620.png" media="(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2266-1488.png" media="(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2868-1320.png" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2622-1206.png" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2736-1260.png" media="(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2796-1290.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2556-1179.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2532-1170.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2778-1284.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2436-1125.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2688-1242.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1792-828.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-2208-1242.png" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1334-750.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            <link rel="apple-touch-startup-image" href="/assets/pwa/apple-splash-1136-640.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
            
            {/* Windows MSTile */}
            <meta name="msapplication-square70x70logo" content="/assets/logo.png" />
            <meta name="msapplication-square150x150logo" content="/assets/logo.png" />
            <meta name="msapplication-square310x310logo" content="/assets/logo.png" />
            <meta name="msapplication-wide310x150logo" content="/assets/logo.png" />
            
            {/* Explicit theme color for Android status bar coloring */}
            <meta name="theme-color" content="#FFFFFF" />
            
        </head>
        <body className={`${poppins.variable} ${baloo.variable}`}>
            <AuthProvider>
                <Suspense fallback={<StartupFallback />}>
                    <RootLayoutClient>
                        {children}
                        {/* Client-side initializer for PWA and performance monitoring */}
                        <ClientSideInitializer />
                        {/* Register Service Worker (production only, guarded inside component) */}
                        <ServiceWorkerRegistration />
                    </RootLayoutClient>
                </Suspense>
            </AuthProvider>
        </body>
        </html>
    );
}

