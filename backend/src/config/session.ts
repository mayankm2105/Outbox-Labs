import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { env } from './env';

const PgSession = connectPgSimple(session);

export function configureSession() {
  const isProduction = env.NODE_ENV === 'production';

  return session({
    store: new PgSession({
      conString: env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    name: 'reachinbox.sid',
    cookie: {
      maxAge: env.SESSION_TTL_SECONDS * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    },
  });
}

