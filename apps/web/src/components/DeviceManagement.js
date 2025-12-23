import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../config/api.js';
 
// Helper functions for device detection fallback
const generateFallbackUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
 
const detectDeviceTypeFallback = () => {
  const userAgent = navigator.userAgent;
 
  // Specific mobile patterns
  const mobilePatterns = [
    /Android\s+\d+/,
    /iPhone\s+OS\s+\d+/,
    /iPad.*OS\s+\d+/,
    /Windows\s+Phone\s+\d+/,
    /BlackBerry\s+\d+/,
    /BB10/,
    /Opera\s+Mini/,
    /IEMobile/
  ];
 
  // Generic mobile indicators
  const mobileGeneric = [
    /Mobile.*Safari/,
    /Android.*Mobile/,
    /iPhone/,
    /iPad|Android.*Tablet|Kindle.*Fire/
  ];
 
  // Check for specific mobile patterns
  for (const pattern of mobilePatterns) {
    if (pattern.test(userAgent)) {
      return 'mobile';
    }
  }
 
  // Check for generic mobile indicators
  for (const pattern of mobileGeneric) {
    if (pattern.test(userAgent)) {
      return 'mobile';
    }
  }
 
  // Default to desktop if no mobile patterns match
  return 'desktop';
};
 
const DeviceManagement = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
 
  // Helper: make authenticated request with auto-refresh on 401
  const requestWithAuth = async (path, options = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const res = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
 
    if (res.status !== 401) return res;
 
    // Try refresh-token flow using expired token (backend supports it)
    try {
      const refreshRes = await fetch(`${API_CONFIG.BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data?.access_token) {
          localStorage.setItem('token', data.access_token);
          if (data.refresh_token) localStorage.setItem('refreshToken', data.refresh_token);
          if (data.user_info) localStorage.setItem('userInfo', JSON.stringify(data.user_info));
        }
        // Retry original request with new token
        const newToken = localStorage.getItem('token');
        return fetch(`${API_CONFIG.BASE_URL}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            ...(newToken ? { 'Authorization': `Bearer ${newToken}` } : {}),
          },
        });
      }
    } catch (e) {
      // fallthrough
    }
    return res;
  };
 
  useEffect(() => {
    fetchDevices();
  }, []);
 
  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await requestWithAuth('/api/auth/devices', { method: 'GET' });
      if (!res.ok) {
        throw new Error(`Failed to fetch devices: ${res.status}`);
      }
      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : (payload?.devices || []);
      setDevices(list);
      setError(null);
    } catch (err) {
      setError('Failed to fetch devices');
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };
 
  const deactivateDevice = async (deviceUuid) => {
    try {
      const res = await requestWithAuth(`/api/auth/devices/${deviceUuid}/deactivate`, { method: 'POST' });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Deactivate failed: ${res.status} ${txt}`);
      }
      setDevices(devices.filter(device => device.device_uuid !== deviceUuid));
    } catch (err) {
      setError('Failed to deactivate device');
      console.error('Error deactivating device:', err);
    }
  };
 
  const replaceDevice = async () => {
    try {
      let deviceInfo = {};
     
      if (window.deviceManager) {
        deviceInfo = window.deviceManager.getDeviceInfo();
        console.log('Device Info:', deviceInfo);
      } else {
        // Fallback device info generation
        deviceInfo = {
          deviceUuid: generateFallbackUUID(),
          deviceType: detectDeviceTypeFallback(),
          fingerprint: {
            platform: navigator.platform || 'unknown',
            screen: `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
            language: navigator.language || 'unknown',
            userAgent: navigator.userAgent ?
              navigator.userAgent
                .replace(/\d+\.\d+\.\d+\.\d+/g, 'X.X.X.X')
                .replace(/\d+\.\d+\.\d+/g, 'X.X.X')
                .replace(/Chrome\/\d+/g, 'Chrome/X')
                .replace(/Safari\/\d+/g, 'Safari/X')
                .replace(/Firefox\/\d+/g, 'Firefox/X')
                .replace(/Edge\/\d+/g, 'Edge/X')
                .replace(/Version\/\d+/g, 'Version/X')
              : 'unknown'
          }
        };
        console.log('Fallback Device Info:', deviceInfo);
      }
     
      const res = await requestWithAuth('/api/devices/replace', {
        method: 'POST',
        body: JSON.stringify({
          old_device_uuid: selectedDevice.device_uuid,
          new_device_uuid: deviceInfo.deviceUuid,
          fingerprint: deviceInfo.fingerprint
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Replace failed: ${res.status} ${txt}`);
      }
 
      setShowReplaceModal(false);
      setSelectedDevice(null);
      fetchDevices();
    } catch (err) {
      setError('Failed to replace device');
      console.error('Error replacing device:', err);
    }
  };
 
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
 
  const getDeviceIcon = (deviceType) => {
    return deviceType === 'mobile' ? '📱' : '💻';
  };
 
  // Extract current device_uuid from stored JWT access token
  const getCurrentTokenDeviceUuid = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload?.device_uuid || null;
    } catch (e) {
      return null;
    }
  };
 
  const currentDeviceUuid = getCurrentTokenDeviceUuid();
 
  const currentDeviceType = detectDeviceTypeFallback();
 
  const getDeviceStatusColor = (device) => {
    if (!device.is_active) return 'text-gray-500';
    const lastUsed = new Date(device.last_used);
    const now = new Date();
    const daysDiff = (now - lastUsed) / (1000 * 60 * 60 * 24);
   
    if (daysDiff < 1) return 'text-green-600';
    if (daysDiff < 7) return 'text-yellow-600';
    return 'text-red-600';
  };
 
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }
 
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Device Management</h2>
          <p className="text-gray-600 mt-2">
            Registered devices for your account. Device changes are restricted for security.
          </p>
        </div>
 
        {error && (
          <div className="px-6 py-4 bg-red-50 border-l-4 border-red-400">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
 
        <div className="px-6 py-4">
          {devices.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">🔒</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No devices registered</h3>
              <p className="text-gray-600">
                Your devices will be automatically registered when you log in.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div
                  key={device.device_uuid}
                  className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${
                    device.device_type === currentDeviceType && !(currentDeviceUuid && device.device_uuid === currentDeviceUuid)
                      ? 'bg-blue-50 border-blue-200'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-3xl">
                        {getDeviceIcon(device.device_type)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {(device.device_type ? device.device_type.charAt(0).toUpperCase() + device.device_type.slice(1) : '')} Device
                          </h3>
                          {currentDeviceUuid && device.device_uuid === currentDeviceUuid && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 border border-green-200">This device</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Registered: {formatDate(device.created_at)}
                        </p>
                        <p className={`text-sm ${getDeviceStatusColor(device)}`}>
                          Last used: {formatDate(device.last_used)}
                        </p>
                        {device.device_type === currentDeviceType && !(currentDeviceUuid && device.device_uuid === currentDeviceUuid) && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">Active</span>
                        )}
                        {(device.os_name || device.browser_name) && (
                          <p className="text-sm text-gray-700">
                            {(device.os_name || '').toString()} {device.os_name && device.browser_name ? '·' : ''} {device.browser_name} {device.browser_version ? device.browser_version : ''}
                          </p>
                        )}
                        {device.ip_address && (
                          <p className="text-xs text-gray-500">
                            IP: {device.ip_address}
                          </p>
                        )}
                      </div>
                    </div>
                   
                    {/* Actions intentionally hidden: users cannot replace or remove devices from UI */}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
 
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <h4 className="font-medium mb-2">Device Security:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Only log in from devices you trust and regularly use.</li>
              <li>If you suspect unauthorized access, contact support to review devices.</li>
              <li>Your device information is encrypted and stored securely.</li>
            </ul>
          </div>
        </div>
      </div>
 
      {/* Replace/Remove actions disabled by policy */}
    </div>
  );
};
 
export default DeviceManagement;
 
 

