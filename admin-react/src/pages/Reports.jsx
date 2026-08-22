import { useState, useEffect } from "react";
import { apiFetch } from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { FormGroup, FormInput, FormSelect } from "../components/ui/FormGroup";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Chart, Bar, Doughnut, Line } from "react-chartjs-2";
import "./Reports.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const REPORT_TABS = [
  { value: "trips", label: "Trips Trend" },
  { value: "on-time-performance", label: "On-Time %" },
  { value: "delays", label: "Delays" },
  { value: "route-efficiency", label: "Efficiency" },
  { value: "bus-utilization", label: "Bus Usage" },
  { value: "driver-hours", label: "Driver Hours" },
  { value: "student-load", label: "Student Load" },
  { value: "complaints-summary", label: "Complaints" },
];

const COLORS = {
  primary: "#6366f1",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#0ea5e9",
  purple: "#8b5cf6",
  muted: "#94a3b8",
  grid: "rgba(148, 163, 184, 0.1)",
};

export default function Reports() {
  const [currentTab, setCurrentTab] = useState("trips");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [routeId, setRouteId] = useState("");
  const [period, setPeriod] = useState("week");
  const [routes, setRoutes] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    setToDate(to.toISOString().split("T")[0]);
    setFromDate(from.toISOString().split("T")[0]);
    loadRoutes();
  }, []);

  useEffect(() => {
    if (fromDate && toDate) loadReport();
  }, [currentTab, fromDate, toDate, routeId, period]);

  async function loadRoutes() {
    try {
      const d = await apiFetch("/routes");
      setRoutes(d.routes || []);
    } catch (err) {
      console.warn("Could not load routes");
    }
  }

  async function loadReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (routeId) params.append("route_id", routeId);
      if (currentTab === "driver-hours") params.append("period", period);

      const d = await apiFetch(`/reports/${currentTab}?${params}`);
      setData(d.report || d.data || d || []);
    } catch (err) {
      console.error("Load report error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  function exportReport(format) {
    const params = new URLSearchParams({ from: fromDate, to: toDate, format });
    if (routeId) params.append("route_id", routeId);
    if (currentTab === "driver-hours") params.append("period", period);
    const token = sessionStorage.getItem("admin_token");
    window.open(
      `${API_BASE.replace("/api", "")}/api/reports/${currentTab}?${params}&token=${token}`,
      "_blank",
    );
  }

  // ── DESCRIPTIVE CHART CONFIGURATIONS ────────────────────────────────────
  function getChartConfig() {
    if (!Array.isArray(data) || data.length === 0) return null;

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: COLORS.muted, font: { family: "Inter" } } },
        tooltip: {
          backgroundColor: "#1e293b",
          titleFont: { size: 14 },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 8,
        },
      },
      scales: {
        x: { ticks: { color: COLORS.muted }, grid: { color: COLORS.grid } },
        y: { ticks: { color: COLORS.muted }, grid: { color: COLORS.grid } },
      },
    };

    switch (currentTab) {
      case "trips": {
        // Trend line of trips over time
        const dateMap = {};
        data.forEach((t) => {
          const d = t.trip_date.split("T")[0];
          dateMap[d] = (dateMap[d] || 0) + 1;
        });
        const sortedDates = Object.keys(dateMap).sort();
        return {
          type: "line",
          data: {
            labels: sortedDates,
            datasets: [
              {
                label: "Total Trips per Day",
                data: sortedDates.map((d) => dateMap[d]),
                borderColor: COLORS.primary,
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                fill: true,
                tension: 0.4,
                pointBackgroundColor: COLORS.primary,
              },
            ],
          },
          options: commonOptions,
        };
      }

      case "on-time-performance": {
        // Stacked bar showing Exact counts of On-Time vs Delayed
        const options = {
          ...commonOptions,
          scales: {
            x: {
              stacked: true,
              ticks: { color: COLORS.muted },
              grid: { display: false },
            },
            y: {
              stacked: true,
              ticks: { color: COLORS.muted },
              grid: { color: COLORS.grid },
            },
          },
        };
        return {
          type: "bar",
          data: {
            labels: data.map((d) => d.route_name),
            datasets: [
              {
                label: "On Time",
                data: data.map((d) => parseInt(d.on_time_trips)),
                backgroundColor: COLORS.success,
              },
              {
                label: "Minor Delay",
                data: data.map((d) => parseInt(d.minor_delay)),
                backgroundColor: COLORS.warning,
              },
              {
                label: "Major Delay",
                data: data.map((d) => parseInt(d.major_delay)),
                backgroundColor: COLORS.danger,
              },
            ],
          },
          options,
        };
      }

      case "route-efficiency": {
        // Dual Axis: Total Trips (Bar) vs Avg Duration (Line)
        const options = {
          ...commonOptions,
          scales: {
            x: { grid: { display: false }, ticks: { color: COLORS.muted } },
            y: {
              type: "linear",
              display: true,
              position: "left",
              title: {
                display: true,
                text: "Total Trips",
                color: COLORS.muted,
              },
              grid: { color: COLORS.grid },
            },
            y1: {
              type: "linear",
              display: true,
              position: "right",
              title: {
                display: true,
                text: "Avg Mins/Trip",
                color: COLORS.muted,
              },
              grid: { drawOnChartArea: false },
            },
          },
        };
        return {
          type: "mixed", // Uses the <Chart> component
          data: {
            labels: data.map((d) => d.route_name),
            datasets: [
              {
                type: "line",
                label: "Avg Duration (mins)",
                data: data.map((d) => parseFloat(d.avg_trip_mins)),
                borderColor: COLORS.warning,
                backgroundColor: COLORS.warning,
                yAxisID: "y1",
                tension: 0.4,
              },
              {
                type: "bar",
                label: "Total Trips",
                data: data.map((d) => parseInt(d.total_trips)),
                backgroundColor: COLORS.primary,
                yAxisID: "y",
              },
            ],
          },
          options,
        };
      }

      case "bus-utilization": {
        // Horizontal bar showing % utilization
        const options = {
          ...commonOptions,
          indexAxis: "y",
          scales: {
            x: {
              max: 100,
              title: {
                display: true,
                text: "Utilization %",
                color: COLORS.muted,
              },
              grid: { color: COLORS.grid },
            },
            y: { grid: { display: false } },
          },
        };
        return {
          type: "bar",
          data: {
            labels: data.map((d) => d.registration_number),
            datasets: [
              {
                label: "Utilization %",
                data: data.map((d) => parseFloat(d.utilization_percent)),
                backgroundColor: data.map((d) => {
                  const val = parseFloat(d.utilization_percent);
                  return val < 30
                    ? COLORS.danger
                    : val > 80
                      ? COLORS.success
                      : COLORS.info;
                }),
                borderRadius: 4,
              },
            ],
          },
          options,
        };
      }

      case "delays": {
        // Side-by-side comparison of Avg vs Max Delay
        const options = { ...commonOptions, indexAxis: "y" };
        return {
          type: "bar",
          data: {
            labels: data.map((d) => d.route_name),
            datasets: [
              {
                label: "Avg Delay (mins)",
                data: data.map((d) => parseFloat(d.avg_delay)),
                backgroundColor: COLORS.warning,
              },
              {
                label: "Max Delay (mins)",
                data: data.map((d) => parseFloat(d.max_delay)),
                backgroundColor: COLORS.danger,
              },
            ],
          },
          options,
        };
      }

      case "driver-hours": {
        return {
          type: "bar",
          data: {
            labels: data.map((d) => d.driver_name),
            datasets: [
              {
                label: "Total Hours Driven",
                data: data.map((d) => parseFloat(d.total_hours)),
                backgroundColor: COLORS.info,
                borderRadius: 4,
              },
            ],
          },
          options: commonOptions,
        };
      }

      case "complaints-summary": {
        const options = {
          ...commonOptions,
          scales: { x: { display: false }, y: { display: false } },
        };
        return {
          type: "doughnut",
          data: {
            labels: data.map((d) => d.category.replace("_", " ").toUpperCase()),
            datasets: [
              {
                data: data.map((d) => parseInt(d.total_count)),
                backgroundColor: [
                  COLORS.danger,
                  COLORS.warning,
                  COLORS.primary,
                  COLORS.info,
                  COLORS.purple,
                  COLORS.success,
                ],
                borderWidth: 0,
              },
            ],
          },
          options,
        };
      }

      case "student-load": {
        return {
          type: "bar",
          data: {
            labels: data.map(
              (d) => `${d.route_name.split(" ")[0]} - ${d.stop_name}`,
            ),
            datasets: [
              {
                label: "Students Assigned",
                data: data.map((d) => parseInt(d.students_assigned)),
                backgroundColor: COLORS.purple,
                borderRadius: 4,
              },
            ],
          },
          options: commonOptions,
        };
      }

      default:
        return null;
    }
  }

  const chartConfig = getChartConfig();

  // Helper to format table headers nicely
  const formatHeader = (str) =>
    str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1>Reports & Analytics</h1>
          <p className="subtitle">Fleet performance insights</p>
        </div>
      </div>

      <div className="report-tabs">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`report-tab ${currentTab === tab.value ? "active" : ""}`}
            onClick={() => setCurrentTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="report-filters">
        <FormGroup label="From">
          <FormInput
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </FormGroup>
        <FormGroup label="To">
          <FormInput
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </FormGroup>
        <FormGroup label="Route">
          <FormSelect
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
          >
            <option value="">All Routes</option>
            {routes.map((r) => (
              <option key={r.rid} value={r.rid}>
                {r.name}
              </option>
            ))}
          </FormSelect>
        </FormGroup>
        {currentTab === "driver-hours" && (
          <FormGroup label="Period">
            <FormSelect
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </FormSelect>
          </FormGroup>
        )}
        <div className="filter-actions">
          <Button size="sm" onClick={loadReport} loading={loading}>
            Apply Filter
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => exportReport("csv")}
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => exportReport("pdf")}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Dynamic Chart Area */}
      {chartConfig && (
        <Card header="Data Visualization" className="chart-card-container">
          <div className="chart-wrapper">
            {chartConfig.type === "bar" && (
              <Bar data={chartConfig.data} options={chartConfig.options} />
            )}
            {chartConfig.type === "line" && (
              <Line data={chartConfig.data} options={chartConfig.options} />
            )}
            {chartConfig.type === "doughnut" && (
              <Doughnut data={chartConfig.data} options={chartConfig.options} />
            )}
            {chartConfig.type === "mixed" && (
              <Chart
                type="bar"
                data={chartConfig.data}
                options={chartConfig.options}
              />
            )}
          </div>
        </Card>
      )}

      {/* Dynamic Table Area */}
      <Card
        header={`Detailed Data (${Array.isArray(data) ? data.length : 0} records)`}
      >
        {!Array.isArray(data) || data.length === 0 ? (
          <p className="empty-text">No data found for the selected filters.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(data[0])
                    .slice(0, 8)
                    .map((key) => (
                      <th key={key}>{formatHeader(key)}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row)
                      .slice(0, 8)
                      .map((val, j) => (
                        <td key={j}>
                          {typeof val === "number"
                            ? val.toFixed
                              ? Number(val).toFixed(1)
                              : val
                            : String(val || "-")}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
