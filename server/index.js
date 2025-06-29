import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import mongoose from 'mongoose'
import { OAuth2Client } from 'google-auth-library'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
const MONGODB_URI = 'mongodb+srv://govindayadav2478:Geh3eqcU5ub0X58G@cluster0.vqwlghm.mongodb.net/'

// Check if we're in a deployment environment
const isDeployment = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.VERCEL

// In-memory storage fallback
const inMemoryUsers = new Map()
const inMemoryMessages = []
const inMemoryFiles = new Map() // Store file metadata for recovery

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
  mimeType: { type: String, required: true },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  isImage: { type: Boolean, default: false }
})

const User = mongoose.model('User', userSchema)
const Message = mongoose.model('Message', messageSchema)
const File = mongoose.model('File', fileSchema)

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

// Simple file serving middleware
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

// File upload configuration - Use disk storage but implement cloud backup
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
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
})

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

app.post('/api/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('📁 File upload request received')
    console.log('👤 User:', req.user)
    console.log('📄 File:', req.file ? 'present' : 'missing')
    
    if (!req.file) {
      console.log('❌ No file uploaded')
      return res.status(400).json({ message: 'No file uploaded' })
    }

    console.log('📄 File details:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    })

    // Verify file was actually saved
    if (!fs.existsSync(req.file.path)) {
      console.error('❌ File was not saved to disk:', req.file.path)
      return res.status(500).json({ message: 'File upload failed - file not saved' })
    }

    // Create full URL for the file
    const baseUrl = req.protocol + '://' + req.get('host')
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`
    
    console.log('🔗 File URL:', fileUrl)
    console.log('📁 Uploads directory:', uploadsDir)
    console.log('📁 File path:', req.file.path)
    
    // Create file metadata
    const fileData = {
      id: uuidv4(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileUrl: fileUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
      isImage: req.file.mimetype.startsWith('image/')
    }

    console.log('💾 File metadata:', fileData)

    // Store file metadata in database
    if (isConnected) {
      const newFile = new File(fileData)
      await newFile.save()
      console.log('✅ File metadata saved to MongoDB')
    } else {
      saveFile(fileData)
      console.log('✅ File metadata saved to memory')
    }
    
    console.log('✅ File upload successful')
    res.json({
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      isImage: req.file.mimetype.startsWith('image/')
    })
  } catch (error) {
    console.error('❌ File upload error:', error)
    console.error('❌ Error stack:', error.stack)
    res.status(500).json({ message: 'Server error: ' + error.message })
  }
})

app.post('/api/profile/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('Profile upload endpoint - Request received')
    console.log('Profile upload endpoint - User:', req.user)
    console.log('Profile upload endpoint - File:', req.file ? 'present' : 'missing')
    
    if (!req.file) {
      console.log('Profile upload endpoint - No file uploaded')
      return res.status(400).json({ message: 'No file uploaded' })
    }

    // Check if file is an image
    if (!req.file.mimetype.startsWith('image/')) {
      console.log('Profile upload endpoint - Invalid file type:', req.file.mimetype)
      return res.status(400).json({ message: 'Only image files are allowed' })
    }

    // Create full URL for the avatar
    const baseUrl = req.protocol + '://' + req.get('host')
    const avatarUrl = `${baseUrl}/uploads/${req.file.filename}`
    console.log('Profile upload endpoint - Avatar URL:', avatarUrl)
    
    // Store file metadata for profile pictures
    const fileData = {
      id: uuidv4(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileUrl: avatarUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
      isImage: true
    }

    if (isConnected) {
      const newFile = new File(fileData)
      await newFile.save()
    } else {
      saveFile(fileData)
    }
    
    // Update user's avatar in database
    if (isConnected) {
      const updatedUser = await User.findOneAndUpdate(
        { id: req.user.id },
        { avatar: avatarUrl, updatedAt: new Date() },
        { new: true }
      )
      console.log('Profile upload endpoint - User updated in MongoDB:', updatedUser ? 'yes' : 'no')
    } else {
      const user = findUserById(req.user.id)
      if (user) {
        user.avatar = avatarUrl
        user.updatedAt = new Date()
        saveUser(user)
        console.log('Profile upload endpoint - User updated in memory')
      } else {
        console.log('Profile upload endpoint - User not found in memory')
      }
    }

    console.log('Profile upload endpoint - Success, returning avatar URL')
    res.json({ avatar: avatarUrl })
  } catch (error) {
    console.error('Profile upload error:', error)
    res.status(500).json({ message: 'Server error: ' + error.message })
  }
})

// Endpoint to recover files from database (useful after server restart)
app.get('/api/files/recover', authenticateToken, async (req, res) => {
  try {
    if (isConnected) {
      const files = await File.find({ uploadedBy: req.user.id }).sort({ uploadedAt: -1 })
      res.json({ files, message: 'Files recovered from MongoDB' })
    } else {
      const files = getAllFiles().filter(file => file.uploadedBy === req.user.id)
      res.json({ files, message: 'Files recovered from memory' })
    }
  } catch (error) {
    console.error('File recovery error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Endpoint to check and fix missing files
app.get('/api/files/check-missing', authenticateToken, async (req, res) => {
  try {
    let missingFiles = []
    
    if (isConnected) {
      const files = await File.find({ uploadedBy: req.user.id })
      
      for (const file of files) {
        const filePath = path.join(uploadsDir, file.filename)
        if (!fileExists(filePath)) {
          missingFiles.push({
            id: file.id,
            filename: file.filename,
            originalName: file.originalName,
            fileUrl: file.fileUrl,
            uploadedAt: file.uploadedAt
          })
        }
      }
    } else {
      const files = getAllFiles().filter(file => file.uploadedBy === req.user.id)
      
      for (const file of files) {
        const filePath = path.join(uploadsDir, file.filename)
        if (!fileExists(filePath)) {
          missingFiles.push({
            id: file.id,
            filename: file.filename,
            originalName: file.originalName,
            fileUrl: file.fileUrl,
            uploadedAt: file.uploadedAt
          })
        }
      }
    }
    
    res.json({ 
      missingFiles, 
      totalMissing: missingFiles.length,
      message: missingFiles.length > 0 ? 'Some files are missing after server restart' : 'All files are present'
    })
  } catch (error) {
    console.error('Check missing files error:', error)
    res.status(500).json({ message: 'Server error' })
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

// Test endpoint to verify backend is working
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!', 
    timestamp: new Date().toISOString(),
    mongodb: isConnected ? 'connected' : 'disconnected',
    deployment: isDeployment ? 'yes' : 'no'
  })
})

// Serve files from base64 data
app.get('/api/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params
    
    let fileData
    if (isConnected) {
      fileData = await File.findOne({ id: fileId })
    } else {
      fileData = findFileById(fileId)
    }
    
    if (!fileData) {
      return res.status(404).json({ message: 'File not found' })
    }
    
    if (fileData.isImage && fileData.base64Data) {
      // For images, return the data URL
      const dataUrl = `data:${fileData.mimeType};base64,${fileData.base64Data}`
      res.json({ dataUrl, fileData })
    } else {
      // For non-images, return file info
      res.json({ fileData })
    }
  } catch (error) {
    console.error('File serve error:', error)
    res.status(500).json({ message: 'Server error' })
  }
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
    // In a real app, you'd want to track which user this socket belongs to
    // and update their status accordingly
    // For now, we'll just log the disconnect
  })
})

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

// Migration endpoint to convert existing files to base64 (run once)
app.post('/api/migrate-files-to-base64', authenticateToken, async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ message: 'Migration only works with MongoDB' })
    }
    
    const files = await File.find({})
    let migratedCount = 0
    
    for (const file of files) {
      if (!file.base64Data && file.isImage) {
        try {
          // Try to read the file from disk
          const filePath = path.join(uploadsDir, file.filename)
          if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath)
            file.base64Data = fileBuffer.toString('base64')
            file.fileUrl = `data:${file.mimeType};base64,${file.base64Data}`
            await file.save()
            migratedCount++
            console.log(`Migrated file: ${file.filename}`)
          }
        } catch (error) {
          console.error(`Failed to migrate file ${file.filename}:`, error)
        }
      }
    }
    
    res.json({ 
      message: `Migration completed. ${migratedCount} files migrated to base64.`,
      migratedCount 
    })
  } catch (error) {
    console.error('Migration error:', error)
    res.status(500).json({ message: 'Migration failed' })
  }
})

const PORT = process.env.PORT || 5003

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Frontend: http://localhost:3007`)
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`)
  console.log(`🗄️  Storage: ${isConnected ? 'MongoDB' : 'In-memory (MongoDB unavailable)'}`)
}) 