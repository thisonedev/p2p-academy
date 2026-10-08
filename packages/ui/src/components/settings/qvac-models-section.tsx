'use client';

import type { AcademyModelCatalogueEntry } from '@academy/validation';
import { Loader2, Square } from 'lucide-react';
import { formatBytes } from '../../lib/format-bytes.js';
import { DownloadMeter, ModelListRow, RemoveAllButton, chapterLabel, joinChapters } from './settings-models.js';
import type { SettingsModels } from './use-settings-models.js';

/** The Models tab's lesson models, grouped by the chapter that needs them. */
export function QvacModelsSection({ m }: { m: SettingsModels }) {
  const {
    fullCatalogue,
    selectedChapter,
    setSelectedChapter,
    downloadingScope,
    downloadingName,
    downloadQueue,
    modelProgress,
    device,
    remove,
    onRemoveOne,
    onRemoveAll,
    downloadModels,
    stopDownloads,
    requestRemove,
    cancelRemove,
    modelIdByName,
    modelCompleteByName,
  } = m;
  if (fullCatalogue === null) return <p className="text-sm text-canvas-muted-foreground">Loading…</p>;

  // Chapter -> its catalogue entries, each paired with the lessons in that
  // chapter that need it (a model can need multiple lessons in one chapter).
  const chapterGroups = new Map<string, { entry: AcademyModelCatalogueEntry; lessons: string[] }[]>();
  for (const entry of fullCatalogue ?? []) {
    if (entry.isCompanionSet) continue;
    // Once an AI bot model is downloaded, its file already satisfies every
    // chapter listing it: showing (and letting someone delete) a duplicate
    // row there would just be a second, confusing path to the same file.
    if (entry.aiBot && modelCompleteByName.get(entry.name) === true) continue;
    for (const ref of entry.usedIn ?? []) {
      if (!ref?.chapter) continue;
      const bucket = chapterGroups.get(ref.chapter) ?? [];
      bucket.push({ entry, lessons: Array.isArray(ref.lessons) ? ref.lessons : [] });
      chapterGroups.set(ref.chapter, bucket);
    }
  }
  const chapterSlugs = [...chapterGroups.keys()].sort((a, b) => chapterLabel(a).localeCompare(chapterLabel(b)));
  const notInstalledBytes = (entries: { entry: AcademyModelCatalogueEntry }[]) =>
    entries
      .filter(({ entry }) => modelCompleteByName.get(entry.name) !== true)
      .reduce((sum, { entry }) => sum + (entry.sizeBytes || 0), 0);
  const missingNames = (entries: { entry: AcademyModelCatalogueEntry }[]) =>
    entries.filter(({ entry }) => modelCompleteByName.get(entry.name) !== true).map(({ entry }) => entry.name);
  // Deduped by name: a model shared across chapters must download once, not
  // once per chapter it appears in. Companion set hashes resolve in
  // models.download() to the owning SDK constant.
  const courseMissingNames = [
    ...new Set(
      (fullCatalogue ?? [])
        .filter(
          (e) =>
            !e.isCompanionSet &&
            (e.usedIn ?? []).length > 0 &&
            modelCompleteByName.get(e.name) !== true,
        )
        .map((e) => e.name),
    ),
  ];

  return (
    <section className="rounded-lg border border-canvas-border bg-canvas p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-canvas-foreground">QVAC Models</h2>
        <div className="flex items-center gap-2">
          <RemoveAllButton
            state={remove}
            onRequestRemove={() => requestRemove('all')}
            onConfirmRemove={onRemoveAll}
            onCancel={cancelRemove}
          />
          {downloadingScope ? (
            <button
              type="button"
              onClick={() => void stopDownloads()}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300/40 bg-red-300/10 px-3 py-1.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-300/20"
            >
              <Square className="size-3 fill-current" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              disabled={courseMissingNames.length === 0}
              onClick={() => void downloadModels('course', courseMissingNames)}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {courseMissingNames.length === 0 ? 'Ready' : 'Download all'}
            </button>
          )}
        </div>
      </div>

      {downloadingName && downloadQueue ? (
        <div className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate font-mono text-xs text-canvas-foreground">{downloadingName}</p>
            <p className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-canvas-muted-foreground">
              {downloadQueue.done + (downloadQueue.done < downloadQueue.total ? 1 : 0)} of {downloadQueue.total}
            </p>
          </div>
          <DownloadMeter progress={modelProgress[downloadingName]} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {chapterSlugs.map((chapter) => {
          const entries = chapterGroups.get(chapter) ?? [];
          const installedCount = entries.filter(({ entry }) => modelCompleteByName.get(entry.name) === true).length;
          const ready = installedCount === entries.length;
          const bytes = entries.reduce((sum, { entry }) => sum + entry.sizeBytes, 0);
          const tight = device != null && notInstalledBytes(entries) > device.storageFreeBytes;
          const expanded = selectedChapter === chapter;
          const chapterHasCurrent = downloadingName != null && entries.some(({ entry }) => entry.name === downloadingName);
          const busy = downloadingScope === chapter || chapterHasCurrent;
          return (
            <div
              key={chapter}
              className={`rounded-xl border overflow-hidden ${expanded ? 'border-emerald-500' : 'border-canvas-border'} bg-canvas-muted`}
            >
              <div className="flex items-center gap-3 p-3.5">
                <button
                  type="button"
                  onClick={() => setSelectedChapter(expanded ? null : chapter)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <svg
                    className={`size-3.5 shrink-0 text-canvas-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[15px] font-bold text-canvas-foreground">
                      <span className="truncate">{chapterLabel(chapter)}</span>
                      {tight ? <span className="size-1.5 shrink-0 rounded-full bg-amber-400" title="Tight on disk" /> : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-canvas-muted-foreground">
                      {chapterHasCurrent && downloadingName
                        ? `Downloading ${downloadingName}`
                        : ready
                          ? 'Ready'
                          : `${installedCount} / ${entries.length} models`}{' '}
                      · {formatBytes(bytes)}
                    </p>
                  </div>
                </button>
                {ready ? (
                  <span className="flex size-[30px] shrink-0 items-center justify-center text-emerald-400" title="Ready">
                    <svg className="size-[17px]" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8 12l3 3 5-6" />
                    </svg>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={downloadingScope !== null}
                    onClick={() => void downloadModels(chapter, missingNames(entries))}
                    title="Download models"
                    aria-label="Download models"
                    className="flex size-[30px] shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <svg className="size-[15px]" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v13m0 0l-4.5-4.5M12 16l4.5-4.5" />
                        <path d="M5 20h14" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              {expanded ? (
                <div className="border-t border-canvas-border px-4 pb-2 pt-1">
                  {entries.map(({ entry, lessons }) => (
                    <ModelListRow
                      key={entry.name}
                      entry={entry}
                      usedLabel={joinChapters(lessons)}
                      state={remove}
                      modelIdByName={modelIdByName}
                      modelCompleteByName={modelCompleteByName}
                      downloading={downloadingName === entry.name}
                      progress={modelProgress[entry.name]}
                      downloadDisabled={downloadingScope !== null}
                      onDownload={() => void downloadModels(entry.name, [entry.name])}
                      onRequestRemove={requestRemove}
                      onConfirmRemove={onRemoveOne}
                      onCancel={cancelRemove}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
