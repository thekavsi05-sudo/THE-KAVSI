importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

const firebaseConfig = {
  apiKey: "AIzaSyBYAuPDnKfyrsLtv1DAgkXavxusGFFpAB4",
  authDomain: "the-kavsi.firebaseapp.com",
  projectId: "the-kavsi",
  storageBucket: "the-kavsi.firebasestorage.app",
  messagingSenderId: "855835826819",
  appId: "1:855835826819:web:d0566d0f0e3266dc9a59b6",
  measurementId: "G-1YFNRP1CSW",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Background message:",
    payload
  );

  const title =
    payload.notification?.title || "THE KAVSI";

  const options = {
    body:
      payload.notification?.body ||
      "You have a new notification.",

    icon: "/logo.jpeg",

    badge: "/logo.jpeg",

    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});