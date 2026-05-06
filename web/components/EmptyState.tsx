export default function EmptyState({ message = "No data available" }: { message?: string }) {
  return (
    <div className="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--blue-light)" strokeWidth="1.5" strokeLinecap="round">
        <rect x="3" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="8" width="4" height="12" rx="1" />
        <rect x="17" y="4" width="4" height="16" rx="1" />
      </svg>
      <p style={{ marginTop: 12 }}>{message}</p>
    </div>
  );
}
