import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "../firebase";
import { registerNotificationToken } from "./api";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function requestNotificationPermission() {
  try {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications.");
      return null;
    }

    if (!VAPID_KEY) {
      console.error("VITE_FIREBASE_VAPID_KEY is missing.");
      return null;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Notification permission was not granted.");
      return null;
    }

    const messaging = await getFirebaseMessaging();

    if (!messaging) {
      console.log("Firebase Messaging is not supported.");
      return null;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.log("No FCM registration token received.");
      return null;
    }
    console.log("FCM token:", token);
    localStorage.setItem("kavsi_fcm_token", token);
    try {await registerNotificationToken(token);
        console.log("FCM token successfully registered with KAVSI backend");
    } catch (error) {console.error("Failed to register FCM token with backend:",error);
}

return token;
  } catch (error) {
    console.error("FCM notification setup failed:", error);
    return null;
  }
}

export function listenForForegroundMessages(callback) {
  let unsubscribe = null;

  getFirebaseMessaging()
    .then((messaging) => {
      if (!messaging) return;

      unsubscribe = onMessage(messaging, (payload) => {
  console.log("Foreground FCM message:", payload);

  // Show browser notification when website is open
  if (
    Notification.permission === "granted" &&
    payload.notification
  ) {
    const title = payload.notification.title || "THE KAVSI";

    const options = {
      body:
        payload.notification.body ||
        "You have a new notification.",
      icon: "/logo.jpeg",
      badge: "/logo.jpeg",
      data: payload.data || {},
    };

    new Notification(title, options);
  }

  // Also send payload to React if needed
  if (callback) {
    callback(payload);
  }
 });
    })
    .catch((error) => {
      console.error("FCM foreground listener failed:", error);
    });

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}