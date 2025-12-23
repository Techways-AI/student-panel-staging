if ('serviceWorker' in navigator) { 
  navigator.serviceWorker.getRegistrations().then(registrations =
    registrations.forEach(registration =
  }); 
  caches.keys().then(cacheNames =
    return Promise.all( 
      cacheNames.map(cacheName =
    ); 
  }).then(() = ALL SERVICE WORKER CACHES DELETED')); 
} 

