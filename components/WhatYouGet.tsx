import {
  CalendarCheckIcon,
  CheckIcon,
  CircleIcon,
  DocumentIcon,
  PeopleIcon,
  SearchIcon,
} from "./Icons";

const features = [
  {
    icon: SearchIcon,
    title: "Provider comparison",
    text: "Verified provider information and options our team has confirmed by hand.",
  },
  {
    icon: DocumentIcon,
    title: "Cost breakdown",
    text: "Treatment estimates, travel costs, exclusions and contingencies, before you commit.",
  },
  {
    icon: CalendarCheckIcon,
    title: "Coordination tracker",
    text: "Requests, consultations, travel tasks and confirmations in one place.",
  },
  {
    icon: PeopleIcon,
    title: "Caregiver access",
    text: "Let family see logistics and progress, only with the patient's permission.",
  },
];

const nextSteps = [
  { label: "Video consultation booked", done: true },
  { label: "Medical visa letter requested", done: true },
  { label: "Flights and accommodation", done: false },
  { label: "Follow-up handover to your local doctor", done: false },
];

export default function WhatYouGet() {
  return (
    <section className="section section-yellow" id="what-you-get">
      <div className="container get-grid">
        <div>
          <p className="eyebrow eyebrow-dark">What you get</p>
          <h2 className="h2-lg">One plan for the whole trip, from first search to final check-up.</h2>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="feature">
                <Icon width={20} height={20} />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="plan" aria-label="Example care journey plan">
          <div className="plan-head">
            <h3>Your care journey plan</h3>
            <span className="badge">Shareable</span>
          </div>

          <div className="plan-row">
            <span>[Provider A], [City]</span>
            <strong className="status-ok">Confirmed</strong>
          </div>
          <div className="plan-row">
            <span>[Provider B], [City]</span>
            <strong className="status-wait">Awaiting reply</strong>
          </div>

          <div className="plan-stats">
            <div>
              <small>Treatment estimate</small>
              <strong>[AMOUNT]</strong>
            </div>
            <div>
              <small>Travel &amp; stay</small>
              <strong>[AMOUNT]</strong>
            </div>
          </div>

          <p className="plan-label">Next steps</p>
          <ul className="plan-list">
            {nextSteps.map((s) => (
              <li key={s.label} className={s.done ? "done" : ""}>
                {s.done ? (
                  <CheckIcon width={14} height={14} />
                ) : (
                  <CircleIcon width={14} height={14} />
                )}
                {s.label}
              </li>
            ))}
          </ul>

          <div className="plan-foot">
            <span>Coordinator: [NAME]</span>
            <span>Caregiver view: on</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
