import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import TrackOrder from "./pages/TrackOrder";
import About from "./pages/About";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";

import AdminLogin from "./admin/AdminLogin";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminProducts from "./admin/AdminProducts";
import AdminProductForm from "./admin/AdminProductForm";
import AdminOrders from "./admin/AdminOrders";
import AdminCategories from "./admin/AdminCategories";
import AdminMessages from "./admin/AdminMessages";
import AdminChangePassword from "./admin/AdminChangePassword";

import {
  requestNotificationPermission,
  listenForForegroundMessages,
} from "./services/notifications";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
      <WhatsAppButton />
    </>
  );
}

export default function App() {
  useEffect(() => {
    requestNotificationPermission().then((token) => {
      if (token) {
        console.log("KAVSI FCM token registered:", token);
      }
    });

    const unsubscribe = listenForForegroundMessages((payload) => {
      console.log("KAVSI notification received:", payload);

      const title = payload.notification?.title || "THE KAVSI";

      const body = payload.notification?.body || "You have a new notification.";

      // Show a simple browser notification while the website is open.
      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/logo.jpeg",
        });
      }
    });

    return unsubscribe;
  }, []);
  return (
    <>
      <ScrollToTop />

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            fontSize: "13px",
            borderRadius: 0,
          },
        }}
      />

      <Routes>
        {/* Public storefront */}
        <Route
          path="/"
          element={
            <PublicLayout>
              <Home />
            </PublicLayout>
          }
        />

        <Route
          path="/shop"
          element={
            <PublicLayout>
              <Shop />
            </PublicLayout>
          }
        />

        <Route
          path="/product/:id"
          element={
            <PublicLayout>
              <ProductDetails />
            </PublicLayout>
          }
        />

        <Route
          path="/cart"
          element={
            <PublicLayout>
              <Cart />
            </PublicLayout>
          }
        />

        <Route
          path="/checkout"
          element={
            <PublicLayout>
              <Checkout />
            </PublicLayout>
          }
        />

        <Route
          path="/order-confirmation/:orderId"
          element={
            <PublicLayout>
              <OrderConfirmation />
            </PublicLayout>
          }
        />

        {/* Legacy path */}
        <Route
          path="/order-confirmation"
          element={<Navigate to="/track-order" replace />}
        />

        <Route
          path="/track-order"
          element={
            <PublicLayout>
              <TrackOrder />
            </PublicLayout>
          }
        />

        <Route
          path="/about"
          element={
            <PublicLayout>
              <About />
            </PublicLayout>
          }
        />

        <Route
          path="/contact"
          element={
            <PublicLayout>
              <Contact />
            </PublicLayout>
          }
        />

        <Route
          path="/faq"
          element={
            <PublicLayout>
              <FAQ />
            </PublicLayout>
          }
        />

        {/* Admin login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected admin panel */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id/edit" element={<AdminProductForm />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="change-password" element={<AdminChangePassword />} />
        </Route>

        {/* 404 */}
        <Route
          path="*"
          element={
            <PublicLayout>
              <NotFound />
            </PublicLayout>
          }
        />
      </Routes>
    </>
  );
}
