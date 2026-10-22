import Link from "next/link";
import HeaderCaseLink from "./HeaderCaseLink";
import { LogoMark } from "./Icons";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#what-you-get", label: "What you get" },
  { href: "#caregivers", label: "For caregivers" },
  { href: "#providers", label: "For providers" },
  { href: "#contact", label: "Contact" },
];

export default function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="#top" className="brand">
          <LogoMark />
          <span>Bon Voyage</span>
        </a>
        <nav className="nav" aria-label="Primary">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <HeaderCaseLink />
          <a href="#login" className="login-link">
            Log in
          </a>
          <Link href="/start" className="btn btn-dark">
            Book a consultation
          </Link>
        </div>
      </div>
    </header>
  );
}
