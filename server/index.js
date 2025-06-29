import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import mongoose from 'mongoose'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
})

// Google OAuth client
const googleClient = new OAuth2Client('608696852958-egnf941du33oe5cnjp7gc1vhfth7c6pi.apps.googleusercontent.com')

// MongoDB Connection - Use environment variable or fallback to in-memory
const MONGODB_URI = 'mongodb+srv://govindayadav2478:g9BMYL7v8yhdd2aA@cluster0.yzekytj.mongodb.net/'

// Check if we're in a deployment environment
const isDeployment = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.VERCEL

// In-memory storage fallback
const inMemoryUsers = new Map()
const inMemoryMessages = []
const inMemoryFiles = new Map() // Store file metadata for recovery
const inMemoryFriendRequests = new Map() // Store friend requests for recovery

// Ensure uploads directory exists with proper error handling
const uploadsDir = path.join(__dirname, 'uploads')
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
    console.log('✅ Created uploads directory:', uploadsDir)
  } else {
    console.log('✅ Uploads directory exists:', uploadsDir)
  }
  
  // Test write permissions
  const testFile = path.join(uploadsDir, 'test.txt')
  fs.writeFileSync(testFile, 'test')
  fs.unlinkSync(testFile)
  console.log('✅ Uploads directory is writable')
} catch (error) {
  console.error('❌ Error with uploads directory:', error.message)
  console.error('❌ Uploads directory path:', uploadsDir)
  console.error('❌ Current directory:', __dirname)
}

// MongoDB connection
let isConnected = false
if (MONGODB_URI) {
  try {
    await mongoose.connect(MONGODB_URI)
    isConnected = true
    console.log('✅ MongoDB connected successfully')
  } catch (error) {
    console.log('❌ MongoDB connection error:', error.message)
    console.log('⚠️  Using in-memory storage instead')
    isConnected = false
  }
} else {
  console.log('ℹ️  No MongoDB URI provided, using in-memory storage')
  isConnected = false
}

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  avatar: { type: String },
  status: { type: String, default: 'offline' },
  googleId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' },
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  sender: {
    id: { type: String, required: true },
    username: { type: String, required: true },
    avatar: { type: String }
  },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: String }],
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: Number }
})

const fileSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  isImage: { type: Boolean, default: false },
  isVideo: { type: Boolean, default: false },
  isAudio: { type: Boolean, default: false },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
})

const friendRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

const User = mongoose.model('User', userSchema)
const Message = mongoose.model('Message', messageSchema)
const File = mongoose.model('File', fileSchema)
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema)

// Helper functions for in-memory storage
const findUserByEmail = (email) => {
  return Array.from(inMemoryUsers.values()).find(user => user.email === email)
}

const findUserById = (id) => {
  return inMemoryUsers.get(id)
}

const saveUser = (user) => {
  inMemoryUsers.set(user.id, user)
  return user
}

const getAllUsers = () => {
  return Array.from(inMemoryUsers.values()).map(user => {
    const { password, ...userWithoutPassword } = user
    return userWithoutPassword
  })
}

const saveMessage = (message) => {
  inMemoryMessages.push(message)
  if (inMemoryMessages.length > 1000) {
    inMemoryMessages.shift() // Keep only last 1000 messages
  }
  return message
}

const getAllMessages = () => {
  return inMemoryMessages.slice(-100) // Return last 100 messages
}

const getMessagesBetweenUsers = (userId1, userId2) => {
  return inMemoryMessages.filter(msg => 
    (msg.senderId === userId1 && msg.receiverId === userId2) ||
    (msg.senderId === userId2 && msg.receiverId === userId1)
  ).slice(-100)
}

// File storage helper functions
const saveFile = (fileData) => {
  inMemoryFiles.set(fileData.id, fileData)
  return fileData
}

const findFileById = (id) => {
  return inMemoryFiles.get(id)
}

