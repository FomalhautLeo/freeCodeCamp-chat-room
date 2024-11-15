import passport from 'passport';
import bcrypt from 'bcrypt'
import debug from 'debug';

const log = debug('my-app');

export default function (app, myDataBase) {
  app.route('/').get((req, res) => {
    res.render('index', {
      title: 'Connected to Database',
      message: 'Please login',
      showLogin: true,
      showRegistration: true,
      showSocialAuth: true
    });
  })

  function ensureAuthenticated(req, res, next) {
    log("-- Checking auth: ", req.user.username);
    if (req.isAuthenticated()) {
      return next();
    }
    console.log("-- Check auth failed. Redirect to /");
    res.redirect('/');
  };

  app.route('/login').post(passport.authenticate('local', { failureRedirect: '/' }), (req, res) => {
    console.log(`== User ${req.user.username} logged in.`);
    res.redirect('/chat');
    // res.redirect('/');
    // res.redirect('/profile')
  });

  app.route('/profile').get(ensureAuthenticated, (req, res) => {
    res.render('profile', { username: req.user.username });
  });

  app.route('/logout')
    .get((req, res) => {
      console.log(`-- User ${req.user.username} logged out.`);
      req.logout();
      res.redirect('/');
    });

  app.route('/register')
    .post(async (req, res, next) => {
      try {
        const username = req.body.username;
        const user = await myDataBase.findOne({ username });
        if (user) {
          // 用户已存在
          console.log(`-- User '${username}' has already registered. Redirect to /`);
          res.redirect('/');
        } else {
          console.log(`-- Store information for user '${username}'...`);
          const hash = await bcrypt.hash(req.body.password, 12);
          const result = await myDataBase.insertOne({
            username,
            password: hash,
          });
          const user = await myDataBase.findOne({ _id: result.insertedId })
          // 手动登录
          req.login(user, (err) => {
            if (err) {
              console.error("** Error logging in newly registered user:", err);
              return next(err);
            }
            console.log(`== User '${user.username}' registered and logged in.`);
            res.redirect('/profile');
          });
          res.redirect('/profile');
        }
      } catch (e) {
        console.error("** Error during register: ", e);
        return next(e);
      }
    },
      passport.authenticate('local', { failureRedirect: '/' }),
      (req, res, next) => {
        res.redirect('/profile');
      }
    );

  app.route('/auth/github').get(passport.authenticate('github'), (req, res) => {
    console.log("== Logging with github...");
  });
  app.route('/auth/github/callback')
    .get(passport.authenticate('github', { failureRedirect: '/' }), (req, res) => {
      console.log("== Github callback, redirecting to /chat...");
      // req.session.user_id = req.user.id
      res.redirect('/chat');
    });

  app.route('/chat')
    .get(ensureAuthenticated, (req, res) => {
      res.render('chat', { user: req.user });
    });

  // 其他资源不存在的情况
  app.use((req, res, next) => {
    res.status(404)
      .type('text')
      .send('Not Found');
  });

}