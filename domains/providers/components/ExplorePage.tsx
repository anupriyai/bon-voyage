import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/domains/marketing";
import { Arrow, Check, GlobeIcon, Plane } from "@/shared/ui/Icons";
import { COUNTRIES } from "../countries";
import { PUBLIC_OFFERS, SPECIALTIES, TREATMENTS, type CareOffer } from "../catalogue";
import { normalise, parseCareSearch, queryString, searchCare, travelQuery, type SearchValues } from "../search";
import FilterPanel from "./FilterPanel";

export const usd = (amount: number | null) => amount === null ? "Price on request" : `US$${amount.toLocaleString("en-US")}`;
export function HiddenValues({ values, except = [] }: { values: SearchValues; except?: string[] }) {
  return <>{Object.entries(values).filter(([key]) => !except.includes(key)).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={Array.isArray(value) ? value[0] : value} /> : null)}</>;
}
export function DestinationArt({ offer, compact = false }: { offer: CareOffer; compact?: boolean }) {
  const country = COUNTRIES.find((item) => item.code === offer.countryCode);
  return <div className={`explore-destination-art explore-region-${country?.continent.toLowerCase().replaceAll(" ", "-")}${compact ? " explore-art-compact" : ""}`} aria-hidden="true"><div className="explore-art-orbit" /><span className="explore-art-code">{offer.airport}</span><span className="explore-art-place">{offer.city}<small>{country?.name}</small></span><GlobeIcon size={30} /></div>;
}

