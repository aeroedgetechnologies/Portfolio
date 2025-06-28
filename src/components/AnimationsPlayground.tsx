import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, ArrowLeft, Sparkles, Heart, Zap, Star, Target } from 'lucide-react'
import { gsap } from 'gsap'

interface AnimationsPlaygroundProps {
  onBack: () => void
}

export default function AnimationsPlayground({ onBack }: AnimationsPlaygroundProps) {
  const [activeAnimation, setActiveAnimation] = useState('bounce')
  const [isPlaying, setIsPlaying] = useState(false)
  const animationRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  const animations = [
    { id: 'bounce', name: 'Bounce Effect', icon: Sparkles },
    { id: 'pulse', name: 'Pulse Wave', icon: Heart },
    { id: 'shake', name: 'Shake Effect', icon: Zap },
    { id: 'rotate', name: '3D Rotate', icon: Star },
    { id: 'morph', name: 'Morphing', icon: Target },
  ]

  const playAnimation = (animationId: string) => {
    const element = animationRefs.current[animationId]
    if (!element) return

    setIsPlaying(true)
    setActiveAnimation(animationId)

    // Reset all animations
    gsap.set(animationRefs.current, { clearProps: 'all' })

    switch (animationId) {
      case 'bounce':
        gsap.to(element, {
          y: -100,
          duration: 0.6,
          ease: 'bounce.out',
          yoyo: true,
          repeat: 2,
          onComplete: () => setIsPlaying(false)
        })
        break

      case 'pulse':
        gsap.to(element, {
          scale: 1.5,
          duration: 0.5,
          ease: 'power2.inOut',
          yoyo: true,
          repeat: 3,
          onComplete: () => setIsPlaying(false)
        })
        break

      case 'shake':
        gsap.to(element, {
          x: 20,
          duration: 0.1,
          ease: 'power2.inOut',
          yoyo: true,
          repeat: 10,
          onComplete: () => setIsPlaying(false)
        })
        break

      case 'rotate':
        gsap.to(element, {
          rotation: 360,
          scale: 1.2,
          duration: 1,
          ease: 'power2.inOut',
          yoyo: true,
          repeat: 1,
          onComplete: () => setIsPlaying(false)
        })
        break

      case 'morph':
        gsap.to(element, {
          borderRadius: '50%',
          scale: 0.8,
          duration: 0.8,
          ease: 'power2.inOut',
          yoyo: true,
          repeat: 1,
          onComplete: () => setIsPlaying(false)
        })
        break
    }
  }

  const resetAnimations = () => {
    gsap.set(animationRefs.current, { clearProps: 'all' })
    setIsPlaying(false)
  }

  useEffect(() => {
    // Auto-play first animation
    setTimeout(() => playAnimation('bounce'), 1000)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="absolute top-6 left-6 z-10">
        <button 
          onClick={onBack}
          className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      </div>

      <div className="absolute top-6 right-6 z-10">
        <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
          <h1 className="text-xl font-bold gradient-text">GSAP Animations</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        {/* Animation Display Area */}
        <div className="relative w-96 h-96 bg-white/20 backdrop-blur-sm rounded-2xl shadow-2xl mb-8 flex items-center justify-center">
          {animations.map((animation) => (
            <div
              key={animation.id}
              ref={(el) => (animationRefs.current[animation.id] = el)}
              className={`absolute w-24 h-24 rounded-xl shadow-lg flex items-center justify-center text-white font-bold text-lg cursor-pointer transition-all ${
                activeAnimation === animation.id 
                  ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                  : 'bg-gradient-to-br from-gray-400 to-gray-600'
              }`}
              onClick={() => !isPlaying && playAnimation(animation.id)}
            >
              <animation.icon className="w-8 h-8" />
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold gradient-text">Animation Controls</h2>
            <div className="flex space-x-2">
              <button
                onClick={resetAnimations}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {animations.map((animation) => (
              <button
                key={animation.id}
                onClick={() => !isPlaying && playAnimation(animation.id)}
                disabled={isPlaying}
                className={`flex items-center space-x-3 p-4 rounded-xl transition-all ${
                  activeAnimation === animation.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                } ${isPlaying ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
              >
                <animation.icon className="w-5 h-5" />
                <span className="font-medium">{animation.name}</span>
                {activeAnimation === animation.id && isPlaying && (
                  <div className="ml-auto">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Animation Info */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
            <h3 className="font-semibold mb-2">Animation Details</h3>
            <p className="text-sm text-gray-600">
              Click on any animation button to see it in action. Each animation uses GSAP for smooth, 
              performant animations with easing functions and precise timing control.
            </p>
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
    </div>
  )
} 