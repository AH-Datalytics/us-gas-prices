"use client";

import Link from "next/link";

interface ModuleCardProps {
  href: string;
  title: string;
  subtitle: string;
  stat: string;
  statLabel: string;
  description: string;
  color: string;
  icon: string;
  delay: number;
}

export default function ModuleCard({
  href, title, subtitle, stat, statLabel, description, color, icon, delay,
}: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="animate-card-in group"
      style={{
        animationDelay: `${delay}ms`,
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        border: "1.5px solid var(--border)",
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        textDecoration: "none",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 4px 16px rgba(26,58,92,0.12)`;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.borderLeftColor = color;
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ padding: "16px 18px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Icon + title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--blue-dark)" }}>{title}</span>
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 10, color: "var(--blue-mid)", letterSpacing: "0.3px", marginBottom: 10, paddingLeft: 28 }}>
          {subtitle}
        </div>

        {/* Big stat */}
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "var(--font-display)", lineHeight: 1 }}>
            {stat}
          </span>
          <span style={{ fontSize: 11, color: "var(--blue-mid)", marginLeft: 6 }}>{statLabel}</span>
        </div>

        {/* Description */}
        <p style={{ fontSize: 12, color: "var(--blue-mid)", lineHeight: 1.55, marginBottom: 14, flex: 1 }}>
          {description}
        </p>

        {/* CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color }}>
          <span>Start exploring</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3l5 5-5 5" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
