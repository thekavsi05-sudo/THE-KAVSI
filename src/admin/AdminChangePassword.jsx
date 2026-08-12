import { useState } from "react";
import toast from "react-hot-toast";
import { changeAdminPassword } from "../services/api";

export default function AdminChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill all fields");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const response = await changeAdminPassword(currentPassword, newPassword);

      toast.success(response.message || "Password updated successfully");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to change password",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">Change Password</h1>

        <p className="text-sm text-ink/60 mt-1">
          Update your admin account password.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-ink/10 p-6 space-y-5"
      >
        <div>
          <label className="block text-sm mb-2">Current Password</label>

          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input-field w-full"
            placeholder="Enter current password"
          />
        </div>

        <div>
          <label className="block text-sm mb-2">New Password</label>

          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input-field w-full"
            placeholder="Minimum 8 characters"
          />
        </div>

        <div>
          <label className="block text-sm mb-2">Confirm New Password</label>

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field w-full"
            placeholder="Confirm new password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
