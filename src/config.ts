// Configuration for different environments
export const config = {
  // API base URL - detect environment and use appropriate backend
  apiBaseUrl: (() => {
    // Check if we're on Vercel
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      return 'https://forgetworries.onrender.com'
    }
    // Check if we're in development
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:5003'
    }
    // Production fallback
    return 'https://forgetworries.onrender.com'
  })(),
  
  // WebSocket URL - detect environment and use appropriate backend
  wsUrl: (() => {
    // Check if we're on Vercel
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      return 'https://forgetworries.onrender.com'
    }
    // Check if we're in development
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:5003'
    }
    // Production fallback
    return 'https://forgetworries.onrender.com'
  })(),
  
  // Environment flags for other features
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  isVercel: process.env.VERCEL === '1'
} 