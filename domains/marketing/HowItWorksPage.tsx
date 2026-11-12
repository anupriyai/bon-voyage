import Link from "next/link";
import { Arrow, Bed, Care, Check, Plane, Sparkle } from "@/shared/ui/Icons";
import { JourneyCTA, SiteFooter, SiteHeader } from "./SiteChrome";
const STEPS = [
  { n: "01", icon: <Sparkle size={24} />, title: "Start with your story.", body: "Tell us what’s happening, who the care is for, and what matters to you. Write naturally—the assistant picks out the details and asks about what’s missing.", detail: "You review the brief before creating your case. Your priorities can change later." },
  { n: "02", icon: <Care size={24} />, title: "Bring the right information together.", body: "See a records checklist shaped around your case. Explore whether a second opinion is the right next step before comparing options.", detail: "Record reading, translation and clinical-provider details are demonstrations in this prototype. Use sample files." },
  { n: "03", icon: <Check size={24} />, title: "Compare with a clearer picture.", body: "Compare care options with estimated costs, timing and travel considerations. Move a priority up and see how the ranking changes.", detail: "A planning score reflects your preferences. It is not a clinical rating or a recommendation to undergo treatment." },
  { n: "04", icon: <Plane size={24} />, title: "Plan the journey around your care.", body: "Explore sample flights, arrival dates, travelling companions and assistance needs. Compare the travel estimate with the time spent travelling.", detail: "Treatment and recovery windows are planning assumptions until your clinician confirms them." },
  { n: "05", icon: <Bed size={24} />, title: "Find a stay that fits.", body: "Explore sample accommodation and review accessibility, room conditions and possible fees.", detail: "A listing does not confirm suitability or availability. Confirm your actual requirements directly with a property before booking." },
  { n: "06", icon: <Check size={24} />, title: "Review one connected plan.", body: "Bring the care, travel and accommodation estimates into one view. Review proposed changes and see who is handling each next step.", detail: "Signing in saves your case so you can return on another device. Live booking and real payments remain disabled." },
];
export default function HowItWorksPage() {
  return <div className="home"><SiteHeader /><main>
    <section className="home-shell marketing-hero marketing-hero-text"><div className="marketing-hero-copy"><p className="h-kicker">How it works</p><h1>From “where do I start?”<br /><span>to a clearer next step.</span></h1><p>One story. One place for the moving parts. Support as you work through the decisions.</p><Link href="/start" className="btn btn-primary">Start my journey <Arrow size={18} /></Link></div></section>
    <section className="home-shell process-sections" aria-label="The journey, step by step">{STEPS.map((step) => <article className="process-step" key={step.n} data-reveal><div className="process-step-number"><span>{step.n}</span>{step.icon}</div><div><h2>{step.title}</h2><p>{step.body}</p><p className="process-step-detail">{step.detail}</p></div></article>)}</section>
    <section className="home-shell marketing-note" data-reveal><h2>Pause. Pick it up later.</h2><p>You don’t need every answer to get started. Drafts stay on your device while you explore; signing in lets you save your case to your account and restore it on another device.</p><Link href="/login" className="home-text-link">Return to your journey <Arrow size={16} /></Link></section>
    <JourneyCTA />
  </main><SiteFooter /></div>;
}
