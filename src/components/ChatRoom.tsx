import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import { Send, Paperclip, ArrowLeft, Search, Users, MessageCircle, Smile, Image, File, Camera, Play, Sparkles, LogOut, Edit } from 'lucide-react'
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
  type?: 'text' | 'file' | 'image' | 'video' | 'audio' | 'gif'
  fileUrl?: string
  fileName?: string
  fileSize?: number
  isVideo?: boolean
  isAudio?: boolean
}

interface UserData {
  id: string
  username: string
  email: string
  avatar?: string
}

interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: Date
  sender?: UserData
  receiver?: UserData
}

interface ChatRoomProps {
  onBack: () => void
  currentUser: UserData
  onNavigateToPlayground?: () => void
  onNavigateTo3D?: () => void
  onLogout?: () => void
}

export default function ChatRoom({ onBack, currentUser, onNavigateToPlayground, onNavigateTo3D, onLogout }: ChatRoomProps) {
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
  const [localCurrentUser, setLocalCurrentUser] = useState<UserData>(currentUser)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [isChangingUsername, setIsChangingUsername] = useState(false)
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [showFriendRequestsSection, setShowFriendRequestsSection] = useState(true)
  const [friendStatus, setFriendStatus] = useState<{[key: string]: 'none' | 'pending' | 'sent' | 'friends'}>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const profileInputRef = useRef<HTMLInputElement>(null)

  // Utility function to convert relative URLs to absolute URLs
  const getFullUrl = (url: string) => {
    if (!url) return url
    // If it's already a data URL, return as is
    if (url.startsWith('data:')) {
      return url
    }
    // If it's already an absolute URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // If it's a relative URL, prepend the backend URL
    return `${config.apiBaseUrl}${url}`
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

    // Friend request notifications
    newSocket.on('friend-request:received', (request: FriendRequest) => {
      console.log('Friend request received:', request)
      
      // Only show this notification and add to list if YOU are the receiver
      if (request.receiverId === currentUser.id) {
        toast.success(`Friend request from ${request.sender?.username || 'Unknown User'}!`, {
          duration: 5000,
          position: 'top-right'
        })
        playNotificationSound()
        // Show the friend requests section if it's hidden
        setShowFriendRequestsSection(true)
        // Immediately add the new request to the list (prevent duplicates)
        setFriendRequests(prev => {
          const exists = prev.some(req => req.id === request.id || 
            (req.senderId === request.senderId && req.receiverId === request.receiverId))
          if (!exists) {
            return [...prev, request]
          }
          return prev
        })
      }
    })

    newSocket.on('friend-request:accepted', (request: FriendRequest) => {
      console.log('Friend request accepted:', request)
      
      // If YOU are the sender and someone accepted your request
      if (request.senderId === currentUser.id) {
        toast.success(`Friend request accepted by ${request.receiver?.username || 'Unknown User'}!`, {
          duration: 3000,
          position: 'top-right'
        })
        // Update friend status immediately
        setFriendStatus(prev => ({ ...prev, [request.receiverId]: 'friends' }))
        // Remove from sent requests list
        setSentRequests(prev => prev.filter(req => req.id !== request.id))
      }
      // If YOU are the receiver and you accepted someone's request
      else if (request.receiverId === currentUser.id) {
        toast.success('Friend request accepted!')
        // Update friend status immediately
        setFriendStatus(prev => ({ ...prev, [request.senderId]: 'friends' }))
        // Remove from friend requests list
        setFriendRequests(prev => prev.filter(req => req.id !== request.id))
      }
    })

    newSocket.on('friend-request:declined', (request: FriendRequest) => {
      console.log('Friend request declined:', request)
      
      // If YOU are the sender and someone declined your request
      if (request.senderId === currentUser.id) {
        toast.error(`Friend request declined by ${request.receiver?.username || 'Unknown User'}`, {
          duration: 3000,
          position: 'top-right'
        })
        // Update friend status immediately
        setFriendStatus(prev => ({ ...prev, [request.receiverId]: 'none' }))
        // Remove from sent requests list
        setSentRequests(prev => prev.filter(req => req.id !== request.id))
      }
      // If YOU are the receiver and you declined someone's request
      else if (request.receiverId === currentUser.id) {
        toast.success('Friend request declined')
        // Remove from friend requests list
        setFriendRequests(prev => prev.filter(req => req.id !== request.id))
      }
    })

    newSocket.on('friend-request:cancelled', (request: FriendRequest) => {
      console.log('Friend request cancelled socket event received:', request)
      console.log('Current user ID:', currentUser.id)
      console.log('Request sender ID:', request.senderId)
      console.log('Request receiver ID:', request.receiverId)
      
      // If YOU are the sender and you cancelled your request
      if (request.senderId === currentUser.id) {
        console.log('You are the sender - updating UI for cancellation')
        toast.success('Friend request cancelled')
        // Update friend status immediately
        setFriendStatus(prev => ({ ...prev, [request.receiverId]: 'none' }))
        // Remove from sent requests list
        setSentRequests(prev => {
          const filtered = prev.filter(req => req.id !== request.id)
          console.log('Updated sent requests:', filtered)
          return filtered
        })
      }
      // If YOU are the receiver and someone cancelled their request to you
      else if (request.receiverId === currentUser.id) {
        console.log('You are the receiver - updating UI for cancellation')
        toast.error('Friend request was cancelled by sender')
        // Remove from friend requests list
        setFriendRequests(prev => {
          const filtered = prev.filter(req => req.id !== request.id)
          console.log('Updated friend requests:', filtered)
          return filtered
        })
      } else {
        console.log('Neither sender nor receiver - ignoring event')
      }
    })

    // Handle when you send a friend request
    newSocket.on('friend-request:sent', (request: FriendRequest) => {
      console.log('Friend request sent:', request)
      
      // If YOU are the sender, update your sent requests list
      if (request.senderId === currentUser.id) {
        setSentRequests(prev => {
          const exists = prev.some(req => req.id === request.id || req.receiverId === request.receiverId)
          if (!exists) {
            return [...prev, request]
          }
          return prev
        })
        // Update friend status
        setFriendStatus(prev => ({ ...prev, [request.receiverId]: 'sent' }))
      }
      // If YOU are the receiver, add to your friend requests list
      else if (request.receiverId === currentUser.id) {
        setFriendRequests(prev => {
          const exists = prev.some(req => req.id === request.id || 
            (req.senderId === request.senderId && req.receiverId === request.receiverId))
          if (!exists) {
            return [...prev, request]
          }
          return prev
        })
        // Show the friend requests section if it's hidden
        setShowFriendRequestsSection(true)
        // Show notification
        toast.success(`Friend request from ${request.sender?.username || 'Unknown User'}!`, {
          duration: 5000,
          position: 'top-right'
        })
        playNotificationSound()
      }
    })

    return () => {
      newSocket.close()
    }
  }, [currentUser, notificationsEnabled, selectedUser])

  useEffect(() => {
    fetchMessages()
    fetchUsers()
    fetchFriendRequests()
    
    // Set up periodic refresh for friend requests
    const interval = setInterval(() => {
      fetchFriendRequests()
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
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
    console.log('File upload triggered!')
    console.log('Event:', event)
    console.log('Files:', event.target.files)
    
    const file = event.target.files?.[0]
    if (!file) {
      console.log('No file selected')
      return
    }

    console.log('File selected:', file.name, file.size, file.type)

    // Check if a user is selected
    if (!selectedUser) {
      console.log('No user selected')
      toast.error('Please select a user to send the file to')
      return
    }

    console.log('User selected:', selectedUser)

    // Check file size (5MB limit for deployment)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast.error('File too large. Please select a file smaller than 5MB.')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const token = localStorage.getItem('token')
      const uploadUrl = `${config.apiBaseUrl}/api/upload`
      console.log('Uploading file to:', uploadUrl)
      console.log('Token exists:', !!token)
      console.log('File:', file.name, file.size, file.type)
      console.log('Selected user:', selectedUser)
      console.log('Is production:', config.isProduction)
      console.log('Is Vercel:', config.isVercel)
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      console.log('File upload response status:', response.status)
      console.log('File upload response ok:', response.ok)
      console.log('Response headers:', response.headers)
      
      if (response.ok) {
        const responseData = await response.json()
        console.log('File upload response data:', responseData)
        
        const { fileUrl, fileName, fileSize, fileType } = responseData
        
        console.log('About to send message with:', {
          content: `Sent a ${fileType}`,
          type: fileType,
          fileName,
          fileSize,
          fileUrl
        })
        
        // Use the file URL for the message with proper type
        await sendMessage(
          `Sent a ${fileType}`, // Use descriptive content instead of URL
          fileType, 
          fileName, 
          fileSize, 
          fileUrl // Pass fileUrl separately
        )
        toast.success('File uploaded successfully!')
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }))
        console.error('File upload failed:', response.status, errorData)
        
        // Provide specific error messages for deployment issues
        if (response.status === 413) {
          toast.error('File too large for server. Please try a smaller file.')
        } else if (response.status === 500) {
          toast.error('Server error. File uploads may not be available on this deployment.')
        } else if (response.status === 404) {
          toast.error('Upload endpoint not found. Backend may be restarting.')
        } else if (response.status === 401) {
          toast.error('Authentication failed. Please log in again.')
        } else {
          toast.error(errorData.message || `Failed to upload file: ${response.status}`)
        }
      }
    } catch (error) {
      console.error('File upload error:', error)
      // console.error('Error name:', error.name)
      // console.error('Error message:', error.message)
      
      // Check if it's a network error (common on deployment)
      // if (error.name === 'TypeError' && error.message.includes('fetch')) {
      //   toast.error('Network error. Backend may be down or restarting.')
      // } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      //   toast.error('Cannot connect to server. Please try again later.')
      // } else {
      //   toast.error('Failed to upload file. This feature may not be available on deployment.')
      // }
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
        // Update current user's avatar immediately
        const updatedUser = { ...localCurrentUser, avatar }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        // Update local state for immediate UI update
        setLocalCurrentUser(updatedUser)
        toast.success('Profile picture updated!')
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Profile upload failed' }))
        console.error('Profile upload failed:', response.status, errorData)
        toast.error(errorData.message || `Failed to upload profile picture: ${response.status}`)
      }
    } catch (error) {
      console.error('Profile upload error:', error)
      toast.error('Failed to upload profile picture')
    } finally {
      setIsUploadingProfile(false)
    }
  }

  const handleUsernameChange = async () => {
    if (!newUsername.trim() || newUsername.trim() === localCurrentUser.username) {
      setShowUsernameModal(false)
      setNewUsername('')
      return
    }

    setIsChangingUsername(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${config.apiBaseUrl}/api/profile/username`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: newUsername.trim() })
      })

      if (response.ok) {
        const { username } = await response.json()
        // Update local user state
        const updatedUser = { ...localCurrentUser, username }
        setLocalCurrentUser(updatedUser)
        localStorage.setItem('user', JSON.stringify(updatedUser))
        toast.success('Username updated successfully!')
        setShowUsernameModal(false)
        setNewUsername('')
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to update username')
      }
    } catch (error) {
      console.error('Username change error:', error)
      toast.error('Failed to update username')
    } finally {
      setIsChangingUsername(false)
    }
  }

  const sendMessage = async (content: string, type: 'text' | 'file' | 'image' | 'video' | 'audio' | 'gif' = 'text', fileName?: string, fileSize?: number, fileUrl?: string) => {
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
        const errorData = await response.json().catch(() => ({ message: 'Send message failed' }))
        console.error('Send message failed:', response.status, errorData)
        toast.error(errorData.message || `Failed to send message: ${response.status}`)
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
    setMessages([])
    setMessageInput('')
    setShowEmojiPicker(false)
    setShowGifSearch(false)
    setHasNewMessages(false)
    fetchMessages()
    checkFriendStatus(user.id)
  }

  // Friend request functions
  const fetchFriendRequests = async () => {
    try {
      console.log('Fetching friend requests...')
      const token = localStorage.getItem('token')
      const [receivedResponse, sentResponse] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/friend-requests/received`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${config.apiBaseUrl}/api/friend-requests/sent`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      console.log('Received requests response:', receivedResponse.status, receivedResponse.ok)
      console.log('Sent requests response:', sentResponse.status, sentResponse.ok)

      if (receivedResponse.ok) {
        const { requests } = await receivedResponse.json()
        console.log('Received friend requests:', requests)
        setFriendRequests(requests)
      } else {
        console.error('Failed to fetch received requests:', receivedResponse.status)
      }

      if (sentResponse.ok) {
        const { requests } = await sentResponse.json()
        console.log('Sent friend requests:', requests)
        setSentRequests(requests)
        
        // Update friend status for sent requests
        requests.forEach((request: FriendRequest) => {
          setFriendStatus(prev => ({ ...prev, [request.receiverId]: 'sent' }))
        })
      } else {
        console.error('Failed to fetch sent requests:', sentResponse.status)
      }
    } catch (error: any) {
      console.error('Fetch friend requests error:', error)
    }
  }

  const sendFriendRequest = async (receiverId: string) => {
    try {
      // Check if we already have a pending request to this user
      const existingRequest = sentRequests.find(req => req.receiverId === receiverId)
      if (existingRequest) {
        toast.error('Friend request already sent to this user')
        return
      }

      const token = localStorage.getItem('token')
      const response = await fetch(`${config.apiBaseUrl}/api/friend-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ receiverId })
      })
      
      if (response.ok) {
        const request = await response.json()
        console.log('Friend request sent successfully:', request)
        toast.success('Friend request sent!')
        
        // Immediately update friend status
        setFriendStatus(prev => ({ ...prev, [receiverId]: 'sent' }))
        
        // Add to sent requests list (prevent duplicates)
        setSentRequests(prev => {
          const exists = prev.some(req => req.id === request.id || req.receiverId === receiverId)
          if (!exists) {
            return [...prev, request]
          }
          return prev
        })
        
        // Emit socket event for real-time updates
        if (socket) {
          socket.emit('friend-request:sent', request)
        }
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to send friend request')
      }
    } catch (error) {
      console.error('Error sending friend request:', error)
      toast.error('Failed to send friend request')
    }
  }

  const acceptFriendRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${config.apiBaseUrl}/api/friend-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'accept' })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('Friend request accepted:', result)
        toast.success('Friend request accepted!')
        
        // Find the request to get the sender ID
        const request = friendRequests.find(req => req.id === requestId)
        if (request) {
          // Immediately update friend status
          setFriendStatus(prev => ({ ...prev, [request.senderId]: 'friends' }))
          
          // Remove from friend requests list
          setFriendRequests(prev => prev.filter(req => req.id !== requestId))
          
          // Emit socket event for real-time updates
          if (socket) {
            socket.emit('friend-request:accepted', result)
          }
          
          // Fallback: Refresh friend requests after a short delay
          setTimeout(() => {
            fetchFriendRequests()
            checkFriendStatus(request.senderId)
          }, 1000)
        }
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to accept friend request')
      }
    } catch (error) {
      console.error('Error accepting friend request:', error)
      toast.error('Failed to accept friend request')
    }
  }

  const declineFriendRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${config.apiBaseUrl}/api/friend-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'decline' })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('Friend request declined:', result)
        toast.success('Friend request declined')
        
        // Find the request to get the sender ID
        const request = friendRequests.find(req => req.id === requestId)
        if (request) {
          // Immediately update friend status
          setFriendStatus(prev => ({ ...prev, [request.senderId]: 'none' }))
          
          // Remove from friend requests list
          setFriendRequests(prev => prev.filter(req => req.id !== requestId))
          
          // Emit socket event for real-time updates
          if (socket) {
            socket.emit('friend-request:declined', result)
          }
          
          // Fallback: Refresh friend requests after a short delay
          setTimeout(() => {
            fetchFriendRequests()
            checkFriendStatus(request.senderId)
          }, 1000)
        }
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to decline friend request')
      }
    } catch (error) {
      console.error('Error declining friend request:', error)
      toast.error('Failed to decline friend request')
    }
  }

  const cancelFriendRequest = async (requestId: string) => {
    try {
      console.log('cancelFriendRequest called with ID:', requestId)
      const token = localStorage.getItem('token')
      console.log('Making DELETE request to:', `${config.apiBaseUrl}/api/friend-requests/${requestId}`)
      
      const response = await fetch(`${config.apiBaseUrl}/api/friend-requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)

      if (response.ok) {
        const result = await response.json()
        console.log('Friend request cancelled:', result)
        toast.success('Friend request cancelled')
        
        // Find the request to get the receiver ID
        const request = sentRequests.find(req => req.id === requestId)
        console.log('Found request in sentRequests:', request)
        if (request) {
          // Immediately update friend status
          setFriendStatus(prev => ({ ...prev, [request.receiverId]: 'none' }))
          
          // Remove from sent requests list
          setSentRequests(prev => prev.filter(req => req.id !== requestId))
          
          // The server will emit the socket event for real-time updates
          console.log('Waiting for server socket event...')
          
          // Fallback: Refresh friend requests after a short delay to ensure UI is up to date
          setTimeout(() => {
            fetchFriendRequests()
            checkFriendStatus(request.receiverId)
          }, 1000)
        }
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to cancel friend request')
      }
    } catch (error) {
      console.error('Error cancelling friend request:', error)
      toast.error('Failed to cancel friend request')
    }
  }

  // Update: Check for any messages between the two users
  const checkFriendStatus = async (userId: string) => {
    try {
      const token = localStorage.getItem('token')
      
      // Check if they are friends
      const response = await fetch(`${config.apiBaseUrl}/api/friends/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      let areFriends = false
      if (response.ok) {
        const data = await response.json()
        areFriends = data.areFriends
      }

      // Check for any messages between the two users using the existing endpoint
      const messagesResponse = await fetch(`${config.apiBaseUrl}/api/messages?receiverId=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      let hasSharedMessages = false
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json()
        hasSharedMessages = messages.length > 0
        console.log(`Messages between current user and ${userId}:`, messages.length)
      }

      // Check for pending friend requests
      const sentRequestsResponse = await fetch(`${config.apiBaseUrl}/api/friend-requests/sent`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      let hasPendingRequest = false
      if (sentRequestsResponse.ok) {
        const { requests } = await sentRequestsResponse.json()
        hasPendingRequest = requests.some((req: FriendRequest) => req.receiverId === userId)
        console.log(`Pending request to ${userId}:`, hasPendingRequest)
      }

      // Determine friend status
      let status = 'none'
      if (areFriends || hasSharedMessages) {
        status = 'friends'
      } else if (hasPendingRequest) {
        status = 'sent'
      }
      
      console.log(`Friend status for ${userId}:`, { areFriends, hasSharedMessages, hasPendingRequest, status })
      
      setFriendStatus(prev => ({ 
        ...prev, 
        [userId]: status
      }))
    } catch (error: any) {
      console.error('Check friend status error:', error)
    }
  }

  // Call checkFriendStatus for all users when users list changes
  useEffect(() => {
    users.forEach(user => {
      if (user.id !== localCurrentUser.id) {
        checkFriendStatus(user.id)
      }
    })
  }, [users])

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
              {localCurrentUser.avatar ? (
                <img 
                  src={getFullUrl(localCurrentUser.avatar)} 
                  alt={localCurrentUser.username}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center ${localCurrentUser.avatar ? 'hidden' : ''}`}>
                <span className="text-white font-semibold">{localCurrentUser.username[0].toUpperCase()}</span>
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
              <div className="flex items-center space-x-2">
                <h2 className="font-semibold">{localCurrentUser.username}</h2>
                <button
                  onClick={() => {
                    setNewUsername(localCurrentUser.username)
                    setShowUsernameModal(true)
                  }}
                  className="p-1 hover:bg-secondary-100 rounded transition-colors"
                  title="Change username"
                >
                  <Edit className="w-3 h-3 text-secondary-500" />
                </button>
              </div>
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
                      <div className="flex items-center space-x-2">
                        {unreadMessages[user.id] > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                            {unreadMessages[user.id]}
                          </span>
                        )}
                        {/* Friend Request Button - Show for users who are not friends and haven't sent requests */}
                        {(!friendStatus[user.id] || friendStatus[user.id] === 'none') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              console.log('Sending friend request to:', user.id)
                              sendFriendRequest(user.id)
                            }}
                            className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                            title="Send friend request"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                        )}
                        {friendStatus[user.id] === 'sent' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              console.log('Cancel button clicked for user:', user.id)
                              console.log('Current sentRequests:', sentRequests)
                              const request = sentRequests.find(req => req.receiverId === user.id)
                              console.log('Found request:', request)
                              if (request) {
                                console.log('Cancelling request with ID:', request.id)
                                cancelFriendRequest(request.id)
                              } else {
                                console.error('No request found for user:', user.id)
                                toast.error('Could not find friend request to cancel')
                              }
                            }}
                            className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors"
                            title="Cancel friend request"
                          >
                            <span className="text-xs">⏳</span>
                          </button>
                        )}
                        {friendStatus[user.id] === 'friends' && (
                          <span className="p-1.5 text-green-500" title="Friends">
                            <span className="text-xs">✓</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Friend Requests Section - Toggleable */}
        {showFriendRequestsSection && (
          <div className="border-t border-secondary-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-secondary-600 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Friend Requests ({friendRequests.length})
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    console.log('Refreshing friend requests...')
                    fetchFriendRequests()
                  }}
                  className="p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Refresh friend requests"
                >
                  <span className="text-xs">🔄</span>
                </button>
                <button
                  onClick={() => setShowFriendRequestsSection(false)}
                  className="p-1 text-gray-500 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                  title="Hide friend requests"
                >
                  <span className="text-xs">−</span>
                </button>
              </div>
            </div>
            
            {friendRequests.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">No pending friend requests</p>
                <p className="text-xs mt-1">Send friend requests to other users to start chatting!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friendRequests.map((request) => (
                  <motion.div
                    key={request.id}
                    className="p-3 rounded-lg bg-blue-50 border border-blue-200"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      {request.sender?.avatar ? (
                        <img 
                          src={getFullUrl(request.sender.avatar)} 
                          alt={request.sender.username}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {request.sender?.username?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{request.sender?.username || 'Unknown User'}</p>
                        <p className="text-xs text-secondary-500">Wants to be your friend</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          console.log('Accepting friend request:', request.id)
                          acceptFriendRequest(request.id)
                        }}
                        className="flex-1 px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          console.log('Declining friend request:', request.id)
                          declineFriendRequest(request.id)
                        }}
                        className="flex-1 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Show Friend Requests Button - When section is hidden */}
        {!showFriendRequestsSection && (
          <div className="border-t border-secondary-200 p-4">
            <button
              onClick={() => setShowFriendRequestsSection(true)}
              className="w-full flex items-center justify-center space-x-2 p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Show friend requests"
            >
              <Users className="w-4 h-4" />
              <span className="text-sm">Show Friend Requests</span>
              {friendRequests.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                  {friendRequests.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Mobile Header - Only visible on mobile */}
      <div className="md:hidden bg-white border-b border-secondary-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-2 hover:bg-secondary-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative group">
              {localCurrentUser.avatar ? (
                <img 
                  src={getFullUrl(localCurrentUser.avatar)} 
                  alt={localCurrentUser.username}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center ${localCurrentUser.avatar ? 'hidden' : ''}`}>
                <span className="text-white text-sm font-semibold">{localCurrentUser.username[0].toUpperCase()}</span>
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
              <div className="flex items-center space-x-1">
                <h2 className="font-semibold text-sm">{localCurrentUser.username}</h2>
                <button
                  onClick={() => {
                    setNewUsername(localCurrentUser.username)
                    setShowUsernameModal(true)
                  }}
                  className="p-0.5 hover:bg-secondary-100 rounded transition-colors"
                  title="Change username"
                >
                  <Edit className="w-2.5 h-2.5 text-secondary-500" />
                </button>
              </div>
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
            className={`p-2 rounded-lg relative transition-colors ${
              showMobileMenu ? 'bg-primary-100 text-primary-600' : 'hover:bg-secondary-100'
            }`}
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
        <motion.div 
          className="md:hidden bg-white border-b border-secondary-200 p-4"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
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
          
          {/* Users Section */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-secondary-600 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Users ({filteredUsers.length})
            </h4>
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
            
            <div className="space-y-2 max-h-40 overflow-y-auto">
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
                    <div className="flex items-center space-x-2">
                      {unreadMessages[user.id] > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                          {unreadMessages[user.id]}
                        </span>
                      )}
                      {/* Friend Request Button - Show for users who are not friends and haven't sent requests */}
                      {(!friendStatus[user.id] || friendStatus[user.id] === 'none') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            console.log('Sending friend request to:', user.id)
                            sendFriendRequest(user.id)
                          }}
                          className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          title="Send friend request"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      )}
                      {friendStatus[user.id] === 'sent' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            console.log('Cancel button clicked for user:', user.id)
                            console.log('Current sentRequests:', sentRequests)
                            const request = sentRequests.find(req => req.receiverId === user.id)
                            console.log('Found request:', request)
                            if (request) {
                              console.log('Cancelling request with ID:', request.id)
                              cancelFriendRequest(request.id)
                            } else {
                              console.error('No request found for user:', user.id)
                              toast.error('Could not find friend request to cancel')
                            }
                          }}
                          className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors"
                          title="Cancel friend request"
                        >
                          <span className="text-xs">⏳</span>
                        </button>
                      )}
                      {friendStatus[user.id] === 'friends' && (
                        <span className="p-1.5 text-green-500" title="Friends">
                          <span className="text-xs">✓</span>
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Navigation Options */}
          <div className="border-t border-secondary-200 pt-4">
            <h4 className="text-sm font-semibold text-secondary-600 mb-3">Navigation</h4>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowMobileMenu(false)
                  onBack()
                }}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <ArrowLeft className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">Back to Home</p>
                  <p className="text-xs text-secondary-500">Return to main menu</p>
                </div>
              </button>
              
              {onNavigateToPlayground && (
                <button
                  onClick={() => {
                    setShowMobileMenu(false)
                    onNavigateToPlayground()
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
              )}
              
              {onNavigateTo3D && (
                <button
                  onClick={() => {
                    setShowMobileMenu(false)
                    onNavigateTo3D()
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
              )}
              
              {onLogout && (
                <button
                  onClick={() => {
                    setShowMobileMenu(false)
                    onLogout()
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
              )}
            </div>
          </div>
        </motion.div>
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
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold">{selectedUser.username}</h3>
                    {friendStatus[selectedUser.id] === 'friends' && (
                      <span className="text-green-500 text-sm">✓ Friends</span>
                    )}
                    {friendStatus[selectedUser.id] === 'sent' && (
                      <span className="text-orange-500 text-sm">⏳ Request Sent</span>
                    )}
                    {friendStatus[selectedUser.id] === 'none' && (
                      <span className="text-gray-500 text-sm">Send friend request to chat</span>
                    )}
                  </div>
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
                className={`flex ${message.senderId === localCurrentUser.id ? 'justify-end' : 'justify-start'} mb-4`}
              >
                <div className={`flex items-end space-x-2 max-w-[85%] sm:max-w-xs lg:max-w-md ${message.senderId === localCurrentUser.id ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {/* Profile Picture */}
                  {message.senderId !== localCurrentUser.id && (
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
                    {message.senderId !== localCurrentUser.id && (
                      <p className="text-xs text-secondary-500 mb-1">{message.sender.username}</p>
                    )}
                    <div className={`chat-bubble ${message.senderId === localCurrentUser.id ? 'chat-bubble-sent' : 'chat-bubble-received'}`}>
                      {message.type === 'image' && (
                        <div className="mb-2">
                          <img 
                            src={getFullUrl(message.fileUrl || message.content)} 
                            alt="Shared image" 
                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(getFullUrl(message.fileUrl || message.content), '_blank')}
                            onError={(e) => {
                              console.log('❌ Image failed to load:', message.fileUrl || message.content)
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                          <div className="hidden p-4 bg-gray-100 rounded-lg text-center">
                            <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Image not available</p>
                            <p className="text-xs text-gray-400">File was removed after server restart</p>
                            <button 
                              onClick={() => {
                                toast.error('Please re-upload this image')
                              }}
                              className="mt-2 text-xs text-blue-500 hover:text-blue-600"
                            >
                              Re-upload needed
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {message.type === 'video' && (
                        <div className="mb-2">
                          <video 
                            src={getFullUrl(message.fileUrl || message.content)} 
                            controls
                            className="max-w-full rounded-lg"
                            preload="metadata"
                          >
                            Your browser does not support the video tag.
                          </video>
                          <p className="text-xs text-gray-500 mt-1">{message.fileName}</p>
                        </div>
                      )}
                      
                      {message.type === 'audio' && (
                        <div className="mb-2">
                          <audio 
                            src={getFullUrl(message.fileUrl || message.content)} 
                            controls
                            className="w-full"
                            preload="metadata"
                          >
                            Your browser does not support the audio tag.
                          </audio>
                          <p className="text-xs text-gray-500 mt-1">{message.fileName}</p>
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
            <div className="absolute bottom-full left-3 sm:left-4 mb-2 z-50 emoji-picker bg-white border rounded-lg shadow-lg p-4 max-h-60 overflow-y-auto">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}
          
          {/* GIF Search */}
          {showGifSearch && (
            <div className="absolute bottom-full left-3 sm:left-4 mb-2 z-50 bg-white border rounded-lg shadow-lg p-4 w-72 sm:w-80 gif-search max-h-60 overflow-y-auto">
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
              <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
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
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <button
                onClick={() => {
                  console.log('Emoji button clicked, current state:', showEmojiPicker)
                  setShowEmojiPicker(!showEmojiPicker)
                  setShowGifSearch(false) // Close GIF search when opening emoji picker
                }}
                disabled={!selectedUser || friendStatus[selectedUser.id] !== 'friends'}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title={
                  !selectedUser 
                    ? 'Select a user to add emoji' 
                    : friendStatus[selectedUser.id] !== 'friends'
                    ? 'Send friend request first'
                    : 'Add emoji'
                }
              >
                <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              <button
                onClick={() => {
                  console.log('GIF button clicked, current state:', showGifSearch)
                  setShowGifSearch(!showGifSearch)
                  setShowEmojiPicker(false) // Close emoji picker when opening GIF search
                }}
                disabled={!selectedUser || friendStatus[selectedUser.id] !== 'friends'}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title={
                  !selectedUser 
                    ? 'Select a user to search GIFs' 
                    : friendStatus[selectedUser.id] !== 'friends'
                    ? 'Send friend request first'
                    : 'Search GIFs'
                }
              >
                <Image className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              <button
                onClick={() => {
                  console.log('File upload button clicked!')
                  console.log('fileInputRef.current:', fileInputRef.current)
                  console.log('isUploading:', isUploading)
                  fileInputRef.current?.click()
                }}
                disabled={isUploading || !selectedUser || friendStatus[selectedUser.id] !== 'friends'}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title={
                  !selectedUser 
                    ? 'Select a user to upload file' 
                    : friendStatus[selectedUser.id] !== 'friends'
                    ? 'Send friend request first'
                    : 'Upload file'
                }
              >
                {isUploading ? (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                ) : (
                  <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                className="hidden"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <textarea
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value)
                  handleTyping(e.target.value.length > 0)
                }}
                onKeyPress={handleKeyPress}
                onBlur={() => handleTyping(false)}
                placeholder={
                  !selectedUser 
                    ? 'Select a user to start chatting...' 
                    : friendStatus[selectedUser.id] === 'friends'
                    ? `Message ${selectedUser.username}...`
                    : friendStatus[selectedUser.id] === 'sent'
                    ? `Friend request sent to ${selectedUser.username}. Waiting for response...`
                    : friendStatus[selectedUser.id] === 'none'
                    ? `Send friend request to ${selectedUser.username} to start chatting`
                    : `Message ${selectedUser.username}...`
                }
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                rows={1}
                disabled={!selectedUser || friendStatus[selectedUser.id] !== 'friends'}
                style={{ minHeight: '44px' }}
              />
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || !selectedUser || friendStatus[selectedUser.id] !== 'friends'}
              className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              title={
                !selectedUser 
                  ? 'Select a user to send message' 
                  : friendStatus[selectedUser.id] !== 'friends'
                  ? 'Send friend request first'
                  : 'Send message'
              }
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Username Change Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Change Username</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Username
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new username"
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">
                Username must be 3-20 characters long
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowUsernameModal(false)
                  setNewUsername('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUsernameChange}
                disabled={!newUsername.trim() || newUsername.trim() === localCurrentUser.username || isChangingUsername}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isChangingUsername ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Updating...
                  </div>
                ) : (
                  'Update Username'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}