import { useState, useEffect } from "react";
import { apiFetch } from "../services/api";
import Card from "../components/ui/Card";
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

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inactive", label: "Inactive" },
];

export default function Buses() {
  const [buses, setBuses] = useState([]);
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    registration_number: "",
    capacity: "",
    model: "",
    gps_device_id: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBuses();
  }, []);

  async function loadBuses() {
    try {
      const data = await apiFetch("/buses");
      setBuses(data.buses || []);
    } catch (err) {
      console.error("Load buses error:", err);
    }
  }

  const filtered =
    filter === "all" ? buses : buses.filter((b) => b.status === filter);

  function openAdd() {
    setEditing(null);
    setForm({
      registration_number: "",
      capacity: "",
      model: "",
      gps_device_id: "",
      status: "active",
    });
    setModalOpen(true);
  }

  function openEdit(bus) {
    setEditing(bus);
    setForm({
      registration_number: bus.registration_number,
      capacity: bus.capacity,
      model: bus.model || "",
      gps_device_id: bus.gps_device_id || "",
      status: bus.status,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.registration_number || !form.capacity) {
      alert("Registration number and capacity are required");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/buses/${editing.bid}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await apiFetch("/buses", {
          method: "POST",
          body: JSON.stringify({ ...form, capacity: parseInt(form.capacity) }),
        });
      }
      setModalOpen(false);
      loadBuses();
    } catch (err) {
      alert(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteModal) return;
    try {
      await apiFetch(`/buses/${deleteModal.bid}`, { method: "DELETE" });
      setDeleteModal(null);
      loadBuses();
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Buses</h1>
          <p className="subtitle">Manage your fleet</p>
        </div>
        <Button onClick={openAdd}>+ Add Bus</Button>
      </div>

      <FilterTabs tabs={STATUS_TABS} active={filter} onChange={setFilter} />

      <Card>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reg Number</th>
                <th>Model</th>
                <th>Capacity</th>
                <th>GPS Device</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      padding: "40px",
                    }}
                  >
                    {filter === "all" ? "No buses found" : `No ${filter} buses`}
                  </td>
                </tr>
              ) : (
                filtered.map((bus) => (
                  <tr key={bus.bid}>
                    <td>
                      <strong>{bus.registration_number}</strong>
                    </td>
                    <td>{bus.model || "-"}</td>
                    <td>{bus.capacity} seats</td>
                    <td
                      style={{
                        fontFamily: "monospace",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {bus.gps_device_id || "Not assigned"}
                    </td>
                    <td>
                      <Badge variant={bus.status}>{bus.status}</Badge>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(bus)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteModal(bus)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Bus" : "Add Bus"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Save Bus
            </Button>
          </>
        }
      >
        <FormGroup label="Registration Number *">
          <FormInput
            value={form.registration_number}
            onChange={(e) =>
              setForm({ ...form, registration_number: e.target.value })
            }
            placeholder="e.g. AP05-AB-1234"
          />
        </FormGroup>
        <FormRow>
          <FormGroup label="Capacity *">
            <FormInput
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              placeholder="e.g. 50"
            />
          </FormGroup>
          <FormGroup label="Model">
            <FormInput
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="e.g. Tata Starbus"
            />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="GPS Device ID">
            <FormInput
              value={form.gps_device_id}
              onChange={(e) =>
                setForm({ ...form, gps_device_id: e.target.value })
              }
              placeholder="e.g. GPS-001"
            />
          </FormGroup>
          <FormGroup label="Status">
            <FormSelect
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </FormSelect>
          </FormGroup>
        </FormRow>
      </Modal>

      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Bus"
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
          Delete <strong>{deleteModal?.registration_number}</strong>? This
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
