import Link from "next/link";
import CareRequestForm from "./CareRequestForm";

export default function Hero() {
  return (
    <section className="hero" id="top">
      <svg
        className="hero-path"
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMin slice"
        aria-hidden="true"
      >
        <path
          d="M368 710 C 330 640, 215 600, 225 575 C 235 545, 330 480, 420 430 S 700 270, 1010 215"
          fill="none"
          stroke="#b4f0d6"
          strokeOpacity="0.85"
          strokeWidth="1.5"
          strokeDasharray="5 7"
        />
        <circle cx="368" cy="710" r="4.5" fill="#b4f0d6" />
        <g transform="translate(225 575)" fill="#b4f0d6">
          <circle r="11" fillOpacity="0.2" />
          <path d="M0-8 2 -2 8 0 2 2 0 8 -2 2 -8 0 -2 -2Z" />
        </g>
      </svg>

      <div className="container hero-inner">
        <div className="hero-copy">
          <span className="pill">Cross-border care coordination</span>
          <h1>The right doctor might be a flight away. We&apos;ll help you get there.</h1>
          <p>
            Bon Voyage helps patients and families find trusted specialists abroad, compare
            real costs, and plan every step of treatment and recovery in one place. Especially
            when the care you need isn&apos;t available, affordable or reachable at home.
          </p>
          <div className="hero-actions">
            <Link href="/start" className="btn btn-mint">
              Start a care request
            </Link>
            <a href="#how-it-works" className="btn btn-outline-light">
              See how it works
            </a>
          </div>
        </div>
        <CareRequestForm />
      </div>
    </section>
  );
}
