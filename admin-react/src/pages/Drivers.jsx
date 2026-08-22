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
  { value: "on_leave", label: "On Leave" },
  { value: "inactive", label: "Inactive" },
];

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [buses, setBuses] = useState([]);
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    license_number: "",
    license_expiry: "",
    current_bus_id: "",
    employment_status: "active",
  });

  useEffect(() => {
    loadDrivers();
    loadBuses();
  }, []);

  async function loadDrivers() {
    try {
      const data = await apiFetch("/drivers");
      setDrivers(data.drivers || []);
    } catch (err) {
      console.error("Load drivers error:", err);
    }
  }

  async function loadBuses() {
    try {
      const data = await apiFetch("/buses");
      setBuses((data.buses || []).filter((b) => b.status === "active"));
    } catch (err) {
      console.error("Load buses error:", err);
    }
  }

  const filtered =
    filter === "all"
      ? drivers
      : drivers.filter((d) => d.employment_status === filter);

  function getExpiryClass(date) {
    if (!date) return "";
    const diff = Math.floor(
      (new Date(date) - new Date()) / (1000 * 60 * 60 * 24),
    );
    if (diff < 0) return "expiry-danger";
    if (diff < 30) return "expiry-warning";
    return "";
  }

  function formatDate(d) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function openAdd() {
    setEditing(null);
    setForm({
      full_name: "",
      email: "",
      phone: "",
      password: "",
      license_number: "",
      license_expiry: "",
      current_bus_id: "",
      employment_status: "active",
    });
    setModalOpen(true);
  }

  function openEdit(driver) {
    setEditing(driver);
    setForm({
      full_name: driver.full_name || "",
      email: driver.email || "",
      phone: driver.phone || "",
      password: "",
      license_number: driver.license_number || "",
      license_expiry: driver.license_expiry
        ? new Date(driver.license_expiry).toISOString().split("T")[0]
        : "",
      current_bus_id: driver.current_bus_id || "",
      employment_status: driver.employment_status || "active",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (
      !form.full_name ||
      !form.phone ||
      !form.license_number ||
      !form.license_expiry
    ) {
      alert("Please fill all required fields");
      return;
    }

    if (!editing && (!form.password || form.password.length < 6)) {
      alert("Password must be at least 6 characters for new drivers");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/drivers/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            license_number: form.license_number,
            license_expiry: form.license_expiry,
            employment_status: form.employment_status,
            current_bus_id: form.current_bus_id || null,
          }),
        });
      } else {
        await apiFetch("/drivers", {
          method: "POST",
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email || null,
            phone: form.phone,
            password: form.password,
            license_number: form.license_number,
            license_expiry: form.license_expiry,
            current_bus_id: form.current_bus_id || null,
          }),
        });
      }
      setModalOpen(false);
      loadDrivers();
    } catch (err) {
      alert(err.message || "Failed to save driver");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteModal) return;
    try {
      await apiFetch(`/drivers/${deleteModal.id}`, { method: "DELETE" });
      setDeleteModal(null);
      loadDrivers();
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Drivers</h1>
          <p className="subtitle">Manage your drivers</p>
        </div>
        <Button onClick={openAdd}>+ Add Driver</Button>
      </div>

      <FilterTabs tabs={STATUS_TABS} active={filter} onChange={setFilter} />

      <Card>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Contact</th>
                <th>License</th>
                <th>License Expiry</th>
                <th>Assigned Bus</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    {filter === "all"
                      ? "No drivers found"
                      : `No ${filter.replace("_", " ")} drivers`}
                  </td>
                </tr>
              ) : (
                filtered.map((driver) => (
                  <tr key={driver.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {(driver.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-name">
                            {driver.full_name || "-"}
                          </div>
                          <div className="user-email">
                            {driver.email || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{driver.phone || "-"}</td>
                    <td className="mono-text">
                      {driver.license_number || "-"}
                    </td>
                    <td className={getExpiryClass(driver.license_expiry)}>
                      {formatDate(driver.license_expiry)}
                    </td>
                    <td>
                      {driver.bus_number ? (
                        <Badge variant="active">🚌 {driver.bus_number}</Badge>
                      ) : (
                        <span className="muted-text">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={driver.employment_status || "active"}>
                        {(driver.employment_status || "active").replace(
                          "_",
                          " ",
                        )}
                      </Badge>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(driver)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteModal(driver)}
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Driver" : "Add Driver"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Save Driver
            </Button>
          </>
        }
      >
        <div className="form-section-title">Personal Information</div>

        <FormRow>
          <FormGroup label="Full Name *">
            <FormInput
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="e.g. Ravi Kumar"
              disabled={!!editing}
            />
          </FormGroup>
          <FormGroup label="Email">
            <FormInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. ravi@email.com"
              disabled={!!editing}
            />
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Phone *">
            <FormInput
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 9100000001"
              disabled={!!editing}
            />
          </FormGroup>
          <FormGroup
            label="Password *"
            hint={editing ? "Leave blank to keep current" : "Min 6 characters"}
          >
            <FormInput
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? "Leave blank" : "Min 6 characters"}
            />
          </FormGroup>
        </FormRow>

        <div className="form-section-title">License Details</div>

        <FormRow>
          <FormGroup label="License Number *">
            <FormInput
              value={form.license_number}
              onChange={(e) =>
                setForm({ ...form, license_number: e.target.value })
              }
              placeholder="e.g. DL-1234567890"
            />
          </FormGroup>
          <FormGroup label="License Expiry *">
            <FormInput
              type="date"
              value={form.license_expiry}
              onChange={(e) =>
                setForm({ ...form, license_expiry: e.target.value })
              }
            />
          </FormGroup>
        </FormRow>

        <div className="form-section-title">Assignment</div>

        <FormRow>
          <FormGroup label="Assigned Bus">
            <FormSelect
              value={form.current_bus_id}
              onChange={(e) =>
                setForm({ ...form, current_bus_id: e.target.value })
              }
            >
              <option value="">No bus assigned</option>
              {buses.map((b) => (
                <option key={b.bid} value={b.bid}>
                  {b.registration_number}
                </option>
              ))}
            </FormSelect>
          </FormGroup>
          <FormGroup label="Status">
            <FormSelect
              value={form.employment_status}
              onChange={(e) =>
                setForm({ ...form, employment_status: e.target.value })
              }
            >
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </FormSelect>
          </FormGroup>
        </FormRow>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Driver"
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
          Delete <strong>{deleteModal?.full_name}</strong>? Their account will
          be deactivated.
        </p>
      </Modal>
    </div>
  );
}