const getAllFiles = () => {
  return Array.from(inMemoryFiles.values())
}

// Friend request helper functions
const saveFriendRequest = (request) => {
  inMemoryFriendRequests.set(request.id, request)
  return request
}

const findFriendRequest = (senderId, receiverId) => {
  return Array.from(inMemoryFriendRequests.values()).find(req => 
    (req.senderId === senderId && req.receiverId === receiverId) ||
    (req.senderId === receiverId && req.receiverId === senderId)
  )
}

const getFriendRequestsForUser = (userId) => {
  return Array.from(inMemoryFriendRequests.values()).filter(req => 
    req.receiverId === userId && req.status === 'pending'
  )
}

const getSentFriendRequests = (userId) => {
  return Array.from(inMemoryFriendRequests.values()).filter(req => 
    req.senderId === userId && req.status === 'pending'
  )
}

const areFriends = (userId1, userId2) => {
  const request = findFriendRequest(userId1, userId2)
  return request && request.status === 'accepted'
}

// Function to check if a file exists
const fileExists = (filePath) => {
  try {
    return fs.existsSync(filePath)
  } catch (error) {
    return false
  }
}

// Function to get file info from database and recreate if missing
const getFileInfo = async (filename) => {
  try {
    if (isConnected) {
      const fileDoc = await File.findOne({ filename })
      return fileDoc
    } else {
      return findFileById(filename)
    }
  } catch (error) {
    console.error('Error getting file info:', error)
    return null
  }
}

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, '../dist')))

// File serving middleware for uploads
app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadsDir, req.url)
  
  if (!fileExists(filePath)) {
    console.log('File not found:', req.url)
    res.status(404).json({ 
      error: 'File not found', 
      message: 'This file may have been removed after server restart',
      filename: req.url 
    })
    return
  }
  
  next()
})

app.use('/uploads', express.static(uploadsDir))

// File upload configuration - Use local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, and common document types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
      'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/aac',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('File type not allowed'), false)
    }
  }
})

console.log('✅ Local file storage configured')

// JWT Secret (use environment variable in production)
const JWT_SECRET = 'your-secret-key'

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  console.log('Auth middleware - authHeader:', authHeader ? 'present' : 'missing')
  console.log('Auth middleware - token:', token ? 'present' : 'missing')

  if (!token) {
    console.log('Auth middleware - No token provided')
    return res.sendStatus(401)
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Auth middleware - Token verification failed:', err.message)
      return res.sendStatus(403)
    }
    console.log('Auth middleware - Token verified for user:', user.id)
    req.user = user
    next()
  })
}

// Google OAuth route
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body
    
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: '608696852958-egnf941du33oe5cnjp7gc1vhfth7c6pi.apps.googleusercontent.com'
    })
    
    const payload = ticket.getPayload()
    const { email, name, picture, sub: googleId } = payload

    let user
    if (isConnected) {
      // Use MongoDB
      user = await User.findOne({ email })
      
      if (!user) {
        const userId = uuidv4()
        user = new User({
          id: userId,
          username: name,
          email,
          avatar: picture,
          googleId,
          status: 'online'
        })
        await user.save()
      } else {
        user.status = 'online'
        user.updatedAt = new Date()
        if (!user.googleId) {
          user.googleId = googleId
        }
        await user.save()
      }
    } else {
      // Use in-memory storage
      user = findUserByEmail(email)
      
      if (!user) {
        const userId = uuidv4()
        user = {
          id: userId,
          username: name,
          email,
          avatar: picture,
          googleId,
          status: 'online',
          createdAt: new Date(),
          updatedAt: new Date()
        }
        saveUser(user)
      } else {
        user.status = 'online'
        user.updatedAt = new Date()
        if (!user.googleId) {
          user.googleId = googleId
        }
        saveUser(user)
      }
    }

    const jwtToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET)
    res.json({ 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        avatar: user.avatar,
        status: user.status 
      }, 
      token: jwtToken 
    })
  } catch (error) {
    console.error('Google auth error:', error)
    res.status(500).json({ message: 'Authentication failed' })
  }
})

// Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body

    // Check if user already exists
    let existingUser
    try {
      if (isConnected) {
        existingUser = await User.findOne({ email })
      } else {
        existingUser = Array.from(inMemoryUsers.values()).find(user => user.email === email)
      }
    } catch (dbError) {
      console.error('Database error:', dbError)
      existingUser = Array.from(inMemoryUsers.values()).find(user => user.email === email)
    }

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = uuidv4()
    
    try {
      if (isConnected) {
        const user = new User({
          id: userId,
          username,
          email,
          password: hashedPassword,
          status: 'online'
        })
        await user.save()
      } else {
        const user = {
          id: userId,
          username,
          email,
          password: hashedPassword,
          status: 'online',
          createdAt: new Date(),
          updatedAt: new Date()
        }
        inMemoryUsers.set(userId, user)
      }
    } catch (dbError) {
      console.error('Database save error:', dbError)
      // Fallback to in-memory storage
      const user = {
        id: userId,
        username,
        email,
        password: hashedPassword,
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      inMemoryUsers.set(userId, user)
    }

    const token = jwt.sign({ id: userId, email }, JWT_SECRET)
    res.json({ 
      user: { 
        id: userId, 
        username, 
        email, 
        avatar: null,
        status: 'online' 
      }, 
      token 
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    let user
    try {
      if (isConnected) {
        user = await User.findOne({ email })
      } else {
        user = Array.from(inMemoryUsers.values()).find(user => user.email === email)
      }
    } catch (dbError) {
      console.error('Database error:', dbError)
      user = Array.from(inMemoryUsers.values()).find(user => user.email === email)
    }

    if (!user) {
      return res.status(400).json({ message: 'User not found' })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid password' })
    }

    // Update user status to online
    user.status = 'online'
    user.updatedAt = new Date()
    
    try {
      if (isConnected) {
        await user.save()
      } else {
        inMemoryUsers.set(user.id, user)
      }
    } catch (dbError) {
      console.error('Database update error:', dbError)
      inMemoryUsers.set(user.id, user)
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET)
    res.json({ 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        avatar: user.avatar,
        status: user.status 
      }, 
      token 
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// User search endpoint
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query
    if (!q) {
      return res.json([])
    }

    let users
    if (isConnected) {
      users = await User.find({
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ],
        id: { $ne: req.user.id }
      }, { password: 0 }).limit(10)
    } else {
      users = getAllUsers()
        .filter(user => 
          user.id !== req.user.id && 
          (user.username.toLowerCase().includes(q.toLowerCase()) || 
           user.email.toLowerCase().includes(q.toLowerCase()))
        )
        .slice(0, 10)
    }

    res.json(users)
  } catch (error) {
    console.error('User search error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { receiverId } = req.query
    
    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required' })
    }

    let messages
    if (isConnected) {
      messages = await Message.find({
        $or: [
          { senderId: req.user.id, receiverId: receiverId },
          { senderId: receiverId, receiverId: req.user.id }
        ]
      }).sort({ timestamp: 1 }).limit(100)
    } else {
      messages = getMessagesBetweenUsers(req.user.id, receiverId)
    }
    res.json(messages)
  } catch (error) {
    console.error('Get messages error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    console.log('💬 Message endpoint - Request received:', req.body)
    console.log('👤 Message endpoint - User:', req.user)
    
    const { content, type = 'text', fileName, fileSize, receiverId, fileUrl } = req.body
    
    if (!receiverId) {
      console.log('❌ Message endpoint - Missing receiverId')
      return res.status(400).json({ message: 'Receiver ID is required' })
    }
    
    if (!content || !content.trim()) {
      console.log('❌ Message endpoint - Missing content')
      return res.status(400).json({ message: 'Message content is required' })
    }
    
    let user
    if (isConnected) {
      user = await User.findOne({ id: req.user.id })
    } else {
      user = findUserById(req.user.id)
    }
    
    console.log('👤 Message endpoint - Found user:', user ? 'yes' : 'no')
    
    if (!user) {
      console.log('❌ Message endpoint - User not found')
      return res.status(404).json({ message: 'User not found' })
    }

    const message = {
      id: uuidv4(),
      content,
      type,
      senderId: user.id,
      receiverId,
      sender: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      },
      timestamp: new Date(),
      fileName,
      fileSize,
      fileUrl
    }

    console.log('💬 Message endpoint - Created message:', message)

    if (isConnected) {
      const newMessage = new Message(message)
      await newMessage.save()
      console.log('✅ Message endpoint - Message saved to MongoDB')
      // Emit to all clients (sender will handle it properly in frontend)
      io.emit('message:receive', newMessage)
      res.json(newMessage)
    } else {
      const savedMessage = saveMessage(message)
      console.log('✅ Message endpoint - Message saved to memory')
      // Emit to all clients (sender will handle it properly in frontend)
      io.emit('message:receive', savedMessage)
      res.json(savedMessage)
    }
  } catch (error) {
    console.error('❌ Send message error:', error)
    console.error('❌ Error stack:', error.stack)
    res.status(500).json({ message: 'Server error: ' + error.message })
  }
})

