import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Principles from "@/components/Principles";
import WhatYouGet from "@/components/WhatYouGet";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <WhatYouGet />
        <Principles />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
