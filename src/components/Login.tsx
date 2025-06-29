import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, User, Globe } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { config } from '../config'

// Google OAuth types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: () => void
        }
      }
    }
  }
}

interface LoginProps {
  onLogin: (userData: any) => void
  onSwitchToRegister: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  })
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    general: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  // Wait for Google OAuth to be available
  const waitForGoogle = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      let attempts = 0
      const maxAttempts = 50 // 5 seconds max wait
      
      const checkGoogle = () => {
        attempts++
        if (window.google && window.google.accounts && window.google.accounts.id) {
          console.log('Google OAuth available after', attempts * 100, 'ms')
          resolve(window.google)
        } else if (attempts >= maxAttempts) {
          reject(new Error('Google OAuth not available after 5 seconds'))
        } else {
          setTimeout(checkGoogle, 100)
        }
      }
      
      checkGoogle()
    })
  }

  // Load Google OAuth script
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      console.log('Google OAuth script loaded')
    }
    script.onerror = () => {
      console.error('Failed to load Google OAuth script')
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup script if component unmounts
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [])

  // Clear errors when form data changes
  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    // Clear field-specific error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors({ ...errors, [field]: '' })
    }
  }

  // Validate form before submission
  const validateForm = () => {
    const newErrors = { email: '', password: '', general: '' }
    let isValid = true

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required'
      isValid = false
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
      isValid = false
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
      isValid = false
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrors({ email: '', password: '', general: '' }) // Clear previous errors

    if (!validateForm()) {
      setIsLoading(false)
      return
    }

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        onLogin(data.user)
        toast.success(isLogin ? 'Login successful!' : 'Registration successful!')
      } else {
        // Handle specific error messages from backend
        if (data.message === 'User not found') {
          setErrors({ ...errors, email: 'No account found with this email address' })
          toast.error('No account found with this email address')
        } else if (data.message === 'Invalid password') {
          setErrors({ ...errors, password: 'Incorrect password' })
          toast.error('Incorrect password')
        } else if (data.message === 'User already exists') {
          setErrors({ ...errors, email: 'An account with this email already exists' })
          toast.error('An account with this email already exists')
        } else {
          setErrors({ ...errors, general: data.message || 'Authentication failed' })
          toast.error(data.message || 'Authentication failed')
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      setErrors({ ...errors, general: 'Network error. Please check your connection.' })
      toast.error('Network error. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    try {
      console.log('Starting Google OAuth login...')
      console.log('Window google object:', window.google)
      console.log('Google accounts:', window.google?.accounts)
      console.log('Google accounts id:', window.google?.accounts?.id)
      
      // Try to wait for Google OAuth
      try {
        const google = await waitForGoogle()
        console.log('Google OAuth library loaded, initializing...')
        
        google.accounts.id.initialize({
          client_id: '608696852958-egnf941du33oe5cnjp7gc1vhfth7c6pi.apps.googleusercontent.com',
          callback: async (response: any) => {
            try {
              console.log('Google OAuth response received')
              const result = await fetch(`${config.apiBaseUrl}/api/auth/google`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: response.credential }),
              })

              console.log('Google auth response status:', result.status)
              const data = await result.json()
              console.log('Google auth response data:', data)

              if (result.ok) {
                localStorage.setItem('token', data.token)
                localStorage.setItem('user', JSON.stringify(data.user))
                onLogin(data.user)
                toast.success('Google login successful!')
              } else {
                toast.error(data.message || 'Google authentication failed')
              }
            } catch (error) {
              console.error('Google auth error:', error)
              toast.error('Google authentication error')
            } finally {
              setIsGoogleLoading(false)
            }
          }
        })

        console.log('Prompting Google OAuth...')
        google.accounts.id.prompt()
      } catch (waitError) {
        console.log('Google OAuth wait failed, trying direct approach...')
        
        // Direct approach - try to use Google OAuth if available
        if (window.google && window.google.accounts && window.google.accounts.id) {
          console.log('Google OAuth available directly, initializing...')
          
          const google = window.google as any
          
          google.accounts.id.initialize({
            client_id: '608696852958-egnf941du33oe5cnjp7gc1vhfth7c6pi.apps.googleusercontent.com',
            callback: async (response: any) => {
              try {
                console.log('Google OAuth response received (direct)')
                const result = await fetch(`${config.apiBaseUrl}/api/auth/google`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ token: response.credential }),
                })

                console.log('Google auth response status:', result.status)
                const data = await result.json()
                console.log('Google auth response data:', data)

                if (result.ok) {
                  localStorage.setItem('token', data.token)
                  localStorage.setItem('user', JSON.stringify(data.user))
                  onLogin(data.user)
                  toast.success('Google login successful!')
                } else {
                  toast.error(data.message || 'Google authentication failed')
                }
              } catch (error) {
                console.error('Google auth error:', error)
                toast.error('Google authentication error')
              } finally {
                setIsGoogleLoading(false)
              }
            }
          })

          console.log('Prompting Google OAuth (direct)...')
          google.accounts.id.prompt()
        } else {
          console.log('Google OAuth not available, using redirect...')
          // Fallback: redirect to Google OAuth
          const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=608696852958-egnf941du33oe5cnjp7gc1vhfth7c6pi.apps.googleusercontent.com&redirect_uri=${encodeURIComponent('http://govindayadavfolio.vercel.app/auth/google/callback')}&response_type=code&scope=email profile&access_type=offline`
          window.location.href = googleAuthUrl
        }
      }
    } catch (error) {
      console.error('Google login error:', error)
      toast.error('Google login failed')
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-gray-600">
              {isLogin ? 'Sign in to continue chatting' : 'Join our community'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your username"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email"
                  required
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
              {!errors.password && !isLogin && (
                <p className="mt-1 text-xs text-gray-500">Password must be at least 6 characters long</p>
              )}
            </div>

            {/* General error message */}
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="mt-4 w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Globe className="w-5 h-5" />
              <span>{isGoogleLoading ? 'Loading...' : 'Continue with Google'}</span>
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
} 