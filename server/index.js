const { PORT } = require('./config.js')
const sessions = require('express-session')
const path = require('path')
const cors = require("cors")
const express = require('express')
const app = express()

const http = require('http').createServer(app)
const socketio = require('socket.io')

const { initDB } = require('./database/init.js')

const { registerRouter } = require('./routes/registerRouter.js')
const { loginRouter } = require('./routes/loginRouter.js')

const { getMessagesFn, insertMessageFn } = require('./utils')
const {
  authMiddleware,
  checkLoggedinMiddleware,
  logoutMiddleware
} = require('./middlewares.js')

const io = socketio(http, {
  cors: { origin: '*' } // need a better fix for cors errors
})

initDB()
io.use((socket, next) => {
  console.log('io middleware')
  const userName = socket.handshake.auth.userName
  const userID = socket.handshake.auth.userID
  if (!userName) {
    return next(new Error("invalid username"))
  }
  socket.userName = userName
  socket.userID = userID
  next() 
})
let users = [];

io.on('connection', async (socket) => {
  socket.join(socket.id)
  console.log('a user connected', socket.id)
  for (let [id, socket] of io.of("/").sockets) {
    if (users.find(a => a.userName === socket.userName)) {
      console.log('matched')
      continue
    }
    users.push({
      socketID: id,
      userID: socket.userID, //changed from id to this
      userName: socket.userName,
    })
  } // adding userInfo for searching up in client

  console.log('users', users)

  
  io.emit("user connected", {
    userID: socket.userID,
    userName: socket.userName
  })

  socket.emit("users", users)
  const messages = await getMessagesFn()
  io.emit('messages', messages)

  socket.on("private message", ({content, to}) => {
    socket.to(to).emit("private message", {
      content,
      from: socket.id
    })
  })
  socket.on('disconnect', () => {
    console.log('users on disconnection', users)
    users = users.filter(a => a.socketID !== socket.id)
    console.log('users after filter', users, socket.id)
    socket.emit('new users', users)
  })
  socket.on('message', (msg) => {
    console.log('in message')
    insertMessageFn(msg)
    io.emit('message', msg)
  })
})
app.use(cors({
  origin: "http://localhost:3000",
  optionsSuccessStatus: 200
}))
app.use(sessions({
  secret: 'abc',
  cookie: {
    maxAge: 3600000
  },
  resave: true,
  saveUninitialized: false
}))

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use('/', express.static(path.join(__dirname, '/public/mainPage')))

app.use('/static/login_page', 
checkLoggedinMiddleware, 
express.static(path.join(__dirname, '/public/loginPage')))

app.use('/static/room', authMiddleware, express.static(path.join(__dirname, '/public/room')))
app.use('/static/register_page', express.static(path.join(__dirname, '/public/registerPage')))

app.use('/api/login', loginRouter)
app.use('/api/register', registerRouter)
app.use('/api/logout', logoutMiddleware)

http.listen(PORT, () => console.log('listening on http://localhost:8000'))
