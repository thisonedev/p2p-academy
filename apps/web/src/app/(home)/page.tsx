'use client';

import { COURSES, type Course, CURRICULUM } from '@academy/courses';
import type { AcademyAPI } from '@academy/validation';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  Code2,
  Eraser,
  FileOutput,
  Filter,
  FolderOpen,
  GitBranch,
  GraduationCap,
  Image as ImageIcon,
  Languages,
  Layers,
  Lock,
  type LucideIcon,
  Mic,
  RotateCcw,
  ScanText,
  Search,
  Sparkles,
  Square,
  Video,
  Volume2,
  Workflow,
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
  { label: 'macOS / Linux', command: 'curl -fsSL https://p2pacademy.cc/install.sh | sh' },
  { label: 'Windows', command: 'irm https://p2pacademy.cc/install.ps1 | iex' },
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
        <PillarsOverview />
        <CoursesSection />
        <PlaygroundTeaser />
        <DesignTeaser />
        <LocalDiagram />
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
    <div className="flex min-w-0 flex-col justify-center space-y-6 sm:space-y-8">
      <p className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-canvas-border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-emerald-400">
        <span aria-hidden>✦</span>
        The first P2P code academy
      </p>
      <h1 className="max-w-4xl text-[clamp(32px,4.6vw,52px)] font-bold leading-[1.1] tracking-tight">
        Learn to build on Tether&apos;s <span className="whitespace-nowrap">open source</span> stack
      </h1>
      <p className="max-w-2xl font-mono text-[15.5px] leading-[1.7] text-canvas-muted-foreground">
        Fully local and private interactive coding school for the Tether ecosystem. Short lessons,
        industry standard editor, models and code that run on your machine.
      </p>
      <div className="flex flex-wrap gap-2">
        {PILLARS.map(({ id, icon: Icon, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex items-center gap-2 rounded-full border border-canvas-border bg-canvas-muted py-1.5 pl-1.5 pr-3 text-sm font-semibold text-canvas-foreground transition-colors hover:border-emerald-500/60"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
              <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
            </span>
            {label}
          </a>
        ))}
      </div>
      <InstallRow />
    </div>
  );
}

const DEMO_VIDEO_ID = 'D6FSQOY6YjQ';

/** The grid uses align-items:center, so this box keeps its own aspect ratio
 *  rather than stretching to match the text column's height. */
