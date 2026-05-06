"use client";

interface ScopeToggleProps {
  options: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
}

export default function ScopeToggle({ options, active, onChange }: ScopeToggleProps) {
  return (
    <div className="scope-toggle">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`scope-btn ${active === opt.value ? "active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
