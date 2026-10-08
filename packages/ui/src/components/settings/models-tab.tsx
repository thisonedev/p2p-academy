'use client';

import { Database } from 'lucide-react';
import { isAiBotModel } from '../lesson/ai-bot-models.js';
import { Card } from '../ui/card.js';
import { AiBotSection } from './ai-bot-section.js';
import { QvacModelsSection } from './qvac-models-section.js';
import { SelectModelButton } from './settings-models.js';
import { formatGb } from './settings-tables.js';
import type { SettingsModels } from './use-settings-models.js';

const RAG_INDEX_BACKEND_OPTIONS: { value: 'turbovec' | 'hyperdb'; label: string; description: string }[] = [
  {
    value: 'turbovec',
    label: 'TurboVec',
    description: "Stores the workspace vectors in a TurboVec index. Needs an embedding size that's a multiple of 8, up to 1024.",
  },
  {
    value: 'hyperdb',
    label: 'HyperDB',
    description: 'Stores the workspace vectors in a HyperDB index. The default; works with any embedding size.',
  },
];


/** The Settings page's Models tab. */
export function ModelsTab({ m }: { m: SettingsModels }) {
  const { remove, downloadError } = m;
  return (
    <Card as="section" muted
      role="tabpanel"
      id="settings-panel-models"
      aria-labelledby="settings-tab-models"
    >
      {remove.error ? (
        <p role="alert" className="mb-4 rounded-md border border-red-300/30 bg-red-300/10 px-3 py-2 text-xs text-red-300">
          {remove.error}
        </p>
      ) : null}
      {downloadError ? (
        <p role="alert" className="mb-4 rounded-md border border-red-300/30 bg-red-300/10 px-3 py-2 text-xs text-red-300">
          {downloadError}
        </p>
      ) : null}

      <StorageSummary m={m} />
      <AiBotSection m={m} />
      <PlaygroundSettingsSection m={m} />
      <QvacModelsSection m={m} />
    </Card>
  );
}

/** The disk as one bar: lesson models, the AI bot's model, everything else, and what is free. */
function StorageSummary({ m }: { m: SettingsModels }) {
  const { fullCatalogue, models, device } = m;
  if (fullCatalogue === null || !device) return null;

  // Device-wide total: every downloaded model, not just lesson-tracked ones.
  const downloadedBytesAll = (models ?? []).reduce((sum, m) => sum + m.sizeBytes, 0);
  // Every downloaded model from the AI bot list counts as AI bot storage, selected or not,
  // so removing one from that list is seen in its own number.
  const aiBotBytes = (models ?? [])
    .filter((m) => isAiBotModel(m.name))
    .reduce((sum, m) => sum + m.sizeBytes, 0);
  const qvacModelsBytes = downloadedBytesAll - aiBotBytes;
  // Everything on disk that isn't a tracked model: the OS, other apps, user files.
  const osBytes = device ? Math.max(0, device.storageBytes - device.storageFreeBytes - downloadedBytesAll) : 0;
  // Storage summary shows only the OS name; the full version lives on the Device tab.
  const osName = device ? device.osLabel.replace(/\s+[\d.]+$/, '') : '';

  return (
    <div className="mb-6 rounded-lg border border-canvas-border bg-canvas p-4 sm:p-5">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-canvas-muted-foreground">Storage</p>
        <p className="text-xs text-canvas-muted-foreground">
          <b className="font-bold text-canvas-foreground">{formatGb(device.storageBytes - device.storageFreeBytes)}</b> of{' '}
          {formatGb(device.storageBytes)} used
        </p>
      </div>
      <div className="flex h-8 gap-[2px] overflow-hidden rounded-md bg-canvas-border">
        <div
          className="h-full bg-emerald-600"
          title={`QVAC/Playground models — ${formatGb(qvacModelsBytes)}`}
          style={{ width: `${Math.min(100, (qvacModelsBytes / device.storageBytes) * 100)}%` }}
        />
        <div
          className="h-full bg-violet-500"
          title={`AI bot models — ${formatGb(aiBotBytes)}`}
          style={{ width: `${Math.min(100, (aiBotBytes / device.storageBytes) * 100)}%` }}
        />
        <div
          className="h-full bg-canvas-muted-foreground/40"
          title={`${osName} — ${formatGb(osBytes)}`}
          style={{ width: `${Math.min(100, (osBytes / device.storageBytes) * 100)}%` }}
        />
        <div
          className="ml-auto flex h-full min-w-fit items-center justify-center border-[1.5px] border-dashed border-canvas-foreground/35 bg-canvas-muted-foreground/10 px-2"
          title={`Free — ${formatGb(device.storageFreeBytes)}`}
          style={{ width: `${Math.min(100, (device.storageFreeBytes / device.storageBytes) * 100)}%` }}
        >
          <span className="whitespace-nowrap text-[11px] font-semibold text-canvas-foreground/80">
            {formatGb(device.storageFreeBytes)}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-canvas-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-emerald-600" />
          <b className="font-bold text-canvas-foreground">{formatGb(qvacModelsBytes)}</b> QVAC/Playground models
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-violet-500" />
          <b className="font-bold text-canvas-foreground">{formatGb(aiBotBytes)}</b> AI bot models
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-canvas-muted-foreground/40" />
          <b className="font-bold text-canvas-foreground">{formatGb(osBytes)}</b> {osName}
        </span>
      </div>
    </div>
  );
}

function PlaygroundSettingsSection({ m }: { m: SettingsModels }) {
  const { ragIndexBackend, pendingRagIndexBackend, changeRagIndexBackend } = m;
  return (
    <section className="mb-6 rounded-lg border border-canvas-border bg-canvas p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
          <Database className="size-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-canvas-foreground">Playground settings</h2>
          <p className="mt-1 text-sm text-canvas-muted-foreground">Configuration for playground nodes.</p>
        </div>
      </div>
      <div className="mt-4 rounded-md border border-canvas-border bg-canvas-muted px-3 py-2.5">
        <p className="text-sm font-medium text-canvas-foreground">RAG search index</p>
        <p className="mt-0.5 text-xs text-canvas-muted-foreground">
          The index the Search documents node writes new workspaces to. A change here applies after the app
          restarts.
        </p>
        <div className="mt-2 space-y-1.5">
          {RAG_INDEX_BACKEND_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className="flex items-center gap-3 rounded-md border border-canvas-border bg-canvas px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-canvas-foreground">{opt.label}</p>
                <p className="mt-0.5 text-xs text-canvas-muted-foreground">{opt.description}</p>
              </div>
              <SelectModelButton
                active={ragIndexBackend === opt.value}
                busy={pendingRagIndexBackend === opt.value}
                disabled={pendingRagIndexBackend !== null || ragIndexBackend === null}
                label={opt.label}
                onSelect={() => void changeRagIndexBackend(opt.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
