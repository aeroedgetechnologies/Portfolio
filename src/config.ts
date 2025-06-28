// Configuration for different environments
// Hardcoded backend URL to ensure it always points to Render
export const config = {
  // API base URL - always use Render backend
  apiBaseUrl: 'https://forgetworries.onrender.com',
  
  // WebSocket URL - always use Render backend
  wsUrl: 'https://forgetworries.onrender.com',
  
  // Environment flags for other features
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  isVercel: process.env.VERCEL === '1'
} 