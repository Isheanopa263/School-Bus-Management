import { useState, useEffect } from "react";
import { apiFetch } from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import FilterTabs from "../components/ui/FilterTabs";
import StatCard from "../components/ui/StatCard";
import {
  FormGroup,
  FormSelect,
  FormTextarea,
} from "../components/ui/FormGroup";
import "./Requests.css";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [filter, setFilter] = useState("all");

  // Approve modal
  const [approveModal, setApproveModal] = useState(null);
  const [approveRoute, setApproveRoute] = useState("");
  const [approveStop, setApproveStop] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [approving, setApproving] = useState(false);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    loadRequests();
    loadRoutes();
  }, []);

  async function loadRequests() {
    try {
      const data = await apiFetch("/bus-requests");
      setRequests(data.requests || []);
    } catch (err) {
      console.error("Load requests error:", err);
    }
  }

  async function loadRoutes() {
    try {
      const data = await apiFetch("/routes");
      setRoutes(data.routes || []);
    } catch (err) {
      console.error("Load routes error:", err);
    }
  }

  async function loadStopsForRoute(routeId) {
    if (!routeId) {
      setStops([]);
      return;
    }
    try {
      const data = await apiFetch(`/stops?route_id=${routeId}`);
      setStops(data.stops || []);
    } catch (err) {
      console.error("Load stops error:", err);
      setStops([]);
    }
  }

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  // Approve flow
  function openApprove(req) {
    setApproveModal(req);
    setApproveRoute("");
    setApproveStop("");
    setApproveNotes("");
    setStops([]);
  }

  async function handleRouteChange(routeId) {
    setApproveRoute(routeId);
    setApproveStop("");
    await loadStopsForRoute(routeId);
  }

  async function handleApprove() {
    if (!approveRoute || !approveStop) {
      alert("Please select a route and stop");
      return;
    }

    setApproving(true);
    try {
      await apiFetch(`/bus-requests/${approveModal.id}/approve`, {
        method: "PUT",
        body: JSON.stringify({
          stop_id: approveStop,
          route_id: approveRoute,
          admin_notes: approveNotes || null,
        }),
      });
      setApproveModal(null);
      loadRequests();
    } catch (err) {
      alert(err.message || "Failed to approve");
    } finally {
      setApproving(false);
    }
  }

  // Reject flow
  function openReject(req) {
    setRejectModal(req);
    setRejectNotes("");
  }

  async function handleReject() {
    if (!rejectNotes.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    setRejecting(true);
    try {
      await apiFetch(`/bus-requests/${rejectModal.id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ admin_notes: rejectNotes }),
      });
      setRejectModal(null);
      loadRequests();
    } catch (err) {
      alert(err.message || "Failed to reject");
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Student Requests</h1>
          <p className="subtitle">Review and manage bus service requests</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="request-stats">
        <div className="request-stat pending">
          <div className="request-stat-value">{pendingCount}</div>
          <div className="request-stat-label">Pending</div>
        </div>
        <div className="request-stat approved">
          <div className="request-stat-value">{approvedCount}</div>
          <div className="request-stat-label">Approved</div>
        </div>
        <div className="request-stat rejected">
          <div className="request-stat-value">{rejectedCount}</div>
          <div className="request-stat-label">Rejected</div>
        </div>
      </div>

      <FilterTabs tabs={STATUS_TABS} active={filter} onChange={setFilter} />

      <Card>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Contact</th>
                <th>Assigned Stop</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    {filter === "all" ? "No requests" : `No ${filter} requests`}
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {(req.student_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-name">
                            {req.student_name || "-"}
                          </div>
                          <div className="user-email">
                            {req.student_email || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{req.roll || "-"}</td>
                    <td>{req.student_phone || "-"}</td>
                    <td>
                      {req.stop_name ? (
                        <Badge variant="active">📍 {req.stop_name}</Badge>
                      ) : (
                        <span className="muted-text">Not assigned</span>
                      )}
                    </td>
                    <td>
                      {req.created_at
                        ? new Date(req.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      <Badge variant={req.status}>{req.status}</Badge>
                    </td>
                    <td>
                      {req.status === "pending" ? (
                        <div className="action-buttons">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => openApprove(req)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openReject(req)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="muted-text">
                          {req.status === "approved"
                            ? "✅ Approved"
                            : "❌ Rejected"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Approve Modal */}
      <Modal
        isOpen={!!approveModal}
        onClose={() => setApproveModal(null)}
        title="Approve Request"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="success"
              loading={approving}
              onClick={handleApprove}
            >
              Approve
            </Button>
          </>
        }
      >
        {approveModal && (
          <>
            <div className="request-info-box">
              <div className="request-info-row">
                <span className="request-info-label">Student</span>
                <span>{approveModal.student_name}</span>
              </div>
              <div className="request-info-row">
                <span className="request-info-label">Email</span>
                <span>{approveModal.student_email || "-"}</span>
              </div>
              <div className="request-info-row">
                <span className="request-info-label">Phone</span>
                <span>{approveModal.student_phone || "-"}</span>
              </div>
              <div className="request-info-row">
                <span className="request-info-label">Roll No</span>
                <span>{approveModal.roll || "-"}</span>
              </div>
            </div>

            <FormGroup label="Select Route *">
              <FormSelect
                value={approveRoute}
                onChange={(e) => handleRouteChange(e.target.value)}
              >
                <option value="">Select route...</option>
                {routes.map((r) => (
                  <option key={r.rid} value={r.rid}>
                    {r.name}
                  </option>
                ))}
              </FormSelect>
            </FormGroup>

            <FormGroup label="Select Stop *">
              <FormSelect
                value={approveStop}
                onChange={(e) => setApproveStop(e.target.value)}
              >
                <option value="">
                  {approveRoute ? "Select stop..." : "Select route first..."}
                </option>
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sequence_number}. {s.name}
                  </option>
                ))}
              </FormSelect>
            </FormGroup>

            <FormGroup label="Admin Notes">
              <FormTextarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </FormGroup>
          </>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Reject Request"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={rejecting} onClick={handleReject}>
              Reject
            </Button>
          </>
        }
      >
        {rejectModal && (
          <>
            <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
              Rejecting request for <strong>{rejectModal.student_name}</strong>
            </p>
            <FormGroup label="Reason *">
              <FormTextarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
              />
            </FormGroup>
          </>
        )}
      </Modal>
    </div>
  );
}
