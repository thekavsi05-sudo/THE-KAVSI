import { useEffect, useState } from "react";
import {
  Package,
  ShoppingBag,
  Clock,
  CheckCircle,
  IndianRupee,
  AlertTriangle,
} from "lucide-react";

import { fetchDashboardStats, fetchSalesChart } from "../services/api";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Dashboard summary + sales analytics
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sales chart state
  const [salesData, setSalesData] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesRange, setSalesRange] = useState("daily");

  // Load dashboard summary
  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await fetchDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  // Load sales chart
  useEffect(() => {
    async function loadSales() {
      try {
        setSalesLoading(true);

        const days = salesRange === "monthly" ? 365 : 30;

        const data = await fetchSalesChart(salesRange, days);

        setSalesData(data || []);
      } catch (error) {
        console.error("Failed to load sales chart:", error);

        setSalesData([]);
      } finally {
        setSalesLoading(false);
      }
    }

    loadSales();
  }, [salesRange]);

  const lowStockVariants = stats?.lowStockVariants || [];

  const cards = stats
    ? [
        {
          label: "Total Products",
          value: stats.totalProducts,
          icon: Package,
        },
        {
          label: "Total Orders",
          value: stats.totalOrders,
          icon: ShoppingBag,
        },
        {
          label: "Pending Orders",
          value: stats.pendingOrders,
          icon: Clock,
        },
        {
          label: "Delivered Orders",
          value: stats.deliveredOrders,
          icon: CheckCircle,
        },
        {
          label: "Paid Revenue",
          value: `₹${stats.revenue.paidRevenue.toLocaleString("en-IN")}`,
          icon: IndianRupee,
        },
        {
          label: "COD Pending",
          value: `₹${stats.revenue.codPending.toLocaleString("en-IN")}`,
          icon: IndianRupee,
        },
        {
          label: "Low Stock Variants",
          value: stats.lowStockCount,
          icon: AlertTriangle,
        },
      ]
    : [];

  // Convert backend sales response into chart-friendly data
  const formattedSalesData = salesData.map((item) => {
    const { year, month, day, week } = item._id;

    // Monthly
    if (salesRange === "monthly") {
      const date = new Date(year, month - 1, 1);

      return {
        label: date.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        }),
        revenue: item.revenue || 0,
        orders: item.orders || 0,
      };
    }

    // Weekly
    if (salesRange === "weekly") {
      return {
        label: `Week ${week}`,
        revenue: item.revenue || 0,
        orders: item.orders || 0,
      };
    }

    // Daily
    const date = new Date(year, month - 1, day);

    return {
      label: date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      revenue: item.revenue || 0,
      orders: item.orders || 0,
    };
  });

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <div>
        <h1 className="font-display text-3xl text-ink">Dashboard</h1>

        <p className="text-sm text-ink/60 mt-1">
          Overview of your KAVSI store.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-ink/60">
          Loading dashboard...
        </div>
      ) : (
        <>
          {/* Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white border border-ink/10 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-ink/50 uppercase tracking-wide">
                      {label}
                    </p>

                    <p className="font-display text-2xl text-ink mt-2">
                      {value}
                    </p>
                  </div>

                  <div className="p-2 bg-ink/5">
                    <Icon size={20} strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* SALES CHART */}
          <section className="bg-white border border-ink/10 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-display text-xl text-ink">
                  Sales Overview
                </h2>

                <p className="text-sm text-ink/50 mt-1">
                  Revenue generated from orders
                </p>
              </div>

              {/* Range buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSalesRange("daily")}
                  className={
                    salesRange === "daily"
                      ? "bg-wine text-ivory px-4 py-2 text-sm"
                      : "border border-ink/20 px-4 py-2 text-sm"
                  }
                >
                  Daily
                </button>

                <button
                  type="button"
                  onClick={() => setSalesRange("weekly")}
                  className={
                    salesRange === "weekly"
                      ? "bg-wine text-ivory px-4 py-2 text-sm"
                      : "border border-ink/20 px-4 py-2 text-sm"
                  }
                >
                  Weekly
                </button>

                <button
                  type="button"
                  onClick={() => setSalesRange("monthly")}
                  className={
                    salesRange === "monthly"
                      ? "bg-wine text-ivory px-4 py-2 text-sm"
                      : "border border-ink/20 px-4 py-2 text-sm"
                  }
                >
                  Monthly
                </button>
              </div>
            </div>

            {/* Chart */}
            {salesLoading ? (
              <div className="h-[350px] flex items-center justify-center">
                <p className="text-sm text-ink/50">Loading sales...</p>
              </div>
            ) : formattedSalesData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center">
                <p className="text-sm text-ink/50">No sales data available.</p>
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={formattedSalesData}
                    margin={{
                      top: 10,
                      right: 20,
                      left: 10,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="label" />

                    <YAxis />

                    <Tooltip
                      formatter={(value, name) => [
                        name === "revenue"
                          ? `₹${Number(value).toLocaleString("en-IN")}`
                          : value,
                        name === "revenue" ? "Revenue" : "Orders",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="revenue"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Low Stock Warning */}
          {lowStockVariants.length > 0 && (
            <div className="bg-white border border-ink/10">
              <div className="px-5 py-4 border-b border-ink/10">
                <h2 className="font-medium text-sm">Low Stock Warning</h2>
              </div>

              <div className="divide-y divide-ink/10">
                {lowStockVariants.map((v) => (
                  <div
                    key={`${v.productId}-${v.size}-${v.color}`}
                    className="flex items-center justify-between px-5 py-3 text-sm"
                  >
                    <span>
                      {v.productName}

                      <span className="text-stone">
                        {" "}
                        — {v.color} / {v.size}
                      </span>
                    </span>

                    <span className="text-wine font-medium">
                      {v.stock} left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
