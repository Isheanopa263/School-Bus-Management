import { useState, useEffect } from "react";
import { apiFetch } from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import FilterTabs from "../components/ui/FilterTabs";
import {
  FormGroup,
  FormSelect,
  FormTextarea,
  FormRow,
} from "../components/ui/FormGroup";
import "./Complaints.css";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const CATEGORY_ICONS = {
  sos: "🚨",
  breakdown: "🔧",
  route_deviation: "↗️",
  harsh_braking: "⚠️",
  overspeeding: "💨",
  bus_service: "🚌",
  driver: "👤",
  safety: "⚠️",
  other: "📋",
};

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState("all");
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveStatus, setResolveStatus] = useState("open");
  const [resolvePriority, setResolvePriority] = useState("medium");
  const [resolveNotes, setResolveNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadComplaints();
  }, []);

  async function loadComplaints() {
    try {
      const data = await apiFetch("/complaints");
      setComplaints(data.complaints || []);
    } catch (err) {
      console.error("Load complaints error:", err);
    }
  }

  const filtered =
    filter === "all"
      ? complaints
      : complaints.filter((c) => c.status === filter);

  const openCount = complaints.filter((c) => c.status === "open").length;
  const progressCount = complaints.filter(
    (c) => c.status === "in_progress",
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.status === "resolved",
  ).length;
  const closedCount = complaints.filter((c) => c.status === "closed").length;

  function openResolve(complaint) {
    setResolveModal(complaint);
    setResolveStatus(complaint.status || "open");
    setResolvePriority(complaint.priority || "medium");
    setResolveNotes(complaint.resolution_notes || "");
  }

  async function handleResolve() {
    setSaving(true);
    try {
      await apiFetch(`/complaints/${resolveModal.id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({
          status: resolveStatus,
          priority: resolvePriority,
          resolution_notes: resolveNotes || null,
        }),
      });
      setResolveModal(null);
      loadComplaints();
    } catch (err) {
      alert(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Complaints</h1>
          <p className="subtitle">Manage and resolve complaints</p>
        </div>
      </div>

      {/* Stats */}
      <div className="complaint-stats">
        <div className="complaint-stat open">
          <div className="complaint-stat-value">{openCount}</div>
          <div className="complaint-stat-label">Open</div>
        </div>
        <div className="complaint-stat progress">
          <div className="complaint-stat-value">{progressCount}</div>
          <div className="complaint-stat-label">In Progress</div>
        </div>
        <div className="complaint-stat resolved">
          <div className="complaint-stat-value">{resolvedCount}</div>
          <div className="complaint-stat-label">Resolved</div>
        </div>
        <div className="complaint-stat closed">
          <div className="complaint-stat-value">{closedCount}</div>
          <div className="complaint-stat-label">Closed</div>
        </div>
      </div>

      <FilterTabs tabs={STATUS_TABS} active={filter} onChange={setFilter} />

      <Card>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Raised By</th>
                <th>Category</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    {filter === "all"
                      ? "No complaints"
                      : `No ${filter.replace("_", " ")} complaints`}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {(c.raised_by_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-name">
                            {c.raised_by_name || "Unknown"}
                          </div>
                          <div className="user-email">
                            {c.raised_by_role || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`category-badge category-${c.category || "other"}`}
                      >
                        {CATEGORY_ICONS[c.category] || "📋"}{" "}
                        {(c.category || "other").replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="desc-cell">{c.description || "-"}</div>
                    </td>
                    <td>
                      <div className="priority-cell">
                        <span
                          className={`priority-dot ${c.priority || "medium"}`}
                        />
                        {c.priority || "medium"}
                      </div>
                    </td>
                    <td>
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      <Badge variant={c.status}>
                        {(c.status || "open").replace("_", " ")}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openResolve(c)}
                      >
                        {c.status === "resolved" || c.status === "closed"
                          ? "View"
                          : "Manage"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Resolve Modal */}
      <Modal
        isOpen={!!resolveModal}
        onClose={() => setResolveModal(null)}
        title="Manage Complaint"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolveModal(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleResolve}>
              Update
            </Button>
          </>
        }
      >
        {resolveModal && (
          <>
            <div className="request-info-box">
              <div className="request-info-row">
                <span className="request-info-label">Raised By</span>
                <span>
                  {resolveModal.raised_by_name} ({resolveModal.raised_by_role})
                </span>
              </div>
              <div className="request-info-row">
                <span className="request-info-label">Category</span>
                <span>
                  {(resolveModal.category || "other").replace("_", " ")}
                </span>
              </div>
              <div className="request-info-row">
                <span className="request-info-label">Bus</span>
                <span>{resolveModal.bus_number || "N/A"}</span>
              </div>
              <div className="request-info-row">
                <span className="request-info-label">Created</span>
                <span>
                  {resolveModal.created_at
                    ? new Date(resolveModal.created_at).toLocaleString()
                    : "-"}
                </span>
              </div>
            </div>

            <div className="complaint-desc-box">
              <strong style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Description
              </strong>
              <p style={{ marginTop: "8px" }}>{resolveModal.description}</p>
            </div>

            <FormRow>
              <FormGroup label="Status">
                <FormSelect
                  value={resolveStatus}
                  onChange={(e) => setResolveStatus(e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </FormSelect>
              </FormGroup>
              <FormGroup label="Priority">
                <FormSelect
                  value={resolvePriority}
                  onChange={(e) => setResolvePriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </FormSelect>
              </FormGroup>
            </FormRow>

            <FormGroup label="Resolution Notes">
              <FormTextarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="Add notes..."
                rows={3}
              />
            </FormGroup>
          </>
        )}
      </Modal>
    </div>
  );
}
