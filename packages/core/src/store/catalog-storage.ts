import type {
  AcademyCatalogAPI,
  AcademyCatalogDiskStatus,
  AcademyCatalogEntry,
  AcademyCatalogKind,
} from '@academy/validation';

// Electron drops custom error fields across IPC, so the code is part of the
// message. Keep in sync with DISK_LOW_CODE in catalog-store.cjs.
const CATALOG_DISK_LOW = 'CATALOG_DISK_LOW';

export function isCatalogDiskLowError(err: unknown): boolean {
  return err instanceof Error && err.message.includes(CATALOG_DISK_LOW);
}

function getAcademyCatalog(): AcademyCatalogAPI | null {
  if (typeof window === 'undefined') return null;
  const academy = (window as unknown as { academy?: { catalog?: AcademyCatalogAPI } }).academy;
  return academy?.catalog ?? null;
}

// Typed client for brand kits, image-constructor designs, and playground
// workflows. Unlike academyStorage, there's no localStorage cache: every
// call goes straight to the main-process catalog, a no-op outside Electron.
export const catalogStorage = {
  /** False outside the desktop app, where every call below is a no-op. */
  available(): boolean {
    return getAcademyCatalog() !== null;
  },
  save(kind: AcademyCatalogKind, id: string, title: string, payload: unknown, preview?: unknown): Promise<void> {
    const catalog = getAcademyCatalog();
    if (!catalog) return Promise.resolve();
    return catalog.save(kind, id, title, payload, preview);
  },
  rename(kind: AcademyCatalogKind, id: string, title: string): Promise<void> {
    const catalog = getAcademyCatalog();
    if (!catalog) return Promise.resolve();
    return catalog.rename(kind, id, title);
  },
  get(kind: AcademyCatalogKind, id: string): Promise<unknown | null> {
    const catalog = getAcademyCatalog();
    if (!catalog) return Promise.resolve(null);
    return catalog.get(kind, id);
  },
  remove(kind: AcademyCatalogKind, id: string): Promise<void> {
    const catalog = getAcademyCatalog();
    if (!catalog) return Promise.resolve();
    return catalog.remove(kind, id);
  },
  list(kind?: AcademyCatalogKind): Promise<AcademyCatalogEntry[]> {
    const catalog = getAcademyCatalog();
    if (!catalog) return Promise.resolve([]);
    return catalog.list(kind);
  },
  diskStatus(): Promise<AcademyCatalogDiskStatus> {
    const catalog = getAcademyCatalog();
    if (!catalog) return Promise.resolve({ level: 'unknown', freeBytes: null, totalBytes: null });
    return catalog.diskStatus();
  },
};
