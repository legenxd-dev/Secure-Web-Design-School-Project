import { Router } from 'express';
import {
  register,
  login,
  logout,
  registerValidators,
  loginValidators,
} from '../controllers/auth.controller';
import { handleValidationErrors } from '../middleware/validate.middleware';
import { authLimiter } from '../middleware/rateLimiters';

const router = Router();

router.post('/register', authLimiter, registerValidators, handleValidationErrors, register);
router.post('/login', authLimiter, loginValidators, handleValidationErrors, login);
router.post('/logout', logout);

export default router;
