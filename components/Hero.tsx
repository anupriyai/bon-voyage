import Link from "next/link";
import CareRequestForm from "./CareRequestForm";
import HeroPath from "./HeroPath";

export default function Hero() {
  return (
    <section className="hero" id="top">
      <HeroPath />

      <div className="container hero-inner">
        <div className="hero-copy">
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
