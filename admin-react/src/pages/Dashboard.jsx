import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";
import StatCard from "../components/ui/StatCard";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import "./Dashboard.css";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [trips, setTrips] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsData, reqData, compData, tripData] = await Promise.all([
        apiFetch("/stats"),
        apiFetch("/bus-requests?limit=5").catch(() => ({ requests: [] })),
        apiFetch("/complaints?limit=5").catch(() => ({ complaints: [] })),
        apiFetch(`/trips?date=${new Date().toISOString().split("T")[0]}`).catch(
          () => ({ trips: [] }),
        ),
      ]);

      setStats(statsData.stats || statsData);
      setRequests(reqData.requests || []);
      setComplaints(compData.complaints || []);
      setTrips(tripData.trips || []);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">System overview and key metrics</p>
        </div>
        <div className="header-date">{today}</div>
      </div>

      <div className="stats-grid">
        <StatCard
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="5" width="18" height="12" rx="2" />
              <path d="M7 17v2M17 17v2" />
            </svg>
          }
          value={stats?.total_buses ?? "-"}
          label="Total Buses"
        />
        <StatCard
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
          value={stats?.total_drivers ?? "-"}
          label="Total Drivers"
        />
        <StatCard
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          }
          value={stats?.pending_requests ?? "-"}
          label="Pending Requests"
          variant="warning"
        />
        <StatCard
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          value={stats?.open_complaints ?? "-"}
          label="Open Complaints"
          variant="error"
        />
      </div>

      <div className="dashboard-grid">
        <Card
          header="Recent Requests"
          actions={
            <button className="link-btn" onClick={() => navigate("/requests")}>
              View all
            </button>
          }
        >
          {requests.length === 0 ? (
            <p className="empty-text">No recent requests</p>
          ) : (
            requests.slice(0, 5).map((req) => (
              <div key={req.id} className="activity-item">
                <div className="activity-icon request">📋</div>
                <div className="activity-info">
                  <div className="activity-title">
                    {req.student_name || "Student"}
                  </div>
                  <div className="activity-meta">
                    {req.created_at
                      ? new Date(req.created_at).toLocaleDateString()
                      : ""}
                  </div>
                </div>
                <Badge variant={req.status || "pending"}>
                  {req.status || "pending"}
                </Badge>
              </div>
            ))
          )}
        </Card>

        <Card
          header="Recent Complaints"
          actions={
            <button
              className="link-btn"
              onClick={() => navigate("/complaints")}
            >
              View all
            </button>
          }
        >
          {complaints.length === 0 ? (
            <p className="empty-text">No recent complaints</p>
          ) : (
            complaints.slice(0, 5).map((c) => (
              <div key={c.id} className="activity-item">
                <div className="activity-icon complaint">⚠️</div>
                <div className="activity-info">
                  <div className="activity-title">
                    {c.category || "General"}
                  </div>
                  <div className="activity-meta">
                    {c.created_at
                      ? new Date(c.created_at).toLocaleDateString()
                      : ""}
                  </div>
                </div>
                <Badge variant={c.status || "open"}>{c.status || "open"}</Badge>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card header="Today's Trips">
        {trips.length === 0 ? (
          <p className="empty-text">No trips today</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Driver</th>
                  <th>Bus</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip.id}>
                    <td>{trip.route_name || "-"}</td>
                    <td>{trip.driver_name || "-"}</td>
                    <td>{trip.bus_number || "-"}</td>
                    <td>
                      <Badge
                        variant={trip.trip_type === "pickup" ? "active" : "low"}
                      >
                        {trip.trip_type || "-"}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={trip.status}>{trip.status}</Badge>
                    </td>
                    <td>
                      {trip.start_time
                        ? new Date(trip.start_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
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
