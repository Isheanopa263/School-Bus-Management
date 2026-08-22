import "./TopNav.css";

export default function TopNav({ onMenuToggle }) {
  return (
    <nav className="top-nav-mobile">
      <button className="menu-toggle" onClick={onMenuToggle}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="top-nav-brand">
        <span>BusTrack Admin</span>
      </div>
    </nav>
  );
}
