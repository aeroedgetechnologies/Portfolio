import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Users, Zap, Sparkles, ArrowRight, Play, LogOut, User, Menu } from 'lucide-react'
import ChatRoom from './components/ChatRoom'
import AnimationsPlayground from './components/AnimationsPlayground'
import ThreeJSPlayground from './components/ThreeJSPlayground'
import Auth from './components/Auth'
import { Toaster } from 'react-hot-toast'

type Page = 'auth' | 'home' | 'chat' | 'animations' | '3d'

interface UserData {
  id: string
  username: string
  email: string
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('auth')
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
        setCurrentPage('home')
      } catch (error) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setIsLoading(false)
  }, [])

  const handleLogin = (userData: UserData) => {
    setUser(userData)
    setCurrentPage('home')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setCurrentPage('auth')
  }

  const features = [
    {
      icon: MessageCircle,
      title: 'Real-time Chat',
      description: 'Instant messaging with typing indicators'
    },
    {
      icon: Users,
      title: 'User Search',
      description: 'Find and chat with other users'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Optimized with Vite and WebSockets'
    },
    {
      icon: Sparkles,
      title: 'Beautiful Animations',
      description: 'GSAP and Three.js powered experiences'
    }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth onLogin={handleLogin} />
  }

  if (currentPage === 'chat') {
    return (
      <ChatRoom 
        onBack={() => setCurrentPage('home')} 
        currentUser={user}
        onNavigateToPlayground={() => setCurrentPage('animations')}
        onNavigateTo3D={() => setCurrentPage('3d')}
        onLogout={handleLogout}
      />
    )
  }

  if (currentPage === 'animations') {
    return <AnimationsPlayground onBack={() => setCurrentPage('home')} />
  }

  if (currentPage === '3d') {
    return <ThreeJSPlayground onBack={() => setCurrentPage('home')} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <Toaster position="top-right" />
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-effect">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div 
              className="flex items-center space-x-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold gradient-text">FastChat</span>
            </motion.div>
            
            {/* Desktop Navigation */}
            <motion.div 
              className="hidden md:flex items-center space-x-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{user.username}</span>
              </div>
              <button 
                onClick={() => setCurrentPage('chat')}
                className="text-secondary-600 hover:text-primary-500 transition-colors"
              >
                Chat
              </button>
              <button 
                onClick={() => setCurrentPage('animations')}
                className="text-secondary-600 hover:text-primary-500 transition-colors"
              >
                Animations
              </button>
              <button 
                onClick={() => setCurrentPage('3d')}
                className="text-secondary-600 hover:text-primary-500 transition-colors"
              >
                3D Playground
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center space-x-1 text-red-600 hover:text-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </motion.div>

            {/* Mobile Hamburger Menu */}
            <div className="md:hidden flex items-center space-x-2">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user.username}</span>
              </div>
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className={`p-2 rounded-lg transition-colors ${
                  showMobileMenu ? 'bg-primary-100 text-primary-600' : 'hover:bg-secondary-100'
                }`}
              >
                {/* Hamburger Menu Icon */}
                <div className="w-5 h-5 flex flex-col justify-center items-center space-y-0.5">
                  <div className={`w-4 h-0.5 bg-current transition-all duration-300 ${
                    showMobileMenu ? 'rotate-45 translate-y-1.5' : ''
                  }`}></div>
                  <div className={`w-4 h-0.5 bg-current transition-all duration-300 ${
                    showMobileMenu ? 'opacity-0' : ''
                  }`}></div>
                  <div className={`w-4 h-0.5 bg-current transition-all duration-300 ${
                    showMobileMenu ? '-rotate-45 -translate-y-1.5' : ''
                  }`}></div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <motion.div 
            className="md:hidden bg-white border-t border-secondary-200 shadow-lg"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="px-4 py-3 space-y-2">
              <button
                onClick={() => {
                  setCurrentPage('chat')
                  setShowMobileMenu(false)
                }}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">Chat</p>
                  <p className="text-xs text-secondary-500">Start messaging</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setCurrentPage('animations')
                  setShowMobileMenu(false)
                }}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <Play className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">Animations Playground</p>
                  <p className="text-xs text-secondary-500">Interactive animations</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setCurrentPage('3d')
                  setShowMobileMenu(false)
                }}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">3D Playground</p>
                  <p className="text-xs text-secondary-500">Three.js experiences</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  handleLogout()
                  setShowMobileMenu(false)
                }}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm text-red-600">Logout</p>
                  <p className="text-xs text-red-500">Sign out of your account</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1 
            className="text-5xl md:text-7xl font-bold mb-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="gradient-text">Welcome back,</span>
            <br />
            {user.username}!
          </motion.h1>
          
          <motion.p 
            className="text-xl md:text-2xl text-secondary-600 mb-8 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Experience real-time messaging with stunning animations, 3D interactions, 
            and a scalable architecture designed for millions of users.
          </motion.p>
          
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <button
              onClick={() => setCurrentPage('chat')}
              className="group bg-primary-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-600 transition-all duration-300 transform hover:scale-105 flex items-center space-x-2"
            >
              <span>Start Chatting</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button
              onClick={() => setCurrentPage('animations')}
              className="group bg-white text-primary-500 border-2 border-primary-500 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-50 transition-all duration-300 transform hover:scale-105 flex items-center space-x-2"
            >
              <Play className="w-5 h-5" />
              <span>Try Animations</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-secondary-900 mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
              Everything you need for a modern chat experience
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 border border-primary-100 hover:shadow-lg transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-secondary-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary-500 to-accent-500">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 
            className="text-4xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            Ready to Experience the Future of Chat?
          </motion.h2>
          
          <motion.p 
            className="text-xl text-primary-100 mb-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Join millions of users and discover the power of real-time messaging with stunning animations.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <button
              onClick={() => setCurrentPage('chat')}
              className="inline-block bg-white text-primary-500 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
            >
              Get Started Now
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-secondary-900 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-secondary-400">
            © 2024 FastChat. Built with ❤️ by Govinda Yadav
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App 