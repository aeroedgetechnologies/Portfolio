// Configuration for different environments
// Check for Vercel deployment environment
const isVercel = process.env.VERCEL === '1'
const isDevelopment = process.env.NODE_ENV !== 'production' && !isVercel

export const config = {
  // API base URL - use Render backend in production/Vercel, localhost in development
  apiBaseUrl: isDevelopment ? 'http://localhost:5003' : 'https://forgetworries.onrender.com',
  
  // WebSocket URL - use Render backend in production/Vercel, localhost in development
  wsUrl: isDevelopment ? 'http://localhost:5003' : 'https://forgetworries.onrender.com',
  
  // Environment
  isDevelopment,
  isProduction: !isDevelopment,
  isVercel
} 