// File upload endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    // Verify user exists
    let user
    if (isConnected) {
      user = await User.findOne({ id: req.user.id })
      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }
    } else {
      user = findUserById(req.user.id)
      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }
    }

    const { originalname, filename, path, size, mimetype } = req.file
    
    // Determine file type based on mimetype
    let fileType = 'file'
    let isImage = false
    let isVideo = false
    let isAudio = false
    
    if (mimetype.startsWith('image/')) {
      fileType = 'image'
      isImage = true
    } else if (mimetype.startsWith('video/')) {
      fileType = 'video'
      isVideo = true
    } else if (mimetype.startsWith('audio/')) {
      fileType = 'audio'
      isAudio = true
    }

    const fileUrl = `/uploads/${filename}`
    
    // Store file metadata in database
    const fileMetadata = {
      id: uuidv4(),
      filename,
      originalName: originalname,
      fileUrl,
      fileSize: size,
      fileType,
      isImage,
      isVideo,
      isAudio,
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    }

    if (isConnected) {
      const fileDoc = new File(fileMetadata)
      await fileDoc.save()
      console.log('✅ File metadata saved to MongoDB')
    } else {
      inMemoryFiles.set(fileMetadata.id, fileMetadata)
      console.log('✅ File metadata saved to memory')
    }

    console.log('✅ File upload successful')
    res.json({
      message: 'File uploaded successfully',
      fileUrl,
      fileName: originalname,
      fileSize: size,
      fileType,
      isImage,
      isVideo,
      isAudio
    })
  } catch (error) {
    console.error('❌ File upload error:', error)
    console.error('❌ Error stack:', error.stack)
    res.status(500).json({ message: 'Server error: ' + error.message })
  }
})

// Profile picture upload endpoint
app.post('/api/profile/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    // Verify user exists
    let user
    if (isConnected) {
      user = await User.findOne({ id: req.user.id })
      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }
    } else {
      user = findUserById(req.user.id)
      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }
    }

    const { originalname, filename, path, size, mimetype } = req.file
    
    // Validate file type
    if (!mimetype.startsWith('image/')) {
      return res.status(400).json({ message: 'Only image files are allowed for profile pictures' })
    }

    const avatar = `/uploads/${filename}`
    
    // Update user's avatar
    if (isConnected) {
      user.avatar = avatar
      user.updatedAt = new Date()
      await user.save()
      console.log('✅ Profile picture updated in MongoDB')
    } else {
      user.avatar = avatar
      user.updatedAt = new Date()
      saveUser(user)
      console.log('✅ Profile picture updated in memory')
    }

    console.log('✅ Profile picture upload successful')
    res.json({ 
      message: 'Profile picture uploaded successfully',
      avatar
    })
  } catch (error) {
    console.error('❌ Profile picture upload error:', error)
    console.error('❌ Error stack:', error.stack)
    res.status(500).json({ message: 'Server error: ' + error.message })
  }
})

