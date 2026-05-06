import Link from "next/link";

interface ModuleCardProps {
  href: string;
  title: string;
  description: string;
  gradient: string;
  delay: number;
}

export default function ModuleCard({ href, title, description, gradient, delay }: ModuleCardProps) {
  return (
    <Link href={href} className="module-card animate-card-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="card-bg" style={{ background: gradient }} />
      <div className="card-overlay">
        <div className="card-title">{title}</div>
        <div className="card-desc">{description}</div>
      </div>
    </Link>
  );
}
