import { useState } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { MessageCircle, Users, Zap, Sparkles, ArrowRight, Play } from 'lucide-react'
import ChatRoom from './components/ChatRoom'
import AnimationsPlayground from './components/AnimationsPlayground'
import ThreeJSPlayground from './components/ThreeJSPlayground'
import { Toaster } from 'react-hot-toast'

type Page = 'home' | 'chat' | 'animations' | '3d'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  const features = [
    {
      icon: MessageCircle,
      title: 'Real-time Chat',
      description: 'Instant messaging with typing indicators'
    },
    {
      icon: Users,
      title: 'Millions of Users',
      description: 'Scalable architecture for massive user bases'
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

  if (currentPage === 'chat') {
    return <ChatRoom onBack={() => setCurrentPage('home')} />
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
            
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
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
            </motion.div>
          </div>
        </div>
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
            <span className="gradient-text">Lightning Fast</span>
            <br />
            Chat Experience
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
            © 2024 FastChat. Built with Vite, React, and Socket.IO.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App 