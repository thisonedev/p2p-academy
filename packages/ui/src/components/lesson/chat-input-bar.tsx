'use client';

import type { AcademyChatChunk, AcademyChatMessage } from '@academy/validation';
import { Square, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { isAiBotModel } from './ai-bot-models.js';
import { ThemedSelect } from '../ui/themed-select.js';
import type { ChatInputBarProps, ConsoleEntry, LessonConsoleLessonContext } from './console-types.js';
import { ConsoleBackgroundContext } from './console-rail.js';

// Turns a cache filename like "Qwen3-4B-Q4_K_M.gguf" into "Qwen3 4B" for display.
function shortName(filename: string | null | undefined): string {
  if (!filename) return '';
  let name = filename.replace(/\.(gguf|bin|safetensors|pth)$/i, '');
  name = name.replace(/-Instruct/gi, '');
  name = name.replace(/-(?:UD-)?Q\d\w*$/i, '');
  return name.replace(/-/g, ' ');
}

// Extracts the billions parameter count from filenames like Qwen3-0.6B-Q4_0
// → 0.6 or Llama-3.2-1B-Instruct-Q4_0 → 1. Only a number immediately
// followed by `B` counts, so version strings and quantisation tags skip.
// Unknown names sort last rather than collapsing to 0.
function paramCountB(filename: string): number {
  const match = /(\d+(?:\.\d+)?)B(?![a-z])/i.exec(filename);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

// Smallest model first, so the picker reads as a size ladder instead of
// whatever order the on-disk listing happened to produce.
function byParamCount(a: string, b: string): number {
  return paramCountB(a) - paramCountB(b) || a.localeCompare(b);
}

function toLessonKey(
  ctx: LessonConsoleLessonContext | null,
): { chapter: string; lesson: string } | null {
  if (!ctx) return null;
  return { chapter: ctx.chapter, lesson: ctx.lesson };
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatInputBar({ entries, setEntries, lessonContext, readOnly, onBuildSubmit }: ChatInputBarProps) {
  const [buildMode, setBuildMode] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [chatUnavailable, setChatUnavailable] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [chatPendingRequestId, setChatPendingRequestId] = useState<string | null>(null);
  const [installedAiBotModels, setInstalledAiBotModels] = useState<string[]>([]);
  const [switchingModel, setSwitchingModel] = useState(false);
  const [useFullDocs, setUseFullDocs] = useState(true);
  const pendingChatRequestIdRef = useRef<string | null>(null);
  const pendingChatEntryIdRef = useRef<string | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const syncCursorIndex = useCallback((e: { currentTarget: HTMLTextAreaElement }) => {
    setCursorIndex(e.currentTarget.selectionStart ?? 0);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.academy?.chat) {
      setChatUnavailable(true);
      setModelLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [current, configured, suggestion] = await Promise.all([
        window.academy!.chat!.currentModel().catch(() => null),
        window.academy!.chat!.configuredModel().catch(() => null),
        window.academy!.models?.recommend(null).catch(() => null) ?? Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (current) {
        setModelName(current);
        setModelLoading(false);
        return;
      }
      // The configured model can be one this device never finished
      // downloading, so only auto-load it if it's actually on disk; an
      // uninstalled recommendation is not consent to download it.
      const onDisk = new Set((suggestion?.ranked ?? []).filter((e) => e.installed).map((e) => e.name));
      const wanted = configured && onDisk.has(configured) ? configured : null;
      if (!wanted) {
        setModelLoading(false);
        return;
      }
      try {
        const loaded = await window.academy!.chat!.load(wanted);
        if (!cancelled && 'modelName' in loaded) setModelName(loaded.modelName);
      } catch (err) {
        if (!cancelled) {
          setChatError(err instanceof Error ? err.message : 'Could not load the configured model.');
        }
      } finally {
        if (!cancelled) setModelLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.academy?.state) return;
    let cancelled = false;
    window.academy.state
      .get('ai.chat.useFullDocs')
      .then((value) => {
        if (!cancelled && typeof value === 'string' && value === 'false') setUseFullDocs(false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshInstalledChatModels = useCallback(async () => {
    if (typeof window === 'undefined' || !window.academy?.models) return;
    try {
      // The catalogue resolves each preset to its own file. The file list is
      // keyed by display name, which offered a chat model whose copy was still
      // downloading.
      const entries = await window.academy.models.catalogue();
      const installedNames = entries
        .filter((e) => e.family === 'chat' && e.installed && isAiBotModel(e.name))
        .map((e) => e.name);
      setInstalledAiBotModels(installedNames.sort(byParamCount));
    } catch {
    }
  }, []);

  useEffect(() => {
    void refreshInstalledChatModels();
  }, [refreshInstalledChatModels]);

  const handleSwitchModel = useCallback(
    async (name: string) => {
      if (name === modelName) return;
      setSwitchingModel(true);
      setChatError(null);
      try {
        const result = await window.academy!.chat!.load(name);
        if ('modelName' in result) setModelName(result.modelName);
      } catch (err) {
        setChatError(err instanceof Error ? err.message : 'Could not switch models.');
      } finally {
        setSwitchingModel(false);
      }
    },
    [modelName],
  );

  // Chat replies stream in via onChunk, matched to the waiting entry by requestId.
  useEffect(() => {
    const offChunk = window.academy?.chat?.onChunk?.((chunk: AcademyChatChunk) => {
      if (chunk.requestId !== pendingChatRequestIdRef.current) return;
      const entryId = pendingChatEntryIdRef.current;
      if (chunk.error) setChatError(chunk.error);
      if (chunk.done) {
        pendingChatRequestIdRef.current = null;
        pendingChatEntryIdRef.current = null;
        setChatPendingRequestId(null);
        if (entryId) {
          setEntries((prev) =>
            prev.map((e) => (e.id === entryId && e.kind === 'chat-assistant' ? { ...e, streaming: false } : e)),
          );
        }
        return;
      }
      if (!entryId) return;
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId || e.kind !== 'chat-assistant') return e;
          return { ...e, content: chunk.replace ? chunk.delta : e.content + chunk.delta };
        }),
      );
    });
    return () => {
      offChunk?.();
    };
  }, [setEntries]);

  const handleSend = useCallback(async () => {
    if (!modelName || readOnly) return;
    const content = draft.trim();
    if (content.length === 0) return;
    setChatError(null);
    setDraft('');

    if (buildMode && onBuildSubmit) {
      onBuildSubmit(content);
      return;
    }

    const history: AcademyChatMessage[] = [
      ...entries
        .filter(
          (e): e is Extract<ConsoleEntry, { kind: 'chat-user' | 'chat-assistant' }> =>
            (e.kind === 'chat-user' || e.kind === 'chat-assistant') && e.content.trim().length > 0,
        )
        .map((e) => ({ role: e.kind === 'chat-user' ? ('user' as const) : ('assistant' as const), content: e.content })),
      { role: 'user', content },
    ];

    const assistantId = newId();
    setEntries((prev) => [
      ...prev,
      { kind: 'chat-user', id: newId(), content },
      { kind: 'chat-assistant', id: assistantId, content: '', streaming: true },
    ]);

    try {
      const { requestId } = await window.academy!.chat!.send({
        messages: history,
        lessonKey: toLessonKey(lessonContext),
        lessonReference: lessonContext?.reference,
        useFullDocs: typeof navigator !== 'undefined' && navigator.onLine && useFullDocs,
      });
      pendingChatRequestIdRef.current = requestId;
      pendingChatEntryIdRef.current = assistantId;
      setChatPendingRequestId(requestId);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Could not send the message.');
      setEntries((prev) =>
        prev.map((e) => (e.id === assistantId && e.kind === 'chat-assistant' ? { ...e, streaming: false } : e)),
      );
    }
  }, [draft, entries, lessonContext, modelName, readOnly, useFullDocs, setEntries, buildMode, onBuildSubmit]);

  const handleStop = useCallback(() => {
    const requestId = pendingChatRequestIdRef.current;
    if (!requestId) return;
    void window.academy?.chat?.stop?.(requestId).catch(() => undefined);
    pendingChatRequestIdRef.current = null;
    pendingChatEntryIdRef.current = null;
    setChatPendingRequestId(null);
  }, []);

  const isStreaming = chatPendingRequestId !== null;
  const noModelConfigured = !readOnly && !chatUnavailable && !modelLoading && !modelName;
  const disabledReason = readOnly
    ? undefined
    : chatUnavailable
      ? 'AI chat is only available in the desktop app.'
      : noModelConfigured
        ? 'Configure AI bot to ask questions'
        : undefined;

  const background = useContext(ConsoleBackgroundContext);
  return (
    <div className="w-full min-w-0" style={{ backgroundColor: background }}>
      {/* No box of its own: the editor's background carries through and only a
          rule above and below separates it, so it reads as part of the panel. */}
      <div
        className="flex min-h-9 items-center gap-2 border-t border-canvas-border px-3 py-2.5"
        title={disabledReason}
      >
        {onBuildSubmit ? (
          <button
            type="button"
            onClick={() => setBuildMode((v) => !v)}
            aria-pressed={buildMode}
            title={buildMode ? 'Building a workflow from your next message' : 'Chatting; click to build a workflow instead'}
            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] leading-4 transition-colors ${
              buildMode
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-canvas-border text-canvas-muted-foreground/70 hover:text-canvas-muted-foreground'
            }`}
          >
            {buildMode ? 'Build' : 'Chat'}
          </button>
        ) : (
          <span aria-hidden className="shrink-0 font-mono text-xs leading-4 text-canvas-muted-foreground/70">
            &rsaquo;
          </span>
        )}
        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ maxHeight: 160 }}>
          {/* Real inline cursor span, not a computed pixel offset: the browser
              positions it exactly where a character would sit. The actual
              textarea sits on top, fully transparent, for input/focus/selection. */}
          <div
            aria-hidden
            className="whitespace-pre-wrap break-words font-mono text-xs leading-4 text-canvas-muted-foreground"
            style={{ transform: `translateY(${-scrollTop}px)` }}
          >
            {draft.length === 0 && disabledReason && (
              <span className="text-canvas-muted-foreground/60">{disabledReason}</span>
            )}
            {draft.slice(0, cursorIndex)}
            {!readOnly && modelName && <span className="inline-block h-3.5 w-1.5 -translate-y-px bg-canvas-muted-foreground align-middle" />}
            {draft.slice(cursorIndex)}
          </div>
          <textarea
            ref={draftRef}
            rows={1}
            value={draft}
            disabled={readOnly || !modelName}
            onChange={(e) => {
              setDraft(e.target.value);
              syncCursorIndex(e);
            }}
            onSelect={syncCursorIndex}
            onClick={syncCursorIndex}
            onKeyUp={syncCursorIndex}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            className="absolute inset-0 w-full resize-none overflow-y-auto whitespace-pre-wrap break-words bg-transparent font-mono text-xs leading-4 text-transparent caret-transparent outline-none disabled:cursor-not-allowed"
          />
        </div>
        <ModelSwitcher
          modelName={modelName}
          options={installedAiBotModels}
          busy={switchingModel}
          onSelect={handleSwitchModel}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={handleStop}
            aria-label="Stop response"
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded text-danger transition-colors hover:bg-danger/10 hover:text-danger"
            style={{ height: '24px', width: '24px', boxSizing: 'border-box', padding: 0 }}
          >
            <Square className="size-4 fill-current" />
          </button>
        ) : noModelConfigured ? (
          <Link
            href="/settings"
            aria-label="Pick a model in Settings to enable chat"
            title="Pick a model in Settings to enable chat"
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded bg-canvas-muted text-canvas-muted-foreground transition-colors hover:bg-canvas-border hover:text-canvas-foreground"
            style={{ height: '24px', width: '24px', boxSizing: 'border-box', padding: 0 }}
          >
            <Settings className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {chatError ? <p className="mt-1 px-1 text-[10px] text-danger">{chatError}</p> : null}
    </div>
  );
}

// Same control as the run-mode and paired-device pickers in the editor
// toolbar: a themed dropdown, so the three read as one family.
function ModelSwitcher({
  modelName,
  options,
  busy,
  onSelect,
}: {
  modelName: string | null;
  options: string[];
  busy: boolean;
  onSelect: (modelName: string) => void;
}) {
  if (!modelName && options.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {busy ? <Loader2 className="size-2.5 shrink-0 animate-spin text-canvas-muted-foreground" /> : null}
      <ThemedSelect
        ariaLabel="Chat model"
        title="Chat model"
        value={modelName ?? ''}
        onChange={onSelect}
        disabled={busy || options.length === 0}
        placeholder="Pick model"
        options={options.map((name) => ({ value: name, label: shortName(name) }))}
        className="flex min-w-0 max-w-[6rem] items-center justify-between gap-1 rounded border border-canvas-border bg-transparent px-1.5 py-1 sm:max-w-[9rem] text-[10px] font-medium tracking-wider text-canvas-muted-foreground uppercase transition-colors hover:text-canvas-foreground focus:ring-1 focus:ring-primary/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      />
    </div>
  );
}
