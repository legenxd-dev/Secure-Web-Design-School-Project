import { Router } from 'express';
import {
  register,
  login,
  logout,
  registerValidators,
  loginValidators,
} from '../controllers/auth.controller';
import { handleValidationErrors } from '../middleware/validate.middleware';

const router = Router();

router.post('/register', registerValidators, handleValidationErrors, register);
router.post('/login', loginValidators, handleValidationErrors, login);
router.post('/logout', logout);

export default router;
