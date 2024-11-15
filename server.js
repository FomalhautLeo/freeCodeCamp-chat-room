'use strict';

// const fccTesting = require('./freeCodeCamp/fcctesting.js');
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session'
import passport from 'passport';

import myDB from './connection.js'
import routes from './routes.js';
import auth from './auth.js';

import connectMongo from 'connect-mongo';
import http from 'http';
import SocketIO from 'socket.io';

const app = express();
const myHttp = http.createServer(app);
const io = SocketIO(myHttp);

dotenv.config();

const URI = process.env.MONGO_URI;
const store = new connectMongo(session)({ url: URI });

// *** OLD CODE
// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: true,
//   saveUninitialized: true,
//   store: store,
//   cookie: { secure: false }
// }));
// app.use(passport.initialize());
// app.use(passport.session());
// io.use(
//   passportSocketIo.authorize({
//     cookieParser: cookieParser,
//     key: 'express.sid',
//     secret: process.env.SESSION_SECRET,
//     store: store,
//     success: onAuthorizeSuccess,
//     fail: onAuthorizeFail
//   })
// );
// function onAuthorizeSuccess(data, accept) {
//   console.log('successful connection to socket.io');
//   accept(null, true);
// }
// function onAuthorizeFail(data, message, error, accept) {
//   if (error) throw new Error(message);
//   console.log('failed connection to socket.io:', message);
//   accept(null, false);
// }

// ***NEW CODE
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  store: store,
  cookie: { secure: false },
})));

io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

io.use((socket, next) => {
  if (socket.request.user) {
    console.log('== Successful connection to socket.io');
    next();
  } else {
    console.error('** Failed connection to socket.io: Unauthorized');
    next(new Error("Unauthorized"));
  }
});
// ***NEW CODE

myDB(async client => {
  const myDataBase = await client.db('database').collection('users');
  // 基础设置
  app.use('/public', express.static(process.cwd() + '/public'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // PUG 渲染
  app.set('view engine', 'pug');
  app.set('views', './views/pug')
  // 监听连接
  const PORT = process.env.PORT || 3000;
  http.listen(PORT, () => {
    console.log('Listening on port ' + PORT);
  });

  let currentUsers = 0;
  io.on('connection', socket => {
    console.log('user ' + socket.request.user.username + ' connected');
    currentUsers++;

    io.emit('user', {
      username: socket.request.user.name,
      currentUsers,
      connected: true
    });

    socket.on('disconnect', () => {
      console.log('A user has disconnected');
      currentUsers--;
      io.emit('user', {
        username: socket.request.user.name,
        currentUsers,
        connected: false
      });
    });

    socket.on('chat message', (message) => {
      io.emit('chat message', {
        username: socket.request.user.name,
        message,
      });
    });
  });

  routes(app, myDataBase);
  auth(app, myDataBase);

  app.use((req, res, next) => {
    res.status(404)
      .type('text')
      .send('Not Found');
  });
}).catch(e => {
  app.route('/').get((req, res) => {
    res.render('index', { title: e, message: 'Unable to connect to database' });
  });
});

// fccTesting(app); //For FCC testing purposes