function HeroVideo() {
  return (
    <div className="min-w-0 overflow-hidden rounded-[10px] border border-canvas-border bg-canvas-raised shadow-2xl">
      <YouTubeEmbed
        videoId={DEMO_VIDEO_ID}
        poster="/hero-lesson.webp"
        title="P2P Academy demo"
        className="aspect-[3/2] w-full"
      />
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

interface Pillar {
  id: 'learn' | 'play' | 'design';
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  facts: string[];
  href: string;
}

const PILLARS: Pillar[] = [
  {
    id: 'learn',
    icon: GraduationCap,
    label: 'Learn',
    title: 'Code school',
    body: 'Short lessons with an industry-standard editor and code that runs on your machine.',
    facts: [`${courseCounts('qvac').lessons} lessons`, 'QVAC', 'TypeScript'],
    href: '/courses',
  },
  {
    id: 'play',
    icon: Workflow,
    label: 'Play',
    title: 'AI playground',
    body: 'Drag blocks onto a canvas, connect them, and run locally. No coding experience required.',
    facts: ['No code', 'Local models', 'Workflows'],
    href: '/playground',
  },
  {
    id: 'design',
    icon: Layers,
    label: 'Design',
    title: 'Design studio',
    body: 'Social posts and threads from templates, in your own style. Export to PNG, JPG, PDF or SVG.',
    facts: ['50+ templates', 'UI kits', 'Threads'],
    href: '/design',
  },
];

function PillarGlyph({ icon: Icon, small }: { icon: LucideIcon; small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center border border-emerald-400/30 text-emerald-400 ${small ? 'size-8 rounded-lg' : 'size-10 rounded-[10px]'}`}
      style={{
        background: 'color-mix(in oklab, var(--color-emerald-400) 10%, var(--color-canvas))',
      }}
      aria-hidden
    >
      <Icon className={small ? 'size-4' : 'size-[18px]'} />
    </span>
  );
}

function FactBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-canvas-border bg-canvas px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-canvas-muted-foreground">
      {children}
    </span>
  );
}

const PREVIEW_LESSONS = [
  { title: 'Load a model', done: true },
  { title: 'Stream completions', done: true },
  { title: 'Transcribe audio', current: true },
  { title: 'Translate text' },
];

function LearnPreview() {
  return (
    <div className="flex h-full flex-col gap-1.5 p-3.5">
      {PREVIEW_LESSONS.map((l, i) => (
        <div
          key={l.title}
          className={`flex items-center gap-2 rounded-lg border bg-canvas-muted px-2.5 py-1.5 font-mono text-[11px] ${l.current ? 'border-emerald-500/50 text-canvas-foreground' : l.done ? 'border-canvas-border text-canvas-foreground' : 'border-canvas-border text-canvas-muted-foreground'}`}
        >
          <span
            className={`flex size-[18px] items-center justify-center rounded-full border-[1.5px] text-[9px] ${l.done ? 'border-emerald-400 text-emerald-400' : 'border-canvas-border'}`}
          >
            {l.done ? <Check className="size-2.5" strokeWidth={3} /> : i + 1}
          </span>
          {l.title}
          <span className="ml-auto text-[9px] tracking-widest">{l.done ? 'DONE' : 'OPEN'}</span>
        </div>
      ))}
    </div>
  );
}

function PreviewNode({
  color,
  label,
  className,
}: {
  color: string;
  label: string;
  className: string;
}) {
  return (
    <span
      className={`absolute flex items-center gap-1.5 rounded-md border border-[#3a3a3a] bg-[#1b1f27] px-2 py-1.5 font-mono text-[10px] text-canvas-foreground ${className}`}
    >
      <span className="size-2 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

function PlayPreview() {
  return (
    <div className="relative h-full bg-[#121212] bg-[radial-gradient(#262a2f_1px,transparent_1px)] bg-[length:12px_12px]">
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <title>Connected blocks</title>
        <path
          d="M74 44.5 C96 44.5 96 84.5 118 84.5"
          stroke="#6ea8fe"
          strokeWidth="1.6"
          fill="none"
        />
        <path
          d="M168 84.5 C195 84.5 195 130.5 222 130.5"
          stroke="#5eead4"
          strokeWidth="1.6"
          fill="none"
        />
      </svg>
      <PreviewNode color="#818cf8" label="Image" className="left-3 top-[30px]" />
      <PreviewNode color="#34d399" label="OCR" className="left-[118px] top-[70px]" />
      <PreviewNode color="#fb923c" label="XLS" className="left-[222px] top-[116px]" />
    </div>
  );
}

// Posts in the studio's Default kit: the app's canvas colors with the playground's blue.
const KIT_BLUE = '#6ea8fe';
const POST =
  'relative flex flex-col justify-between overflow-hidden rounded-md border border-white/5 bg-[radial-gradient(110%_120%_at_100%_0%,#1a2638,#12151a_65%)] p-2 text-canvas-foreground';

function PostTag({ children }: { children: ReactNode }) {
  return (
    <span className="self-start rounded-full bg-[#6ea8fe] px-1.5 py-px font-mono text-[6.5px] font-bold uppercase tracking-widest text-[#0b1a30]">
      {children}
    </span>
  );
}

function Bars({ heights }: { heights: number[] }) {
  return (
    <div className="flex h-[44%] items-end gap-[3px]">
      {heights.map((h, i) => (
        <i
          // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ height: `${h}%`, background: i === heights.length - 1 ? KIT_BLUE : '#242b33' }}
        />
      ))}
    </div>
  );
}

function Phone({ className = '' }: { className?: string }) {
  return (
    <span
      className={`absolute flex aspect-[9/18] flex-col gap-[3px] rounded-lg border-2 border-[#3a434e] bg-[#0d1014] p-1 ${className}`}
    >
      <i className="block h-3.5 rounded-sm" style={{ background: KIT_BLUE }} />
      <i className="block h-[5px] rounded-sm bg-[#242b33]" />
      <i className="block h-[5px] w-3/5 rounded-sm bg-[#242b33]" />
    </span>
  );
}

function Avatar({ className = '' }: { className?: string }) {
  return (
    <span
      className={`aspect-square shrink-0 rounded-full border-2 ${className}`}
      style={{
        borderColor: KIT_BLUE,
        background:
          'radial-gradient(circle at 50% 38%, #eef1f0 0 22%, transparent 23%), radial-gradient(ellipse at 50% 100%, #eef1f0 0 42%, transparent 43%), #242b33',
      }}
    />
  );
}

function CodeSnippet({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[5px] border border-[#242b33] bg-[#0d1014] px-1.5 py-1 font-mono text-[6.5px] leading-[1.55] text-canvas-muted-foreground">
      {children}
    </div>
  );
}

function DesignPreview() {
  return (
    <div className="grid h-full grid-cols-2 gap-2 p-3">
      <div className={POST}>
        <PostTag>Growth</PostTag>
        <Bars heights={[30, 45, 60, 100]} />
      </div>
      <div className={POST}>
        <CodeSnippet>
          <span style={{ color: KIT_BLUE }}>await</span>{' '}
          <span className="text-canvas-foreground">loadModel</span>({'{'} modelSrc {'}'})
        </CodeSnippet>
        <span className="text-[9px] font-extrabold leading-tight">New SDK release</span>
      </div>
      <div className={POST}>
        <span className="max-w-[52%] text-[10px] font-extrabold leading-tight">
          Now on <span style={{ color: KIT_BLUE }}>mobile</span>
        </span>
        <Phone className="right-[10%] top-[14%] w-[34%]" />
      </div>
      <div className={`${POST} !flex-row items-center gap-2`}>
        <Avatar className="w-[26%]" />
        <div>
          <PostTag>Live AMA</PostTag>
          <p className="mt-1 text-[9px] font-extrabold leading-tight">Ask the team anything</p>
        </div>
      </div>
    </div>
  );
}

const PILLAR_PREVIEW: Record<Pillar['id'], () => ReactNode> = {
  learn: LearnPreview,
  play: PlayPreview,
  design: DesignPreview,
};

function PillarsOverview() {
  return (
    <section className="space-y-9">
      <div className="space-y-3 text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
          All-in-one app
        </p>
        <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight text-canvas-foreground">
          Embrace the power of the P2P stack
        </h2>
        <p className="mx-auto max-w-2xl font-mono text-[14px] leading-[1.5] text-canvas-muted-foreground">
          Understand how it works, put it to work, share it with others.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PILLARS.map(({ id, icon, label, title, body, facts }) => {
          const Preview = PILLAR_PREVIEW[id];
          return (
            <div
              key={id}
              className="flex flex-col rounded-2xl border border-canvas-border bg-canvas-muted p-2.5"
            >
              <div className="h-[170px] overflow-hidden rounded-[10px] border border-canvas-border bg-canvas">
                <Preview />
              </div>
              <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-4">
                <div className="flex items-center gap-2.5">
                  <PillarGlyph icon={icon} />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-400">
                    {label}
                  </span>
                </div>
                <h3 className="mt-3.5 text-xl font-semibold tracking-tight text-canvas-foreground">
                  {title}
                </h3>
                <p className="mt-2 font-mono text-[13.5px] leading-relaxed text-canvas-muted-foreground">
                  {body}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {facts.map((f) => (
                    <FactBadge key={f}>{f}</FactBadge>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The divider, icon label, heading and subline that open the Learn, Play and Design sections. */
function SectionHead({
  id,
  title,
  sub,
  cta,
}: {
  id: Pillar['id'];
  title: string;
  sub: string;
  cta: string;
}) {
  const pillar = PILLARS.find((p) => p.id === id) as Pillar;
  return (
    <>
      <SectionDivider />
      <div className="flex flex-wrap items-end gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2.5">
            <PillarGlyph icon={pillar.icon} small />
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
              {pillar.label}
            </p>
          </div>
          <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight text-canvas-foreground">
            {title}
          </h2>
          <p className="max-w-2xl font-mono text-[14px] leading-[1.5] text-canvas-muted-foreground">
            {sub}
          </p>
        </div>
        <Link
          href={pillar.href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-muted px-4 py-2 text-sm font-semibold text-canvas-foreground transition-colors hover:border-emerald-500/60"
        >
          {cta}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

const STUDIO_KITS = [
  { name: 'Default', color: '#6ea8fe' },
  { name: 'Glass', color: '#7db8ff' },
  { name: 'Tether', color: '#009393' },
  { name: 'QVAC', color: '#16e3c1' },
];

const DESIGN_FACTS = [
  '50+ templates across the most used and requested post types, tailored for Web3 and AI industries.',
  'Generous database of built-in UI kits, and the constructor to create your own.',
  'Single posts or multi-page threads, sized for X, Instagram, LinkedIn and stories.',
];

function StudioChip({ on, children }: { on?: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-md border px-1.5 py-1 font-mono text-[10px] ${on ? 'border-emerald-500/50 text-emerald-400' : 'border-canvas-border text-canvas-muted-foreground'}`}
    >
      {children}
    </span>
  );
}

/** A still of the studio: templates, the open post, and its UI kit, size and export. */
function DesignTeaser() {
  const tile = `${POST} aspect-[16/10] !p-1.5 text-[8px] font-extrabold`;
  return (
    <section id="design" className="scroll-mt-24 space-y-6">
      <SectionHead
        id="design"
        title="Post about it"
        cta="Open studio"
        sub="Pick a template, switch it to your style, and export. Announcements, partnerships, threads, etc."
      />
      <div className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted">
        <div className="grid min-h-[360px] md:grid-cols-[56px_190px_1fr_200px]">
          <div className="hidden flex-col items-center gap-3 border-r border-canvas-border bg-canvas-raised py-3 md:flex">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-400 text-sm font-bold text-emerald-950">
              +
            </span>
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className="size-[18px] rounded border-[1.5px] border-canvas-dimmer" />
            ))}
          </div>
          <div className="hidden content-start gap-2 border-r border-canvas-border p-3 md:grid md:grid-cols-2">
            <div className={tile}>
              <Bars heights={[35, 55, 100]} />
              Growth
            </div>
            <div className={`${tile} outline outline-2 outline-offset-1 outline-emerald-400`}>
              <span className="text-xs" style={{ color: KIT_BLUE }}>
                $1.2B
              </span>
              Milestone
            </div>
            <div className={tile}>
              <CodeSnippet>
                <span style={{ color: KIT_BLUE }}>await</span> run()
              </CodeSnippet>
              SDK release
            </div>
            <div className={tile}>
              Mobile
              <Phone className="right-[12%] top-[12%] w-[26%] !rounded-[5px] !border-[1.5px]" />
            </div>
            <div className={`${tile} !flex-row items-center gap-1.5`}>
              <Avatar className="w-[30%] !border-[1.5px]" />
              AMA
            </div>
            <div className={tile} style={{ background: KIT_BLUE, color: '#0b1a30' }}>
              Thread
              <span className="text-[7px] font-semibold">1 / 5</span>
            </div>
          </div>
          <div className="grid place-items-center bg-[#0f1216] p-5">
            <div className={`${POST} aspect-video w-full max-w-[380px] !p-5`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-bold">
                  <span className="size-3.5 rounded-full" style={{ background: KIT_BLUE }} />
                  Your Brand
                </span>
                <PostTag>Milestone</PostTag>
              </div>
              <div>
                <p
                  className="text-[54px] font-extrabold leading-none tracking-tight"
                  style={{ color: KIT_BLUE }}
                >
                  $1.2B
                </p>
                <p className="mt-1 text-[15px] font-bold">total value settled on Your Brand</p>
              </div>
            </div>
          </div>
          <div className="hidden border-l border-canvas-border p-3.5 font-mono text-[11px] text-canvas-foreground md:block">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-canvas-muted-foreground">
              UI kit
            </p>
            {STUDIO_KITS.map((k, i) => (
              <div
                key={k.name}
                className={`mb-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${i === 0 ? 'border-emerald-500/50 bg-emerald-400/10' : 'border-canvas-border'}`}
              >
                <span className="size-2.5 rounded-full" style={{ background: k.color }} />
                {k.name}
              </div>
            ))}
            <p className="mb-2 mt-4 text-[10px] uppercase tracking-widest text-canvas-muted-foreground">
              Size
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['X', 'IG', 'LinkedIn', 'Story'].map((s, i) => (
                <StudioChip key={s} on={i === 0}>
                  {s}
                </StudioChip>
              ))}
            </div>
            <p className="mb-2 mt-4 text-[10px] uppercase tracking-widest text-canvas-muted-foreground">
              Export
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['PNG', 'JPG', 'PDF', 'SVG'].map((s) => (
                <StudioChip key={s}>{s}</StudioChip>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {DESIGN_FACTS.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 font-mono text-sm leading-relaxed text-canvas-muted-foreground"
          >
            <span className="mt-0.5 text-emerald-400">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </section>
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
      <span className="text-red-300" aria-hidden>
        ✕
      </span>
      <span className="font-mono text-[10px] text-canvas-muted-foreground">{label}</span>
      <span className="h-3 w-px bg-canvas-border" aria-hidden />
    </div>
  );
}

// One checklist, since it applies to all three tools.
const LOCAL_FACTS = [
  "Lessons execute in a kernel sandbox, so code can't reach the rest of your system.",
  'Models run on your CPU or GPU. No API keys and no rate limiting.',
  'Monaco, TypeScript and IntelliSense are bundled. No CDN.',
  'Pair other devices over an end-to-end encrypted peer-to-peer connection.',
  'Works on macOS, Windows, and Linux.',
];

function LocalDiagram() {
  return (
    <section className="space-y-6">
      <SectionDivider />
      <div className="space-y-3">
        <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight text-canvas-foreground">
          Explore new way of learning
        </h2>
        <p className="max-w-2xl font-mono text-[14px] leading-[1.5] text-canvas-muted-foreground">
          The Academy is built on a local-first, peer-to-peer architecture. This allows a series of
          features that are impossible in a traditional online coding academies, including local
          execution, device pairing, private identity management, etc.
        </p>
      </div>
      <div className="grid items-center gap-10 pt-4 md:grid-cols-2">
        <div className="space-y-1">
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
        <ul className="space-y-2.5">
          {LOCAL_FACTS.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 font-mono text-sm leading-relaxed text-canvas-muted-foreground"
            >
              <span className="mt-0.5 text-emerald-400">✓</span>
              {f}
            </li>
          ))}
        </ul>
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
  { label: 'Media', category: 'media', icons: [ImageIcon, Video, ScanText] },
  { label: 'Voice', category: 'voice', icons: [Volume2, Mic] },
  { label: 'Text', category: 'text', icons: [Bot, Languages, Search] },
  { label: 'Logic', category: 'logic', icons: [Filter, GitBranch] },
  { label: 'Files & data', category: 'data', icons: [FolderOpen, FileOutput] },
  { label: 'Trigger', category: 'trigger', icons: [Zap] },
];

// A small flow on a fixed-size stage. Wires are computed from the same numbers as the nodes,
// so they meet the node edges at any screen width.
const STAGE = { w: 620, h: 230 };
const NODE_H = 34;
const FLOW_NODES = {
  trigger: { label: '', icon: Zap, category: 'trigger', x: 8, y: 50, w: NODE_H },
  image: { label: 'Image input', icon: ImageIcon, category: 'media', x: 82, y: 50, w: 132 },
  ocr: { label: 'Read text (OCR)', icon: ScanText, category: 'media', x: 258, y: 98, w: 168 },
  summary: { label: 'Summarize', icon: Bot, category: 'text', x: 474, y: 36, w: 136 },
  xls: { label: 'Export XLS', icon: FileOutput, category: 'data', x: 474, y: 160, w: 136 },
} satisfies Record<
  string,
  { label: string; icon: LucideIcon; category: string; x: number; y: number; w: number }
>;
const FLOW_WIRES: [keyof typeof FLOW_NODES, keyof typeof FLOW_NODES, string][] = [
  ['trigger', 'image', '#9aa4af'],
  ['image', 'ocr', '#6ea8fe'],
  ['ocr', 'summary', '#5eead4'],
  ['ocr', 'xls', '#6ea8fe'],
];

function wirePath(from: keyof typeof FLOW_NODES, to: keyof typeof FLOW_NODES): string {
  const a = FLOW_NODES[from];
  const b = FLOW_NODES[to];
  const [x1, y1, x2, y2] = [a.x + a.w, a.y + NODE_H / 2, b.x, b.y + NODE_H / 2];
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

function FlowStage() {
  return (
    <div className="relative shrink-0" style={{ width: STAGE.w, height: STAGE.h }}>
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <title>Connected blocks</title>
        {FLOW_WIRES.map(([from, to, color]) => (
          <path
            key={`${from}-${to}`}
            d={wirePath(from, to)}
            stroke={color}
            strokeWidth="2"
            fill="none"
          />
        ))}
      </svg>
      {Object.values(FLOW_NODES).map(({ label, icon: Icon, category, x, y, w }) =>
        label ? (
          <span
            key={label}
            className="absolute flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas-muted px-2 font-mono text-xs text-canvas-foreground"
            style={{ left: x, top: y, width: w, height: NODE_H }}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-md border ${CATEGORY_STYLE[category]}`}
            >
              <Icon className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
            {label}
          </span>
        ) : (
          <span
            key={category}
            className={`absolute flex items-center justify-center rounded-full border ${CATEGORY_STYLE[category]}`}
            style={{ left: x, top: y, width: w, height: NODE_H }}
          >
            <Icon className="size-4" strokeWidth={2} aria-hidden />
          </span>
        ),
      )}
    </div>
  );
}

/** The real playground UI in small: toolbar, category palette and a connected flow. */
function PlaygroundTeaser() {
  return (
    <section id="play" className="scroll-mt-24 space-y-6">
      <SectionHead
        id="play"
        title="Play with it"
        cta="Open playground"
        sub="Build an AI workflow without writing code. Drag blocks onto a canvas, connect them, and run on your own machine."
      />

      <div className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-canvas-border px-4 py-3">
          <span className="font-mono text-sm font-bold text-canvas-foreground">
            Receipt / Invoice Scanner
          </span>
          <span className="rounded-md border border-canvas-border px-2.5 py-1 font-mono text-xs text-canvas-muted-foreground">
            File ▾
          </span>
          <div className="flex items-center gap-3 text-canvas-muted-foreground">
            <Square className="size-3.5 fill-current text-red-300" aria-hidden />
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

          <div
            className="flex items-center justify-center overflow-hidden bg-canvas bg-[radial-gradient(var(--color-canvas-border)_1px,transparent_1px)] bg-[length:18px_18px] px-6 py-8"
            style={{ backgroundPosition: '10px 10px' }}
          >
            <FlowStage />
          </div>
        </div>
      </div>
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
            Ready to learn, play and design?
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
    <section id="learn" className="scroll-mt-24 space-y-6">
      <SectionHead
        id="learn"
        title="Learn it"
        cta="All courses"
        sub="Pick a track. Each course is a series of short lessons with code to read and run."
      />
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
