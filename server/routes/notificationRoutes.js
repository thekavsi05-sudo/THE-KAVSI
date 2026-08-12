import express from 'express';

import {
  registerNotificationToken,
  sendTestNotification,
} from '../controllers/notificationController.js';

const router = express.Router();

router.post('/register', registerNotificationToken);

router.post('/send-test', sendTestNotification);

export default router;