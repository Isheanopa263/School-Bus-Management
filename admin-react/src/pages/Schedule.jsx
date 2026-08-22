import { useState, useEffect } from "react";
import { apiFetch } from "../services/api";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import FilterTabs from "../components/ui/FilterTabs";
import {
  FormGroup,
  FormInput,
  FormSelect,
  FormRow,
} from "../components/ui/FormGroup";
import "./Schedule.css";

const FILTER_TABS = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "both", label: "Both" },
];

export default function Schedule() {
  const [assignments, setAssignments] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    route_id: "",
    bus_id: "",
    driver_id: "",
    effective_date: "",
    end_date: "",
    shift: "morning",
  });

  useEffect(() => {
    loadAssignments();
    loadDropdowns();
  }, []);

  async function loadAssignments() {
    try {
      const data = await apiFetch("/route-assignments");
      setAssignments(data.assignments || []);
    } catch (err) {
      console.error("Load assignments error:", err);
    }
  }

  async function loadDropdowns() {
    try {
      const [routeData, busData, driverData] = await Promise.all([
        apiFetch("/routes"),
        apiFetch("/buses"),
        apiFetch("/drivers"),
      ]);
      setRoutes(routeData.routes || []);
      setBuses((busData.buses || []).filter((b) => b.status === "active"));
      setDrivers(
        (driverData.drivers || []).filter(
          (d) => d.employment_status === "active",
        ),
      );
    } catch (err) {
      console.error("Load dropdowns error:", err);
    }
  }

  function isExpired(a) {
    if (!a.end_date) return false;
    const end = new Date(a.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end < today;
  }

  function formatDate(d) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const filtered = (() => {
    if (filter === "all") return assignments;
    if (filter === "paused") return assignments.filter((a) => a.is_paused);
    if (filter === "expired") return assignments.filter((a) => isExpired(a));
    if (filter === "active")
      return assignments.filter((a) => !a.is_paused && !isExpired(a));
    return assignments.filter(
      (a) => a.shift === filter && !a.is_paused && !isExpired(a),
    );
  })();

  function openAdd() {
    setEditing(null);
    setForm({
      route_id: "",
      bus_id: "",
      driver_id: "",
      effective_date: new Date().toISOString().split("T")[0],
      end_date: "",
      shift: "morning",
    });
    setModalOpen(true);
  }

  function openEdit(assignment) {
    setEditing(assignment);
    setForm({
      route_id: assignment.route_id,
      bus_id: assignment.bus_id,
      driver_id: assignment.driver_table_id || assignment.driver_id,
      effective_date: new Date(assignment.effective_date)
        .toISOString()
        .split("T")[0],
      end_date: assignment.end_date
        ? new Date(assignment.end_date).toISOString().split("T")[0]
        : "",
      shift: assignment.shift,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (
      !form.route_id ||
      !form.bus_id ||
      !form.driver_id ||
      !form.effective_date ||
      !form.shift
    ) {
      alert("Please fill all required fields");
      return;
    }

    setSaving(true);
    try {
      const body = {
        route_id: form.route_id,
        bus_id: form.bus_id,
        driver_id: form.driver_id,
        effective_date: form.effective_date,
        end_date: form.end_date || null,
        shift: form.shift,
      };

      if (editing) {
        await apiFetch(`/route-assignments/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/route-assignments", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setModalOpen(false);
      loadAssignments();
    } catch (err) {
      alert(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePause(id, isPaused) {
    const action = isPaused ? "resume" : "pause";
    if (!confirm(`Are you sure you want to ${action} this assignment?`)) return;

    try {
      await apiFetch(`/route-assignments/${id}/toggle-pause`, {
        method: "PUT",
      });
      loadAssignments();
    } catch (err) {
      alert(err.message || `Failed to ${action}`);
    }
  }

  async function handleDelete() {
    if (!deleteModal) return;
    try {
      await apiFetch(`/route-assignments/${deleteModal.id}`, {
        method: "DELETE",
      });
      setDeleteModal(null);
      loadAssignments();
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Schedule Builder</h1>
          <p className="subtitle">Assign routes to buses and drivers</p>
        </div>
        <Button onClick={openAdd}>+ New Assignment</Button>
      </div>

      <FilterTabs tabs={FILTER_TABS} active={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <div className="schedule-empty">
          <div className="schedule-empty-icon">📅</div>
          <h3>No Assignments</h3>
          <p>
            {filter === "all"
              ? "Create your first assignment"
              : filter === "paused"
                ? "No paused assignments"
                : filter === "expired"
                  ? "No expired assignments"
                  : filter === "active"
                    ? "No active assignments"
                    : `No ${filter} assignments`}
          </p>
        </div>
      ) : (
        <div className="assignments-grid">
          {filtered.map((a) => {
            const expired = isExpired(a);
            const showActions = !expired;

            return (
              <div
                key={a.id}
                className={`assignment-card ${a.is_paused ? "paused" : ""} ${expired ? "expired" : ""}`}
              >
                <div className="assignment-card-header">
                  <div className="assignment-route">📍 {a.route_name}</div>
                  <div className="assignment-badges">
                    {expired && <span className="expired-badge">Expired</span>}
                    {a.is_paused && !expired && (
                      <span className="paused-badge">⏸ Paused</span>
                    )}
                    <span className={`shift-tag shift-${a.shift}`}>
                      {a.shift}
                    </span>
                  </div>
                </div>

                <div className="assignment-details">
                  <div className="assignment-detail">
                    <div className="assignment-detail-icon">🚌</div>
                    <div>
                      <div className="assignment-detail-label">Bus</div>
                      <div className="assignment-detail-value">
                        {a.bus_number}
                      </div>
                    </div>
                  </div>
                  <div className="assignment-detail">
                    <div className="assignment-detail-icon">👤</div>
                    <div>
                      <div className="assignment-detail-label">Driver</div>
                      <div className="assignment-detail-value">
                        {a.driver_name}
                      </div>
                    </div>
                  </div>
                  <div className="assignment-detail">
                    <div className="assignment-detail-icon">📅</div>
                    <div>
                      <div className="assignment-detail-label">Period</div>
                      <div className="assignment-detail-value">
                        {formatDate(a.effective_date)}
                        {a.end_date
                          ? ` → ${formatDate(a.end_date)}`
                          : " → Ongoing"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="assignment-card-footer">
                  {showActions && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(a)}
                      >
                        ✎ Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={a.is_paused ? "success" : "secondary"}
                        onClick={() => handleTogglePause(a.id, a.is_paused)}
                      >
                        {a.is_paused ? "▶ Resume" : "⏸ Pause"}
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeleteModal(a)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Assignment" : "New Assignment"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editing ? "Update" : "Create"} Assignment
            </Button>
          </>
        }
      >
        <FormGroup label="Route *">
          <FormSelect
            value={form.route_id}
            onChange={(e) => setForm({ ...form, route_id: e.target.value })}
          >
            <option value="">Select route...</option>
            {routes.map((r) => (
              <option key={r.rid} value={r.rid}>
                {r.name}
              </option>
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Bus *">
          <FormSelect
            value={form.bus_id}
            onChange={(e) => setForm({ ...form, bus_id: e.target.value })}
          >
            <option value="">Select bus...</option>
            {buses.map((b) => (
              <option key={b.bid} value={b.bid}>
                {b.registration_number} ({b.capacity} seats)
              </option>
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Driver *">
          <FormSelect
            value={form.driver_id}
            onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
          >
            <option value="">Select driver...</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </FormSelect>
        </FormGroup>

        <FormRow>
          <FormGroup label="Shift *">
            <FormSelect
              value={form.shift}
              onChange={(e) => setForm({ ...form, shift: e.target.value })}
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="both">Both</option>
            </FormSelect>
          </FormGroup>
          <FormGroup label="Effective Date *">
            <FormInput
              type="date"
              value={form.effective_date}
              onChange={(e) =>
                setForm({ ...form, effective_date: e.target.value })
              }
            />
          </FormGroup>
        </FormRow>

        <FormGroup label="End Date" hint="Leave blank for ongoing">
          <FormInput
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </FormGroup>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Assignment"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p>
          Delete assignment for <strong>{deleteModal?.route_name}</strong>?
        </p>
      </Modal>
    </div>
  );
}
