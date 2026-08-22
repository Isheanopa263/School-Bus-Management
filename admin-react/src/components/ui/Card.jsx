import "./Card.css";

export default function Card({ children, className = "", header, actions }) {
  return (
    <div className={`card ${className}`}>
      {(header || actions) && (
        <div className="card-header">
          {header && <h3 className="card-title">{header}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}
