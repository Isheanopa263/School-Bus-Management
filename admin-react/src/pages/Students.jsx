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
  { value: "approved", label: "Assigned" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" },
];

export default function Students() {
  const [students, setStudents] = useState([]);
  const [stops, setStops] = useState([]);
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
    roll: "",
    emergency_contact_phone: "",
    assigned_stop_id: "",
    bus_request_status: "inactive",
  });

  useEffect(() => {
    loadStudents();
    loadStops();
  }, []);

  async function loadStudents() {
    try {
      const data = await apiFetch("/students");
      setStudents(data.students || []);
    } catch (err) {
      console.error("Load students error:", err);
    }
  }

  async function loadStops() {
    try {
      const routesData = await apiFetch("/routes");
      const routes = routesData.routes || [];
      const allStops = [];

      for (const route of routes) {
        try {
          const stopsData = await apiFetch(`/stops?route_id=${route.rid}`);
          (stopsData.stops || []).forEach((stop) => {
            allStops.push({
              id: stop.id,
              name: stop.name,
              route_name: route.name,
              sequence: stop.sequence_number,
            });
          });
        } catch (e) {
          console.warn(`Failed to load stops for ${route.name}`);
        }
      }

      setStops(allStops);
    } catch (err) {
      console.error("Load stops error:", err);
    }
  }

  const filtered =
    filter === "all"
      ? students
      : students.filter((s) => s.bus_request_status === filter);

  function openAdd() {
    setEditing(null);
    setForm({
      full_name: "",
      email: "",
      phone: "",
      password: "",
      roll: "",
      emergency_contact_phone: "",
      assigned_stop_id: "",
      bus_request_status: "inactive",
    });
    setModalOpen(true);
  }

  function openEdit(student) {
    setEditing(student);
    setForm({
      full_name: student.full_name || "",
      email: student.email || "",
      phone: student.phone || "",
      password: "",
      roll: student.roll || "",
      emergency_contact_phone: student.emergency_contact_phone || "",
      assigned_stop_id: student.assigned_stop_id || "",
      bus_request_status: student.bus_request_status || "inactive",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.full_name || !form.phone) {
      alert("Full name and phone are required");
      return;
    }

    if (!editing && (!form.password || form.password.length < 6)) {
      alert("Password must be at least 6 characters for new students");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/students/${editing.sid}`, {
          method: "PUT",
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email || null,
            phone: form.phone,
            roll: form.roll || null,
            emergency_contact_phone: form.emergency_contact_phone || null,
            assigned_stop_id: form.assigned_stop_id || null,
            bus_request_status: form.bus_request_status,
          }),
        });
      } else {
        await apiFetch("/students", {
          method: "POST",
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email || null,
            phone: form.phone,
            password: form.password,
            roll: form.roll || null,
            emergency_contact_phone: form.emergency_contact_phone || null,
            assigned_stop_id: form.assigned_stop_id || null,
          }),
        });
      }
      setModalOpen(false);
      loadStudents();
    } catch (err) {
      alert(err.message || "Failed to save student");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteModal) return;
    try {
      await apiFetch(`/students/${deleteModal.sid}`, { method: "DELETE" });
      setDeleteModal(null);
      loadStudents();
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Students</h1>
          <p className="subtitle">
            Manage student accounts and bus assignments
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Student</Button>
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
                <th>Emergency</th>
                <th>Bus Status</th>
                <th>Assigned Stop</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    {filter === "all"
                      ? "No students found"
                      : `No ${filter} students`}
                  </td>
                </tr>
              ) : (
                filtered.map((student) => (
                  <tr key={student.sid}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {(student.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-name">
                            {student.full_name || "-"}
                          </div>
                          <div className="user-email">
                            {student.email || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{student.roll || "-"}</td>
                    <td>{student.phone || "-"}</td>
                    <td>{student.emergency_contact_phone || "-"}</td>
                    <td>
                      <Badge variant={student.bus_request_status || "inactive"}>
                        {(student.bus_request_status || "inactive").replace(
                          "_",
                          " ",
                        )}
                      </Badge>
                    </td>
                    <td>
                      {student.stop_name ? (
                        <Badge variant="active">📍 {student.stop_name}</Badge>
                      ) : (
                        <span className="muted-text">No stop</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(student)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteModal(student)}
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
        title={editing ? "Edit Student" : "Add Student"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Save Student
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
              placeholder="e.g. John Doe"
            />
          </FormGroup>
          <FormGroup label="Email">
            <FormInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. john@email.com"
            />
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Phone *">
            <FormInput
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 9100000001"
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

        <div className="form-section-title">Student Details</div>

        <FormRow>
          <FormGroup label="Roll Number">
            <FormInput
              value={form.roll}
              onChange={(e) => setForm({ ...form, roll: e.target.value })}
              placeholder="e.g. 22A91A0501"
            />
          </FormGroup>
          <FormGroup label="Emergency Contact">
            <FormInput
              value={form.emergency_contact_phone}
              onChange={(e) =>
                setForm({ ...form, emergency_contact_phone: e.target.value })
              }
              placeholder="Parent/Guardian phone"
            />
          </FormGroup>
        </FormRow>

        <div className="form-section-title">Bus Assignment</div>

        <FormRow>
          <FormGroup label="Assigned Stop">
            <FormSelect
              value={form.assigned_stop_id}
              onChange={(e) =>
                setForm({ ...form, assigned_stop_id: e.target.value })
              }
            >
              <option value="">No stop assigned</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.route_name} - {s.sequence}. {s.name}
                </option>
              ))}
            </FormSelect>
          </FormGroup>
          <FormGroup label="Status">
            <FormSelect
              value={form.bus_request_status}
              onChange={(e) =>
                setForm({ ...form, bus_request_status: e.target.value })
              }
            >
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </FormSelect>
          </FormGroup>
        </FormRow>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Student"
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
