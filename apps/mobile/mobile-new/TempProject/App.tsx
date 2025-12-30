import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Use correct local IP for Android emulator or device
const WEB_APP_URL =
  Platform.OS === 'android' ? 'https://student-panel-staging-production-d927.up.railway.app' : 'https://student-panel-staging-production-d927.up.railway.app';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebView | null>(null);

  // ✅ Handle Android back button safely
  useEffect(() => {
    const backAction = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [canGoBack]);

  // ✅ Handle load errors
  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('WebView error:', nativeEvent);

    if (nativeEvent.description?.includes('net::ERR_CONNECTION_REFUSED')) {
      setError('Connection refused. Make sure your web server is running.');
    } else if (nativeEvent.description?.includes('net::ERR_NAME_NOT_RESOLVED')) {
      setError('Cannot resolve server. Check your internet or IP address.');
    } else {
      setError(`Error: ${nativeEvent.description || 'Failed to load the web app'}`);
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.helpText}>
            Make sure your Next.js server is running at:
            {'\n'}
            {WEB_APP_URL}
          </Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: WEB_APP_URL }}
          style={styles.webview}
          onError={handleError}
          onHttpError={handleError}
          onLoadStart={() => {
            setLoading(true);
            setError(null);
          }}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
          }}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          cacheEnabled
          incognito={false}
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          pullToRefreshEnabled
          injectedJavaScriptBeforeContentLoaded={`
            (function() {
              if (!document.querySelector('meta[name="viewport"]')) {
                const meta = document.createElement('meta');
                meta.name = 'viewport';
                meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                document.head.appendChild(meta);
              }
            })();
            true;
          `}
          onMessage={(event) => {
            console.log('Message from web:', event.nativeEvent.data);
          }}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading Web App...</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  helpText: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default App;

