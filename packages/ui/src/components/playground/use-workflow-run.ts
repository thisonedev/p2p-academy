
import {
  type Node,
  type Edge,
} from '@xyflow/react';
import {
  type Dispatch,
  type SetStateAction,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { type ConsoleEntry } from '../lesson/console-types.js';
import { slotFromHandle } from '../design/render/slots.js';
import { PLAYGROUND_NODE_DEFS } from './flow/node-defs.js';
import type { PlaygroundTable } from './lib/table.js';
import type { PlaygroundNodeData, PlaygroundRunContext } from './flow/types.js';
import {
  mainInputEdge,
  nextEntryId,
  topoOrderIds,
} from './flow/graph.js';
import '../../lib/academy.js';

// The SDK gives these calls no requestId/signal to cancel; once started, only
// letting the current step finish (never starting the next) is possible.
const UNCANCELABLE_KINDS = new Set(['ocr', 'classify-image']);
import type { NodeRunners } from './use-node-runners.js';

/** Run and Stop for the whole workflow: walks the nodes in order and feeds each one's output
 *  to the next. */
export function useWorkflowRun({
  nodes,
  edges,
  setNodes,
  setEntries,
  runners,
}: {
  nodes: Node<PlaygroundNodeData>[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<Node<PlaygroundNodeData>[]>>;
  setEntries: Dispatch<SetStateAction<ConsoleEntry[]>>;
  runners: NodeRunners;
}) {
  const {
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
  } = runners;

  const [isRunning, setIsRunning] = useState(false);
  // Which nodes' `run` reported an error on the run currently shown in the
  // output feed; render-only, cleared at the start of every run and reset.
  const [nodeErrors, setNodeErrors] = useState<Set<string>>(new Set());
  // The loop never branches on `kind`: every node contract in PLAYGROUND_NODE_DEFS
  // owns its own `run`, so a new node kind never touches this function.
  const handleRun = useCallback(async () => {
    stopRequestedRef.current = false;
    setStopRequested(false);
    setIsRunning(true);
    setNodeErrors(new Set());
    // Keyed by `nodeId::sourceHandle` (handle is '' for single-output nodes), rebuilt fresh
    // each run. Holds a table or plain text, whichever the upstream node actually produced.
    const nodeOutputs = new Map<string, PlaygroundTable | string>();
    const outKey = (nodeId: string, handle?: string | null) => `${nodeId}::${handle ?? ''}`;
    // Nodes wired to the branch of an If that didn't match: skipped outright,
    // not run with empty input, so "connect to No" actually means conditional.
    const skippedNodes = new Set<string>();
    const pushResult = (content: string, opts?: { raw?: boolean }) =>
      appendEntry({
        kind: 'chat-assistant',
        id: nextEntryId(),
        content,
        streaming: false,
        raw: opts?.raw,
      });
    const pushMedia = (
      mediaType: 'image' | 'audio' | 'video' | 'pdf' | 'zip',
      dataUrl: string,
      caption?: string,
    ) => appendEntry({ kind: 'media', id: nextEntryId(), mediaType, dataUrl, caption });
    try {
      for (const id of topoOrderIds(nodes, edges)) {
        if (stopRequestedRef.current) break;
        const node = nodes.find((n) => n.id === id);
        if (!node || node.data.kind === 'start') continue;
        const incomingEdge = mainInputEdge(id, edges);
        if (incomingEdge) {
          if (skippedNodes.has(incomingEdge.source)) {
            skippedNodes.add(id);
            continue;
          }
          if (incomingEdge.sourceHandle === 'true' || incomingEdge.sourceHandle === 'false') {
            const branchValue = nodeOutputs.get(
              outKey(incomingEdge.source, incomingEdge.sourceHandle),
            );
            const branchEmpty =
              branchValue === undefined ||
              (typeof branchValue === 'string'
                ? branchValue.length === 0
                : branchValue.rows.length === 0);
            if (branchEmpty) {
              skippedNodes.add(id);
              continue;
            }
          }
        }
        // Closes over this node's id so a failing `run` marks the node that
        // actually failed, not whichever one happens to run next.
        const pushRunLine = (status: 'ok' | 'err', line: string) => {
          setEntries((prev) => [
            ...prev,
            {
              kind: 'run',
              id: nextEntryId(),
              lines: [{ stream: status === 'err' ? 'stderr' : 'stdout', line }],
              status,
            },
          ]);
          if (status === 'err') setNodeErrors((prev) => new Set(prev).add(id));
        };
        const def = PLAYGROUND_NODE_DEFS[node.data.kind];
        if (!def?.run) {
          pushRunLine('ok', '[not wired up yet]');
          continue;
        }
        // Same pinned "Thinking…" bar a lesson check gets, not a blank
        // console; an empty line renders nothing of its own in the log.
        const runningEntryId = nextEntryId();
        setEntries((prev) => [
          ...prev,
          {
            kind: 'run',
            id: runningEntryId,
            lines: [{ stream: 'stdout', line: '' }],
            status: 'running',
          },
        ]);
        const readInput = () => {
          const edge = mainInputEdge(id, edges);
          return edge ? nodeOutputs.get(outKey(edge.source, edge.sourceHandle)) : undefined;
        };
        // A slot fed by a table or by a skipped branch keeps the design's own value.
        const readSlots = () => {
          const values: Record<string, string> = {};
          for (const e of edges) {
            const name = e.target === id ? slotFromHandle(e.targetHandle) : null;
            if (!name || skippedNodes.has(e.source)) continue;
            const value = nodeOutputs.get(outKey(e.source, e.sourceHandle));
            if (typeof value === 'string') values[name] = value;
          }
          return values;
        };
        // The explicit "Text source" choice, not a connection silently overriding what
        // was typed: undefined means "Upstream input" was picked but nothing usable is wired in.
        const resolveContent = (manualKey: string) => {
          const fields = node.data.fields;
          if ((fields.source ?? 'My input') !== 'Upstream input') return fields[manualKey] ?? '';
          const upstream = readInput();
          // An empty string counts as "nothing usable" too: an upstream If with zero
          // matching items still writes '', which otherwise sailed through as real
          // content and got sent to the model with nothing to actually act on.
          if (typeof upstream !== 'string' || upstream.trim().length === 0) return undefined;
          return upstream;
        };
        runningKindRef.current = node.data.kind;
        runningEntryIdRef.current = runningEntryId;
        const pushStageLine = (line: string) =>
          setEntries((prev) =>
            prev.map((e) => {
              if (e.id !== runningEntryId || e.kind !== 'run') return e;
              const lines = e.lines.length === 1 && e.lines[0].line === '' ? [] : e.lines.slice();
              lines.push({ stream: 'stderr', line });
              return { ...e, lines };
            }),
          );
        // The stage closes on the node's first visible output. A result is
        // pushed before run() returns, so waiting for that would print the ✓
        // underneath the very thing it announces.
        let activityStartedAt = 0;
        let activityOpen = false;
        // Hands the line back, so appendEntry can fold the close and the
        // result it precedes into one state update.
        const closeActivity = () => {
          if (!activityOpen || !def.activity) return null;
          activityOpen = false;
          closeActivityRef.current = null;
          // A streaming node closes its stage when the bubble appears, before
          // the text fills in, so the elapsed time here would read 0.0s and
          // claim work that has not happened. Under a tenth of a second, omit it.
          const elapsed = (Date.now() - activityStartedAt) / 1000;
          const took = elapsed >= 0.1 ? ` (${elapsed.toFixed(1)}s)` : '';
          return {
            entryId: runningEntryId,
            line: `  ✓ ${def.activity.done}${took}`,
            label: def.activity.doing,
          };
        };
        const runCtx: PlaygroundRunContext = {
          fields: node.data.fields,
          readInput,
          readSlots,
          resolveContent,
          pushResult,
          pushRunLine,
          runAgent: runAgentNode,
          translate: translateNode,
          confirm: confirmNode,
          search: searchDocumentsNode,
          setOutput: (value, handle) => nodeOutputs.set(outKey(id, handle), value),
          setField: (key, value) =>
            setNodes((nds) =>
              nds.map((n) =>
                n.id === id
                  ? { ...n, data: { ...n.data, fields: { ...n.data.fields, [key]: value } } }
                  : n,
              ),
            ),
          pushMedia,
          playAudio,
          ocr: ocrNode,
          classifyImage: classifyImageNode,
          textToSpeech: textToSpeechNode,
          speechToText: speechToTextNode,
          recordVoice: recordVoiceNode,
          voiceConversationTurns,
          ensureVoiceModelReady,
          ensureChatModelReady,
          generateImage: generateImageNode,
          generateVideo: generateVideoNode,
          generateMusic: generateMusicNode,
          stopRequested: () => stopRequestedRef.current,
        };
        try {
          // Always awaited before run(), for every node kind: a node needing
          // more than one model declares preload, so no visible work starts
          // while a later model is still downloading. Opening the stage after
          // it keeps a model's own loading lines above this node's work.
          if (def.preload) await def.preload(runCtx);
          if (def.activity && !stopRequestedRef.current) {
            activityStartedAt = Date.now();
            activityOpen = true;
            closeActivityRef.current = closeActivity;
            pushStageLine(`→ ${def.activity.doing}...`);
          }
          if (!stopRequestedRef.current) await def.run(runCtx);
          // Still open when a node finished without showing anything.
          if (!stopRequestedRef.current) {
            const closing = closeActivity();
            if (closing) pushStageLine(closing.line);
          }
          closeActivityRef.current = null;
        } catch (err) {
          // A handler that throws instead of reporting through pushRunLine (an
          // unexpected exception, not a modeled "nothing connected" case) still
          // has to mark its node and keep the run going for whatever's left.
          pushRunLine('err', err instanceof Error ? err.message : 'This step failed.');
        } finally {
          runningKindRef.current = null;
          runningEntryIdRef.current = null;
          const stopped = stopRequestedRef.current;
          setEntries((prev) => {
            const entry = prev.find((e) => e.id === runningEntryId);
            // A node still holding its empty placeholder gets dropped, but one
            // a model-status update filled with a real load trace survives
            // teardown of the "running" placeholder.
            if (entry?.kind === 'run' && entry.lines.length === 1 && entry.lines[0].line === '') {
              return prev.filter((e) => e.id !== runningEntryId);
            }
            return prev.map((e) =>
              e.id === runningEntryId && e.kind === 'run'
                ? { ...e, status: stopped ? 'stopped' : 'ok' }
                : e,
            );
          });
        }
      }
    } finally {
      setIsRunning(false);
      setStopRequested(false);
      stopRequestedRef.current = false;
    }
  }, [
    nodes,
    edges,
    runAgentNode,
    translateNode,
    confirmNode,
    searchDocumentsNode,
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
    setNodes,
  ]);

  // Read inside the interval tick below instead of closing over `isRunning`
  // directly, so a long run in progress doesn't get a second one stacked on top.
  const isRunningRef = useRef(false);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);
  // Stops the queue between nodes; the in-flight agent call itself only stops
  // early when the desktop bridge can actually abort it.
  const handleStop = useCallback(() => {
    if (!isRunning || stopRequestedRef.current) return;
    stopRequestedRef.current = true;
    setStopRequested(true);
    replyAudioRef.current?.pause();
    setReplyClip(null);
    const requestId = pendingRequestIdRef.current;
    if (requestId) void window.academy?.chat?.stop?.(requestId).catch(() => undefined);
    const voiceRequestId = pendingVoiceRequestIdRef.current;
    if (voiceRequestId) void window.academy?.voice?.stop?.(voiceRequestId).catch(() => undefined);
    const voiceConversationId = pendingVoiceConversationIdRef.current;
    if (voiceConversationId)
      void window.academy?.voice?.stopConversation?.(voiceConversationId).catch(() => undefined);
    void window.academy?.cancelGenerateImage?.().catch(() => undefined);
    void window.academy?.cancelGenerateVideo?.().catch(() => undefined);
    void window.academy?.cancelGenerateMusic?.().catch(() => undefined);
    if (runningKindRef.current && UNCANCELABLE_KINDS.has(runningKindRef.current)) {
      setEntries((prev) => [
        ...prev,
        {
          kind: 'run',
          id: nextEntryId(),
          lines: [
            {
              stream: 'stdout',
              line: "This step can't be interrupted mid-run; it'll stop right after it finishes.",
            },
          ],
          status: 'ok',
        },
      ]);
    }
    if (confirmResolversRef.current.size > 0) {
      const pendingIds = new Set(confirmResolversRef.current.keys());
      for (const resolve of confirmResolversRef.current.values()) resolve(false);
      confirmResolversRef.current.clear();
      setEntries((prev) =>
        prev.map((e) =>
          e.kind === 'confirm' && pendingIds.has(e.id) ? { ...e, answer: 'no' } : e,
        ),
      );
    }
  }, [isRunning]);

  return {
    setNodeErrors,
    nodeErrors,
    isRunning,
    handleStop,
    handleRun,
  };
}
