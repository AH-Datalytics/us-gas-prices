import Link from "next/link";

export default function TopBar() {
  return (
    <header className="top-bar">
      <Link href="/" className="flex items-center gap-3 no-underline">
        <img src="/logo-navy.png" alt="AH Datalytics" className="topbar-logo" />
      </Link>
      <div className="flex-1 text-center">
        <span className="topbar-title-bold">
          US Gas{" "}
        </span>
        <span className="topbar-title-light">
          Prices
        </span>
      </div>
    </header>
  );
}
