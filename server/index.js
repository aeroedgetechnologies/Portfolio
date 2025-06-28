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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3006",
    methods: ["GET", "POST"],
    credentials: true
  }
})

// MongoDB Connection
const MONGODB_URI = "mongodb+srv://govindayadav2478:bVBtO9ELerYpUzY@cluster0.qkn9nmw.mongodb.net/chatapp?retryWrites=true&w=majority"

// In-memory storage fallback
const inMemoryUsers = new Map()
const inMemoryMessages = []

// MongoDB connection
let isConnected = false
try {
  await mongoose.connect(MONGODB_URI)
  isConnected = true
  console.log('✅ MongoDB connected successfully')
} catch (error) {
  console.log('❌ MongoDB connection error:', error.message)
  console.log('⚠️  Using in-memory storage instead')
  isConnected = false
}

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String },
  status: { type: String, default: 'offline' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' },
  senderId: { type: String, required: true },
  sender: {
    id: { type: String, required: true },
    username: { type: String, required: true },
    avatar: { type: String }
  },
  roomId: { type: String, default: 'general' },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: String }],
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: Number }
})

const User = mongoose.model('User', userSchema)
const Message = mongoose.model('Message', messageSchema)

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../dist')))
app.use('/uploads', express.static('uploads'))

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const upload = multer({ storage })

// JWT Secret (use environment variable in production)
const JWT_SECRET = 'your-secret-key'

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.sendStatus(401)
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403)
    req.user = user
    next()
  })
}

// Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = uuidv4()
    
    const user = new User({
      id: userId,
      username,
      email,
      password: hashedPassword,
      status: 'online'
    })

    await user.save()

    const token = jwt.sign({ id: userId, email }, JWT_SECRET)
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
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })

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
    await user.save()

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

app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 }).limit(100)
    res.json(messages)
  } catch (error) {
    console.error('Get messages error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { content, type = 'text' } = req.body
    const user = await User.findOne({ id: req.user.id })
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const message = new Message({
      id: uuidv4(),
      content,
      type,
      senderId: user.id,
      sender: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      },
      timestamp: new Date()
    })

    await message.save()
    io.emit('message:receive', message)
    res.json(message)
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const fileUrl = `/uploads/${req.file.filename}`
    res.json({
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    })
  } catch (error) {
    console.error('File upload error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ status: -1, username: 1 })
    res.json(users)
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('join', async (userData) => {
    try {
      socket.userId = userData.id
      socket.username = userData.username
      socket.join('general')
      
      // Update user status in database
      await User.findOneAndUpdate(
        { id: userData.id },
        { status: 'online', updatedAt: new Date() }
      )
      
      io.emit('user:status', { userId: userData.id, status: 'online' })
    } catch (error) {
      console.error('Socket join error:', error)
    }
  })

  socket.on('message:send', async (messageData) => {
    try {
      const user = await User.findOne({ id: messageData.senderId })
      if (!user) return

      const message = new Message({
        id: uuidv4(),
        ...messageData,
        sender: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
        },
        timestamp: new Date()
      })
      
      await message.save()
      io.emit('message:receive', message)
    } catch (error) {
      console.error('Socket message error:', error)
    }
  })

  socket.on('typing:start', (data) => {
    socket.broadcast.emit('typing:start', {
      userId: socket.userId,
      username: socket.username,
      roomId: data.roomId,
      isTyping: true
    })
  })

  socket.on('typing:stop', (data) => {
    socket.broadcast.emit('typing:stop', {
      userId: socket.userId,
      roomId: data.roomId
    })
  })

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id)
    
    // Update user status in database
    if (socket.userId) {
      try {
        await User.findOneAndUpdate(
          { id: socket.userId },
          { status: 'offline', updatedAt: new Date() }
        )
        io.emit('user:status', { userId: socket.userId, status: 'offline' })
      } catch (error) {
        console.error('Socket disconnect error:', error)
      }
    }
  })
})

// Serve static files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

const PORT = process.env.PORT || 5002
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Frontend: http://localhost:3006`)
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`)
  if (isConnected) {
    console.log(`🗄️  MongoDB: Connected to Cluster0`)
  } else {
    console.log(`🗄️  Storage: In-memory (MongoDB unavailable)`)
  }
}) 