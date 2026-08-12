import NotificationToken from '../models/NotificationToken.js';
import { messaging } from '../config/firebaseAdmin.js';

/* Register FCM token */
export async function registerNotificationToken(req, res) {
  try {
    const { token, phone } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
    }

    const existing = await NotificationToken.findOne({ token });

    if (existing) {
      existing.phone = phone || existing.phone;
      existing.lastUsedAt = new Date();

      await existing.save();

      return res.status(200).json({
        success: true,
        message: 'FCM token already registered',
      });
    }

    await NotificationToken.create({
      token,
      phone: phone || null,
      lastUsedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'FCM token registered successfully',
    });
  } catch (error) {
    console.error('FCM token registration error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to register FCM token',
    });
  }
}

/* Send test notification to all registered devices */
export async function sendTestNotification(req, res) {
  try {
    const { title, body } = req.body;

    const tokens = await NotificationToken.find({});

    if (!tokens.length) {
      return res.status(404).json({
        success: false,
        message: 'No FCM tokens registered',
      });
    }

    const results = [];

    for (const item of tokens) {
      try {
        const message = {
          token: item.token,

          notification: {
            title: title || 'THE KAVSI',
            body: body || 'This is a test notification from KAVSI.',
          },

          webpush: {
            notification: {
              icon: '/logo.jpeg',
              badge: '/logo.jpeg',
            },
          },
        };

        const response = await messaging.send(message);

        results.push({
          success: true,
          messageId: response,
          token: item.token,
        });
      } catch (error) {
        console.error('FCM send error:', error);

        results.push({
          success: false,
          error: error.message,
          token: item.token,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Notification sending completed',
      results,
    });
  } catch (error) {
    console.error('Send notification error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to send notification',
    });
  }
}

/* Send notification to a specific customer's registered device(s) */
export async function sendNotificationToPhone(
  phone,
  title,
  body,
  data = {}
) {
  try {
    if (!phone) {
      console.log(
        'No phone number supplied for FCM notification'
      );
      return;
    }

    const normalizedPhone = String(phone).trim();

    const tokens = await NotificationToken.find({
      phone: normalizedPhone,
    });

    if (!tokens.length) {
      console.log(
        `No FCM token found for phone: ${normalizedPhone}`
      );
      return;
    }

    for (const item of tokens) {
      try {
        const message = {
          token: item.token,

          notification: {
            title: title || 'THE KAVSI',
            body: body || '',
          },

          data: Object.fromEntries(
            Object.entries(data).map(([key, value]) => [
              key,
              String(value),
            ])
          ),

          webpush: {
            notification: {
              icon: '/logo.jpeg',
              badge: '/logo.jpeg',
            },
          },
        };

        const response = await messaging.send(message);

        console.log(
          `FCM notification sent to ${normalizedPhone}:`,
          response
        );
      } catch (error) {
        console.error(
          `FCM notification failed for ${normalizedPhone}:`,
          error.message
        );
      }
    }
  } catch (error) {
    console.error(
      `FCM phone notification error for ${phone}:`,
      error
    );
  }
}