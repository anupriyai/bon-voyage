import Link from "next/link";
import { LogoMark } from "./Icons";

export default function FlowHeader({ exitLabel = "Save and exit" }: { exitLabel?: string }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          <LogoMark />
          <span>Bon Voyage</span>
        </Link>
        <div className="header-actions">
          <Link href="/" className="btn btn-outline-dark btn-sm">
            {exitLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
