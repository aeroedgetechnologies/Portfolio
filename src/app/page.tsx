'use client'

import { useState } from 'react'
import Auth from '@/components/Auth'
import ChatRoom from '@/components/ChatRoom'
import AnimationsPlayground from '@/components/AnimationsPlayground'
import ThreeJSPlayground from '@/components/ThreeJSPlayground'

export default function Home() {
  const [user, setUser] = useState(null)
  const [currentView, setCurrentView] = useState<'auth' | 'chat' | 'animations' | '3d'>('auth')

  const handleLogin = (userData: any) => {
    setUser(userData)
    setCurrentView('chat')
  }

  const handleLogout = () => {
    setUser(null)
    setCurrentView('auth')
  }

  const renderView = () => {
    switch (currentView) {
      case 'auth':
        return <Auth onLogin={handleLogin} />
      case 'chat':
        return (
          <ChatRoom 
            user={user} 
            onLogout={handleLogout}
            onNavigateToAnimations={() => setCurrentView('animations')}
            onNavigateTo3D={() => setCurrentView('3d')}
          />
        )
      case 'animations':
        return (
          <AnimationsPlayground 
            onBack={() => setCurrentView('chat')}
          />
        )
      case '3d':
        return (
          <ThreeJSPlayground 
            onBack={() => setCurrentView('chat')}
          />
        )
      default:
        return <Auth onLogin={handleLogin} />
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {renderView()}
    </main>
  )
} 