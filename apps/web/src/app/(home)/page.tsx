'use client';

import { COURSES, type Course, CURRICULUM } from '@academy/courses';
import type { AcademyAPI } from '@academy/validation';
import {
  ArrowRight,
  BookOpen,
  Bot,
  CircleCheck,
  Code2,
  Combine,
  Dices,
  Eraser,
  FileOutput,
  FileQuestion,
  Filter,
  FolderOpen,
  GitBranch,
  Image as ImageIcon,
  Languages,
  Lock,
  type LucideIcon,
  MessageCircle,
  Mic,
  Music,
  Repeat,
  RotateCcw,
  ScanText,
  Scissors,
  Search,
  Sparkles,
  Square,
  Video,
  Volume2,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { CopyButton } from '../../../../../packages/ui/src/components/install-command';
import { YouTubeEmbed } from '../../../../../packages/ui/src/components/youtube-embed';

declare global {
  interface Window {
    academy?: AcademyAPI;
  }
}

const INSTALL_TABS = [
  { label: 'macOS / Linux', command: 'curl -fsSL https://tetheracademy.cc/install.sh | sh' },
  { label: 'Windows', command: 'irm https://tetheracademy.cc/install.ps1 | iex' },
];
const THISONEDEV_URL = 'https://github.com/thisonedev';

interface FeatureItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: BookOpen,
    title: 'Learn by doing',
    body: 'Every lesson = a short explanation, a small coding task, and instant feedback. No passive reading.',
  },
  {
    icon: Code2,
    title: 'Real SDK examples',
    body: "We wrap the SDK's own examples. Never fork them. One source of truth, kept in sync automatically",
  },
  {
    icon: Sparkles,
    title: 'AI-native by design',
    body: 'Every lesson doubles as high-quality training data. Agents can fetch the full curriculum via llms.txt.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 sm:px-8 sm:py-16">
      <div className="space-y-14 sm:space-y-20">
        <HeroWithInstall />
        <StatsStrip />
        <TerminalDemo />
        <CoursesSection />
        <LocalDiagram />
        <PlaygroundTeaser />
        <FeatureCards />
        <ExploreCta />
        <Copyright />
      </div>
    </main>
  );
}

/** Install lives inside the same left column as the headline, not as a
 *  separate row below the grid, so the video's height relates to the whole
 *  left block (headline + lede + install) rather than just the headline. */
function HeroWithInstall() {
  return (
    <div className="grid min-h-[calc(100vh-200px)] items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <Hero />
      <HeroVideo />
    </div>
  );
}

function Hero() {
  return (
    <div className="flex flex-col justify-center space-y-6 sm:space-y-8">
      <p className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-canvas-border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-emerald-400">
        <span aria-hidden>✦</span>
        The first P2P code academy
      </p>
      <h1 className="max-w-4xl text-[clamp(32px,4.6vw,52px)] font-bold leading-[1.1] tracking-tight">
        Learn to build on Tether&apos;s <span className="whitespace-nowrap">open source</span> stack
      </h1>
      <p className="max-w-2xl font-mono text-[15.5px] leading-[1.7] text-canvas-muted-foreground">
        Fully local and private interactive code school for the Tether ecosystem. Short lessons,
        industry standard editor, models and code that run on your machine.
      </p>
      <InstallRow />
    </div>
  );
}

const DEMO_VIDEO_ID = 'MlQBdaKAlLk';

/** The grid uses align-items:center, so this box keeps its own aspect ratio
 *  rather than stretching to match the text column's height. */
function HeroVideo() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[10px] border border-canvas-border bg-canvas-raised">
      <div className="flex items-center justify-between border-b border-canvas-border px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-canvas-border" />
          <span className="size-2.5 rounded-full bg-canvas-border" />
          <span className="size-2.5 rounded-full bg-canvas-border" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-canvas-muted-foreground">
          demo
        </span>
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
      </div>
      <YouTubeEmbed
        videoId={DEMO_VIDEO_ID}
        title="Tether Academy demo"
        className="aspect-[4/3] w-full"
      />
    </div>
  );
}

/** The real desktop-app startup log, verbatim, no invented flourishes.
 *  Two layers: an outer canvas-muted bezel around an inner canvas-raised
 *  window, so it reads as "a screen" instead of just "a card." */
