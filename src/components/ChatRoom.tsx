import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import { Send, Paperclip, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

interface Message {
  id: string
  content: string
  senderId: string
  sender: { username: string }
  timestamp: Date
}

interface ChatRoomProps {
  onBack: () => void
}

export default function ChatRoom({ onBack }: ChatRoomProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [currentUser, setCurrentUser] = useState({ id: '1', username: 'User' })
  const [isConnected, setIsConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const newSocket = io('http://localhost:5001')
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setIsConnected(true)
      toast.success('Connected to chat!')
    })

    newSocket.on('message:receive', (message: Message) => {
      setMessages(prev => [...prev, message])
    })

    return () => newSocket.close()
  }, [])

  const handleSendMessage = () => {
    if (!messageInput.trim() || !socket) return

    const messageData = {
      content: messageInput.trim(),
      senderId: currentUser.id
    }

    socket.emit('message:send', messageData)
    setMessageInput('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-secondary-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-secondary-200 flex flex-col">
        <div className="p-4 border-b border-secondary-200">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-2 hover:bg-secondary-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
              <span className="text-white font-semibold">C</span>
            </div>
            <div>
              <h2 className="font-semibold">General Chat</h2>
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-secondary-500">{isConnected ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`chat-bubble ${message.senderId === currentUser.id ? 'chat-bubble-sent' : 'chat-bubble-received'}`}>
                <p>{message.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-secondary-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full p-3 border border-secondary-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={1}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="p-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 