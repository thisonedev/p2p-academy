import type {
  AcademyModelEntry,
  AcademyModelCatalogueEntry,
  AcademyDeviceInfo,
  AcademyModelDownloadQueueState,
} from '@academy/validation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AI_BOT_MODEL_NAMES } from '../lesson/ai-bot-models.js';
import '../../lib/academy.js';
import type { RemoveState } from './settings-models.js';

/** What the Models tab shows and does: the model lists, downloads in flight, the AI bot's
 *  model and the removal confirm. The page holds it, not the tab, so a download keeps
 *  reporting while another tab is open. */
export function useSettingsModels({
  hydrated,
  username,
  openSignInPrompt,
}: {
  hydrated: boolean;
  username: string | null;
  openSignInPrompt: () => void;
}) {
  const [models, setModels] = useState<AcademyModelEntry[] | null>(null);
  const [chatCatalogue, setChatCatalogue] = useState<AcademyModelCatalogueEntry[] | null>(null);
  const [fullCatalogue, setFullCatalogue] = useState<AcademyModelCatalogueEntry[] | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  // A chapter slug, 'course', or null. Only one bulk download runs at a time.
  const [downloadingScope, setDownloadingScope] = useState<string | null>(null);
  const [downloadingName, setDownloadingName] = useState<string | null>(null);
  const [downloadQueue, setDownloadQueue] = useState<{ done: number; total: number } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [configuredChatModel, setConfiguredChatModel] = useState<string | null>(null);
  const [configuringChatModel, setConfiguringChatModel] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState<Record<string, { loaded: number; total: number }>>({});
  const [useFullDocs, setUseFullDocs] = useState(true);
  const [ragIndexBackend, setRagIndexBackendState] = useState<'hyperdb' | 'turbovec' | null>(null);
  const [pendingRagIndexBackend, setPendingRagIndexBackend] = useState<'hyperdb' | 'turbovec' | null>(null);
  const [docsStatus, setDocsStatus] = useState<{ available: boolean; source: string; bytes: number; expiresAt: number } | null>(null);
  const [docsBusy, setDocsBusy] = useState(false);
  const [device, setDevice] = useState<AcademyDeviceInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remove, setRemove] = useState<RemoveState>({ pending: null, busy: false, error: null });

  const refreshModels = useCallback(async () => {
    if (!window.academy?.models) {
      setModels([]);
      return;
    }
    // The catalogue carries each chat model's own install state, so a delete
    // that only refreshed the file list left the row looking untouched.
    const [list, cat] = await Promise.all([
      window.academy.models.list(),
      window.academy.models.catalogue().catch(() => null),
    ]);
    setModels(list);
    if (cat) {
      setChatCatalogue(
        AI_BOT_MODEL_NAMES.map((name) => cat.find((entry) => entry.name === name)).filter(
          (entry): entry is AcademyModelCatalogueEntry => entry != null,
        ),
      );
      setFullCatalogue(cat);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!username) {
      openSignInPrompt();
      return;
    }
    // The P2P registry path can re-fetch a block it already reported,
    // walking `loaded` backward mid-download; clamp to keep the bar from
    // visibly restarting on every re-fetch instead of just filling in.
    const applyProgress = (name: string, loaded: number, total: number) => {
      setModelProgress((prev) => {
        const prevEntry = prev[name];
        const merged =
          prevEntry && prevEntry.total === total ? Math.max(prevEntry.loaded, loaded) : loaded;
        return { ...prev, [name]: { loaded: merged, total } };
      });
    };
    // Subscribe to model load progress once; the host emits events while a
    // chat:load call is downloading a model file.
    const offProgress = window.academy?.chat?.onLoadProgress?.((event) => {
      if (!event || !event.modelName) return;
      applyProgress(event.modelName, event.loaded, event.total);
    });
    // Same shape, different source: a models.download() call in flight.
    const offDownloadProgress = window.academy?.models?.onDownloadProgress?.((event) => {
      if (!event || !event.name) return;
      applyProgress(event.name, event.loaded, event.total);
    });
    // The batch runs host-side (models.cjs's downloadModels) and keeps its
    // own state across this page unmounting; this mirrors it into the UI.
    // lastQueueName tells a live new-item transition (reset its bar to 0)
    // apart from an initial catch-up read of a batch already in progress.
    let lastQueueName: string | null = null;
    const applyQueueSnapshot = (snapshot: AcademyModelDownloadQueueState | null) => {
      if (!snapshot?.active) {
        lastQueueName = null;
        setDownloadingScope(null);
        setDownloadingName(null);
        setDownloadQueue(null);
        if (snapshot?.error) setDownloadError(snapshot.error);
        return;
      }
      // A new item started, or a reload is catching up mid-download: seed
      // its bar from the host's own progress, not a prior item's reading.
      if (snapshot.name && snapshot.name !== lastQueueName) {
        setModelProgress((prev) => ({
          ...prev,
          [snapshot.name as string]: snapshot.progress ?? { loaded: 0, total: 0 },
        }));
      }
      lastQueueName = snapshot.name;
      setDownloadingScope(snapshot.scope);
      setDownloadingName(snapshot.name);
      setDownloadQueue({ done: snapshot.done, total: snapshot.total });
    };
    const offQueueProgress = window.academy?.models?.onDownloadQueueProgress?.((snapshot) => {
      applyQueueSnapshot(snapshot);
      // A model finished or the whole batch wrapped up: pick up the new file.
      void refreshModels();
    });
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [list, dev, catalogue, configured, useFullDocsRaw, status, ragBackend, queueState] = await Promise.all([
          window.academy?.models?.list().catch(() => null) ?? Promise.resolve(null),
          window.academy?.device?.info().catch(() => null) ?? Promise.resolve(null),
          window.academy?.models?.catalogue().catch(() => []) ?? Promise.resolve([]),
          window.academy?.chat?.configuredModel().catch(() => null) ?? Promise.resolve(null),
          window.academy?.state?.get?.('ai.chat.useFullDocs').catch(() => null) ?? Promise.resolve(null),
          window.academy?.chat?.docsStatus?.().catch(() => null) ?? Promise.resolve(null),
          window.academy?.ragIndexBackend?.().catch(() => null) ?? Promise.resolve(null),
          window.academy?.models?.downloadQueueState?.().catch(() => null) ?? Promise.resolve(null),
        ]);
        if (cancelled) return;
        setModels(list ?? []);
        setChatCatalogue(
          AI_BOT_MODEL_NAMES.map((name) => (catalogue ?? []).find((entry) => entry.name === name)).filter(
            (entry): entry is AcademyModelCatalogueEntry => entry != null,
          ),
        );
        setFullCatalogue(catalogue ?? []);
        setConfiguredChatModel(configured);
        setDevice(dev);
        if (typeof useFullDocsRaw === 'string') setUseFullDocs(useFullDocsRaw !== 'false');
        if (status && typeof status === 'object') setDocsStatus(status);
        if (ragBackend === 'hyperdb' || ragBackend === 'turbovec') setRagIndexBackendState(ragBackend);
        // Catches up a remount on a batch that started before this page loaded.
        if (queueState?.active) applyQueueSnapshot(queueState);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
      }
    })();
    return () => {
      cancelled = true;
      offProgress?.();
      offDownloadProgress?.();
      offQueueProgress?.();
    };
  }, [hydrated, username, openSignInPrompt]);

  const configureChatModel = useCallback(async (modelName: string) => {
    if (!window.academy?.chat) return;
    setConfiguringChatModel(modelName);
    setLoadError(null);
    setModelProgress((prev) => ({ ...prev, [modelName]: { loaded: 0, total: 0 } }));
    try {
      const result = await window.academy.chat.load(modelName);
      if ('cancelled' in result) return;
      setConfiguredChatModel(result.modelName);
      await refreshModels();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not configure the AI bot');
    } finally {
      setConfiguringChatModel(null);
      setModelProgress((prev) => {
        const next = { ...prev };
        delete next[modelName];
        return next;
      });
    }
  }, [refreshModels]);

  const stopChatLoad = useCallback(async () => {
    await window.academy?.chat?.cancelLoad?.();
  }, []);

  const toggleUseFullDocs = useCallback(async () => {
    const next = !useFullDocs;
    setUseFullDocs(next);
    try {
      await window.academy?.state?.set?.('ai.chat.useFullDocs', next ? 'true' : 'false');
    } catch {
      // best-effort; the next reload will recover
    }
    if (next) {
      setDocsBusy(true);
      try {
        const result = await window.academy?.chat?.docsRefresh?.();
        if (result && typeof result === 'object') setDocsStatus(result);
      } catch {
        // surface the existing status; don't block the toggle
      } finally {
        setDocsBusy(false);
      }
    }
  }, [useFullDocs]);

  const refreshDocs = useCallback(async () => {
    setDocsBusy(true);
    try {
      const result = await window.academy?.chat?.docsRefresh?.();
      if (result && typeof result === 'object') setDocsStatus(result);
    } finally {
      setDocsBusy(false);
    }
  }, []);

  const changeRagIndexBackend = useCallback(async (backend: 'hyperdb' | 'turbovec') => {
    setPendingRagIndexBackend(backend);
    setLoadError(null);
    try {
      const result = await window.academy?.setRagIndexBackend?.(backend);
      if (result === 'hyperdb' || result === 'turbovec') setRagIndexBackendState(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not change the RAG index backend');
    } finally {
      setPendingRagIndexBackend(null);
    }
  }, []);

  const onRemoveOne = useCallback(
    async (id: string) => {
      if (!window.academy?.models) return;
      setRemove({ pending: id, busy: true, error: null });
      try {
        await window.academy.models.remove(id);
        await refreshModels();
        setRemove({ pending: null, busy: false, error: null });
      } catch (err) {
        setRemove({
          pending: null,
          busy: false,
          error: err instanceof Error ? err.message : 'Remove failed',
        });
      }
    },
    [refreshModels],
  );

  const onRemoveAll = useCallback(async () => {
    if (!window.academy?.models) return;
    setRemove({ pending: 'all', busy: true, error: null });
    try {
      // The removeAll handler itself stops the queue and cancels the
      // in-flight download before deleting anything.
      await window.academy.models.removeAll();
      await refreshModels();
      setRemove({ pending: null, busy: false, error: null });
    } catch (err) {
      setRemove({
        pending: null,
        busy: false,
        error: err instanceof Error ? err.message : 'Remove all failed',
      });
    }
  }, [refreshModels]);

  // Runs host-side (models.cjs's downloadModels), not as a loop in this
  // component, so it keeps going if the user opens a lesson mid-batch; the
  // onDownloadQueueProgress subscription above mirrors its state back in.
  const downloadModels = useCallback(async (scope: string, names: string[]) => {
    if (!window.academy?.models || names.length === 0) return;
    setDownloadError(null);
    try {
      await window.academy.models.downloadQueue(scope, names);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    }
  }, []);

  const stopDownloads = useCallback(async () => {
    await window.academy?.models?.cancelDownloadQueue?.();
  }, []);

  // Open the chapter that owns the file in flight so the row's bar is visible.
  useEffect(() => {
    if (!downloadingName) return;
    const entry = (fullCatalogue ?? []).find((e) => e.name === downloadingName);
    const chapter = entry?.usedIn?.[0]?.chapter;
    if (chapter) setSelectedChapter(chapter);
  }, [downloadingName, fullCatalogue]);

  // Arms the inline confirm for a row without deleting anything yet; the
  // actual delete only fires from the "Remove" button in that confirm state.
  const requestRemove = useCallback((id: string) => {
    setRemove({ pending: id, busy: false, error: null });
  }, []);

  const cancelRemove = useCallback(() => {
    setRemove({ pending: null, busy: false, error: null });
  }, []);

  // The AI bot row needs the exact chat cache file, not just any on-disk file
  // sharing the display name (Qwen3-4B-Q4_K_M.gguf is also a lesson model with
  // its own, different file), so Remove there can't target the wrong one.
  const chatModelIdByName = useMemo(() => {
    const map = new Map<string, string>();
    (chatCatalogue ?? []).forEach((entry) => {
      if (entry.cacheFile && entry.installed) map.set(entry.name, entry.cacheFile);
    });
    return map;
  }, [chatCatalogue]);

  // For every other row: the on-disk file for this display name, falling back
  // to the companion set that contains it (a companion file may only exist
  // inside sets/<hash>/, so deleting the set is what actually frees it).
  const modelIdByName = useMemo(() => {
    const map = new Map<string, string>();
    (models ?? []).forEach((m) => map.set(m.name, m.id));
    (fullCatalogue ?? []).forEach((entry) => {
      if (!entry.companionSetKey || map.has(entry.name)) return;
      const set = (models ?? []).find((m) => m.name === entry.companionSetKey);
      if (set) map.set(entry.name, set.id);
    });
    return map;
  }, [models, fullCatalogue]);

  // A download in progress already occupies its final filename, so the checkmark
  // needs completeness too, and for chat models only the host can resolve it.
  const modelCompleteByName = useMemo(() => {
    const map = new Map<string, boolean>();
    (models ?? []).forEach((m) => map.set(m.name, m.complete));
    (fullCatalogue ?? []).forEach((entry) => {
      if (map.has(entry.name)) return;
      if (typeof entry.installed === 'boolean') map.set(entry.name, entry.installed);
    });
    (chatCatalogue ?? []).forEach((entry) => {
      if (map.has(entry.name)) return;
      if (typeof entry.installed === 'boolean') map.set(entry.name, entry.installed);
    });
    return map;
  }, [models, chatCatalogue, fullCatalogue]);

  return {
    models,
    chatCatalogue,
    fullCatalogue,
    selectedChapter,
    setSelectedChapter,
    downloadingScope,
    downloadingName,
    downloadQueue,
    downloadError,
    configuredChatModel,
    configuringChatModel,
    modelProgress,
    useFullDocs,
    ragIndexBackend,
    pendingRagIndexBackend,
    device,
    loadError,
    remove,
    configureChatModel,
    stopChatLoad,
    toggleUseFullDocs,
    changeRagIndexBackend,
    onRemoveOne,
    onRemoveAll,
    downloadModels,
    stopDownloads,
    requestRemove,
    cancelRemove,
    chatModelIdByName,
    modelIdByName,
    modelCompleteByName,
  };
}

export type SettingsModels = ReturnType<typeof useSettingsModels>;