export default function ExplorePage({ values = {}, heading, intro }: { values?: SearchValues; heading?: string; intro?: string }) {
  const search = parseCareSearch(values);
  const result = searchCare(search);
  const selected = search.compare.map((id) => PUBLIC_OFFERS.find((item) => item.id === id)!).filter(Boolean);
  const travel = travelQuery(values);
  const href = (updates: Record<string, string | null>, anchor = "") => `/explore?${queryString(values, updates)}${anchor}`;
  const filtered = Boolean(search.q || search.country || search.treatment || search.specialty || search.language || search.accessible || search.min !== null || search.max !== null);
  const invalidBudget = search.min !== null && search.max !== null && search.min > search.max;
  const topicQuery = normalise(search.q);
  const topics = TREATMENTS.filter((item) => (!search.treatment || item.id === search.treatment) && (!topicQuery || normalise(`${item.name} ${item.synonyms.join(" ")}`).includes(topicQuery)));
  return <div className="home explore-page"><SiteHeader /><main key={JSON.stringify(values)}>
    <section className="explore-hero home-shell">
      <div className="explore-hero-top"><p className="h-kicker">Care abroad, on your terms</p><span className="explore-hero-note"><GlobeIcon size={15} /> {COUNTRIES.length} countries & territories to explore</span></div>
      <h1>{heading || <>Explore cancer care.<br /><span>Know what’s verified.</span></>}</h1>
      <p className="explore-hero-description">{intro || "Explore cancer care pathways and destinations. Clinic comparison opens when verified partners, prices and availability are ready."}</p>
      <nav className="explore-tabs" aria-label="Explore care"><Link href="/explore" aria-current="page"><Check size={16} /> Cancer care</Link><Link href="/destinations"><GlobeIcon size={17} /> Destinations</Link><Link href="/treatments">Care topics</Link></nav>
      <form id="care-search" action="/explore" method="get" className="explore-search-bar">
        <label className="explore-search-treatment"><span>What cancer care?</span><input name="q" type="search" list="care-treatment-list" placeholder="Second opinion, radiation, surgery…" defaultValue={search.q} /><datalist id="care-treatment-list">{TREATMENTS.map((item) => <option key={item.id} value={item.name} />)}</datalist></label>
        <label className="explore-search-country"><span>Where?</span><select name="country" defaultValue={search.country}><option value="">Anywhere</option>{COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
        <button className="btn btn-primary" type="submit">Search care <Arrow size={18} /></button>
        {search.treatment && <input type="hidden" name="treatment" value={search.treatment} />}
        {search.compare.length > 0 && <input type="hidden" name="compare" value={search.compare.join(",")} />}
      </form>
      {search.treatment && <p className="explore-active-treatment">Browsing {TREATMENTS.find((item) => item.id === search.treatment)?.name || "this treatment"} <Link href={href({ treatment: null, page: null })}>Clear treatment ×</Link></p>}
      {PUBLIC_OFFERS.length > 0 && <details className="explore-travel-fields"><summary><Plane size={16} /> Add your travel preferences <span>Optional</span></summary><div>
        <label>Flying from<input form="care-search" name="from" placeholder="Airport code, e.g. JFK" maxLength={3} defaultValue={typeof values.from === "string" ? values.from : ""} /></label>
        <label>Outbound<input form="care-search" type="date" name="out" defaultValue={typeof values.out === "string" ? values.out : ""} /></label>
        <label>Return<input form="care-search" type="date" name="back" defaultValue={typeof values.back === "string" ? values.back : ""} /></label>
        <label>Travellers<select form="care-search" name="travellers" defaultValue={typeof values.travellers === "string" ? values.travellers : "1"}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? "traveller" : "travellers"}</option>)}</select></label>
      </div></details>}
    </section>
    <div className="explore-context home-shell"><span><Check size={15} /> No account needed to browse</span><span><Check size={15} /> Verified clinics only</span><span><Check size={15} /> You choose every next step</span></div>
    {topics.length > 0 && <section className="home-shell" aria-labelledby="cancer-topics-title"><div className="explore-section-heading"><div><p className="h-kicker">Explore the questions</p><h2 id="cancer-topics-title">Cancer care topics</h2></div></div><div className="directory-grid">{topics.map((topic) => <Link key={topic.id} className="directory-item directory-treatment" href={`/treatments/${topic.slug}`}><div><h3>{topic.name}</h3><p>{topic.summary}</p></div><Arrow size={16} /></Link>)}</div><p className="explore-small">Care pathways depend on the diagnosis and individual circumstances. <a href="https://www.cancer.gov/about-cancer/treatment/types" target="_blank" rel="noopener noreferrer">Learn about treatment types from the National Cancer Institute.</a></p></section>}
    <section className={`explore-market home-shell${PUBLIC_OFFERS.length === 0 ? " explore-market-no-listings" : ""}`} aria-label="Care search results">
      {PUBLIC_OFFERS.length > 0 && <FilterPanel activeCount={[search.specialty, search.language, search.accessible, search.min !== null, search.max !== null].filter(Boolean).length}><div className="explore-filters"><div className="explore-filter-heading"><h2>Filter your options</h2>{filtered && <Link href={`/explore${travel ? `?${travel}` : ""}`}>Reset</Link>}</div>
        <label>Specialty<select form="care-search" name="specialty" defaultValue={search.specialty}><option value="">All specialties</option>{SPECIALTIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <fieldset><legend>Care estimate in USD</legend><div className="explore-price-fields"><label><span>Minimum</span><input form="care-search" type="number" name="min" min="0" placeholder="Any" defaultValue={search.min ?? ""} /></label><label><span>Maximum</span><input form="care-search" type="number" name="max" min="0" placeholder="Any" defaultValue={search.max ?? ""} /></label></div><p>Care only. Flights, stays and other costs are separate. Unknown prices do not match a budget filter.</p></fieldset>
        <label>Consultation language<select form="care-search" name="language" defaultValue={search.language}><option value="">Any language</option>{[...new Set(PUBLIC_OFFERS.flatMap((item) => item.languages))].sort().map((language) => <option key={language}>{language}</option>)}</select></label>
        <label className="explore-check"><input form="care-search" name="accessible" type="checkbox" value="1" defaultChecked={search.accessible} /><span>Step-free access indicated<small>Confirm your specific needs directly.</small></span></label>
        <button form="care-search" type="submit" className="btn btn-secondary">Apply filters</button>
        <div className="explore-filter-note"><GlobeIcon size={24} /><h3>A world to explore.</h3><p>All countries are searchable. Verified cancer clinics are not listed yet; a country page does not imply care is available there.</p><Link href="/destinations">Browse all destinations <Arrow size={14} /></Link></div>
      </div></FilterPanel>}
      <div className="explore-results"><div className="explore-results-heading"><div><p className="h-kicker">Verified care listings</p><h2>{result.total} {result.total === 1 ? "cancer clinic" : "cancer clinics"}</h2></div>{PUBLIC_OFFERS.length > 0 && <form action="/explore"><HiddenValues values={values} except={["sort", "page"]} /><label>Sort by<select name="sort" defaultValue={search.sort}><option value="listed">Browse order</option><option value="price">Care estimate: low to high</option><option value="destination">Destination: A–Z</option></select></label><button type="submit" className="explore-sort-go">Apply</button></form>}</div>
        {invalidBudget && <p className="explore-budget-error" role="alert">Your minimum care budget is higher than your maximum. Update the budget fields, then apply your filters.</p>}
        {result.total === 0 && <div className="explore-empty"><GlobeIcon size={45} /><h3>No listings yet.</h3><p>{search.country ? `There are no verified cancer clinic listings in ${COUNTRIES.find((item) => item.code === search.country)?.name || "this destination"}.` : "Clinic names, prices, credentials and appointment dates will appear only after verification."} Explore cancer care topics or start a guided sample journey.</p><Link href="/treatments" className="btn btn-primary">Explore cancer care <Arrow size={17} /></Link><Link href="/destinations" className="home-text-link">Change destination</Link><Link href="/start" className="home-text-link">Start a guided journey</Link></div>}
        <div className="explore-result-list">{result.offers.map((offer) => {
          const treatment = TREATMENTS.find((item) => item.id === offer.treatmentId)!;
          const country = COUNTRIES.find((item) => item.code === offer.countryCode)!;
          const compared = search.compare.includes(offer.id);
          const next = compared ? search.compare.filter((id) => id !== offer.id) : [...search.compare, offer.id];
          const detail = `/explore/offers/${offer.id}${travel ? `?${travel}` : ""}`;
          return <article className="explore-offer" key={offer.id}><Link href={detail} className="explore-offer-art" aria-label={`View ${treatment.name} in ${offer.city}`}><DestinationArt offer={offer} /></Link><div className="explore-offer-main"><div className="explore-offer-eyebrow"><span>{country.name} · {offer.city}</span><span className="explore-sample-tag">Verified listing</span></div><h3><Link href={detail}>{treatment.name}</Link></h3><p className="explore-provider">{offer.providerName}</p><div className="explore-offer-facts"><span>{offer.languages.join(" · ")}</span><span>{offer.accessibility === true ? "Step-free access indicated" : offer.accessibility === false ? "Step-free access not indicated" : "Accessibility to confirm"}</span></div><p className="explore-inclusion"><Check size={14} /> {offer.inclusions.slice(0, 2).join(" · ")}</p><div className="explore-offer-bottom"><span>Care estimate · no flights or stay</span>{search.compare.length >= 3 && !compared ? <span className="explore-compare-limit">Compare limit reached</span> : <Link href={href({ compare: next.join(",") || null }, "#care-results")} className="explore-compare-toggle" aria-label={`${compared ? "Remove" : "Add"} ${treatment.name} in ${offer.city} ${compared ? "from" : "to"} comparison`}>{compared ? "✓ Comparing" : "+ Compare"}</Link>}</div></div><div className="explore-offer-price"><small>{offer.priceUsd === null ? "Care estimate" : "Provider care estimate"}</small><strong>{usd(offer.priceUsd)}</strong><p>{offer.priceUsd === null ? "Cost not supplied" : "Per patient · USD"}</p><Link href={detail} className="btn btn-primary">View option <Arrow size={16} /></Link><span>Plan flights & stay next</span></div></article>;
        })}</div>
        {result.pages > 1 && <nav className="explore-pagination" aria-label="Results pages">{result.page > 1 ? <Link href={href({ page: String(result.page - 1) })}>← Previous</Link> : <span /> }<span>Page {result.page} of {result.pages}</span>{result.page < result.pages ? <Link href={href({ page: String(result.page + 1) })}>Next →</Link> : <span />}</nav>}
        {result.total > 0 && <div className="explore-disclaimer">{search.sort === "price" ? "Sorted by the displayed care estimate." : search.sort === "destination" ? "Sorted alphabetically by destination." : "Shown in catalogue order."} Order never represents a claim of medical quality. Treatment suitability, appointment dates and travel timing require clinical confirmation.</div>}
      </div>
    </section>
    {selected.length > 0 && <section className="explore-comparison home-shell" id="care-results" aria-labelledby="comparison-title"><div className="explore-section-heading"><div><p className="h-kicker">Side by side</p><h2 id="comparison-title">Compare your shortlist</h2></div><Link href={href({ compare: null })}>Clear comparison</Link></div><p>Choose up to three care options. Compare inclusions and practical details; suitability needs a clinician’s review.</p><div className="explore-compare-grid">{selected.map((offer) => <article key={offer.id}><span className="explore-sample-tag">Verified listing</span><h3>{TREATMENTS.find((item) => item.id === offer.treatmentId)?.name}</h3><p>{offer.city}, {COUNTRIES.find((item) => item.code === offer.countryCode)?.name}</p><strong>{usd(offer.priceUsd)}</strong><dl><dt>Care includes</dt><dd>{offer.inclusions.join(" · ")}</dd><dt>Language</dt><dd>{offer.languages.join(" · ")}</dd><dt>Accessibility</dt><dd>{offer.accessibility === true ? "Step-free indicated; confirm" : "To confirm"}</dd><dt>Transfer estimate</dt><dd>{usd(offer.transferUsd)}</dd><dt>Not included</dt><dd>{offer.exclusions.join(" · ")}</dd></dl><Link className="btn btn-secondary" href={`/explore/offers/${offer.id}${travel ? `?${travel}` : ""}`}>View details <Arrow size={14} /></Link></article>)}</div></section>}
    <section className="explore-bottom-cta home-shell"><div><p className="h-kicker">A little guidance, when you need it</p><h2>Prefer to start with your story?</h2><p>Your care journey is still here, with guidance shaped around your situation.</p></div><Link href="/start" className="btn btn-secondary">Start my journey <Arrow size={18} /></Link></section>
  </main><SiteFooter /></div>;
}
