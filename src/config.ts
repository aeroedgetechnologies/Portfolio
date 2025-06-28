// Configuration for different environments
// In production, Vercel will set NODE_ENV to 'production'
const isDevelopment = process.env.NODE_ENV !== 'production'

export const config = {
  // API base URL - use Render backend in production, localhost in development
  apiBaseUrl: isDevelopment ? 'http://localhost:5003' : 'https://forgetworries.onrender.com',
  
  // WebSocket URL - use Render backend in production, localhost in development
  wsUrl: isDevelopment ? 'http://localhost:5003' : 'https://forgetworries.onrender.com',
  
  // Environment
  isDevelopment,
  isProduction: !isDevelopment
} 