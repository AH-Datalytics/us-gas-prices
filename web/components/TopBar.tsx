import Link from "next/link";

export default function TopBar() {
  return (
    <header className="top-bar">
      <Link href="/" className="flex items-center gap-3 no-underline">
        <img src="/logo-navy.png" alt="AH Datalytics" style={{ height: 36, width: "auto" }} />
      </Link>
      <div className="flex-1 text-center">
        <span style={{ fontSize: 24, fontWeight: 800, color: "var(--blue-dark)", fontFamily: "var(--font-display)", letterSpacing: -0.3 }}>
          US Gas{" "}
        </span>
        <span style={{ fontSize: 24, fontWeight: 600, color: "var(--blue-mid)", fontFamily: "var(--font-display)", letterSpacing: -0.3 }}>
          Prices
        </span>
      </div>
    </header>
  );
}
