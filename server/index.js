const { PORT } = require('./config.js')
// const sessions = require('express-session')
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
  logoutMiddleware,
  jwtAuthMiddleware
} = require('./middlewares.js')

const io = socketio(http, {
  cors: { origin: '*' } // need a better fix for cors errors
})

initDB()
io.use( jwtAuthMiddleware )
io.use((socket, next) => {
  console.log('io middleware')
  const userName = socket.userName
  const userID = socket.userID
  if (!userName) {
    console.log(' in err')
    return next(new Error("invalid username"))
  }
  console.log('after io mw')
  socket.userName = userName
  socket.userID = userID
  next() 
})

  // users array stores the list of users will be shared to the client

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

  io.emit("users", users)

  const messages = await getMessagesFn()
  console.log('messages', messages)

  // hack because on refresh all sockets recieve messages event except the connecting socket 
  // socket.to(socket.socketID).emit('messages', messages.filter(msg => msg.user_name === socket.userName || msg.recipient === socket.userID || msg.room_id === 'general'))

  for (user of users) {
    const messagesForCurrentUser = messages.filter(
      msg => msg.user_name === user.userName || 
      msg.recipient === user.userID || 
      msg.room_id === 'general'
      )

    console.log("current user", user, "messagesForCurrentUser", messagesForCurrentUser)
    io.to(user.socketID).emit('messages', messagesForCurrentUser, 'hi')
  }
  // io.emit('messages', messages)

  socket.on("private message", ({content, userID}) => {
    console.log("priv to", userID)
    to = users.find(a => a.userID ===userID).socketID
    socket.to(to).emit("private message", {
      content,
      from: socket.userName
    })

    insertMessageFn(content)
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
// app.use(sessions({
//   secret: 'abc',
//   cookie: {
//     maxAge: 3600000
//   },
//   resave: true,
//   saveUninitialized: false
// }))

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
