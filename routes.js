const passport = require('passport');
const bcrypt = require('bcrypt');

module.exports = function (app, myDataBase) {

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
    console.log("-- Checking auth: ", req.user);
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect('/');
  };

  app.route('/login').post(passport.authenticate('local', { failureRedirect: '/' }), (req, res) => {
    console.log(`User ${req.username} logged in.`);
    res.redirect('/chat');
    // res.redirect('/');
    // res.redirect('/profile')
  });
  app.route('/profile').get(ensureAuthenticated, (req, res) => {
    res.render('profile', { username: req.user.username });
  });

  app.route('/logout')
    .get((req, res) => {
      req.logout();
      res.redirect('/');
    });

  app.route('/register')
    .post((req, res, next) => {
      myDataBase.findOne({ username: req.body.username }, (err, user) => {
        if (err) {
          next(err);
        } else if (user) {
          res.redirect('/');
        } else {
          const hash = bcrypt.hashSync(req.body.password, 12);
          myDataBase.insertOne({
            username: req.body.username,
            password: hash,
          },
            (err, doc) => {
              if (err) {
                res.redirect('/');
              } else {
                // The inserted document is held within
                // the ops property of the doc
                next(null, doc.ops[0]);
              }
            }
          )
        }
      })
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
      console.log("== Github callback, redirecting to /profile...");
      // req.session.user_id = req.user.id
      res.redirect('/chat');
    });

  app.route('/chat')
    .get(ensureAuthenticated, (req, res) => {
      res.render('chat', { user: req.user });
    });
}