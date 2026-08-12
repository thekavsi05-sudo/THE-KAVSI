import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  fetchAdminMessages,
  markMessageRead,
  deleteAdminMessage,
} from "../services/api";

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);

  async function loadMessages() {
    try {
      setLoading(true);

      const data = await fetchAdminMessages();

      setMessages(data);
    } catch (error) {
      console.error(error);

      toast.error(error?.response?.data?.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
  }, []);

  async function handleRead(message) {
    try {
      await markMessageRead(message._id, !message.isRead);

      await loadMessages();

      if (selectedMessage?._id === message._id) {
        setSelectedMessage({
          ...message,
          isRead: !message.isRead,
        });
      }

      toast.success(
        message.isRead ? "Message marked as unread" : "Message marked as read",
      );
    } catch (error) {
      console.error(error);

      toast.error(error?.response?.data?.message || "Failed to update message");
    }
  }

  async function handleDelete(message) {
    const confirmed = window.confirm(
      `Delete the message from ${message.name || "this customer"}?`,
    );

    if (!confirmed) return;

    try {
      await deleteAdminMessage(message._id);

      if (selectedMessage?._id === message._id) {
        setSelectedMessage(null);
      }

      await loadMessages();

      toast.success("Message deleted successfully");
    } catch (error) {
      console.error(error);

      toast.error(error?.response?.data?.message || "Failed to delete message");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-ink">Contact Messages</h1>

        <p className="text-sm text-ink/60 mt-1">
          View and manage customer enquiries.
        </p>
      </div>

      {/* Message Details */}
      {selectedMessage && (
        <section className="bg-white border border-ink/10 p-6">
          <div className="flex justify-between items-start gap-4 mb-6">
            <div>
              <h2 className="font-display text-xl">Message Details</h2>

              <p className="text-sm text-ink/50 mt-1">
                {selectedMessage.createdAt
                  ? new Date(selectedMessage.createdAt).toLocaleString("en-IN")
                  : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMessage(null)}
              className="text-sm underline"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div>
              <p className="text-xs text-ink/50">Name</p>

              <p className="font-medium mt-1">{selectedMessage.name || "-"}</p>
            </div>

            <div>
              <p className="text-xs text-ink/50">Email</p>

              <p className="font-medium mt-1">{selectedMessage.email || "-"}</p>
            </div>

            <div>
              <p className="text-xs text-ink/50">Phone</p>

              <p className="font-medium mt-1">{selectedMessage.phone || "-"}</p>
            </div>

            <div>
              <p className="text-xs text-ink/50">Subject</p>

              <p className="font-medium mt-1">
                {selectedMessage.subject || "-"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-ink/50 mb-2">Message</p>

            <div className="bg-ink/5 p-4 whitespace-pre-wrap">
              {selectedMessage.message || "-"}
            </div>
          </div>
        </section>
      )}

      {/* Messages */}
      <section className="bg-white border border-ink/10">
        <div className="p-6 border-b border-ink/10">
          <h2 className="font-display text-xl">All Messages</h2>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-ink/60">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="p-6 text-sm text-ink/60">
            No contact messages found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left">
                  <th className="px-6 py-4">Status</th>

                  <th className="px-6 py-4">Customer</th>

                  <th className="px-6 py-4">Subject</th>

                  <th className="px-6 py-4">Date</th>

                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {messages.map((message) => (
                  <tr
                    key={message._id}
                    className={`border-b border-ink/5 ${
                      !message.isRead ? "bg-ink/[0.025]" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <span
                        className={
                          message.isRead
                            ? "text-ink/50"
                            : "text-wine font-medium"
                        }
                      >
                        {message.isRead ? "Read" : "Unread"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <p className="font-medium">{message.name || "-"}</p>

                      <p className="text-xs text-ink/50">
                        {message.email || "-"}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      {message.subject || "No subject"}
                    </td>

                    <td className="px-6 py-4">
                      {message.createdAt
                        ? new Date(message.createdAt).toLocaleDateString(
                            "en-IN",
                          )
                        : "-"}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMessage(message);

                            if (!message.isRead) {
                              handleRead(message);
                            }
                          }}
                          className="underline"
                        >
                          View
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRead(message)}
                          className="underline"
                        >
                          {message.isRead ? "Unread" : "Mark Read"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(message)}
                          className="text-red-700 underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
