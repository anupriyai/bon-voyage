import Link from "next/link";
import { Arrow } from "@/shared/ui/Icons";
import { SiteFooter, SiteHeader } from "./SiteChrome";
export default function ContactPage() {
  return <div className="home"><SiteHeader /><main className="home-shell">
    <section className="marketing-hero marketing-hero-text"><div className="marketing-hero-copy"><p className="h-kicker">Help & contact</p><h1>A little clarity.<br /><span>A person when you need one.</span></h1><p>Choose the place that fits where you are in your journey.</p></div></section>
    <section className="contact-options marketing-section" aria-label="Ways to get help">{[["Just getting started?", "Tell the assistant what’s happening. It will help organise the first questions and build a brief you can review.", "/start", "Start with your story"], ["Already have a case?", "Sign in to your saved journey. The coordinator panel inside your case keeps your message alongside the context you have already shared.", "/account", "Open my journeys"], ["Want to understand the service?", "Read about how planning works, what estimates include, and which decisions belong with your clinicians.", "/#faq", "Read common questions"]].map(([title, body, href, action]) => <article key={title} data-reveal><h2>{title}</h2><p>{body}</p><Link href={href} className="home-text-link">{action} <Arrow size={17} /></Link></article>)}</section>
    <section className="marketing-note" data-reveal><h2>About support in this prototype</h2><p>Coordinator conversations are demonstrations; messages are saved to the case but are not delivered to a staffed support team. Bon Voyage does not provide urgent care or medical advice. For treatment questions, contact your licensed healthcare professional directly.</p></section>
  </main><SiteFooter /></div>;
}
