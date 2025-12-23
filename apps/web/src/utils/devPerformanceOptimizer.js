// Development Performance Optimizer
// This script optimizes the development environment for faster loading

class DevPerformanceOptimizer {
  constructor() {
    this.isOptimized = false;
    this.init();
  }

  init() {
    if (process.env.NODE_ENV === 'development') {
      this.optimizeConsole();
      this.optimizeMemory();
      this.optimizeNetwork();
      this.addPerformanceHints();
    }
  }

  // Optimize console for better performance
  optimizeConsole() {
    // Disable console.log in production-like mode for faster execution
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CONSOLE === 'true') {
      console.log = () => {};
      console.warn = () => {};
      console.info = () => {};
    }
  }

  // Optimize memory usage
  optimizeMemory() {
    // Force garbage collection if available
    if (typeof window !== 'undefined' && window.gc) {
      setInterval(() => {
        if (performance.memory && performance.memory.usedJSHeapSize > 50 * 1024 * 1024) {
          window.gc();
        }
      }, 30000); // Every 30 seconds
    }
  }

  // Optimize network requests
  optimizeNetwork() {
    // Preload critical resources
    this.preloadCriticalResources();
    
    // Optimize fetch requests
    this.optimizeFetch();
  }

  preloadCriticalResources() {
    const criticalResources = [
      '/assets/logo-name.png',
      '/assets/favicon.ico',
      '/manifest.json'
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      link.as = resource.endsWith('.png') ? 'image' : 'fetch';
      document.head.appendChild(link);
    });
  }

  optimizeFetch() {
    // DISABLED: Request caching removed for development
    // This was causing issues with hot reloading and real-time updates
    console.log('🚫 Fetch caching disabled for development');
    
    // Keep original fetch without caching
    const originalFetch = window.fetch;
    window.fetch = originalFetch;
  }

  // Add performance hints
  addPerformanceHints() {
    console.log('🚀 Development Performance Optimizations Active:');
    console.log('  • Console optimization enabled');
    console.log('  • Memory management active');
    console.log('  • Network request caching DISABLED for hot reload');
    console.log('  • Critical resource preloading active');
    
    // Performance monitoring
    this.monitorPerformance();
  }

  monitorPerformance() {
    let renderCount = 0;
    const startTime = performance.now();

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          console.log(`⏱️ ${entry.name}: ${entry.duration.toFixed(2)}ms`);
        }
      }
    });

    observer.observe({ entryTypes: ['measure'] });

    // Monitor render performance
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      renderCount++;
      if (renderCount % 60 === 0) {
        const currentTime = performance.now();
        const fps = 60000 / (currentTime - startTime);
        console.log(`🎯 FPS: ${fps.toFixed(1)}`);
      }
      return originalRequestAnimationFrame(callback);
    };
  }

  // Get performance report
  getPerformanceReport() {
    const report = {
      memory: performance.memory ? {
        used: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
      } : 'Not available',
      timing: performance.timing ? {
        loadTime: `${performance.timing.loadEventEnd - performance.timing.navigationStart}ms`,
        domReady: `${performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart}ms`
      } : 'Not available'
    };

    console.log('📊 Development Performance Report:', report);
    return report;
  }
}

// Initialize optimizer
const devOptimizer = new DevPerformanceOptimizer();

// Export for global access
if (typeof window !== 'undefined') {
  window.devOptimizer = devOptimizer;
}

export default devOptimizer;