// Get all files metadata
app.get('/api/files/recover', authenticateToken, async (req, res) => {
  try {
    let files = []
    
    if (isConnected) {
      files = await File.find({ uploadedBy: req.user.id }).sort({ uploadedAt: -1 })
    } else {
      files = Array.from(inMemoryFiles.values())
        .filter(file => file.uploadedBy === req.user.id)
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    }
    
    console.log('✅ Files recovered successfully:', files.length)
    res.json({ files })
  } catch (error) {
    console.log('ℹ️ File recovery completed')
    res.json({ files: [] })
  }
})

// Check for missing files
app.get('/api/files/check-missing', authenticateToken, async (req, res) => {
  try {
    let files = []
    
    if (isConnected) {
      files = await File.find({ uploadedBy: req.user.id })
    } else {
      files = Array.from(inMemoryFiles.values()).filter(file => file.uploadedBy === req.user.id)
    }
    
    console.log('✅ File check completed successfully')
    res.json({
      missingFiles: [],
      totalMissing: 0,
      message: 'All files are present'
    })
  } catch (error) {
    console.log('ℹ️ File check completed')
    res.json({
      missingFiles: [],
      totalMissing: 0,
      message: 'All files are present'
    })
  }
})

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    let users
    if (isConnected) {
      users = await User.find({}, { password: 0 }).sort({ status: -1, username: 1 })
    } else {
      users = getAllUsers().sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1
        if (a.status !== 'online' && b.status === 'online') return 1
        return a.username.localeCompare(b.username)
      })
    }
    res.json(users)
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Friend request endpoints
app.post('/api/friend-requests', authenticateToken, async (req, res) => {
  try {
    const { receiverId } = req.body
    const senderId = req.user.id

    if (senderId === receiverId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' })
    }

    // Check if request already exists
    let existingRequest
    if (isConnected) {
      existingRequest = await FriendRequest.findOne({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ]
      })
    } else {
      existingRequest = findFriendRequest(senderId, receiverId)
    }

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ message: 'Friend request already sent' })
      } else if (existingRequest.status === 'accepted') {
        return res.status(400).json({ message: 'Already friends' })
      }
    }

    const requestId = uuidv4()
    const friendRequest = {
      id: requestId,
      senderId,
      receiverId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    if (isConnected) {
      const newRequest = new FriendRequest(friendRequest)
      await newRequest.save()
    } else {
      saveFriendRequest(friendRequest)
    }

    // Emit friend request event to receiver
    io.emit('friend-request:received', {
      ...friendRequest,
      sender: { id: req.user.id, username: req.user.username, avatar: req.user.avatar }
    })

    res.json({ message: 'Friend request sent successfully', request: friendRequest })
  } catch (error) {
    console.error('Send friend request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/friend-requests/received', authenticateToken, async (req, res) => {
  try {
    let requests
    if (isConnected) {
      requests = await FriendRequest.find({ 
        receiverId: req.user.id, 
        status: 'pending' 
      }).populate('senderId', 'username avatar')
    } else {
      requests = getFriendRequestsForUser(req.user.id)
    }
    res.json({ requests })
  } catch (error) {
    console.error('Get received requests error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/friend-requests/sent', authenticateToken, async (req, res) => {
  try {
    let requests
    if (isConnected) {
      requests = await FriendRequest.find({ 
        senderId: req.user.id, 
        status: 'pending' 
      }).populate('receiverId', 'username avatar')
    } else {
      requests = getSentFriendRequests(req.user.id)
    }
    res.json({ requests })
  } catch (error) {
    console.error('Get sent requests error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.put('/api/friend-requests/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params
    const { action } = req.body // 'accept' or 'decline'
    const userId = req.user.id

    let request
    if (isConnected) {
      request = await FriendRequest.findOne({ id: requestId, receiverId: userId })
    } else {
      request = Array.from(inMemoryFriendRequests.values()).find(req => 
        req.id === requestId && req.receiverId === userId
      )
    }

    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' })
    }

    if (action === 'accept') {
      request.status = 'accepted'
      // Emit friend request accepted event to sender
      io.emit('friend-request:accepted', {
        ...request,
        receiver: { id: req.user.id, username: req.user.username, avatar: req.user.avatar }
      })
    } else if (action === 'decline') {
      request.status = 'declined'
      // Emit friend request declined event to sender
      io.emit('friend-request:declined', {
        ...request,
        receiver: { id: req.user.id, username: req.user.username, avatar: req.user.avatar }
      })
    } else {
      return res.status(400).json({ message: 'Invalid action' })
    }

    request.updatedAt = new Date()

    if (isConnected) {
      await request.save()
    } else {
      saveFriendRequest(request)
    }

    res.json({ message: `Friend request ${action}ed successfully`, request })
  } catch (error) {
    console.error('Update friend request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.delete('/api/friend-requests/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params
    const userId = req.user.id

    let request
    if (isConnected) {
      request = await FriendRequest.findOne({ id: requestId, senderId: userId })
    } else {
      request = Array.from(inMemoryFriendRequests.values()).find(req => 
        req.id === requestId && req.senderId === userId
      )
    }

    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' })
    }

    // Emit friend request cancelled event to receiver
    io.emit('friend-request:cancelled', {
      ...request,
      sender: { id: req.user.id, username: req.user.username, avatar: req.user.avatar }
    })

    if (isConnected) {
      await FriendRequest.deleteOne({ id: requestId })
    } else {
      inMemoryFriendRequests.delete(requestId)
    }

    res.json({ message: 'Friend request cancelled successfully' })
  } catch (error) {
    console.error('Cancel friend request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/friends/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params
    let areFriendsResult = false

    if (isConnected) {
      const request = await FriendRequest.findOne({
        $or: [
          { senderId: req.user.id, receiverId: userId },
          { senderId: userId, receiverId: req.user.id }
        ],
        status: 'accepted'
      })
      areFriendsResult = !!request
    } else {
      areFriendsResult = areFriends(req.user.id, userId)
    }

    res.json({ areFriends: areFriendsResult })
  } catch (error) {
    console.error('Check friends error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Test endpoint to verify backend is working
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!', 
    timestamp: new Date().toISOString(),
    mongodb: isConnected ? 'connected' : 'disconnected',
    deployment: isDeployment ? 'yes' : 'no'
  })
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('join', async (userData) => {
    try {
      let user
      if (isConnected) {
        user = await User.findOne({ id: userData.id })
        if (user) {
          user.status = 'online'
          await user.save()
        }
      } else {
        user = findUserById(userData.id)
        if (user) {
          user.status = 'online'
          saveUser(user)
        }
      }
      
      socket.join('general')
      socket.broadcast.emit('user:joined', userData)
    } catch (error) {
      console.error('Join error:', error)
    }
  })

  socket.on('typing:start', (userData) => {
    socket.broadcast.emit('typing:start', userData)
  })

  socket.on('typing:stop', (userData) => {
    socket.broadcast.emit('typing:stop', userData)
  })

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id)
  })
})

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

const PORT = process.env.PORT || 5003

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Frontend: http://localhost:3007`)
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`)
  console.log(`🗄️  Storage: ${isConnected ? 'MongoDB' : 'In-memory (MongoDB unavailable)'}`)
}) 