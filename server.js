'use strict';

// const fccTesting = require('./freeCodeCamp/fcctesting.js');
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session'
import passport from 'passport';
import debug from 'debug';

import routes from './routes.js';
import auth from './auth.js';

import connectMongo from 'connect-mongo';
import http from 'http';
import SocketIO from 'socket.io';
import { MongoClient } from 'mongodb';


const app = express();
const myHttp = http.createServer(app);
const io = SocketIO(myHttp);
const log = debug('my-app');

dotenv.config();
async function startServer() {
  try {
    log("Server start...");
    // 连接数据库
    const URI = process.env.MONGO_URI;
    log("Mongo URI: ", URI);
    const client = new MongoClient(URI);
    await client.connect();
    const myDataBase = client.db('database').collection('users');
    const store = connectMongo.create({ client });
    // 清空已有会话
    // store.clear();

    // 设置会话
    const sessionConfig = {
      secret: process.env.SESSION_SECRET,
      resave: true,
      saveUninitialized: true,
      store: store,
      cookie: { secure: false },
    };
    app.use(session(sessionConfig));
    app.use(passport.initialize());
    app.use(passport.session());
    const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
    io.use(wrap(session(sessionConfig)));
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
    // 错误处理
    // io.use((err, socket, next) => {
    //   console.error("Error in Socket.IO middleware:", err);
    //   if (socket.connected) {
    //     socket.disconnect(true);
    //   }
    // });

    // 基础设置
    app.use('/public', express.static(process.cwd() + '/public'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // PUG 渲染
    app.set('view engine', 'pug');
    app.set('views', './views/pug')

    auth(app, myDataBase);
    routes(app, myDataBase);

    // 监听连接
    const PORT = process.env.PORT || 3000;
    myHttp.listen(PORT, () => {
      console.log('== Listening on port ' + PORT);
    });

    let currentUsers = 0;
    io.on('connection', socket => {
      log('-- User ' + socket.request.user.username + ' connected');
      currentUsers++;
      io.emit('user', {
        username: socket.request.user.username,
        currentUsers,
        connected: true
      });

      socket.on('disconnect', () => {
        console.log(`-- ${socket.request.user.username} has disconnected`);
        currentUsers--;
        io.emit('user', {
          username: socket.request.user.username,
          currentUsers,
          connected: false
        });
      });

      socket.on('chat message', (message) => {
        io.emit('chat message', {
          username: socket.request.user.username,
          message,
        });
      });
    });

    log("Server exit...");
  } catch (e) {
    app.route('/').get((req, res) => {
      res.render('index', { title: e, message: 'Unable to connect to database' });
    });
    console.error("startServer() error: ", e);
  }
}

// fccTesting(app); //For FCC testing purposes
startServer();