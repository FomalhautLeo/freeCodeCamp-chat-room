import dotenv from 'dotenv';
import passport from 'passport';
import bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import LocalStrategy from 'passport-local';
import passportGithub from 'passport-github';
import debug from 'debug';

const log = debug('my-app');

dotenv.config();
const GitHubStrategy = passportGithub.Strategy;

export default function (app, myDataBase) {

  passport.serializeUser((user, done) => {
    log(`-- Serializing user: ${user}`);
    done(null, user._id.toString());
  });
  passport.deserializeUser(async (id, done) => {
    try {
      log(`-- Deserialzing id: ${id}`);
      const user = await myDataBase.findOne({ _id: ObjectId.createFromHexString(id) });
      if (!user) {
        console.log(`-- ID '${id}' not found.`);
        done(null, false);
      }
      log(`--   find user '${user.username}'...`)
      done(null, user);
    } catch (err) {
      console.error(`** Error during deserialize id: ${id}`, err.stack);
      return done(err);
    }
  });

  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      console.log(`-- User ${username} attempted to log in.`);
      const user = await myDataBase.findOne({ username: username });
      log(`-- Checking user '${username}'...`);
      if (!user) {
        console.log(`-- User '${username}' not found.`);
        return done(null, false);
      }
      log("-- Checking passwd...");
      const passwdMatch = await bcrypt.compare(password, user.password);
      if (!passwdMatch) {
        console.log(`-- Incorrect password for '${username}'.`);
        return done(null, false);
      }
      log("-- Local auth passed.");
      return done(null, user);
    } catch (err) {
      console.error("** Error during authentication:", err);
      return done(err);
    }
  }));

  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/callback",
  },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        log(`-- Logged with github [${profile.displayName}]`);
        //Database logic here with callback containing your user object
        const user = await myDataBase.findOneAndUpdate(
          { id: profile.id },
          {
            $setOnInsert: {
              id: profile.id,
              username: profile.username,
              name: profile.displayName || 'John Doe',
              photo: profile.photos[0].value || '',
              email: Array.isArray(profile.emails)
                ? profile.emails[0].value
                : 'No public email',
              created_on: new Date(),
              provider: profile.provider || ''
            },
            $set: {
              last_login: new Date()
            },
            $inc: {
              login_count: 1
            }
          },
          { upsert: true, new: true }
        );
        if (!user) {
          console.log("** Eroor during findAndUpdate logging with github...");
          return cb(null);
        }
        log("--    update mongodb, continue: ", user.username);
        return cb(null, user);
      } catch (e) {
        if (err) {
          console.error("Error at saving:", err);
          return cb(err);
        }
      }
    }
  ));
}