function TerminalDemo() {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-canvas-border bg-canvas-muted p-3.5">
      <div className="overflow-hidden rounded-[10px] border border-canvas-border bg-canvas-raised">
        <div className="flex items-center justify-between border-b border-canvas-border px-4 py-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-canvas-border" />
            <span className="size-2.5 rounded-full bg-canvas-border" />
            <span className="size-2.5 rounded-full bg-canvas-border" />
          </span>
          <span className="size-2 rounded-full bg-red-400" aria-hidden />
        </div>
        <div className="min-h-[340px] p-6 font-mono text-sm leading-[1.9] sm:p-8">
          <p>
            <span className="text-emerald-400">&gt;</span> tether-academy start
          </p>
          <p>&nbsp;</p>
          <p className="font-semibold text-emerald-400">⬡ Starting Tether Academy...</p>
          <p>&nbsp;</p>
          <p className="text-canvas-muted-foreground">[tether-academy-desktop] serving</p>
          <p className="text-canvas-muted-foreground">
            [pear-end worker] [peer] ready, identity pubkey 955008b390e17723...
          </p>
          <p aria-hidden>
            <span className="inline-block h-3.5 w-1.5 animate-pulse bg-emerald-400 align-middle" />
          </p>
        </div>
      </div>
    </div>
  );
}

/** Tabs sit flush against the code box below (shared border, no gap,
 *  matching radius), unlike the shared InstallCommandTabs component's
 *  separate segmented-control style. Real clipboard copy via CopyButton. */
