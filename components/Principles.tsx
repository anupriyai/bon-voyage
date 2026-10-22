const principles = [
  {
    title: "In your language",
    text: "Multilingual guidance at every step, for patients and the family members supporting them.",
  },
  {
    title: "Honest total costs",
    text: "Medically appropriate comparisons of what treatment really costs, travel included.",
  },
  {
    title: "Care that follows you home",
    text: "Coordinated follow-up with trusted local physicians once you're back.",
  },
];

export default function Principles() {
  return (
    <section className="section" id="caregivers">
      <div className="container">
        <div className="split split-center">
          <h2 className="h2-lg">We connect people to doctors. We don&apos;t replace them.</h2>
          <p className="lede lede-sm">
            Bon Voyage connects patients, caregivers and qualified providers, and takes the
            admin of arranging treatment abroad off everyone&apos;s plate.
          </p>
        </div>

        <div className="principles">
          {principles.map((p) => (
            <div key={p.title} className="principle">
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>

        <div className="partner" id="providers">
          <div>
            <h3>Are you a hospital or clinic?</h3>
            <p>Partner with us to reach patients who need your expertise.</p>
          </div>
          <a href="#partner" className="btn btn-outline-dark">
            Become a provider partner
          </a>
        </div>
      </div>
    </section>
  );
}
