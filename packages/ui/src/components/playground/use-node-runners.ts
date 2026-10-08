
import type { AcademyAPI } from '@academy/validation';
import {
  type Dispatch,
  type SetStateAction,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { type ConsoleEntry } from '../lesson/console-types.js';
import type { PlaygroundRunContext } from './flow/types.js';
import {
  MODEL_STATUS_OPEN,
  formatModelStatusLine,
  nextEntryId,
} from './flow/graph.js';
import '../../lib/academy.js';

/** What each kind of node calls to do its work: the chat model, translation, search, speech,
 *  image, video and music. Also the Stop bookkeeping those calls share. */
export function useNodeRunners(setEntries: Dispatch<SetStateAction<ConsoleEntry[]>>) {
  const setAssistantEntry = useCallback(
    (
      id: string,
      update: (
        e: Extract<ConsoleEntry, { kind: 'chat-assistant' }>,
      ) => Extract<ConsoleEntry, { kind: 'chat-assistant' }>,
    ) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id && e.kind === 'chat-assistant' ? update(e) : e)),
      );
    },
    [],
  );

  // Read inside the run loop's for-await, not React state: a state read would
  // only ever see the value from when the closure was created, not a Stop
  // click that happens mid-run.
  const stopRequestedRef = useRef(false);
  // Set while a node's activity stage is open. Every entry appended to the
  // feed goes through appendEntry below, so output closes its own stage first
  // whichever call produced it, including calls added later.
  const closeActivityRef = useRef<
    (() => { entryId: string; line: string; label: string } | null) | null
  >(null);
  const appendEntry = useCallback((entry: ConsoleEntry) => {
    // Text sits between the two halves of its stage ("Reading the text", the
    // text, "Read the text") because the stage narrates producing it. A
    // finished file is the stage's product instead, so its ✓ goes above it.
    const closing = closeActivityRef.current?.() ?? null;
    setEntries((prev) => {
      // The opener stays behind in its own entry, so it has to be marked closed
      // there; otherwise it pulses as in-flight for the rest of the run.
      const next = closing
        ? prev.map((e) =>
            e.id === closing.entryId && e.kind === 'run'
              ? { ...e, settledStage: closing.label }
              : e,
          )
        : [...prev];
      const closingEntry = closing
        ? ({
            kind: 'run',
            id: nextEntryId(),
            lines: [{ stream: 'stderr' as const, line: closing.line }],
            status: 'ok',
          } as ConsoleEntry)
        : null;
      if (closingEntry && entry.kind === 'media') next.push(closingEntry, entry);
      else if (closingEntry) next.push(entry, closingEntry);
      else next.push(entry);
      return next;
    });
  }, []);
  const pendingRequestIdRef = useRef<string | null>(null);
  const pendingVoiceRequestIdRef = useRef<string | null>(null);
  const pendingVoiceConversationIdRef = useRef<string | null>(null);
  const [stopRequested, setStopRequested] = useState(false);
  // Which node kind is inside its own `run` right now, so Stop can tell the
  // user when a kind has no way to interrupt an already-started call (the
  // SDK gives ocr/classify-image/generate-image no requestId to cancel).
  const runningKindRef = useRef<string | null>(null);
  // Which console entry the running spinner is currently showing, so a
  // model-status event can append to it like a lesson run's own stage lines.
  const runningEntryIdRef = useRef<string | null>(null);

  // A cold model load can take real time; each phase gets its own line,
  // updated in place while in progress and turned into a checkmark once done.
  useEffect(() => {
    return window.academy?.onModelStatus?.((status) => {
      const entryId = runningEntryIdRef.current;
      if (!entryId) return;
      const line = formatModelStatusLine(status);
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId || e.kind !== 'run') return e;
          const lines = e.lines.length === 1 && e.lines[0].line === '' ? [] : e.lines.slice();
          // Most nodes load their model inside run(), once their own stage is
          // open, so appending would file the load under work it precedes.
          // Writing above that open line keeps the model first everywhere.
          const openIdx = lines.findIndex(
            (l) => l.line.startsWith('→') && !MODEL_STATUS_OPEN.test(l.line),
          );
          const at = openIdx === -1 ? lines.length : openIdx;
          const prevLine = lines[at - 1];
          // Replaced in place while the stage is still open, since splitStages
          // re-reads this line. A closing ✓ stays its own line, or splitStages
          // loses the opener and renders a stray checkmark.
          if (prevLine && MODEL_STATUS_OPEN.test(prevLine.line) && MODEL_STATUS_OPEN.test(line)) {
            lines[at - 1] = { stream: 'stderr', line };
          } else {
            lines.splice(at, 0, { stream: 'stderr', line });
          }
          return { ...e, lines };
        }),
      );
    });
  }, []);

  // Routes through the same `chat.send` bridge lesson chat uses (already
  // tuned: stripping, token budget), not a hand-rolled `academy.run` call.
  const runAgentNode = useCallback(
    (task: string) =>
      new Promise<string>((resolve) => {
        const entryId = nextEntryId();
        let content = '';
        setEntries((prev) => [
          ...prev,
          { kind: 'chat-assistant', id: entryId, content: '', streaming: true },
        ]);

        if (typeof window.academy?.chat?.send !== 'function') {
          content = 'Running a block is only available in the desktop app.';
          setAssistantEntry(entryId, (e) => ({ ...e, content, streaming: false }));
          resolve(content);
          return;
        }

        let unsubscribe: (() => void) | undefined;
        window.academy.chat
          .send({ messages: [{ role: 'user', content: task }], lessonKey: null })
          .then(({ requestId }) => {
            pendingRequestIdRef.current = requestId;
            unsubscribe = window.academy?.chat?.onChunk?.((chunk) => {
              if (chunk.requestId !== requestId) return;
              if (chunk.error) {
                // Stop aborts the in-flight request itself, so the SDK's abort
                // text (a worker exiting mid-request, say) is an expected side
                // effect here and would read as if it were the reply.
                if (stopRequestedRef.current) {
                  setEntries((prev) => prev.filter((e) => e.id !== entryId));
                } else {
                  content = chunk.error ?? 'Run failed.';
                  setAssistantEntry(entryId, (e) => ({ ...e, content, streaming: false }));
                }
              } else if (!chunk.done) {
                content = chunk.replace ? chunk.delta : content + chunk.delta;
                setAssistantEntry(entryId, (e) => ({ ...e, content }));
              }
              if (chunk.done) {
                setAssistantEntry(entryId, (e) => ({ ...e, streaming: false }));
                unsubscribe?.();
                pendingRequestIdRef.current = null;
                resolve(content);
              }
            });
          })
          .catch((err: unknown) => {
            if (stopRequestedRef.current) {
              setEntries((prev) => prev.filter((e) => e.id !== entryId));
            } else {
              content = err instanceof Error ? err.message : 'Run failed.';
              setAssistantEntry(entryId, (e) => ({ ...e, content, streaming: false }));
            }
            pendingRequestIdRef.current = null;
            resolve(content);
          });
      }),
    [setAssistantEntry],
  );

  // Tries the SDK's dedicated per-language Bergamot NMT models first (real
  // translation, not a chat-model guess); silently falls back to runAgentNode
  // when the bridge is unavailable (web) or the language has no NMT model.
  const translateNode = useCallback(
    async (text: string | string[], language: string): Promise<string | string[]> => {
      const prompt = (one: string) =>
        `Translate the following text to ${language}. Reply with only the translation, nothing else.\n\n${one}`;
      if (typeof window.academy?.translate === 'function') {
        try {
          // One entry point for both arities; the overloads split again on return.
          const call = window.academy.translate as (
            value: string | string[],
            target: string,
          ) => Promise<string | string[]>;
          const result = await call(text, language);
          const shown = Array.isArray(result) ? result.join('\n') : result;
          // translate doesn't stream, so the bubble is only added once the
          // final text is ready: appendEntry then closes the "Translating the
          // text" stage as it adds it, putting the ✓ line after the result.
          appendEntry({
            kind: 'chat-assistant',
            id: nextEntryId(),
            content: shown,
            streaming: false,
          });
          return result;
        } catch {
          // Falls through to the agent round trip below; no bubble to clean up
          // since none was added before the call was known to succeed.
        }
      }
      // Without the NMT bridge each entry still needs its own agent round trip.
      if (Array.isArray(text)) {
        const out: string[] = [];
        for (const one of text) out.push(await runAgentNode(prompt(one)));
        return out;
      }
      return runAgentNode(prompt(text));
    },
    [runAgentNode, setAssistantEntry],
  ) as PlaygroundRunContext['translate'];

  // Keyed by confirm entry id; handleStop resolves every pending one as `false`
  // so a run stuck waiting on the user isn't the one thing Stop can't stop.
  const confirmResolversRef = useRef(new Map<string, (answer: boolean) => void>());
  const confirmNode = useCallback(
    (message: string): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        const entryId = nextEntryId();
        confirmResolversRef.current.set(entryId, resolve);
        appendEntry({ kind: 'confirm', id: entryId, message, answer: null });
      }),
    [],
  );
  const handleConfirmAnswer = useCallback((entryId: string, answer: 'yes' | 'no') => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId && e.kind === 'confirm' ? { ...e, answer } : e)),
    );
    const resolve = confirmResolversRef.current.get(entryId);
    if (resolve) {
      resolve(answer === 'yes');
      confirmResolversRef.current.delete(entryId);
    }
  }, []);

  // Scraped/pasted source text wraps its lines for a page width that has
  // nothing to do with this bubble, and marks list items as often with an
  // inline "; -" as with a real line break. A line starting with a marker
  // gets its own line; everything else joins the previous line with a
  // space, so a mid-sentence wrap (or a mid-item one) reads as one sentence.
  const normalizeChunkText = (text: string): string => {
    const listMarker = /^(?:[-*+]|\d+[.)])\s/;
    const withRealBreaks = text.replace(/;\s*(?=(?:[-*+]|\d+[.)])\s)/g, ';\n');
    const lines = withRealBreaks
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return lines.reduce(
      (out, line, i) =>
        i === 0 ? line : listMarker.test(line) ? `${out}\n${line}` : `${out} ${line}`,
      '',
    );
  };

  // Real vector search (chunk + embed + ragSearch), not ask-doc's whole-document
  // prompt stuffing. No chat-model fallback: a wrong answer dressed up as a
  // real search result would be worse than a plain "not available" here.
  const searchDocumentsNode = useCallback(
    async (documents: string[], query: string): Promise<string> => {
      // ragSearch doesn't stream, so there's no partial content to show while
      // it runs: the bubble is only added once the final text is ready, in
      // one appendEntry call. appendEntry closes the node's "Searching the
      // documents" stage as it adds the bubble, which puts the stage's ✓ line
      // right after the result instead of before it.
      if (typeof window.academy?.ragSearch !== 'function') {
        const content = 'Search documents is only available in the desktop app.';
        appendEntry({ kind: 'chat-assistant', id: nextEntryId(), content, streaming: false });
        return content;
      }
      try {
        const results = await window.academy.ragSearch(documents, query);
        // A quoted chunk is the source document's own text, not something to
        // run through Markdown: its own "- " lines and single newlines would
        // otherwise be read as list syntax and soft breaks. raw: true renders
        // it as OCR results already do, preformatted with real line breaks.
        const content =
          results.length === 0
            ? `No matches for "${query}".`
            : `${results.length} result(s) for "${query}"\n\n` +
              results
                .map(
                  (r, i) =>
                    `Result ${i + 1} (score ${r.score.toFixed(3)})\n${normalizeChunkText(r.content)}`,
                )
                .join('\n\n');
        appendEntry({
          kind: 'chat-assistant',
          id: nextEntryId(),
          content,
          streaming: false,
          raw: true,
        });
        return content;
      } catch (err) {
        const content = err instanceof Error ? err.message : 'Search failed.';
        appendEntry({ kind: 'chat-assistant', id: nextEntryId(), content, streaming: false });
        return content;
      }
    },
    [appendEntry],
  );

  // Reads window.academy fresh on every call, not captured at render time:
  // the preload bridge can attach after this component's first render.
  function bridgeCall<A extends unknown[], R>(
    pick: (api: AcademyAPI) => ((...args: A) => Promise<R>) | undefined,
    label: string,
  ) {
    return async (...args: A): Promise<R> => {
      const fn = window.academy && pick(window.academy);
      if (typeof fn !== 'function')
        throw new Error(`${label} is only available in the desktop app.`);
      return fn(...args);
    };
  }
  const ocrNode = useCallback(
    bridgeCall((a) => a.ocr, 'Read text from image'),
    [],
  );
  const classifyImageNode = useCallback(
    bridgeCall((a) => a.classifyImage, 'Classify image'),
    [],
  );
  const textToSpeechNode = useCallback(
    bridgeCall((a) => a.textToSpeech, 'Text to speech'),
    [],
  );
  const speechToTextNode = useCallback(
    bridgeCall((a) => a.speechToText, 'Speech to text'),
    [],
  );
  // Not a bridgeCall: the stop phrase can end the whole run, not just this
  // node, so it sets stopRequestedRef itself instead of only resolving.
  const recordVoiceNode = useCallback(
    (opts: { stopPhrase?: string; maxDurationMs?: number; record?: boolean }) =>
      new Promise<{
        transcript: string;
        stoppedByPhrase: boolean;
        audioDataUrl: string | null;
        error: string | null;
      }>((resolve) => {
        if (typeof window.academy?.voice?.start !== 'function') {
          resolve({
            transcript: '',
            stoppedByPhrase: false,
            audioDataUrl: null,
            error: 'Voice recording is only available in the desktop app.',
          });
          return;
        }
        let unsubscribe: (() => void) | undefined;
        window.academy.voice
          .start(opts)
          .then(({ requestId }) => {
            pendingVoiceRequestIdRef.current = requestId;
            unsubscribe = window.academy?.voice?.onEvent?.((event) => {
              if (!('requestId' in event) || event.requestId !== requestId) return;
              if (!event.done) return;
              unsubscribe?.();
              pendingVoiceRequestIdRef.current = null;
              if (event.stoppedByPhrase) {
                stopRequestedRef.current = true;
                setStopRequested(true);
              }
              resolve({
                transcript: event.transcript,
                stoppedByPhrase: event.stoppedByPhrase,
                audioDataUrl: event.audioDataUrl,
                error: event.error,
              });
            });
          })
          .catch((err: unknown) =>
            resolve({
              transcript: '',
              stoppedByPhrase: false,
              audioDataUrl: null,
              error: err instanceof Error ? err.message : 'Voice recording failed.',
            }),
          );
      }),
    [],
  );
  // Not a bridgeCall: this is an async generator, one session yielding many turns.
  const voiceConversationTurns = useCallback(async function* (
    opts: { endOfTurnSilenceMs?: number } = {},
  ) {
    if (typeof window.academy?.voice?.startConversation !== 'function') {
      yield { transcript: '', error: 'Voice recording is only available in the desktop app.' };
      return;
    }
    const { conversationId } = await window.academy.voice.startConversation(opts);
    pendingVoiceConversationIdRef.current = conversationId;
    // Events arrive push-style via onEvent; the generator consumes them
    // pull-style via yield, so a small queue bridges the two.
    const queue: Array<{ transcript: string; done: boolean; error: string | null }> = [];
    let wake: (() => void) | null = null;
    const unsubscribe = window.academy.voice.onEvent((event) => {
      if (!('conversationId' in event) || event.conversationId !== conversationId) return;
      queue.push(event);
      wake?.();
    });
    try {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }
        const event = queue.shift();
        if (!event) continue;
        yield { transcript: event.transcript, error: event.error };
        if (event.done) return;
      }
    } finally {
      unsubscribe();
      pendingVoiceConversationIdRef.current = null;
    }
  }, []);
  // Spoken replies play with no player card in the feed: once the answer has
  // been said out loud, the clip has no second use. It plays through a real
  // hidden element because a detached `new Audio()` stayed silent here.
  const replyAudioRef = useRef<HTMLAudioElement | null>(null);
  const replySeqRef = useRef(0);
  const [replyClip, setReplyClip] = useState<{ url: string; seq: number } | null>(null);
  const playAudio = useCallback((dataUrl: string) => {
    replySeqRef.current += 1;
    setReplyClip({ url: dataUrl, seq: replySeqRef.current });
  }, []);
  const ensureVoiceModelReady = useCallback(async () => {
    await window.academy?.voice?.preload?.().catch(() => undefined);
  }, []);
  // chat.cjs's preload() owns the fallback chain. A renderer-side copy of it
  // once dropped the last fallback and preloaded nothing.
  const ensureChatModelReady = useCallback(async () => {
    await window.academy?.chat?.preload?.().catch(() => undefined);
  }, []);
  const generateImageNode = useCallback(
    bridgeCall((a) => a.generateImage, 'Generate image'),
    [],
  );
  const generateVideoNode = useCallback(
    bridgeCall((a) => a.generateVideo, 'Generate video'),
    [],
  );
  const generateMusicNode = useCallback(
    bridgeCall((a) => a.generateMusic, 'Generate music'),
    [],
  );

  return {
    stopRequestedRef,
    setStopRequested,
    appendEntry,
    runningKindRef,
    runningEntryIdRef,
    closeActivityRef,
    runAgentNode,
    translateNode,
    confirmNode,
    searchDocumentsNode,
    playAudio,
    ocrNode,
    classifyImageNode,
    textToSpeechNode,
    speechToTextNode,
    recordVoiceNode,
    voiceConversationTurns,
    ensureVoiceModelReady,
    ensureChatModelReady,
    generateImageNode,
    generateVideoNode,
    generateMusicNode,
    replyAudioRef,
    setReplyClip,
    pendingRequestIdRef,
    pendingVoiceRequestIdRef,
    pendingVoiceConversationIdRef,
    confirmResolversRef,
    setAssistantEntry,
    stopRequested,
    handleConfirmAnswer,
    replyClip,
  };
}

export type NodeRunners = ReturnType<typeof useNodeRunners>;
