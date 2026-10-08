'use client';

import { Bot, Square } from 'lucide-react';
import { formatBytes } from '../../lib/format-bytes.js';
import { ProgressBar, percentOf } from '../ui/progress-bar.js';
import { RemoveIconButton, SelectModelButton, chapterLabel, joinChapters } from './settings-models.js';
import type { SettingsModels } from './use-settings-models.js';

/** The Models tab's AI bot block: which local model the assistant uses, and its docs switch. */
export function AiBotSection({ m }: { m: SettingsModels }) {
  const {
    chatCatalogue,
    configuredChatModel,
    configuringChatModel,
    modelProgress,
    useFullDocs,
    remove,
    configureChatModel,
    stopChatLoad,
    toggleUseFullDocs,
    onRemoveOne,
    requestRemove,
    cancelRemove,
    chatModelIdByName,
  } = m;
  return (
    <section className="mb-6 rounded-lg border border-canvas-border bg-canvas p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-canvas-foreground">AI bot models</h2>
          <p className="mt-1 text-sm text-canvas-muted-foreground">
            Choose the local model the assistant uses in every lesson chat. You only need to configure it once.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {chatCatalogue === null ? (
          <p className="text-sm text-canvas-muted-foreground">Loading chat models…</p>
        ) : chatCatalogue.length === 0 ? (
          <p className="rounded-md border border-canvas-border bg-canvas-muted p-3 text-sm text-canvas-muted-foreground">
            No chat models are available yet.
          </p>
        ) : (
          chatCatalogue.map((entry) => {
            // chatModelIdByName only holds a value once that exact chat
            // file is confirmed installed, so its presence already
            // implies completeness.
            const downloadedId = chatModelIdByName.get(entry.name);
            const active = configuredChatModel === entry.name && downloadedId != null;
            const busy = configuringChatModel === entry.name;
            const progress = modelProgress[entry.name];
            return (
              <div key={entry.name} className="rounded-md border border-canvas-border bg-canvas-muted px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-canvas-foreground">{entry.name}</p>
                    <p className="mt-0.5 text-xs text-canvas-muted-foreground">
                      {entry.description || 'Local text-generation model'}
                    </p>
                    {(entry.usedIn ?? []).length > 0 ? (
                      <p className="mt-0.5 text-[11px] text-canvas-muted-foreground">
                        Also used by: {joinChapters((entry.usedIn ?? []).map((ref) => chapterLabel(ref.chapter)))}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-mono text-sm text-canvas-foreground">
                    {entry.sizeBytes ? formatBytes(entry.sizeBytes) : '—'}
                  </span>
                  <SelectModelButton
                    active={active}
                    busy={busy}
                    disabled={configuringChatModel !== null}
                    label={entry.name}
                    onSelect={() => void configureChatModel(entry.name)}
                  />
                  {downloadedId && !active ? (
                    <RemoveIconButton
                      id={downloadedId}
                      label={entry.name}
                      state={remove}
                      onRequestRemove={() => requestRemove(downloadedId)}
                      onConfirmRemove={() => onRemoveOne(downloadedId)}
                      onCancel={cancelRemove}
                    />
                  ) : null}
                </div>
                {busy ? (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        percent={percentOf(progress)}
                        className="w-full bg-canvas-muted"
                      />
                      <button
                        type="button"
                        onClick={() => void stopChatLoad()}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-300/40 bg-red-300/10 px-2 py-1 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-300/20"
                      >
                        <Square className="size-2.5 fill-current" />
                        Stop
                      </button>
                    </div>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-canvas-muted-foreground">
                      {progress && progress.total > 0
                        ? `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}`
                        : busy
                          ? 'Preparing model…'
                          : ''}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      <div className="mt-4 rounded-md border border-canvas-border bg-canvas p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-canvas-foreground">Include QVAC documentation</p>
            <p className="mt-0.5 text-xs text-canvas-muted-foreground">
              When online, the assistant sees the full QVAC SDK docs alongside the current lesson. Disable to keep answers local-only.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={useFullDocs}
            onClick={() => void toggleUseFullDocs()}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-[3px] transition-colors ${
              useFullDocs ? 'bg-emerald-500' : 'bg-canvas-muted-foreground/40'
            }`}
          >
            <span
              className={`inline-block size-4 transform rounded-[2px] bg-canvas transition-transform ${
                useFullDocs ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
