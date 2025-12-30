// CACHE KILLER INJECTION 
const killAllApiCaches = () =
  if (typeof window !== 'undefined') { 
    // Clear simpleCache Map 
    if (window.simpleCache) window.simpleCache.clear(); 
    // Clear navigationCache Map 
    if (window.navigationCache) window.navigationCache.clear(); 
    // Clear pendingRequests Map 
    if (window.pendingRequests) window.pendingRequests.clear(); 
    console.log('🧹 ALL API CACHES KILLED'); 
  } 
}; 
killAllApiCaches(); 
export default killAllApiCaches; 

