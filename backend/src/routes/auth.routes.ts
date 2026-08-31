import { Router } from 'express';
import {
  changePassword,
  login,
  logout,
  me,
  refresh,
  register,
  turnsSession,
} from '../controllers/auth.controller';
import { authenticate, requireAdmin, validate } from '../middlewares';
import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  turnsSessionSchema,
} from '../validators';

const router = Router();

router.post('/login', validate({ body: loginSchema }), login);
// No public sign-up: only an admin creates accounts.
router.post('/register', authenticate, requireAdmin, validate({ body: registerSchema }), register);
// Called after the client has signed in to turns; we re-verify that token
// server-side before trusting the identity it claims.
router.post('/turns-session', validate({ body: turnsSessionSchema }), turnsSession);
router.post('/refresh', validate({ body: refreshSchema }), refresh);
router.post('/logout', authenticate, validate({ body: logoutSchema }), logout);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), changePassword);

export default router;