function InstallDemo({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  return (
    <div className={className}>
      <div className="flex gap-0.5">
        {INSTALL_TABS.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-t-[10px] border border-b-0 px-3.5 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors ${
              i === active
                ? 'border-canvas-border bg-canvas-muted text-emerald-400'
                : 'border-transparent text-canvas-dimmer hover:text-canvas-muted-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-b-[10px] rounded-tr-[10px] border border-canvas-border bg-canvas-muted px-4 py-3 font-mono text-[12.5px] text-canvas-muted-foreground">
        <code className="min-w-0 flex-1 truncate">{INSTALL_TABS[active].command}</code>
        <CopyButton command={INSTALL_TABS[active].command} />
      </div>
    </div>
  );
}

function InstallRow() {
  return (
    <section id="install" className="max-w-lg space-y-3 scroll-mt-24">
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
        Install via Terminal
      </p>
      <InstallDemo />
    </section>
  );
}

/** Lesson/chapter counts come from courseCounts('qvac') so this never drifts
 *  from the real curriculum as it grows. */
function StatsStrip() {
  const { chapters, lessons } = courseCounts('qvac');
  const stats = [
    { label: 'Lessons', value: String(lessons), sub: `Across ${chapters} chapters` },
    { label: 'On-device', value: '100%', sub: 'Nothing runs in the cloud' },
    { label: 'Cost / token', value: '$0', sub: 'No charge per token' },
    { label: 'API keys', value: '0', sub: 'Nothing to sign up for' },
  ];
  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen border-y border-canvas-border">
      <div className="mx-auto grid max-w-[1100px] grid-cols-2 divide-x divide-y divide-canvas-border sm:grid-cols-4 sm:divide-y-0">
        {stats.map((stat) => (
          <div key={stat.label} className="px-5 py-6 sm:px-8">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-canvas-foreground">
              {stat.value}
            </p>
            <p className="mt-1 font-mono text-xs text-canvas-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionDivider() {
  return (
    <div aria-hidden className="flex items-center gap-3">
      <span className="h-0.5 w-10 rounded-full bg-emerald-500" />
      <span className="h-px flex-1 bg-canvas-border" />
    </div>
  );
}

function FeatureCards() {
  return (
    <section className="grid grid-cols-1 divide-y divide-canvas-border md:grid-cols-3 md:divide-x md:divide-y-0">
      {FEATURES.map((feature) => (
        <FeatureCard key={feature.title} {...feature} />
      ))}
    </section>
  );
}

function FeatureCard({ icon: Icon, title, body }: FeatureItem) {
  return (
    <div className="flex h-full flex-col bg-canvas-muted p-6 sm:p-7">
      <p className="flex items-center gap-2 font-mono text-xs tracking-widest text-emerald-400">
        <Icon className="size-3.5" strokeWidth={2.5} aria-hidden />
      </p>
      <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-canvas-foreground sm:text-xl">
        {title}
      </h3>
      <p className="mt-2.5 font-mono text-sm leading-relaxed text-canvas-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function DiagramBox({ label, sub, accent }: { label: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`flex-1 rounded-xl border px-4 py-3 text-center font-mono text-xs uppercase tracking-widest ${
        accent
          ? 'border-emerald-500/50 text-canvas-foreground'
          : 'border-canvas-border text-canvas-muted-foreground'
      }`}
    >
      {label}
      {sub ? (
        <div
          className={`mt-1 text-[10px] normal-case tracking-normal ${
            accent ? 'text-emerald-400' : 'text-canvas-muted-foreground'
          }`}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function DiagramConnector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <span className="h-3 w-px bg-canvas-border" aria-hidden />
      <span className="text-red-400" aria-hidden>
        ✕
      </span>
      <span className="font-mono text-[10px] text-canvas-muted-foreground">{label}</span>
      <span className="h-3 w-px bg-canvas-border" aria-hidden />
    </div>
  );
}

function LocalDiagram() {
  return (
    <section className="space-y-14 sm:space-y-20">
      <div className="space-y-6">
        <div className="space-y-3 text-center">
          <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight text-canvas-foreground">
            Explore new way of learning
          </h2>
          <p className="mx-auto max-w-2xl font-mono text-[14px] leading-[1.5] text-canvas-muted-foreground">
            The Academy is built on a local-first, peer-to-peer architecture. This allows a series
            of features that are impossible in a traditional online coding academies, including
            local execution, device pairing, private identity management, etc.
          </p>
        </div>
        <div className="mx-auto max-w-xl space-y-1">
          <DiagramBox label="Cloud" />
          <DiagramConnector label="never contacted" />
          <div className="relative rounded-2xl border border-dashed border-canvas-border px-4 pb-5 pt-6">
            <span className="absolute -top-2.5 left-4 bg-canvas px-2 font-mono text-[10px] uppercase tracking-widest text-canvas-muted-foreground">
              Your machine
            </span>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <DiagramBox label="Your code" sub="index.ts" />
              <ArrowRight
                className="mx-auto size-4 shrink-0 text-canvas-muted-foreground sm:mx-0"
                aria-hidden
              />
              <DiagramBox label="QVAC" sub="runs the model" accent />
              <ArrowRight
                className="mx-auto size-4 shrink-0 text-canvas-muted-foreground sm:mx-0"
                aria-hidden
              />
              <DiagramBox label="Result" sub="back in your editor" />
            </div>
          </div>
          <DiagramConnector label="blocked unless paired" />
          <DiagramBox label="Other devices" />
        </div>
        <p className="mx-auto max-w-lg text-center font-mono text-xs leading-relaxed text-canvas-muted-foreground">
          Both code and models stay on your machine. The only exception is pairing another device
          over a direct, peer-to-peer connection.
        </p>
      </div>

      <div className="grid grid-cols-1 divide-y divide-canvas-border md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="bg-canvas-muted p-6 sm:p-7">
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-canvas-foreground sm:text-xl">
            Local execution
          </h3>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2 font-mono text-sm text-canvas-muted-foreground">
              <span className="mt-0.5 text-emerald-400">✓</span>
              Lessons execute in a kernel sandbox, so code can&apos;t reach the rest of your system.
            </li>
            <li className="flex items-start gap-2 font-mono text-sm text-canvas-muted-foreground">
              <span className="mt-0.5 text-emerald-400">✓</span>
              Models run on your CPU or GPU. No API keys and no rate limiting.
            </li>
            <li className="flex items-start gap-2 font-mono text-sm text-canvas-muted-foreground">
              <span className="mt-0.5 text-emerald-400">✓</span>
              Works on macOS, Windows, and Linux.
            </li>
          </ul>
        </div>
        <div className="bg-canvas-muted p-6 sm:p-7">
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-canvas-foreground sm:text-xl">
            Familiar coding experience
          </h3>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2 font-mono text-sm text-canvas-muted-foreground">
              <span className="mt-0.5 text-emerald-400">✓</span>
              Monaco is bundled with the desktop app. No CDN.
            </li>
            <li className="flex items-start gap-2 font-mono text-sm text-canvas-muted-foreground">
              <span className="mt-0.5 text-emerald-400">✓</span>
              TypeScript, IntelliSense, and inline error messages work out of the box.
            </li>
            <li className="flex items-start gap-2 font-mono text-sm text-canvas-muted-foreground">
              <span className="mt-0.5 text-emerald-400">✓</span>
              Loads from the same local bundle as the lesson runtime. No remote scripts.
            </li>
          </ul>
        </div>
        <div className="bg-canvas-muted p-6 sm:p-7">
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-canvas-foreground sm:text-xl">
            Device pairing
          </h3>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2 font-mono text-sm text-canvas-muted-foreground">
              <span className="mt-0.5 text-emerald-400">✓</span>
              Connects to other devices over a public DHT by their keypair.
            </li>
            <li className="flex items-start gap-2 font-mono text-sm text-canvas-muted-foreground">
              <span className="mt-0.5 text-emerald-400">✓</span>
              Every connection is end-to-end encrypted.
            </li>
            <li className="flex items-start gap-2 font-mono text-sm text-canvas-muted-foreground">
              <span className="mt-0.5 text-emerald-400">✓</span>
              Rate-limited to one in-flight run per peer.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Same category → color classes as CATEGORY_CLASSES in
 *  playground-node-defs.ts, so every swatch below matches the real app. */
const CATEGORY_STYLE: Record<string, string> = {
  interface: 'text-violet-300 bg-violet-300/15 border-violet-300/40',
  media: 'text-indigo-300 bg-indigo-300/15 border-indigo-300/40',
  voice: 'text-blue-300 bg-blue-300/15 border-blue-300/40',
  text: 'text-emerald-300 bg-emerald-300/15 border-emerald-300/40',
  logic: 'text-amber-300 bg-amber-300/15 border-amber-300/40',
  data: 'text-orange-300 bg-orange-300/15 border-orange-300/40',
  trigger: 'text-red-300 bg-red-300/15 border-red-300/40',
};

const PALETTE: { label: string; category: keyof typeof CATEGORY_STYLE; icons: LucideIcon[] }[] = [
  { label: 'Interface', category: 'interface', icons: [CircleCheck] },
  { label: 'Media', category: 'media', icons: [ImageIcon, Video, Music, ScanText] },
  { label: 'Voice', category: 'voice', icons: [Volume2, Mic, MessageCircle] },
  { label: 'Text', category: 'text', icons: [Bot, Languages, FileQuestion, Search] },
  { label: 'Logic', category: 'logic', icons: [Filter, GitBranch, Repeat, Dices] },
  { label: 'Files & data', category: 'data', icons: [FolderOpen, Combine, Scissors, FileOutput] },
  { label: 'Trigger', category: 'trigger', icons: [Zap] },
];

function FlowConnector() {
  return (
    <div className="flex flex-col items-center gap-1 py-1" aria-hidden>
      <span className="h-4 w-px bg-canvas-border" />
      <span className="flex size-4 items-center justify-center rounded-full border border-canvas-border text-[10px] text-canvas-muted-foreground">
        +
      </span>
      <span className="h-4 w-px bg-canvas-border" />
    </div>
  );
}

function LogLine({ done, children }: { done?: boolean; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-mono text-xs text-canvas-muted-foreground">
      <span
        className={`size-1.5 shrink-0 rounded-full ${done ? 'bg-emerald-400' : 'bg-canvas-border'}`}
        aria-hidden
      />
      {children}
    </p>
  );
}

/** A working recreation of the real playground UI (toolbar, category
 *  palette, a connected node chain, and a live run log) — not just a
 *  themed icon row standing in for it. */
function PlaygroundTeaser() {
  return (
    <section className="space-y-6">
      <SectionDivider />
      <div className="space-y-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
          the playground
        </p>
        <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight text-canvas-foreground">
          Build an AI workflow without writing code
        </h2>
        <p className="max-w-2xl font-mono text-[14px] leading-[1.5] text-canvas-muted-foreground">
          Drag blocks onto a canvas, connect them, and run them on your own machine. No coding
          experience required.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-canvas-border px-4 py-3">
          <span className="font-mono text-sm font-bold text-canvas-foreground">
            Receipt / Invoice Scanner
          </span>
          <span className="rounded-md border border-canvas-border px-2.5 py-1 font-mono text-xs text-canvas-muted-foreground">
            File ▾
          </span>
          <div className="flex items-center gap-3 text-canvas-muted-foreground">
            <Square className="size-3.5 fill-current text-red-400" aria-hidden />
            <RotateCcw className="size-3.5" aria-hidden />
            <Eraser className="size-3.5" aria-hidden />
            <Sparkles className="size-3.5" aria-hidden />
          </div>
        </div>

        <div className="grid sm:grid-cols-[170px_1fr]">
          <div className="space-y-4 border-b border-canvas-border p-4 sm:border-b-0 sm:border-r">
            {PALETTE.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-canvas-muted-foreground">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.icons.map((Icon, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
                      key={i}
                      className={`flex size-7 items-center justify-center border ${group.category === 'trigger' ? 'rounded-full' : 'rounded-md'} ${CATEGORY_STYLE[group.category]}`}
                    >
                      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div
              className="flex flex-col items-center gap-1 bg-canvas bg-[radial-gradient(var(--color-canvas-border)_1px,transparent_1px)] bg-[length:18px_18px] px-6 py-8"
              style={{ backgroundPosition: '10px 10px' }}
            >
              <span className="rounded-full border border-red-300/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-red-300">
                Trigger
              </span>
              <span className="flex size-11 items-center justify-center rounded-full border border-red-300/40 bg-canvas-muted text-red-300">
                <Zap className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <FlowConnector />
              <span className="flex w-full max-w-xs items-center gap-2 rounded-xl border border-canvas-border bg-canvas-muted px-4 py-3 font-mono text-xs text-canvas-foreground">
                <span
                  className={`flex size-6 items-center justify-center rounded-md ${CATEGORY_STYLE.media}`}
                >
                  <ScanText className="size-3.5" strokeWidth={2} aria-hidden />
                </span>
                Read text from image
              </span>
              <FlowConnector />
              <span className="flex w-full max-w-xs items-center gap-2 rounded-xl border border-canvas-border bg-canvas-muted px-4 py-3 font-mono text-xs text-canvas-foreground">
                <span
                  className={`flex size-6 items-center justify-center rounded-md ${CATEGORY_STYLE.text}`}
                >
                  <Bot className="size-3.5" strokeWidth={2} aria-hidden />
                </span>
                Ask an AI agent
              </span>
            </div>

            <div className="space-y-2 border-t border-canvas-border p-6">
              <LogLine done>Loaded the text-reading model</LogLine>
              <LogLine done>Read text from the image</LogLine>
              <LogLine>Asking the AI to structure it…</LogLine>
              <p className="border-t border-dashed border-canvas-border pt-3 font-mono text-xs text-emerald-400">
                → Structured receipt data, ready to export as JSON or a spreadsheet.
              </p>
              <div className="flex justify-end">
                <span className="rounded-md border border-canvas-border px-2.5 py-1 font-mono text-[10px] text-canvas-muted-foreground">
                  QWEN3 4B ▾
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto max-w-lg text-center font-mono text-xs leading-relaxed text-canvas-muted-foreground">
        Read a file, ask an AI, generate music, scan a receipt: connect ready-made blocks by
        dragging instead of typing. It runs on your machine the moment you press play.
      </p>
    </section>
  );
}

function ExploreCta() {
  return (
    <div className="rounded-2xl border border-canvas-border bg-canvas-muted p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-6 items-center md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Try it
          </p>
          <h3 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-canvas-foreground">
            Ready to build on the P2P stack?
          </h3>
          <p className="mt-2 font-mono text-sm leading-relaxed text-canvas-muted-foreground sm:text-base max-w-xl">
            One install command. Runs offline. No accounts, no cloud.
          </p>
        </div>
        <div className="min-w-0 w-full md:w-[400px]">
          <InstallDemo />
        </div>
      </div>
    </div>
  );
}

/** True once the desktop bridge (window.academy) is confirmed present. Starts
 *  false so SSR HTML matches the first client render, then flips after mount. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(typeof window !== 'undefined' && !!window.academy);
  }, []);
  return isDesktop;
}

/** Per-course accent palette, used until real logos exist. Mirrors
 *  apps/web/src/app/courses/page.tsx so the two listings stay visually in sync.
 *  Same construction as the playground's own node-category colors
 *  (CATEGORY_CLASSES): a flat color at 15% for the fill and 40% for the border. */
function glyphPalette(slug: string): { bg: string; fg: string; border: string } {
  switch (slug) {
    case 'qvac':
      return {
        bg: 'color-mix(in oklab, var(--color-emerald-400) 10%, var(--color-canvas))',
        fg: 'var(--color-emerald-400)',
        border: 'color-mix(in oklab, var(--color-emerald-400) 30%, transparent)',
      };
    case 'wdk':
      return {
        bg: 'color-mix(in oklab, #818cf8 10%, var(--color-canvas))',
        fg: '#818cf8',
        border: 'color-mix(in oklab, #818cf8 30%, transparent)',
      };
    case 'pears':
      return {
        bg: 'color-mix(in oklab, #fca5a5 10%, var(--color-canvas))',
        fg: '#fca5a5',
        border: 'color-mix(in oklab, #fca5a5 30%, transparent)',
      };
    default:
      return {
        bg: 'var(--color-canvas)',
        fg: 'var(--color-canvas-foreground)',
        border: 'var(--color-canvas-border)',
      };
  }
}

function CourseGlyph({ slug }: { slug: string }) {
  const { bg, fg, border } = glyphPalette(slug);
  return (
    <span
      className="flex size-12 items-center justify-center rounded-lg border text-sm font-bold sm:size-14 sm:text-base"
      style={{ background: bg, color: fg, borderColor: border }}
      aria-hidden
    >
      {slug.slice(0, 3).toUpperCase()}
    </span>
  );
}

/** Counts chapters + lessons for a course. Only QVAC ships chapters today. */
function courseCounts(slug: string): { chapters: number; lessons: number } {
  if (slug !== 'qvac') return { chapters: 0, lessons: 0 };
  return {
    chapters: CURRICULUM.length,
    lessons: CURRICULUM.reduce((sum, c) => sum + c.lessons.length, 0),
  };
}

function CoursesSection() {
  const isDesktop = useIsDesktop();
  return (
    <section className="space-y-10">
      <SectionDivider />
      <div className="space-y-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Courses
        </p>
        <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight text-canvas-foreground">
          Pick a track
        </h2>
        <p className="max-w-2xl font-mono text-[14px] leading-[1.5] text-canvas-muted-foreground">
          Pick an open-source stack to learn. Each course is a series of short lessons with code to
          read and run.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {COURSES.map((course) => (
          <CourseCard key={course.slug} course={course} isDesktop={isDesktop} />
        ))}
      </div>
      {isDesktop ? null : (
        <p className="font-mono text-sm text-canvas-muted-foreground">
          Courses run in the desktop app.{' '}
          <a href="#install" className="font-semibold text-emerald-400 hover:underline">
            Install it above
          </a>{' '}
          to start learning.
        </p>
      )}
    </section>
  );
}

function CourseCard({ course, isDesktop }: { course: Course; isDesktop: boolean }) {
  const counts = courseCounts(course.slug);
  // Web visitors never get a clickable course, live or not: the app is where
  // lessons actually run, so every card here should push toward installing it.
  const locked = !isDesktop && !course.planned;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <CourseGlyph slug={course.slug} />
        {course.planned ? (
          <span className="inline-flex items-center rounded-full border border-canvas-border bg-canvas px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-canvas-muted-foreground">
            Coming soon
          </span>
        ) : locked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-canvas px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-canvas-muted-foreground">
            <Lock className="size-3" strokeWidth={2.5} />
            Desktop only
          </span>
        ) : (
          <ArrowRight className="size-4 shrink-0 text-canvas-muted-foreground transition-colors group-hover:text-emerald-400" />
        )}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-canvas-foreground sm:text-xl">
        {course.name}
      </h3>
      <p className="mt-1 font-mono text-sm leading-relaxed text-canvas-muted-foreground sm:text-base">
        {course.description}
      </p>
      {counts.chapters > 0 ? (
        <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-canvas-muted-foreground">
          <span className="font-mono">
            {counts.chapters} {counts.chapters === 1 ? 'chapter' : 'chapters'}
          </span>
          <span aria-hidden className="text-canvas-border">
            ·
          </span>
          <span className="font-mono">
            {counts.lessons} {counts.lessons === 1 ? 'lesson' : 'lessons'}
          </span>
        </div>
      ) : null}
    </>
  );

  if (course.planned) {
    return (
      <div
        aria-disabled
        className="flex h-full flex-col rounded-2xl border border-dashed border-canvas-border bg-canvas-muted p-4 opacity-70 sm:p-5"
      >
        {body}
      </div>
    );
  }

  if (locked) {
    return (
      <div
        title="Install the desktop app to start this course"
        className="flex h-full flex-col rounded-2xl border border-canvas-border bg-canvas-muted p-4 opacity-80 sm:p-5"
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={course.href}
      className="group flex h-full flex-col rounded-2xl border border-canvas-border bg-canvas-muted p-4 transition-colors hover:border-emerald-500/60 sm:p-5"
    >
      {body}
    </Link>
  );
}

function Copyright() {
  return (
    <footer className="flex flex-col items-center gap-2 pt-2 text-center font-mono text-xs text-canvas-muted-foreground sm:flex-row sm:justify-between sm:text-left">
      <p>
        © 2026{' '}
        <a
          href={THISONEDEV_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono transition-colors hover:text-emerald-400"
        >
          thisonedev
        </a>
      </p>
    </footer>
  );
}
