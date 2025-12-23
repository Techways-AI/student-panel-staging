// Navigation Performance Monitor for Production-Ready Optimization
class NavigationPerformanceMonitor {
  constructor() {
    this.navigationTimes = new Map();
    this.isMonitoring = false;
    this.startTime = null;
  }

  // Start monitoring navigation performance
  startNavigation(from, to) {
    this.startTime = performance.now();
    this.isMonitoring = true;
    
    console.log(`🚀 Navigation started: ${from} → ${to}`);
    
    // Track navigation start time
    this.navigationTimes.set(`${from}-${to}`, {
      startTime: this.startTime,
      from,
      to
    });
  }

  // End monitoring and log performance metrics
  endNavigation(from, to) {
    if (!this.isMonitoring || !this.startTime) return;
    
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    // Update navigation time record
    const record = this.navigationTimes.get(`${from}-${to}`);
    if (record) {
      record.endTime = endTime;
      record.duration = duration;
    }
    
    // Log performance metrics
    console.log(`✅ Navigation completed: ${from} → ${to}`, {
      duration: `${duration.toFixed(2)}ms`,
      performance: this.getPerformanceRating(duration)
    });
    
    // Performance warning for slow navigation
    if (duration > 100) {
      console.warn(`⚠️ Slow navigation detected: ${duration.toFixed(2)}ms`);
    }
    
    this.isMonitoring = false;
    this.startTime = null;
  }

  // Get performance rating based on duration
  getPerformanceRating(duration) {
    if (duration < 50) return 'Excellent';
    if (duration < 100) return 'Good';
    if (duration < 200) return 'Fair';
    return 'Poor';
  }

  // Get navigation statistics
  getStats() {
    const stats = {
      totalNavigations: this.navigationTimes.size,
      averageTime: 0,
      fastestTime: Infinity,
      slowestTime: 0,
      performanceBreakdown: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      }
    };

    let totalTime = 0;
    
    this.navigationTimes.forEach(record => {
      if (record.duration) {
        totalTime += record.duration;
        stats.fastestTime = Math.min(stats.fastestTime, record.duration);
        stats.slowestTime = Math.max(stats.slowestTime, record.duration);
        
        const rating = this.getPerformanceRating(record.duration);
        stats.performanceBreakdown[rating.toLowerCase()]++;
      }
    });

    if (this.navigationTimes.size > 0) {
      stats.averageTime = totalTime / this.navigationTimes.size;
    }

    return stats;
  }

  // Log comprehensive performance report
  logPerformanceReport() {
    const stats = this.getStats();
    
    console.log('📊 Navigation Performance Report:', {
      totalNavigations: stats.totalNavigations,
      averageTime: `${stats.averageTime.toFixed(2)}ms`,
      fastestTime: stats.fastestTime === Infinity ? 'N/A' : `${stats.fastestTime.toFixed(2)}ms`,
      slowestTime: `${stats.slowestTime.toFixed(2)}ms`,
      performanceBreakdown: stats.performanceBreakdown
    });
  }
}

// Create global instance
const navigationMonitor = new NavigationPerformanceMonitor();

// Export for use in components
export default navigationMonitor;

// Global function for easy access
if (typeof window !== 'undefined') {
  window.navigationMonitor = navigationMonitor;
}

