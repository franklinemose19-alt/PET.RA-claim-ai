// src/pages/Landing.jsx
//
// PET.RA Claims AI — Public Landing Page

import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="bg-[#14171C] text-[#E5E7EB] font-sans antialiased">
      <Nav />
      <Hero />
      <InsurerPitch />
      <CustomerExplainer />
      <HowItWorks />
      <Features />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <p className="font-mono text-xs tracking-[0.2em] uppercase text-[#E8A33D] mb-3">
      {children}
    </p>
  );
}

function Container({ children, className = '' }) {
  return <div className={`max-w-6xl mx-auto px-6 ${className}`}>{children}</div>;
}

function Nav() {
  return (
    <header className="border-b border-white/5 sticky top-0 z-50 backdrop-blur-md bg-[#14171C]/80">
      <Container className="flex items-center justify-between h-16">
        <span className="font-mono text-sm tracking-wide text-white">
          PET<span className="text-[#E8A33D]">.</span>RA
          <span className="text-[#8B93A1] ml-2 text-xs">CLAIMS AI</span>
        </span>
        <nav className="hidden md:flex items-center gap-8 text-sm text-[#8B93A1]">
          <a href="#insurers" className="hover:text-white transition">For Insurers</a>
          <a href="#customers" className="hover:text-white transition">For Policyholders</a>
          <a href="#how-it-works" className="hover:text-white transition">How it works</a>
        </nav>
        <Link
          to="/login"
          className="font-mono text-xs px-4 py-2 rounded border border-white/15 text-white hover:border-[#E8A33D] hover:text-[#E8A33D] transition"
        >
          Log in
        </Link>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <Container className="py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <Eyebrow>AI-Powered Claims Infrastructure</Eyebrow>
          <h1 className="font-sans text-4xl md:text-5xl font-semibold leading-tight text-white">
            Evidence, the moment it happens.
          </h1>
          <p className="mt-6 text-[#8B93A1] text-lg leading-relaxed max-w-md">
            PET.RA connects insurers and their policyholders through one
            infrastructure layer, AI-guided evidence capture for customers,
            a verified review dashboard for insurers, nothing in between.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="px-5 py-3 rounded-lg bg-[#E8A33D] text-[#14171C] font-medium text-sm hover:bg-amber-400 transition"
            >
              Connect your company
            </Link>
            
              href="#customers"
              className="px-5 py-3 rounded-lg border border-white/15 text-white text-sm hover:border-white/30 transition"
            >
              I am a policyholder
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-xl border border-white/10 bg-[#1A1E25] overflow-hidden shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 font-mono text-xs text-[#8B93A1]">
              <span>CLAIM #PR-88291-K</span>
              <span className="text-[#E8A33D]">UNDER REVIEW</span>
            </div>
            <div className="aspect-[4/3] bg-gradient-to-br from-[#23282F] to-[#181B20] relative flex items-center justify-center">
              <div className="absolute inset-4 border border-dashed border-white/10 rounded"></div>
              <svg width="120" height="90" viewBox="0 0 120 90" fill="none" className="opacity-30">
                <rect x="10" y="30" width="100" height="40" rx="6" stroke="#8B93A1" strokeWidth="2" />
                <circle cx="35" cy="70" r="8" stroke="#8B93A1" strokeWidth="2" />
                <circle cx="85" cy="70" r="8" stroke="#8B93A1" strokeWidth="2" />
              </svg>
              <span className="absolute bottom-3 right-3 font-mono text-xs text-white/40">
                IMG_03 FRONT 14:22:09
              </span>
            </div>
            <div className="px-4 py-3 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#8B93A1]">Risk score</span>
                <span className="text-[#E8A33D]">62 / 100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B93A1]">Damage severity</span>
                <span className="text-white">Moderate</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B93A1]">Evidence</span>
                <span className="text-white">5 of 5 angles</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function InsurerPitch() {
  return (
    <section id="insurers" className="border-b border-white/5">
      <Container className="py-20 grid md:grid-cols-2 gap-12">
        <div>
          <Eyebrow>For Insurance Companies</Eyebrow>
          <h2 className="font-sans text-3xl font-semibold text-white leading-tight">
            Your policyholders, already filing claims correctly.
          </h2>
          <p className="mt-4 text-[#8B93A1] leading-relaxed">
            Connect your company to PET.RA once. From then on, every
            policyholder you refer captures evidence the way your adjusters
            actually need it, before it ever reaches your dashboard.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <PitchCard
            title="Verified onboarding"
            body="Register your company, get verified by PET.RA, and your claims dashboard goes live."
          />
          <PitchCard
            title="Refer your policyholders"
            body="Customers connect their policy number once. Every claim they file routes straight to you."
          />
          <PitchCard
            title="AI pre-analysis"
            body="Risk score, damage severity, and fraud signals arrive with every claim, before your adjuster opens it."
          />
          <PitchCard
            title="You decide, always"
            body="PET.RA never approves or rejects a claim. Every decision stays with your team."
          />
        </div>
      </Container>
    </section>
  );
}

function PitchCard({ title, body }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1A1E25] p-5">
      <h3 className="text-white font-medium text-sm mb-2">{title}</h3>
      <p className="text-[#8B93A1] text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function CustomerExplainer() {
  return (
    <section id="customers" className="border-b border-white/5 bg-[#171A20]">
      <Container className="py-20 grid md:grid-cols-2 gap-12">
        <div className="order-2 md:order-1 grid sm:grid-cols-2 gap-4">
          <PitchCard
            title="Connect your policy"
            body="Search your insurer, enter your policy number, done. They are already on PET.RA, your insurer set this up."
          />
          <PitchCard
            title="Guided capture"
            body="When something happens, PET.RA walks you through exactly which photos to take. No guesswork."
          />
          <PitchCard
            title="One tap to submit"
            body="Your evidence, location, and timestamp go straight to your insurer's dashboard. No forms to fill out twice."
          />
          <PitchCard
            title="Track it yourself"
            body="See your claim's status and your insurer's notes, the moment they update it."
          />
        </div>
        <div className="order-1 md:order-2">
          <Eyebrow>For Policyholders</Eyebrow>
          <h2 className="font-sans text-3xl font-semibold text-white leading-tight">
            Filing a claim should not feel like a second incident.
          </h2>
          <p className="mt-4 text-[#8B93A1] leading-relaxed">
            If your insurer uses PET.RA, you already have access. Connect
            your policy once, every claim after that takes minutes, not
            phone calls.
          </p>
        </div>
      </Container>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Capture', body: 'AI-guided photo capture at the scene, front, sides, damage close-up, GPS and timestamp attached automatically.' },
    { n: '02', title: 'Submit', body: "One tap routes the claim to your insurer's dashboard instantly, with all evidence attached." },
    { n: '03', title: 'Analyze', body: 'AI reviews evidence quality, completeness, and consistency, surfacing a risk score for the adjuster.' },
    { n: '04', title: 'Decide', body: 'A human adjuster reviews everything and makes the call. PET.RA never decides for them.' },
  ];

  return (
    <section id="how-it-works" className="border-b border-white/5">
      <Container className="py-20">
        <Eyebrow>The Sequence</Eyebrow>
        <h2 className="font-sans text-3xl font-semibold text-white mb-12">How a claim actually moves.</h2>
        <div className="grid md:grid-cols-4 gap-px bg-white/5 rounded-xl overflow-hidden">
          {steps.map((s) => (
            <div key={s.n} className="bg-[#14171C] p-6">
              <span className="font-mono text-[#E8A33D] text-sm">{s.n}</span>
              <h3 className="text-white font-medium mt-3 mb-2">{s.title}</h3>
              <p className="text-[#8B93A1] text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Features() {
  const features = [
    { title: 'Company data isolation', body: "Every insurer sees only their own policyholders' claims. Enforced at the database level, not just the UI." },
    { title: 'Real-time delivery', body: 'New claims and status changes appear instantly, no refreshing, no polling your inbox.' },
    { title: 'Audit-ready evidence', body: 'Every photo, GPS point, and timestamp is stored exactly as captured, with secure signed access.' },
    { title: 'Built for both sides', body: 'One ecosystem, two purpose-built dashboards, nothing borrowed from a generic CRM template.' },
  ];

  return (
    <section className="border-b border-white/5 bg-[#171A20]">
      <Container className="py-20">
        <Eyebrow>Infrastructure, Not Guesswork</Eyebrow>
        <h2 className="font-sans text-3xl font-semibold text-white mb-12 max-w-lg">
          The parts you do not see, working the way they should.
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title}>
              <h3 className="text-white font-medium text-sm mb-2">{f.title}</h3>
              <p className="text-[#8B93A1] text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="border-b border-white/5">
      <Container className="py-20">
        <Eyebrow>What Early Partners Say</Eyebrow>
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <TestimonialCard
            quote="Placeholder, swap in a real insurer quote once you have one. Keep it specific, a number, a before and after, not generic praise."
            name="Name, Title"
            org="Company"
          />
          <TestimonialCard
            quote="Placeholder, a policyholder quote about how fast and easy filing was works well here once you have real users."
            name="Name"
            org="Policyholder"
          />
        </div>
      </Container>
    </section>
  );
}

function TestimonialCard({ quote, name, org }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1A1E25] p-6">
      <p className="text-[#C7CCD4] text-sm leading-relaxed italic">{quote}</p>
      <div className="mt-4 font-mono text-xs text-[#8B93A1]">
        {name} - {org}
      </div>
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="border-b border-white/5">
      <Container className="py-24 text-center">
        <h2 className="font-sans text-3xl md:text-4xl font-semibold text-white max-w-xl mx-auto">
          Get your company verified, then send your first policyholder a link.
        </h2>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/login"
            className="px-6 py-3 rounded-lg bg-[#E8A33D] text-[#14171C] font-medium text-sm hover:bg-amber-400 transition"
          >
            Connect your company
          </Link>
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <Container className="py-10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="font-mono text-xs text-[#8B93A1]">
          PET.RA - Proof, Evidence, Trust, Risk, Analysis
        </span>
        <span className="font-mono text-xs text-[#8B93A1]">
          AI-Powered Claims Infrastructure
        </span>
      </Container>
    </footer>
  );
}
