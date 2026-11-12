import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CARD, PAGE_BG, SCROLLBAR } from "@/app/components/ui";
import teamPhoto from "./image0.jpg";
import shopPhoto from "./image1.jpg";

export const metadata: Metadata = {
  title: "Documentation — Vulcan",
  description:
    "FTC team 21180, Error 418, and why they built Vulcan for the shop.",
};

const LABEL = "font-mono text-zinc-500 uppercase tracking-widest";
const HEADING_GRADIENT = "text-zinc-100";

const NAV_LINK =
  "inline-flex min-h-11 shrink-0 items-center hover:text-zinc-100 transition-colors";

const METHODOLOGY = [
  {
    label: "Parts",
    title: "Parts & inventory",
    body: "Error 418 looks up a part by name or SKU and marks it in stock, set aside, used, or removed. The shelf and the list stay the same.",
  },
  {
    label: "Tasks",
    title: "Kanban task board",
    body: "Work sits on one board. A task can be assigned, split into smaller pieces, and tied to the part it needs.",
  },
  {
    label: "Notebook",
    title: "Engineering documentation",
    body: "Daily logs and photos stay with the date. The timeline runs down the season, and a day can be compiled into the notebook.",
  },
];

export default function DocumentationPage() {
  return (
    <div className={`relative min-h-screen ${PAGE_BG} font-sans overflow-hidden`}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f2e_1px,transparent_1px),linear-gradient(to_bottom,#1f1f2e_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 pointer-events-none" />

      <nav className="relative z-10 flex items-center justify-between gap-4 px-4 py-4 md:px-8 md:py-6 border-b border-white/10 backdrop-blur-xl bg-zinc-900/40">
        <Link href="/" className="flex items-center space-x-3">
          <img
            src="/Vulcan_Transparent.png"
            alt="Vulcan logo"
            className="h-9 w-9 shrink-0 object-contain"
          />
          <span className="text-lg font-semibold tracking-tight uppercase text-zinc-100">
            Vulcan
          </span>
        </Link>
        <div
          className={`flex min-w-0 items-center gap-4 md:gap-6 text-sm text-zinc-400 overflow-x-auto ${SCROLLBAR}`}
        >
          <Link href="/" className={NAV_LINK}>
            Home
          </Link>
          <Link
            href="/documentation"
            aria-current="page"
            className="inline-flex min-h-11 shrink-0 items-center text-zinc-100"
          >
            Documentation
          </Link>
          <a
            href="https://github.com/Aniko805/Vulcan-Organization-Tool"
            target="_blank"
            rel="noopener noreferrer"
            className={NAV_LINK}
          >
            Repository
          </a>
          <span className="h-4 w-px shrink-0 bg-white/10" />
          <div className="flex shrink-0 items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono">Open Source</span>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-24 md:px-6">
        <header className="relative flex flex-col items-center text-center pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="relative inline-flex items-center space-x-2 bg-zinc-900/40 backdrop-blur-xl border border-white/10 px-3 py-1 rounded-full text-xs text-zinc-400 mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className={LABEL}>Documentation</span>
          </div>

          <h1
            className={`relative text-4xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl mb-6 ${HEADING_GRADIENT}`}
          >
            Documentation &amp; Our Story
          </h1>

          <p className="relative text-zinc-400 text-base md:text-xl max-w-2xl tracking-tight font-light">
            Vulcan is the shop tool built by FTC team 21180, Error 418.
          </p>
        </header>

        <div className="space-y-6 md:space-y-8">
          <section id="team" className={`${CARD} p-6 md:p-10`}>
            <p className={`text-[10px] mb-2 ${LABEL}`}>01 / Team</p>
            <h2
              className={`text-2xl md:text-3xl font-bold tracking-tight mb-6 ${HEADING_GRADIENT}`}
            >
              The Team &amp; Our Story
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 items-center">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10">
                <Image
                  src={teamPhoto}
                  alt="FTC team 21180, Error 418, at the Jet Propulsion Laboratory"
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 28rem, 100vw"
                  priority
                />
              </div>
              <div className="space-y-4 text-sm md:text-base leading-relaxed text-zinc-400">
                <p>
                  We are FTC team 21180, Error 418. The students and coaches in this
                  photo are the team, visiting NASA's Jet Propulsion Laboratory.
                </p>
                <p>
                  We design and build a robot together each season. We made Vulcan 
                  to help us manage our parts, tasks, and documentation.
                </p>
              </div>
            </div>
          </section>

          <section id="inspiration" className={`${CARD} p-6 md:p-10`}>
            <p className={`text-[10px] mb-2 ${LABEL}`}>02 / Inspiration</p>
            <h2
              className={`text-2xl md:text-3xl font-bold tracking-tight mb-6 ${HEADING_GRADIENT}`}
            >
              Inspiration for Vulcan
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 items-center">
              <div className="space-y-4 text-sm md:text-base leading-relaxed text-zinc-400 md:order-1 order-2">
                <p>
                  We faced much trouble managing our inventory, keeping track of deadlines, and organizing our tasks.
                  We needed a better way to manage these at once, while also having a place to document our engineering process.
                </p>
                <p>
                  So, we made Vulcan, free for any FTC team to use, and open source.
                </p>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 md:order-2 order-1">
                <Image
                  src={shopPhoto}
                  alt="A member of Error 418 organizing FTC parts beside a laptop running Vulcan"
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 28rem, 100vw"
                />
              </div>
            </div>
          </section>

          <section id="methodology" className={`${CARD} p-6 md:p-10`}>
            <p className={`text-[10px] mb-2 ${LABEL}`}>03 / Methodology</p>
            <h2
              className={`text-2xl md:text-3xl font-bold tracking-tight mb-2 ${HEADING_GRADIENT}`}
            >
              Our Methodology &amp; Engineering Process
            </h2>
            <p className="mb-8 max-w-2xl text-sm md:text-base leading-relaxed text-zinc-400">
              We plan the robot in the same place it builds it.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {METHODOLOGY.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 hover:bg-zinc-800/50 hover:border-white/20 transition-all duration-300 ease-out"
                >
                  <p className={`text-[10px] mb-1 ${LABEL}`}>{item.label}</p>
                  <h3 className="text-sm font-semibold text-zinc-100 tracking-tight mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
