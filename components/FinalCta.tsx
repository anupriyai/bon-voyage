import Link from "next/link";
export default function FinalCta() {
  return (
    <section className="cta-wrap" id="book">
      <div className="container">
        <div className="cta">
          <h2>Wherever your care is, start the journey here.</h2>
          <p>Tell us what you need. A care coordinator will follow up with options you can trust.</p>
          <Link href="/start" className="btn btn-yellow">
            Book a consultation
          </Link>
        </div>
      </div>
    </section>
  );
}
