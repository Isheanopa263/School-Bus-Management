import "./Button.css";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  loading,
  disabled,
  fullWidth,
  onClick,
  type = "button",
  className = "",
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${fullWidth ? "btn-full" : ""} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (
        <span className="btn-spinner" />
      ) : (
        <>
          {icon && <span className="btn-icon">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
