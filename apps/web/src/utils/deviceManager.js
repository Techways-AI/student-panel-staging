/**
 * Device Fingerprinting and UUID Management
 * Production-ready client-side device management
 */

class DeviceManager {
    constructor() {
        this.deviceUuid = null;
        this.cookieName = 'device_uuid';
        this.cookieMaxAge = 365 * 24 * 60 * 60; // 1 year in seconds
    }

    /**
     * Initialize device management
     * Call this on page load
     */
    async init() {
        try {
            // Get or create device UUID
            this.deviceUuid = await this.getOrCreateDeviceUuid();
            
            // Set cookie for web clients
            this.setDeviceUuidCookie(this.deviceUuid);
            
            console.log('Device Manager initialized:', {
                deviceUuid: this.deviceUuid,
                fingerprint: this.collectFingerprint()
            });
            
            return this.deviceUuid;
        } catch (error) {
            console.error('Failed to initialize device manager:', error);
            throw error;
        }
    }

    /**
     * Get or create device UUID
     */
    async getOrCreateDeviceUuid() {
        // Try to get from cookie first
        let uuid = this.getDeviceUuidFromCookie();
        
        if (uuid) {
            return uuid;
        }

        // Try to get from localStorage as fallback
        uuid = localStorage.getItem('device_uuid');
        
        if (uuid) {
            // Set cookie for future requests
            this.setDeviceUuidCookie(uuid);
            return uuid;
        }

        // Generate new UUID
        uuid = this.generateUuid();
        
        // Store in localStorage as backup
        localStorage.setItem('device_uuid', uuid);
        
        return uuid;
    }

    /**
     * Generate a new UUID v4
     */
    generateUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Set device UUID cookie
     */
    setDeviceUuidCookie(uuid) {
        try {
            const cookieValue = `${this.cookieName}=${uuid}; Path=/; Max-Age=${this.cookieMaxAge}; SameSite=Lax`;
            
            // Add Secure flag if HTTPS
            const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
            
            document.cookie = cookieValue + secureFlag;
        } catch (error) {
            console.warn('Failed to set device UUID cookie:', error);
        }
    }

