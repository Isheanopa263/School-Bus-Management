import "./FormGroup.css";

export function FormGroup({ label, children, hint, error }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      {children}
      {hint && <p className="form-hint">{hint}</p>}
      {error && <p className="form-error-text">{error}</p>}
    </div>
  );
}

export function FormInput({ ...props }) {
  return <input className={`form-input ${props.className || ""}`} {...props} />;
}

export function FormSelect({ children, ...props }) {
  return (
    <select className="form-select" {...props}>
      {children}
    </select>
  );
}

export function FormTextarea({ ...props }) {
  return <textarea className="form-textarea" {...props} />;
}

export function FormRow({ children }) {
  return <div className="form-row">{children}</div>;
}
