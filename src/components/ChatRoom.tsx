import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import { Send, Paperclip, ArrowLeft, Search, Users, MessageCircle, Smile, Image, File, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import EmojiPicker from 'emoji-picker-react'
import { config } from '../config'

interface Message {
  id: string
  content: string
  senderId: string
  receiverId: string
  sender: { 
    username: string
    avatar?: string
  }
  timestamp: Date
  type?: 'text' | 'file' | 'image' | 'gif'
  fileUrl?: string
  fileName?: string
  fileSize?: number
}

interface UserData {
  id: string
  username: string
  email: string
  avatar?: string
}

interface ChatRoomProps {
  onBack: () => void
  currentUser: UserData
}

export default function ChatRoom({ onBack, currentUser }: ChatRoomProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [users, setUsers] = useState<UserData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [isWindowFocused, setIsWindowFocused] = useState(true)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifSearch, setShowGifSearch] = useState(false)
  const [gifSearchQuery, setGifSearchQuery] = useState('')
  const [gifResults, setGifResults] = useState<any[]>([])
  const [isSearchingGifs, setIsSearchingGifs] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingProfile, setIsUploadingProfile] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState<{[key: string]: number}>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const profileInputRef = useRef<HTMLInputElement>(null)

  // Utility function to convert relative URLs to absolute URLs
  const getFullUrl = (url: string) => {
    if (!url) return url
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // If it's a relative URL, prepend the backend URL
    return `${config.apiBaseUrl}${url}`
  }

  // Function to recover files from database after server restart
  const recoverFiles = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${config.apiBaseUrl}/api/files/recover`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const { files } = await response.json()
        console.log('Recovered files from database:', files.length)
        // You can use this to restore file references if needed
        return files
      }
    } catch (error) {
      console.error('File recovery error:', error)
    }
    return []
  }

  // Create notification sound
  const playNotificationSound = () => {
    if (!notificationsEnabled) return
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)
      
      oscillator.frequency.setValueAtTime(800, audioContextRef.current.currentTime)
      oscillator.frequency.setValueAtTime(600, audioContextRef.current.currentTime + 0.1)
      oscillator.frequency.setValueAtTime(800, audioContextRef.current.currentTime + 0.2)
      
      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.3)
      
      oscillator.start(audioContextRef.current.currentTime)
      oscillator.stop(audioContextRef.current.currentTime + 0.3)
    } catch (error) {
      console.log('Audio notification failed:', error)
    }
  }

  // Show browser notification
  const showNotification = (title: string, body: string) => {
    if (!notificationsEnabled) return
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' })
    }
  }

  useEffect(() => {
    // Test backend connectivity
    const testBackendConnection = async () => {
      try {
        console.log('Testing backend connection to:', config.apiBaseUrl)
        
        // Test basic connectivity
        const testResponse = await fetch(`${config.apiBaseUrl}/api/test`)
        console.log('Backend test response:', testResponse.status, testResponse.ok)
        if (testResponse.ok) {
          const testData = await testResponse.json()
          console.log('Backend test data:', testData)
        }
        
        const response = await fetch(`${config.apiBaseUrl}/api/users`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        console.log('Users API response:', response.status, response.ok)
        if (!response.ok) {
          console.error('Backend connection failed:', response.status)
        }
      } catch (error) {
        console.error('Backend connection error:', error)
      }
    }
    
    testBackendConnection()
    
    // Recover files from database (useful after server restart)
    recoverFiles()
    
    // Request notification permission immediately
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setNotificationsEnabled(true)
          }
        })
      } else if (Notification.permission === 'granted') {
        setNotificationsEnabled(true)
      }
    }

    const newSocket = io(config.wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })
    
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setIsConnected(true)
      toast.success('Connected to chat!')
      // Join the chat room
      newSocket.emit('join', currentUser)
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
      toast.error('Disconnected from chat')
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      toast.error('Connection failed. Retrying...')
    })

    newSocket.on('message:receive', (newMessage: Message) => {
      console.log('Socket message:receive event triggered:', newMessage)
      console.log('Current messages count:', messages.length)
      
      // Ignore messages sent by the current user (they're already in local state)
      if (newMessage.senderId === currentUser.id) {
        console.log('Ignoring message sent by current user')
        return
      }
      
      // Check if this message is for the current user (either as sender or receiver)
      const isForCurrentUser = newMessage.senderId === currentUser.id || newMessage.receiverId === currentUser.id
      
      // Only add message if it's part of the current conversation
      if (selectedUser && 
          ((newMessage.senderId === currentUser.id && newMessage.receiverId === selectedUser.id) ||
           (newMessage.senderId === selectedUser.id && newMessage.receiverId === currentUser.id))) {
        
        // Check if message already exists to prevent duplicates
        setMessages(prev => {
          const messageExists = prev.some(msg => msg.id === newMessage.id)
          console.log('Message already exists:', messageExists, 'Message ID:', newMessage.id)
          
          if (!messageExists) {
            console.log('Adding new message to state')
            return [...prev, newMessage]
          } else {
            console.log('Skipping duplicate message')
            return prev
          }
        })
      }
      
      // Show notification for any message sent TO the current user (not from them)
      if (isForCurrentUser && newMessage.senderId !== currentUser.id) {
        // Track unread messages
        const senderId = newMessage.senderId
        setUnreadMessages(prev => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1
        }))
        
        // Show notification regardless of window focus (but only if not in the same conversation)
        const isInCurrentConversation = selectedUser && 
          ((newMessage.senderId === currentUser.id && newMessage.receiverId === selectedUser.id) ||
           (newMessage.senderId === selectedUser.id && newMessage.receiverId === currentUser.id))
        
        if (!isInCurrentConversation) {
          playNotificationSound()
          showNotification(
            `New message from ${newMessage.sender.username}`,
            newMessage.content.length > 50 ? newMessage.content.substring(0, 50) + '...' : newMessage.content
          )
          // Also show a toast notification for better visibility
          toast.success(`New message from ${newMessage.sender.username}!`, {
            duration: 3000,
            position: 'top-right'
          })
        } else {
          // If in current conversation, just play sound and show toast
          playNotificationSound()
          toast.success(`New message from ${newMessage.sender.username}!`, {
            duration: 2000,
            position: 'top-right'
          })
        }
        
        // Set new message indicator if window is not focused
        if (!isWindowFocused) {
          setHasNewMessages(true)
        }
      }
    })

    newSocket.on('user:joined', (userData: UserData) => {
      toast.success(`${userData.username} joined the chat!`)
      playNotificationSound()
    })

    newSocket.on('user:left', (userData: UserData) => {
      toast.success(`${userData.username} left the chat`)
    })

    newSocket.on('typing:start', (userData: UserData) => {
      // Handle typing indicator
      setTypingUsers(prev => {
        if (!prev.includes(userData.username)) {
          // Auto-clear typing indicator after 3 seconds
          setTimeout(() => {
            setTypingUsers(current => current.filter(username => username !== userData.username))
          }, 3000)
          return [...prev, userData.username]
        }
        return prev
      })
    })

    newSocket.on('typing:stop', (userData: UserData) => {
      // Handle typing stop
      setTypingUsers(prev => prev.filter(username => username !== userData.username))
    })

    return () => {
      newSocket.close()
    }
  }, [currentUser, notificationsEnabled, selectedUser])

  useEffect(() => {
    fetchMessages()
    fetchUsers()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // Clear new message indicator when scrolling to bottom
    if (hasNewMessages) {
      setHasNewMessages(false)
    }
  }, [messages, hasNewMessages])

  // Handle window focus/blur
  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true)
      setHasNewMessages(false)
    }
    
    const handleBlur = () => {
      setIsWindowFocused(false)
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      
      // Don't close if clicking on emoji or GIF buttons
      if (target.closest('button[title="Add emoji"]') || target.closest('button[title="Search GIFs"]')) {
        return
      }
      
      // Close if clicking outside emoji picker and GIF search
      if (!target.closest('.emoji-picker') && !target.closest('.gif-search')) {
        setShowEmojiPicker(false)
        setShowGifSearch(false)
      }
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('click', handleClickOutside)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (selectedUser) {
      fetchMessages()
    } else {
      setMessages([])
    }
  }, [selectedUser])

  const fetchMessages = async () => {
    if (!selectedUser) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${config.apiBaseUrl}/api/messages?receiverId=${selectedUser.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const messages = await response.json()
        setMessages(messages)
        // Clear unread count for this user
        setUnreadMessages(prev => {
          const newUnread = { ...prev }
          delete newUnread[selectedUser.id]
          return newUnread
        })
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast.error('Failed to load messages')
    }
  }

  const fetchUsers = async () => {
    setIsLoadingUsers(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${config.apiBaseUrl}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const users = await response.json()
        setUsers(users.filter((user: UserData) => user.id !== currentUser.id))
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const handleTyping = (isTyping: boolean) => {
    if (socket) {
      if (isTyping) {
        socket.emit('typing:start', currentUser)
      } else {
        socket.emit('typing:stop', currentUser)
      }
    }
  }

  const handleEmojiClick = (emojiObject: any) => {
    console.log('Emoji clicked:', emojiObject)
    setMessageInput(prev => prev + emojiObject.emoji)
    setShowEmojiPicker(false)
  }

  const searchGifs = async (query: string) => {
    if (!query.trim()) return
    
    setIsSearchingGifs(true)
    try {
      console.log('Searching GIFs for:', query)
      
      // Use GIPHY API key
      const giphyApiKey = 'NDteicumrzsd5MAYmWvLDIJSmCj7T2SC'
      
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&limit=12&rating=g`)
      
      console.log('GIF search response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('GIF search results:', data.data.length)
        setGifResults(data.data)
      } else {
        console.error('GIF search failed:', response.status)
        toast.error('Failed to search GIFs')
      }
    } catch (error) {
      console.error('GIF search error:', error)
      toast.error('Failed to search GIFs')
    } finally {
      setIsSearchingGifs(false)
    }
  }

  const handleGifSelect = (gif: any) => {
    try {
      console.log('GIF selected:', gif)
      const gifUrl = gif.images.original.url
      sendMessage(gifUrl, 'gif', undefined, undefined, gifUrl)
      setShowGifSearch(false)
      setGifSearchQuery('')
      toast.success('GIF sent!')
    } catch (error) {
      console.error('Error sending GIF:', error)
      toast.error('Failed to send GIF')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const token = localStorage.getItem('token')
      const response = await fetch(`${config.apiBaseUrl}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      if (response.ok) {
        const { fileUrl, fileName, fileSize } = await response.json()
        await sendMessage(fileUrl, file.type.startsWith('image/') ? 'image' : 'file', fileName, fileSize, fileUrl)
      } else {
        toast.error('Failed to upload file')
      }
    } catch (error) {
      console.error('File upload error:', error)
      toast.error('Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingProfile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const token = localStorage.getItem('token')
      console.log('Uploading profile picture to:', `${config.apiBaseUrl}/api/profile/upload`)
      console.log('Token exists:', !!token)
      console.log('File:', file.name, file.size, file.type)
      
      const response = await fetch(`${config.apiBaseUrl}/api/profile/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      console.log('Profile upload response status:', response.status)
      console.log('Profile upload response ok:', response.ok)
      
      if (response.ok) {
        const { avatar } = await response.json()
        console.log('Profile picture uploaded successfully:', avatar)
        // Update current user's avatar
        const updatedUser = { ...currentUser, avatar }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        toast.success('Profile picture updated!')
      } else {
        const errorText = await response.text()
        console.error('Profile upload failed:', response.status, errorText)
        toast.error(`Failed to upload profile picture: ${response.status}`)
      }
    } catch (error) {
      console.error('Profile upload error:', error)
      toast.error('Failed to upload profile picture')
    } finally {
      setIsUploadingProfile(false)
    }
  }

  const sendMessage = async (content: string, type: 'text' | 'file' | 'image' | 'gif' = 'text', fileName?: string, fileSize?: number, fileUrl?: string) => {
    if (!selectedUser || !content.trim()) return
    
    try {
      const token = localStorage.getItem('token')
      console.log('Sending message to:', `${config.apiBaseUrl}/api/messages`)
      console.log('Token exists:', !!token)
      console.log('Selected user:', selectedUser)
      
      const response = await fetch(`${config.apiBaseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          type,
          receiverId: selectedUser.id,
          fileName,
          fileSize,
          fileUrl
        })
      })
      
      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      
      if (response.ok) {
        const newMessage = await response.json()
        console.log('Message sent successfully:', newMessage)
        // Add message to sender's state immediately
        setMessages(prev => [...prev, newMessage])
        setMessageInput('')
        setShowEmojiPicker(false)
        setShowGifSearch(false)
      } else {
        const errorText = await response.text()
        console.error('Send message failed:', response.status, errorText)
        toast.error(`Failed to send message: ${response.status}`)
      }
    } catch (error) {
      console.error('Send message error:', error)
      toast.error('Failed to send message')
    }
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return
    await sendMessage(messageInput.trim(), 'text')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleUserSelect = (user: UserData) => {
    setSelectedUser(user)
    setShowMobileMenu(false)
    // Clear unread messages for this user
    setUnreadMessages(prev => {
      const newUnread = { ...prev }
      delete newUnread[user.id]
      return newUnread
    })
  }

  return (
    <div className="flex flex-col h-screen bg-secondary-50 md:flex-row">
      {/* Sidebar - Hidden on mobile, shown on desktop */}
      <div className="hidden md:flex md:w-80 bg-white border-r border-secondary-200 flex-col">
        <div className="p-4 border-b border-secondary-200">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-2 hover:bg-secondary-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative group">
              {currentUser.avatar ? (
                <img 
                  src={getFullUrl(currentUser.avatar)} 
                  alt={currentUser.username}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center ${currentUser.avatar ? 'hidden' : ''}`}>
                <span className="text-white font-semibold">{currentUser.username[0].toUpperCase()}</span>
              </div>
              <button
                onClick={() => profileInputRef.current?.click()}
                disabled={isUploadingProfile}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600 disabled:opacity-50"
                title="Change profile picture"
              >
                {isUploadingProfile ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Camera className="w-3 h-3" />
                )}
              </button>
              <input
                ref={profileInputRef}
                type="file"
                onChange={handleProfilePictureUpload}
                className="hidden"
                accept="image/*"
              />
            </div>
            <div>
              <h2 className="font-semibold">{currentUser.username}</h2>
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-secondary-500">
                  {isConnected ? 'Online' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
          {!isConnected && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-700">Reconnecting to server...</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-secondary-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-secondary-600 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Users ({filteredUsers.length})
            </h3>
            
            {isLoadingUsers ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <motion.div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUser?.id === user.id 
                        ? 'bg-primary-100 border border-primary-300' 
                        : 'hover:bg-secondary-50'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center space-x-3">
                      {user.avatar ? (
                        <img 
                          src={getFullUrl(user.avatar)} 
                          alt={user.username}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center ${user.avatar ? 'hidden' : ''}`}>
                        <span className="text-white text-sm font-semibold">
                          {user.username[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user.username}</p>
                        <p className="text-xs text-secondary-500 truncate">{user.email}</p>
                      </div>
                      {unreadMessages[user.id] > 0 && (
                        <div className="flex-shrink-0">
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                            {unreadMessages[user.id]}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Header - Only visible on mobile */}
      <div className="md:hidden bg-white border-b border-secondary-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-2 hover:bg-secondary-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative group">
              {currentUser.avatar ? (
                <img 
                  src={getFullUrl(currentUser.avatar)} 
                  alt={currentUser.username}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center ${currentUser.avatar ? 'hidden' : ''}`}>
                <span className="text-white text-sm font-semibold">{currentUser.username[0].toUpperCase()}</span>
              </div>
              <button
                onClick={() => profileInputRef.current?.click()}
                disabled={isUploadingProfile}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600 disabled:opacity-50"
                title="Change profile picture"
              >
                {isUploadingProfile ? (
                  <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Camera className="w-2 h-2" />
                )}
              </button>
            </div>
            <div>
              <h2 className="font-semibold text-sm">{currentUser.username}</h2>
              <div className="flex items-center space-x-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-secondary-500">
                  {isConnected ? 'Online' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 hover:bg-secondary-100 rounded-lg relative"
          >
            <Users className="w-5 h-5" />
            {Object.values(unreadMessages).reduce((sum, count) => sum + count, 0) > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                {Object.values(unreadMessages).reduce((sum, count) => sum + count, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Users Menu */}
      {showMobileMenu && (
        <div className="md:hidden bg-white border-b border-secondary-200 p-4">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-secondary-600 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Users ({filteredUsers.length})
              </h3>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <span className="text-lg">×</span>
              </button>
            </div>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {filteredUsers.map((user) => (
              <motion.div
                key={user.id}
                onClick={() => handleUserSelect(user)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedUser?.id === user.id 
                    ? 'bg-primary-100 border border-primary-300' 
                    : 'hover:bg-secondary-50'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center space-x-3">
                  {user.avatar ? (
                    <img 
                      src={getFullUrl(user.avatar)} 
                      alt={user.username}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center ${user.avatar ? 'hidden' : ''}`}>
                    <span className="text-white text-sm font-semibold">
                      {user.username[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.username}</p>
                    <p className="text-xs text-secondary-500 truncate">{user.email}</p>
                  </div>
                  {unreadMessages[user.id] > 0 && (
                    <div className="flex-shrink-0">
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                        {unreadMessages[user.id]}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-secondary-200 p-4">
          {selectedUser ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {selectedUser.avatar ? (
                  <img 
                    src={getFullUrl(selectedUser.avatar)} 
                    alt={selectedUser.username}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : null}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center ${selectedUser.avatar ? 'hidden' : ''}`}>
                  <span className="text-white font-semibold">
                    {selectedUser.username[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold">{selectedUser.username}</h3>
                  <p className="text-sm text-secondary-500">{selectedUser.email}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-secondary-600 mb-1">Select a user to start chatting</h3>
              <p className="text-sm text-secondary-500">Choose someone from the list to begin your conversation</p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedUser ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-r from-primary-100 to-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-secondary-600 mb-2">No conversation selected</h3>
              <p className="text-secondary-500">Select a user from the list to start chatting!</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-r from-primary-100 to-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-secondary-600 mb-2">Start the conversation!</h3>
              <p className="text-secondary-500">Send your first message to {selectedUser.username}</p>
            </div>
          ) : (
            messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.senderId === currentUser.id ? 'justify-end' : 'justify-start'} mb-4`}
              >
                <div className={`flex items-end space-x-2 max-w-[85%] sm:max-w-xs lg:max-w-md ${message.senderId === currentUser.id ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {/* Profile Picture */}
                  {message.senderId !== currentUser.id && (
                    <div className="flex-shrink-0">
                      {message.sender.avatar ? (
                        <img 
                          src={getFullUrl(message.sender.avatar)} 
                          alt={message.sender.username}
                          className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center ${message.sender.avatar ? 'hidden' : ''}`}>
                        <span className="text-white text-xs font-semibold">
                          {message.sender.username[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col">
                    {message.senderId !== currentUser.id && (
                      <p className="text-xs text-secondary-500 mb-1">{message.sender.username}</p>
                    )}
                    <div className={`chat-bubble ${message.senderId === currentUser.id ? 'chat-bubble-sent' : 'chat-bubble-received'}`}>
                      {message.type === 'image' && (
                        <div className="mb-2">
                          <img 
                            src={getFullUrl(message.fileUrl || message.content)} 
                            alt="Shared image" 
                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(getFullUrl(message.fileUrl || message.content), '_blank')}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                          <div className="hidden p-4 bg-gray-100 rounded-lg text-center">
                            <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Image not available</p>
                            <p className="text-xs text-gray-400">File may have been removed after server restart</p>
                          </div>
                        </div>
                      )}
                      
                      {message.type === 'gif' && (
                        <div className="mb-2">
                          <img 
                            src={getFullUrl(message.fileUrl || message.content)} 
                            alt="GIF" 
                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(getFullUrl(message.fileUrl || message.content), '_blank')}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                          <div className="hidden p-4 bg-gray-100 rounded-lg text-center">
                            <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">GIF not available</p>
                            <p className="text-xs text-gray-400">File may have been removed after server restart</p>
                          </div>
                        </div>
                      )}
                      
                      {message.type === 'file' && (
                        <div className="mb-2 p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center space-x-2">
                            <File className="w-5 h-5 text-blue-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{message.fileName}</p>
                              <p className="text-xs text-gray-500">
                                {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)} KB` : ''}
                              </p>
                            </div>
                          </div>
                          <a 
                            href={getFullUrl(message.fileUrl || message.content)} 
                            download={message.fileName}
                            className="mt-2 inline-block text-sm text-blue-500 hover:text-blue-600"
                          >
                            Download
                          </a>
                        </div>
                      )}
                      
                      {message.type === 'text' && (
                        <p className="text-sm">{message.content}</p>
                      )}
                      
                      <span className="text-xs opacity-70 mt-1 block">
                        {new Date(message.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          
          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="chat-bubble chat-bubble-received">
                <div className="flex items-center space-x-1">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs text-gray-500 ml-2">
                    {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* New Messages Indicator */}
          {hasNewMessages && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center"
            >
              <div className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                New messages! Scroll to see them
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-secondary-200 p-3 sm:p-4 relative">
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-3 sm:left-4 mb-2 z-50 emoji-picker bg-white border rounded-lg shadow-lg p-4">
              <div className="mb-2 text-sm font-medium">Emoji Picker</div>
              <div className="grid grid-cols-8 gap-1">
                {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰'].map((emoji, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      console.log('Emoji clicked:', emoji)
                      setMessageInput(prev => prev + emoji)
                      setShowEmojiPicker(false)
                    }}
                    className="p-2 hover:bg-gray-100 rounded text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-500">Simple emoji picker for testing</div>
            </div>
          )}
          
          {/* GIF Search */}
          {showGifSearch && (
            <div className="absolute bottom-full left-3 sm:left-4 mb-2 z-50 bg-white border rounded-lg shadow-lg p-4 w-72 sm:w-80 gif-search">
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search GIFs..."
                  value={gifSearchQuery}
                  onChange={(e) => setGifSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchGifs(gifSearchQuery)}
                  className="w-full p-2 border rounded"
                />
                <button
                  onClick={() => searchGifs(gifSearchQuery)}
                  className="mt-2 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                  disabled={isSearchingGifs}
                >
                  {isSearchingGifs ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Searching...
                    </div>
                  ) : (
                    'Search'
                  )}
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto grid grid-cols-2 gap-2">
                {gifResults.map((gif) => (
                  <img
                    key={gif.id}
                    src={gif.images.fixed_height_small.url}
                    alt={gif.title}
                    className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80"
                    onClick={() => handleGifSelect(gif)}
                  />
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={() => {
                  console.log('Emoji button clicked, current state:', showEmojiPicker)
                  setShowEmojiPicker(!showEmojiPicker)
                  setShowGifSearch(false) // Close GIF search when opening emoji picker
                }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Add emoji"
              >
                <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              <button
                onClick={() => {
                  console.log('GIF button clicked, current state:', showGifSearch)
                  setShowGifSearch(!showGifSearch)
                  setShowEmojiPicker(false) // Close emoji picker when opening GIF search
                }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Search GIFs"
              >
                <Image className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Upload file"
              >
                {isUploading ? (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                ) : (
                  <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
              />
            </div>
            
            <div className="flex-1">
              <textarea
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value)
                  handleTyping(e.target.value.length > 0)
                }}
                onKeyPress={handleKeyPress}
                onBlur={() => handleTyping(false)}
                placeholder={selectedUser ? `Message ${selectedUser.username}...` : 'Select a user to start chatting...'}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                disabled={!selectedUser}
              />
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || !selectedUser}
              className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Send message"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}