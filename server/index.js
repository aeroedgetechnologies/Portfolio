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
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '608696852958-egnf941du33oe5cnjp7gc1vhfth7c6pi.apps.googleusercontent.com')

// MongoDB Connection - Use environment variable or fallback to in-memory
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://govindayadav2478:Geh3eqcU5ub0X58G@cluster0.vqwlghm.mongodb.net/'

// In-memory storage fallback
const inMemoryUsers = new Map()
const inMemoryMessages = []

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

const User = mongoose.model('User', userSchema)
const Message = mongoose.model('Message', messageSchema)

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

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}))
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
      audience: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id'
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
    console.log('Message endpoint - Request received:', req.body)
    console.log('Message endpoint - User:', req.user)
    
    const { content, type = 'text', fileName, fileSize, receiverId, fileUrl } = req.body
    
    if (!receiverId) {
      console.log('Message endpoint - Missing receiverId')
      return res.status(400).json({ message: 'Receiver ID is required' })
    }
    
    let user
    if (isConnected) {
      user = await User.findOne({ id: req.user.id })
    } else {
      user = findUserById(req.user.id)
    }
    
    console.log('Message endpoint - Found user:', user ? 'yes' : 'no')
    
    if (!user) {
      console.log('Message endpoint - User not found')
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

    console.log('Message endpoint - Created message:', message)

    if (isConnected) {
      const newMessage = new Message(message)
      await newMessage.save()
      console.log('Message endpoint - Message saved to MongoDB')
      // Emit to all clients (sender will handle it properly in frontend)
      io.emit('message:receive', newMessage)
      res.json(newMessage)
    } else {
      const savedMessage = saveMessage(message)
      console.log('Message endpoint - Message saved to memory')
      // Emit to all clients (sender will handle it properly in frontend)
      io.emit('message:receive', savedMessage)
      res.json(savedMessage)
    }
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

    // Create full URL for the file
    const baseUrl = req.protocol + '://' + req.get('host')
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`
    
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

const PORT = process.env.PORT || 5003

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Frontend: http://localhost:3007`)
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`)
  console.log(`🗄️  Storage: ${isConnected ? 'MongoDB' : 'In-memory (MongoDB unavailable)'}`)
}) 