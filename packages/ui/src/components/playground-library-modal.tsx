'use client';

import { catalogStorage } from '@academy/core';
import type { AcademyCatalogDiskStatus, AcademyCatalogEntry } from '@academy/validation';
import { FileDown, FileUp, MoreHorizontal, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadBlob, slugFilename } from './playground-export.js';
import {
  formatBytes,
  formatWhen,
  ipcErrorMessage,
  isWorkflowPreview,
  PREVIEW_H,
  PREVIEW_NODE_H,
  PREVIEW_NODE_W,
  PREVIEW_W,
} from './playground-library.js';
import { downloadWorkflow, parseWorkflowShape, type SavedWorkflow } from './playground-workflow.js';

const KIND = 'pg-workflows';

type Filter = 'all' | 'pg-workflows';
type Sort = 'recent' | 'name';

function WorkflowThumb({ preview }: { preview: unknown }) {
  if (!isWorkflowPreview(preview) || preview.n.length === 0) {
    return <div className="h-[84px] border-b border-canvas-border bg-canvas-muted/40" />;
  }
  return (
    <svg
      viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
      className="block h-[84px] w-full border-b border-canvas-border"
      style={{ background: 'radial-gradient(#262a2f 1px, transparent 1px) 0 0 / 12px 12px, #121212' }}
      aria-hidden
    >
      {preview.e.map(([a, b]) => {
        const from = preview.n[a];
        const to = preview.n[b];
        if (!from || !to) return null;
        return (
          <line
            key={`${a}-${b}`}
            x1={from[0] + PREVIEW_NODE_W / 2}
            y1={from[1] + PREVIEW_NODE_H / 2}
            x2={to[0] + PREVIEW_NODE_W / 2}
            y2={to[1] + PREVIEW_NODE_H / 2}
            stroke="#6ea8fe77"
            strokeWidth={1.5}
          />
        );
      })}
      {preview.n.map(([x, y], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: preview nodes have no ids, only positions
        <rect key={i} x={x} y={y} width={PREVIEW_NODE_W} height={PREVIEW_NODE_H} rx={3} fill="#2a2a2a" stroke="#3a3a3a" />
      ))}
    </svg>
  );
}

function DiskMeter({ status }: { status: AcademyCatalogDiskStatus | null }) {
  if (!status || status.freeBytes === null || status.totalBytes === null) return <span />;
  const used = 1 - status.freeBytes / status.totalBytes;
  const low = status.level !== 'ok';
  return (
    <div
      className={`flex items-center gap-2 text-[11px] ${low ? 'text-amber-400' : 'text-canvas-muted-foreground'}`}
      title="Saving stops when less than 500 MB is free"
    >
      <span>Disk</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-canvas-muted">
        <div className={`h-full ${low ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.round(used * 100)}%` }} />
      </div>
      <span>{formatBytes(status.freeBytes)} free</span>
    </div>
  );
}

async function loadWorkflow(entry: AcademyCatalogEntry): Promise<SavedWorkflow> {
  const payload = await catalogStorage.get(KIND, entry.id);
  if (payload === null) throw new Error('This workflow is missing from the library.');
  return { ...parseWorkflowShape(payload), name: entry.title };
}