    /**
     * Get device UUID from cookie
     */
    getDeviceUuidFromCookie() {
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === this.cookieName) {
                    return value;
                }
            }
        } catch (error) {
            console.warn('Failed to read device UUID cookie:', error);
        }
        return null;
    }

    /**
     * Collect minimal, stable browser fingerprint
     * Only collects stable signals to avoid false negatives
     */
    collectFingerprint() {
        try {
            const fingerprint = {
                platform: navigator.platform || null,
                screen: `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
                language: navigator.language || null,
                hw: navigator.hardwareConcurrency || null
            };

            // Clean up user agent to remove volatile parts
            if (navigator.userAgent) {
                fingerprint.userAgent = this.cleanUserAgent(navigator.userAgent);
            }

            // Add incognito/private browsing detection
            fingerprint.isIncognito = this.detectIncognitoMode();

            return fingerprint;
        } catch (error) {
            console.error('Failed to collect fingerprint:', error);
            return {};
        }
    }

    /**
     * Detect if browser is in incognito/private mode
     */
    detectIncognitoMode() {
        try {
            // Check for various incognito indicators
            const indicators = {
                // Chrome/Edge incognito indicators
                webkitRequestFileSystem: !window.webkitRequestFileSystem,
                indexedDB: !window.indexedDB,
                
                // Firefox private browsing indicators
                mozIndexedDB: !window.mozIndexedDB,
                
                // Safari private browsing indicators
                safariIncognito: !window.safari || window.safari.pushNotification === undefined
            };
            
            // Count positive indicators
            const positiveIndicators = Object.values(indicators).filter(Boolean).length;
            
            // If multiple indicators suggest incognito mode
            return positiveIndicators >= 2;
        } catch (error) {
            console.error('Failed to detect incognito mode:', error);
            return false;
        }
    }

    /**
     * Clean user agent string to remove volatile parts
     */
    cleanUserAgent(userAgent) {
        try {
            // Remove version numbers and volatile identifiers
            return userAgent
                .replace(/\d+\.\d+\.\d+\.\d+/g, 'X.X.X.X') // IP addresses
                .replace(/\d+\.\d+\.\d+/g, 'X.X.X') // Version numbers
                .replace(/Chrome\/\d+/g, 'Chrome/X')
                .replace(/Safari\/\d+/g, 'Safari/X')
                .replace(/Firefox\/\d+/g, 'Firefox/X')
                .replace(/Edge\/\d+/g, 'Edge/X')
                .replace(/Version\/\d+/g, 'Version/X');
        } catch (error) {
            console.warn('Failed to clean user agent:', error);
            return userAgent;
        }
    }

    /**
     * Detect device type
     */
    detectDeviceType() {
        const userAgent = navigator.userAgent;
        
        // More specific mobile patterns to avoid false positives
        const mobilePatterns = [
            /Android\s+\d+/,  // Android with version number
            /iPhone\s+OS\s+\d+/,  // iPhone with OS version
            /iPad.*OS\s+\d+/,  // iPad with OS version
            /Windows Phone\s+\d+/,  // Windows Phone with version
            /BlackBerry\s+\d+/,  // BlackBerry with version
            /Opera Mini/,  // Opera Mini browser
            /IEMobile/,  // Internet Explorer Mobile
            /webOS/,  // webOS
            /Symbian/,  // Symbian
            /Kindle/,  // Kindle
            /Silk/,  // Silk browser
        ];
        
        // Check for specific mobile patterns first
        for (const pattern of mobilePatterns) {
            if (pattern.test(userAgent)) {
                console.log(`🔍 Device detected as mobile due to pattern: ${pattern}`);
                console.log(`🔍 User Agent: ${userAgent}`);
                return 'mobile';
            }
        }
        
        // Additional checks for generic mobile indicators
        // But be more careful about "Mobile" - it can appear in desktop browsers
        if (/Mobile.*Safari/.test(userAgent)) {
            console.log(`🔍 Device detected as mobile due to Mobile Safari`);
            console.log(`🔍 User Agent: ${userAgent}`);
            return 'mobile';
        }
        
        // Check for tablet patterns
        if (/iPad|Android.*Tablet|Kindle.*Fire/.test(userAgent)) {
            console.log(`🔍 Device detected as mobile due to tablet pattern`);
            console.log(`🔍 User Agent: ${userAgent}`);
            return 'mobile';
        }
        
        console.log(`🔍 Device detected as desktop`);
        console.log(`🔍 User Agent: ${userAgent}`);
        return 'desktop';
    }

    /**
     * Get device info for API requests
     */
    getDeviceInfo() {
        const deviceInfo = {
            deviceUuid: this.deviceUuid,
            deviceType: this.detectDeviceType(),
            fingerprint: this.collectFingerprint()
        };
        
        console.log('🔍 Device Info being sent to backend:', deviceInfo);
        return deviceInfo;
    }

    /**
     * Clear device data (for logout/reset)
     */
    clearDeviceData() {
        try {
            // Clear cookie
            document.cookie = `${this.cookieName}=; Path=/; Max-Age=0`;
            
            // Clear localStorage
            localStorage.removeItem('device_uuid');
            
            // Reset UUID
            this.deviceUuid = null;
            
            console.log('Device data cleared');
        } catch (error) {
            console.error('Failed to clear device data:', error);
        }
    }

    /**
     * Check if device is in incognito mode
     */
    isIncognitoMode() {
        try {
            // Check for various incognito indicators
            if (window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect) {
                return false; // Not incognito
            }
            
            // Check for storage limitations
            if (navigator.storage && navigator.storage.estimate) {
                navigator.storage.estimate().then(estimate => {
                    if (estimate.quota < 120000000) { // Less than ~120MB
                        return true; // Likely incognito
                    }
                });
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }
}

// Global instance
window.deviceManager = new DeviceManager();

// Auto-initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.deviceManager.init().catch(console.error);
    });
} else {
    window.deviceManager.init().catch(console.error);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceManager;
}

