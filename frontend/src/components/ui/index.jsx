// ──────────────────────────────────────────────────────────
// Reusable UI Components
// src/components/ui/
// ──────────────────────────────────────────────────────────

export function Button({ variant = "primary", size = "md", className = "", children, ...props }) {
  return (
    <button className={`btn btn--${variant} ${size !== "md" ? `btn--${size}` : ""} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function Card({ as: Element = "section", className = "", children, ...props }) {
  return <Element className={`clay-card ${className}`.trim()} {...props}>{children}</Element>;
}

export function Input({ label, error, className = "", ...props }) {
  return (
    <label className="clay-input-field">
      {label && <span className="form-label">{label}</span>}
      <input className={`clay-input ${className}`.trim()} {...props} />
      {error && <span className="form-error">{error}</span>}
    </label>
  );
}

export function Badge({ tone = "default", children }) {
  return <span className={`clay-badge clay-badge--${tone}`}>{children}</span>;
}

// ── KPICard ──────────────────────────────────────────────
export function KPICard({ title, value, icon, color = "primary", subtitle }) {
  return (
    <div className={`kpi-card kpi-card--${color}`}>
      <div className="kpi-card-icon">{icon}</div>
      <div className="kpi-card-content">
        <span className="kpi-card-value">{value}</span>
        <span className="kpi-card-title">{title}</span>
        {subtitle && <span className="kpi-card-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

// ── StatusBadge ──────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    done:      { label: "Done",      cls: "success" },
    ready:     { label: "Ready",     cls: "primary" },
    waiting:   { label: "Waiting",   cls: "warning" },
    draft:     { label: "Draft",     cls: "default" },
    canceled:  { label: "Canceled",  cls: "danger" },
    cancelled: { label: "Cancelled", cls: "danger" },
  };
  const s = map[status?.toLowerCase()] || { label: status, cls: "default" };
  return <span className={`status-badge status-badge--${s.cls}`}>{s.label}</span>;
}

// ── SearchBar ────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="search-bar">
      <span className="search-bar-icon">🔍</span>
      <input
        type="text"
        className="search-bar-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button className="search-bar-clear" onClick={() => onChange("")}>✕</button>
      )}
    </div>
  );
}

// ── Filter Select ────────────────────────────────────────
export function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="filter-select">
      {label && <label className="filter-select-label">{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="filter-select-input">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── LoadingSpinner ───────────────────────────────────────
export function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="loading-spinner">
      <div className="loading-spinner-circle" />
      <span>{message}</span>
    </div>
  );
}

// ── ErrorMessage ─────────────────────────────────────────
export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="error-message-box">
      <span className="error-message-icon">⚠️</span>
      <p>{message || "Something went wrong."}</p>
      {onRetry && <button className="btn btn--primary btn--sm" onClick={onRetry}>Try Again</button>}
    </div>
  );
}

// ── EmptyState ───────────────────────────────────────────
export function EmptyState({ icon = "📭", title = "No data found", message }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">{icon}</span>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
    </div>
  );
}

// ── ConfirmDialog ────────────────────────────────────────
export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = false }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog modal-dialog--sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title || "Confirm"}</h3>
        <p className="modal-text">{message}</p>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? "btn--danger" : "btn--primary"}`} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────
export function Modal({ open, title, onClose, children, size = "md" }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-dialog modal-dialog--${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Toast / Notification ─────────────────────────────────
export function Toast({ message, type = "success", onClose }) {
  if (!message) return null;
  return (
    <div className={`toast toast--${type}`}>
      <span className="toast-icon">
        {type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}
      </span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>✕</button>
    </div>
  );
}