function LibraryCard({
  entry,
  current,
  onOpen,
  onChanged,
  onDelete,
  onError,
}: {
  entry: AcademyCatalogEntry;
  current: boolean;
  onOpen: () => void;
  onChanged: (change: { renamed?: string }) => void;
  onDelete: () => void;
  onError: (message: string) => void;
}) {
  // Fixed-positioned from the ⋯ button's rect: the grid scrolls, and its
  // overflow would otherwise clip a menu opened on the last row.
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuOpen = menuPos !== null;
  const setMenuOpen = (open: boolean) => {
    if (!open) return setMenuPos(null);
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    const height = 176;
    const below = rect.bottom + 4 + height <= window.innerHeight;
    setMenuPos({ top: below ? rect.bottom + 4 : rect.top - height - 4, left: rect.right - 160 });
  };
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(entry.title);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as globalThis.Node)) {
        setMenuOpen(false);
      }
    };
    const dismiss = () => setMenuPos(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [menuOpen]);

  const run = (fn: () => Promise<void>) => {
    setMenuOpen(false);
    fn().catch((err) => onError(ipcErrorMessage(err)));
  };

  const commitRename = () => {
    setRenaming(false);
    const title = draft.trim();
    if (!title || title === entry.title) return setDraft(entry.title);
    run(async () => {
      await catalogStorage.rename(KIND, entry.id, title);
      onChanged({ renamed: title });
    });
  };

  const actions: { label: string; danger?: boolean; onSelect: () => void }[] = [
    { label: 'Open', onSelect: () => run(async () => onOpen()) },
    {
      label: 'Rename',
      onSelect: () => {
        setMenuOpen(false);
        setDraft(entry.title);
        setRenaming(true);
      },
    },
    {
      label: 'Duplicate',
      onSelect: () =>
        run(async () => {
          const workflow = await loadWorkflow(entry);
          const title = `${entry.title} (copy)`;
          await catalogStorage.save(KIND, crypto.randomUUID(), title, { ...workflow, name: title }, entry.preview);
          onChanged({});
        }),
    },
    { label: 'Export as .json', onSelect: () => run(async () => downloadWorkflow(await loadWorkflow(entry))) },
    {
      label: 'Delete…',
      danger: true,
      onSelect: () => {
        setMenuOpen(false);
        onDelete();
      },
    },
  ];

  return (
    <div
      className={`group relative rounded-lg border bg-canvas text-left transition-colors ${
        current ? 'border-emerald-500/70' : 'border-canvas-border hover:border-emerald-500/40'
      }`}
    >
      <button type="button" onClick={onOpen} className="block w-full overflow-hidden rounded-t-lg text-left" title={`Open ${entry.title}`}>
        <WorkflowThumb preview={entry.preview} />
      </button>
      <div className="px-2.5 py-2">
        {renaming ? (
          <input
            // biome-ignore lint/a11y/noAutofocus: opened by the user's own Rename click
            autoFocus
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              else if (e.key === 'Escape') {
                setDraft(entry.title);
                setRenaming(false);
              }
            }}
            className="w-full rounded border border-emerald-500/60 bg-canvas px-1 py-0.5 text-[12.5px] font-semibold text-canvas-foreground focus:outline-none"
          />
        ) : (
          <button type="button" onClick={onOpen} className="block w-full truncate text-left text-[12.5px] font-semibold text-canvas-foreground">
            {entry.title}
          </button>
        )}
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-canvas-muted-foreground">
          <span className="rounded bg-[#6ea8fe1a] px-1.5 text-[9.5px] uppercase tracking-wide text-[#6ea8fe]">Workflow</span>
          <span className="truncate">
            {formatWhen(entry.updatedAt)}
            {entry.bytes !== undefined && ` · ${formatBytes(entry.bytes)}`}
          </span>
        </div>
      </div>
      <div ref={menuRef} className="absolute right-1.5 top-1.5">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex size-6 items-center justify-center rounded-md bg-black/60 text-canvas-foreground transition-opacity ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          }`}
          aria-label={`Actions for ${entry.title}`}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
        {menuOpen && (
          <div
            className="fixed z-50 w-40 rounded-md border border-canvas-border bg-canvas p-1 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {actions.map((a) => (
              <button
                key={a.danger ? 'delete' : a.label}
                type="button"
                onClick={a.onSelect}
                className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-canvas-muted ${
                  a.danger ? 'text-red-400' : 'text-canvas-foreground'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlaygroundLibraryModal({
  currentId,
  onClose,
  onOpen,
  onImport,
  onCurrentChanged,
}: {
  currentId: string | null;
  onClose: () => void;
  onOpen: (entry: AcademyCatalogEntry, workflow: SavedWorkflow) => void;
  onImport: () => void;
  onCurrentChanged: (change: { renamed?: string; deleted?: boolean }) => void;
}) {
  const [entries, setEntries] = useState<AcademyCatalogEntry[] | null>(null);
  const [disk, setDisk] = useState<AcademyCatalogDiskStatus | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AcademyCatalogEntry | null>(null);

  const refresh = useCallback(() => {
    catalogStorage
      .list(KIND)
      .then(setEntries)
      .catch((err) => {
        setEntries([]);
        setError(ipcErrorMessage(err));
      });
    catalogStorage.diskStatus().then(setDisk, () => setDisk(null));
  }, []);

  useEffect(refresh, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape backs out of the delete dialog first, then the library.
      if (pendingDelete) setPendingDelete(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pendingDelete]);

  const confirmDelete = () => {
    const entry = pendingDelete;
    if (!entry) return;
    setPendingDelete(null);
    catalogStorage
      .remove(KIND, entry.id)
      .then(() => {
        if (entry.id === currentId) onCurrentChanged({ deleted: true });
        refresh();
      })
      .catch((err) => setError(ipcErrorMessage(err)));
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (entries ?? []).filter(
      (e) => (filter === 'all' || e.kind === filter) && (!q || e.title.toLowerCase().includes(q)),
    );
    return sort === 'name' ? [...list].sort((a, b) => a.title.localeCompare(b.title)) : list;
  }, [entries, query, filter, sort]);

  const open = (entry: AcademyCatalogEntry) => {
    loadWorkflow(entry)
      .then((workflow) => onOpen(entry, workflow))
      .catch((err) => setError(ipcErrorMessage(err)));
  };

  const exportAll = async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const files: Record<string, Uint8Array> = {};
    for (const entry of entries ?? []) {
      const workflow = await loadWorkflow(entry);
      let name = slugFilename(entry.title, 'json');
      for (let n = 2; files[name]; n++) name = slugFilename(`${entry.title} ${n}`, 'json');
      files[name] = strToU8(`${JSON.stringify(workflow, null, 2)}\n`);
    }
    const zip = zipSync(files);
    downloadBlob(new Blob([zip.slice().buffer], { type: 'application/zip' }), 'p2p-academy-library.zip');
  };

  const count = entries?.length ?? 0;
  const chip = (active: boolean) =>
    `flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
      active ? 'border-emerald-500/40 bg-emerald-500/12 text-canvas-foreground' : 'border-canvas-border text-canvas-muted-foreground'
    }`;

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/55 pt-10" onClick={onClose}>
      <div
        className="flex max-h-[560px] w-[800px] max-w-[calc(100%-32px)] flex-col overflow-hidden rounded-xl border border-canvas-border bg-canvas shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-canvas-border px-4 py-3">
          <span className="text-[13px] font-semibold text-canvas-foreground">Library</span>
          <div className="flex flex-1 items-center gap-2 rounded-md border border-canvas-border bg-canvas-muted px-2.5 focus-within:border-emerald-500/50">
            <Search className="size-3.5 text-canvas-muted-foreground" />
            <input
              // biome-ignore lint/a11y/noAutofocus: the modal opens to search
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your library…"
              className="flex-1 bg-transparent py-1.5 font-mono text-[12.5px] text-canvas-foreground focus:outline-none"
            />
          </div>
          <button type="button" onClick={onClose} className="text-canvas-muted-foreground hover:text-canvas-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pt-2.5">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(filter === 'all')} onClick={() => setFilter('all')}>
              All <span className="opacity-60">{count}</span>
            </button>
            <button type="button" className={chip(filter === 'pg-workflows')} onClick={() => setFilter('pg-workflows')}>
              Workflows <span className="opacity-60">{count}</span>
            </button>
            {['Designs', 'Brand kits'].map((label) => (
              <span key={label} className={`${chip(false)} cursor-default opacity-45`} title="Coming soon">
                {label} <span className="opacity-60">soon</span>
              </span>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-md border border-canvas-border bg-canvas-muted px-1.5 py-1 text-[11px] text-canvas-foreground focus:outline-none"
          >
            <option value="recent">Recently edited</option>
            <option value="name">Name</option>
          </select>
        </div>

        {error && (
          <div className="mx-4 mt-2.5 rounded-md border border-red-300/40 px-3 py-1.5 font-mono text-[12px] text-red-300">{error}</div>
        )}

        <div className="grid flex-1 grid-cols-3 gap-2.5 overflow-y-auto p-4">
          {entries === null && <div className="col-span-3 text-center text-xs text-canvas-muted-foreground">Loading library…</div>}
          {entries !== null && shown.length === 0 && (
            <div className="col-span-3 flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-canvas-border text-xs text-canvas-muted-foreground">
              {count === 0 ? (
                <>
                  <span>Your library is empty.</span>
                  <span>Save a workflow with ⌘S to add it here.</span>
                </>
              ) : (
                <span>Nothing matches.</span>
              )}
            </div>
          )}
          {shown.map((entry) => (
            <LibraryCard
              key={entry.id}
              entry={entry}
              current={entry.id === currentId}
              onOpen={() => open(entry)}
              onError={setError}
              onDelete={() => setPendingDelete(entry)}
              onChanged={(change) => {
                if (entry.id === currentId && change.renamed) onCurrentChanged(change);
                refresh();
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-canvas-border px-4 py-2.5">
          <DiskMeter status={disk} />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onImport}
              className="inline-flex items-center gap-1.5 rounded-md border border-canvas-border px-2.5 py-1 text-xs text-canvas-foreground hover:bg-canvas-muted"
            >
              <FileUp className="size-3.5" /> Import .json
            </button>
            <button
              type="button"
              disabled={count === 0}
              onClick={() => exportAll().catch((err) => setError(ipcErrorMessage(err)))}
              className="inline-flex items-center gap-1.5 rounded-md border border-canvas-border px-2.5 py-1 text-xs text-canvas-foreground hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileDown className="size-3.5" /> Export all as .zip
            </button>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            e.stopPropagation();
            setPendingDelete(null);
          }}
        >
          <div
            role="alertdialog"
            aria-labelledby="library-delete-title"
            className="w-[360px] rounded-xl border border-canvas-border bg-canvas p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="library-delete-title" className="text-[13px] font-semibold text-canvas-foreground">
              Delete “{pendingDelete.title}”?
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-canvas-muted-foreground">
              It will be removed from your library. This can't be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                // biome-ignore lint/a11y/noAutofocus: the safe choice takes focus, so Enter never deletes by accident
                autoFocus
                onClick={() => setPendingDelete(null)}
                className="rounded-md border border-canvas-border px-3 py-1.5 text-xs text-canvas-foreground hover:bg-canvas-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-md bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

