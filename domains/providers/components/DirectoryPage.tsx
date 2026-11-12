import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/domains/marketing";
import { Arrow, GlobeIcon } from "@/shared/ui/Icons";
import { COUNTRIES } from "../countries";
import { PUBLIC_OFFERS, SPECIALTIES, TREATMENTS } from "../catalogue";
import { normalise } from "../search";

export default function DirectoryPage({ kind, query = "" }: { kind: "destinations" | "treatments"; query?: string }) {
  const destinations = kind === "destinations";
  const groups = destinations ? ["Africa", "Asia", "Europe", "North America", "South America", "Oceania", "Antarctica"] : SPECIALTIES.map((item) => item.name);
  const countries = COUNTRIES.filter((item) => normalise(`${item.name} ${item.code} ${item.continent}`).includes(normalise(query)));
  const treatments = TREATMENTS.filter((item) => normalise(`${item.name} ${item.synonyms.join(" ")} ${SPECIALTIES.find((specialty) => specialty.id === item.specialtyId)?.name}`).includes(normalise(query)));
  return <div className="home directory-page"><SiteHeader /><main><section className="directory-hero home-shell"><p className="h-kicker">Cancer care, worldwide</p><h1>{destinations ? <>Explore cancer care<br /><span>by destination.</span></> : <>Explore cancer care<br /><span>topics.</span></>}</h1><p>{destinations ? `Browse ${COUNTRIES.length} countries and territories. Countries without independently verified clinics show an honest empty state.` : "Learn the names of cancer care consultations and treatment approaches. Your cancer team decides what is appropriate; this directory does not offer treatment."}</p><form action={`/${kind}`} className="directory-search"><label className="directory-sr" htmlFor="directory-query">Search {kind}</label><input id="directory-query" name="q" type="search" key={query} defaultValue={query} placeholder={destinations ? "Search country, region or country code" : "Search cancer care topic"} /><button type="submit" className="btn btn-primary">Search <Arrow size={17} /></button></form><div className="directory-quick-links"><Link href="/explore">Explore cancer care <Arrow size={14} /></Link><Link href={destinations ? "/treatments" : "/destinations"}>{destinations ? "Browse cancer care topics" : "Browse destinations"} <Arrow size={14} /></Link></div>{!destinations && <p className="explore-small">Care topic names follow the <a href="https://www.cancer.gov/about-cancer/treatment/types" target="_blank" rel="noopener noreferrer">National Cancer Institute’s treatment overview</a>. This is general information, not personal medical advice.</p>}</section>
    <div className="directory-stats home-shell"><div><strong>{destinations ? COUNTRIES.length : SPECIALTIES.length}</strong><span>{destinations ? "countries & territories" : "care focus"}</span></div><div><strong>{destinations ? new Set(PUBLIC_OFFERS.map((item) => item.countryCode)).size : TREATMENTS.length}</strong><span>{destinations ? "destinations with verified clinics" : "cancer care topics"}</span></div><p>No fictional clinics or prices are shown. A country listing does not imply a verified medical service.</p></div>
    <nav className="directory-jump home-shell" aria-label={destinations ? "Regions" : "Specialties"}>{groups.map((group) => <a key={group} href={`#${normalise(group).replace(/\W+/g, "-")}`}>{group}</a>)}</nav>
    <div className="directory-content home-shell">{groups.map((group) => {
      const items = destinations ? countries.filter((item) => item.continent === group) : treatments.filter((item) => SPECIALTIES.find((specialty) => specialty.id === item.specialtyId)?.name === group);
      if (!items.length) return null;
      return <section key={group} id={normalise(group).replace(/\W+/g, "-")} className="directory-group"><div className="directory-group-title"><GlobeIcon size={24} /><h2>{group}</h2><span>{items.length}</span></div><div className="directory-grid">{items.map((item) => {
        if ("code" in item) {
          const count = PUBLIC_OFFERS.filter((offer) => offer.countryCode === item.code).length;
          return <Link key={item.code} href={`/destinations/${item.slug}`} className={`directory-item${count ? " directory-item-available" : ""}`}><span className="directory-code">{item.code}</span><div><h3>{item.name}</h3><p>{count ? `${count} verified care ${count === 1 ? "option" : "options"}` : "No verified clinics listed yet"}</p></div><Arrow size={16} /></Link>;
        }
        const count = PUBLIC_OFFERS.filter((offer) => offer.treatmentId === item.id).length;
        return <Link key={item.id} href={`/treatments/${item.slug}`} className="directory-item directory-treatment"><div><h3>{item.name}</h3><p>{count ? `${count} verified ${count === 1 ? "option" : "options"}` : "No verified clinics listed yet"}</p></div><Arrow size={16} /></Link>;
      })}</div></section>;
    })}{(destinations ? countries.length : treatments.length) === 0 && <div className="explore-empty"><GlobeIcon size={40} /><h2>No {kind} match “{query}”.</h2><p>Try another name, procedure or spelling.</p><Link href={`/${kind}`} className="btn btn-secondary">See all {kind}</Link></div>}</div>
    <section className="explore-bottom-cta home-shell"><div><h2>See the care. Plan the trip.</h2><p>Bring a treatment estimate, flights and accommodation together.</p></div><Link href="/explore" className="btn btn-primary">Explore care + travel <Arrow size={18} /></Link></section>
  </main><SiteFooter /></div>;
}
