interface ChartCardProps {
  title: string;
  subtitle?: string;
  source?: string;
  children: React.ReactNode;
}

export default function ChartCard({ title, subtitle, source, children }: ChartCardProps) {
  return (
    <div className="chart-card">
      <h2>{title}</h2>
      {subtitle && <div className="subtitle">{subtitle}</div>}
      {children}
      {source && <div className="source">Source: {source}</div>}
    </div>
  );
}
