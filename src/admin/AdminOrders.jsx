import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import {
  fetchAdminOrders,
  updateOrderStatus,
  exportOrdersCSV,
} from "../services/api";
import { generateInvoicePDF } from "../utils/invoice";

const STATUSES = [
  "Pending",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const statusStyles = {
  Pending: "bg-champagne/20 text-champagne",
  Confirmed: "bg-blush/40 text-ink",
  Packed: "bg-blush/60 text-wine",
  Shipped: "bg-ink/10 text-ink",
  "Out for Delivery": "bg-ink/10 text-ink",
  Delivered: "bg-green-100 text-green-700",
  Cancelled: "bg-wine/10 text-wine",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("All");
  const [downloadingId, setDownloadingId] = useState(null);

  async function handleDownloadInvoice(order) {
    setDownloadingId(order._id);
    try {
      await generateInvoicePDF(order);
    } catch {
      toast.error("Could not generate invoice");
    } finally {
      setDownloadingId(null);
    }
  }

  function load() {
    setLoading(true);
    fetchAdminOrders().then((data) => {
      setOrders(data);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function handleStatusChange(id, status) {
    try {
      await updateOrderStatus(id, status);
      setOrders((prev) =>
        prev.map((o) => (o._id === id ? { ...o, orderStatus: status } : o)),
      );
      toast.success(`Order marked as ${status}`);
    } catch {
      toast.error("Could not update order status");
    }
  }

  async function handleExportCSV() {
    try {
      const orders = await exportOrdersCSV();

      if (!orders || orders.length === 0) {
        toast.error("No orders available to export");
        return;
      }

      const headers = [
        "Order ID",
        "Customer Name",
        "Phone",
        "Total Amount",
        "Payment Method",
        "Payment Status",
        "Order Status",
        "Date",
      ];

      const rows = orders.map((order) => [
        order._id || "",
        order.customerName || order.name || "",
        order.phone || "",
        order.totalAmount || 0,
        order.paymentMethod || "",
        order.paymentStatus || "",
        order.orderStatus || "",
        order.createdAt
          ? new Date(order.createdAt).toLocaleDateString("en-IN")
          : "",
      ]);

      const csv = [headers, ...rows]
        .map((row) =>
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "kavsi-orders.csv";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast.success("Orders exported successfully");
    } catch (error) {
      console.error("Orders CSV export failed:", error);
      toast.error("Failed to export orders");
    }
  }

  const visibleOrders =
    filter === "All" ? orders : orders.filter((o) => o.orderStatus === filter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-display">Orders</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input-field w-auto text-xs py-2"
        >
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExportCSV}
          className="btn-outline px-4 py-2 text-xs"
        >
          Export CSV
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-stone text-sm">Loading…</p>
        ) : visibleOrders.length === 0 ? (
          <p className="text-stone text-sm">No orders in this view.</p>
        ) : (
          visibleOrders.map((order) => (
            <div key={order._id} className="bg-white border border-ink/10">
              <button
                onClick={() =>
                  setExpanded(expanded === order._id ? null : order._id)
                }
                className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div>
                  <p className="font-medium text-sm">
                    {order.customerName} · #{order.orderId}
                  </p>
                  <p className="text-xs text-stone mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" · "}₹{order.totalAmount.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[order.orderStatus]}`}
                  >
                    {order.orderStatus}
                  </span>
                  {expanded === order._id ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </div>
              </button>

              {expanded === order._id && (
                <div className="border-t border-ink/10 px-5 py-5 grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone mb-2">
                      Customer
                    </p>
                    <p className="text-sm">{order.customerName}</p>
                    <p className="text-sm text-ink/70">
                      {order.phone}
                      {order.alternatePhone && ` / ${order.alternatePhone}`}
                    </p>
                    <p className="text-sm text-ink/70 mt-2">
                      {order.address.houseNumber}, {order.address.street}
                      {order.address.landmark &&
                        `, near ${order.address.landmark}`}
                      <br />
                      {order.address.area}, {order.address.city},{" "}
                      {order.address.state} - {order.address.pincode}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => handleDownloadInvoice(order)}
                        disabled={downloadingId === order._id}
                        className="btn-outline text-xs px-4 py-2 inline-flex items-center gap-1.5"
                      >
                        <Download size={13} />{" "}
                        {downloadingId === order._id
                          ? "Preparing…"
                          : "Download Invoice"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone mb-2">
                      Products
                    </p>
                    <div className="space-y-1.5">
                      {order.products.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>
                            {p.name} × {p.quantity}{" "}
                            {p.size && `(${p.size}/${p.color})`}
                          </span>
                          <span>
                            ₹{(p.price * p.quantity).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-wide text-stone mt-4 mb-2">
                      Update Status
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(order._id, s)}
                          className={`text-xs px-3 py-1.5 border ${
                            order.orderStatus === s
                              ? "bg-ink text-ivory border-ink"
                              : "border-ink/20 hover:border-ink"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
