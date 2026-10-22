const steps = [
  {
    title: "Discover",
    text: "Explore countries, hospitals and specialists who treat your condition.",
  },
  {
    title: "Compare",
    text: "See verified providers side by side, with treatment and travel costs spelled out.",
  },
  {
    title: "Prepare",
    text: "Share records securely, book consultations and sort out travel.",
  },
  {
    title: "Get treated",
    text: "Arrive knowing who to call, where to go and what comes next.",
  },
  {
    title: "Recover at home",
    text: "Return home with a follow-up plan your local doctor can pick up.",
  },
];

export default function HowItWorks() {
  return (
    <section className="section" id="how-it-works">
      <div className="container">
        <div className="split split-end">
          <h2 className="h2-xl">
            Getting care abroad shouldn&apos;t mean becoming your own travel agent, translator
            and case manager.
          </h2>
          <p className="lede">
            Today, patients piece it together alone: providers, pricing, records, visas,
            flights, follow-up, often across languages and healthcare systems. Bon Voyage
            brings it into one journey, so you and your family can focus on getting better.
          </p>
        </div>

        <p className="eyebrow">How it works</p>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.title} className={`step${i === steps.length - 1 ? " step-final" : ""}`}>
              <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
