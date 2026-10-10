import { catalogStorage, isCatalogDiskLowError } from '@academy/core';
import {
  type Node,
  type Edge,
  useReactFlow,
} from '@xyflow/react';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { type ConsoleEntry } from '../lesson/console-types.js';
import { generateStandaloneScript } from './lib/codegen.js';
import { downloadBlob, slugFilename } from './lib/export.js';
import { type PresetEntry, loadPresetWorkflow } from './lib/preset-data.js';
import { workflowPreview, ipcErrorMessage } from './lib/library.js';
import { summarizeCurrentWorkflow, buildNodeCatalogue, parseGeneratedWorkflow } from './lib/generate.js';
import { PLAYGROUND_NODE_DEFS } from './flow/node-defs.js';
import type { PlaygroundNodeData } from './flow/types.js';
import {
  type SavedWorkflow,
  canPickFiles,
  downloadWorkflow,
  pickSaveHandle,
  writeWorkflowToHandle,
  parseWorkflowFile,
  pickOpenHandle,
} from './flow/workflow.js';
import {
  initialGraph,
  nextEntryId,
  nextId,
} from './flow/graph.js';
import '../../lib/academy.js';


import { held } from './held-state.js';
import type { NodeRunners } from './use-node-runners.js';
import { FIT_VIEW_DELAY_MS, FIT_VIEW_OPTIONS } from './lib/fit-view.js';
import { FEEDBACK_MS, NOTICE_MS } from '../../lib/timings.js';

/** Saving, opening, exporting and resetting a workflow, the library and presets, and the
 *  generated workflow a chat message can ask for. */
export function useWorkflowFiles({
  nodes,
  edges,
  entries,
  workflowName,
  setNodes,
  setEdges,
  setSelectedId,
  setEntries,
  setNodeErrors,
  setWorkflowName,
  presetNodeIdsRef,
  centerOnStart,
  setRejectMessage,
  setAssistantEntry,
  fitView,
}: {
  nodes: Node<PlaygroundNodeData>[];
  edges: Edge[];
  entries: ConsoleEntry[];
  workflowName: string;
  setNodes: Dispatch<SetStateAction<Node<PlaygroundNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setEntries: Dispatch<SetStateAction<ConsoleEntry[]>>;
  setNodeErrors: Dispatch<SetStateAction<Set<string>>>;
  setWorkflowName: (value: string | ((prev: string) => string)) => void;
  presetNodeIdsRef: RefObject<Set<string>>;
  centerOnStart: (duration?: number) => Promise<boolean>;
  setRejectMessage: Dispatch<SetStateAction<string | null>>;
  setAssistantEntry: NodeRunners['setAssistantEntry'];
  fitView: ReturnType<typeof useReactFlow>['fitView'];
}) {
  // The file this workflow was last opened from or saved to, if the browser
  // supports keeping one: lets Save write back to it directly, no picker, the
  // same "Ctrl+S just saves" behavior every other app has.
  const fileHandleRef = useRef<FileSystemFileHandle | null>(held.current?.fileHandle ?? null);
  // The library entry this workflow was opened from or saved to; the desktop
  // app's Save writes back to it, the web build falls back to files.
  const libraryIdRef = useRef<string | null>(held.current?.libraryId ?? null);
  const [libraryAvailable, setLibraryAvailable] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  useEffect(() => setLibraryAvailable(catalogStorage.available()), []);

  // Keeps the held state current every render so it's there to read from if this
  // component unmounts (navigating away) and remounts (navigating back).
  useEffect(() => {
    held.current = {
      nodes,
      edges,
      entries,
      workflowName,
      fileHandle: fileHandleRef.current,
      libraryId: libraryIdRef.current,
    };
  });

  const handleReset = useCallback(() => {
    const fresh = initialGraph();
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setSelectedId(null);
    setEntries([]);
    setNodeErrors(new Set());
    setWorkflowName('My Workflow');
    presetNodeIdsRef.current = new Set();
    fileHandleRef.current = null;
    libraryIdRef.current = null;
    centerOnStart(200);
  }, [setNodes, setEdges, centerOnStart]);

  const buildWorkflow = useCallback(
    (): SavedWorkflow => ({
      version: 1,
      name: workflowName,
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: n.data.kind,
        x: n.position.x,
        y: n.position.y,
        fields: n.data.fields,
      })),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })),
    }),
    [nodes, edges, workflowName],
  );

  const handleExportCode = useCallback(async () => {
    const script = await generateStandaloneScript(buildWorkflow());
    downloadBlob(
      new Blob([script], { type: 'text/javascript' }),
      slugFilename(workflowName, 'cjs'),
    );
  }, [buildWorkflow, workflowName]);

  const flashNotice = useCallback((message: string) => {
    setSavedNotice(message);
    window.setTimeout(() => setSavedNotice(null), FEEDBACK_MS);
  }, []);

  const showReject = useCallback((message: string) => {
    setRejectMessage(message);
    window.setTimeout(() => setRejectMessage(null), NOTICE_MS);
  }, []);

  // `built` lets a caller hand in a workflow with edits the node state hasn't caught up with yet.
  const saveToLibrary = useCallback(
    async (asCopy: boolean, built?: SavedWorkflow, quiet = false): Promise<boolean> => {
      const name = asCopy ? `${workflowName} (copy)` : workflowName;
      const workflow = { ...(built ?? buildWorkflow()), name };
      const id = (!asCopy && libraryIdRef.current) || crypto.randomUUID();
      try {
        await catalogStorage.save('pg-workflows', id, name, workflow, workflowPreview(workflow));
      } catch (err) {
        showReject(
          isCatalogDiskLowError(err)
            ? 'Not enough disk space to save. Free some space and try again.'
            : `Couldn't save to the library: ${ipcErrorMessage(err)}`,
        );
        return false;
      }
      libraryIdRef.current = id;
      if (asCopy) setWorkflowName(name);
      if (!quiet) flashNotice(asCopy ? 'Saved a copy to the library' : 'Saved to library');
      return true;
    },
    [buildWorkflow, workflowName, setWorkflowName, flashNotice, showReject],
  );

  const handleExportWorkflow = useCallback(async () => {
    const workflow = buildWorkflow();
    if (!canPickFiles()) return downloadWorkflow(workflow);
    const handle = await pickSaveHandle(`${workflow.name || 'workflow'}.json`);
    if (handle) await writeWorkflowToHandle(handle, workflow);
  }, [buildWorkflow]);

  // `quiet` leaves the confirmation to the caller.
  const handleSaveWorkflow = useCallback(
    async (built?: SavedWorkflow, quiet = false): Promise<boolean> => {
      if (libraryAvailable) return saveToLibrary(false, built, quiet);
      const workflow = built ?? buildWorkflow();
      if (!canPickFiles()) {
        downloadWorkflow(workflow);
        return true;
      }
      if (!fileHandleRef.current) {
        const handle = await pickSaveHandle(`${workflow.name || 'workflow'}.json`);
        if (!handle) return false; // user cancelled the picker
        fileHandleRef.current = handle;
      }
      await writeWorkflowToHandle(fileHandleRef.current, workflow);
      return true;
    },
    [buildWorkflow, libraryAvailable, saveToLibrary],
  );

  // Loaded nodes get fresh ids through the same nextId() every other node uses,
  // never the saved ones directly: those came from a different session's counter
  // and could collide with whatever's minted next in this one.
  const applyLoadedWorkflow = useCallback(
    (
      workflow: ReturnType<typeof parseWorkflowFile>,
      options?: { keepConsole?: boolean; isPreset?: boolean },
    ) => {
      const idMap = new Map(workflow.nodes.map((n) => [n.id, nextId()]));
      setNodes(
        workflow.nodes.map((n) => ({
          id: idMap.get(n.id) ?? n.id,
          type: 'playgroundNode',
          position: { x: n.x, y: n.y },
          // A workflow saved before a field existed on this kind won't have
          // it in `n.fields`; back-filling with the kind's current default
          // keeps an old preset's select from landing on a blank value.
          data: {
            kind: n.kind,
            fields: { ...(PLAYGROUND_NODE_DEFS[n.kind]?.defaultFields?.() ?? {}), ...n.fields },
          },
        })),
      );
      setEdges(
        workflow.edges
          .filter((e) => idMap.has(e.source) && idMap.has(e.target))
          .map((e) => ({
            id: nextId(),
            source: idMap.get(e.source) ?? '',
            target: idMap.get(e.target) ?? '',
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          })),
      );
      setWorkflowName(workflow.name);
      setSelectedId(null);
      // A generated workflow's own console entries (the prompt, "Built...")
      // are worth keeping so the user can see which request produced it.
      if (!options?.keepConsole) setEntries([]);
      setNodeErrors(new Set());
      presetNodeIdsRef.current = options?.isPreset ? new Set(idMap.values()) : new Set();
      centerOnStart(0);
    },
    [setNodes, setEdges, centerOnStart],
  );

  // Reuses applyLoadedWorkflow, the same "replace the whole canvas" path a
  // file open or a preset already goes through: nothing about landing a
  // workflow on the canvas is new here, only where it comes from.
  const handleGenerateWorkflow = useCallback(
    async (prompt: string) => {
      const entryId = nextEntryId();
      setEntries((prev) => [
        ...prev,
        { kind: 'chat-user', id: nextEntryId(), content: prompt },
        {
          kind: 'chat-assistant',
          id: entryId,
          content: 'Building your workflow…',
          streaming: true,
        },
      ]);
      if (typeof window.academy?.workflow?.generate !== 'function') {
        setAssistantEntry(entryId, (e) => ({
          ...e,
          content: 'Building a workflow from a prompt is only available in the desktop app.',
          streaming: false,
        }));
        return;
      }
      // Only sent when the canvas already has real content: an empty "just
      // start" graph is nothing worth describing, and omitting it keeps a
      // genuinely fresh request from being second-guessed against it.
      const existing = buildWorkflow();
      const currentWorkflow =
        existing.nodes.length > 1 ? summarizeCurrentWorkflow(existing) : undefined;
      const tryGenerate = async () => {
        const { text } = await window.academy!.workflow!.generate(
          prompt,
          buildNodeCatalogue(),
          currentWorkflow,
        );
        return parseGeneratedWorkflow(text);
      };
      try {
        // A small local model occasionally emits a syntax slip (a missing
        // brace, a stray comma); one retry costs a few seconds and clears
        // most of those without bothering the user to re-type the request.
        let workflow;
        try {
          workflow = await tryGenerate();
        } catch {
          setAssistantEntry(entryId, (e) => ({
            ...e,
            content: 'That attempt had a glitch, trying once more…',
          }));
          workflow = await tryGenerate();
        }
        applyLoadedWorkflow(workflow, { keepConsole: true });
        window.setTimeout(() => fitView(FIT_VIEW_OPTIONS), FIT_VIEW_DELAY_MS);
        setAssistantEntry(entryId, (e) => ({
          ...e,
          content: `Built "${workflow.name}" with ${workflow.nodes.length} node(s). Review it, then Save when it looks right.`,
          streaming: false,
        }));
      } catch (err) {
        setAssistantEntry(entryId, (e) => ({
          ...e,
          content:
            err instanceof Error
              ? err.message
              : "Couldn't build that workflow. Try rephrasing the request.",
          streaming: false,
        }));
      }
    },
    [applyLoadedWorkflow, setAssistantEntry, fitView, buildWorkflow],
  );

  const handleLoadWorkflowFile = useCallback(
    async (file: File) => {
      try {
        // Cleared, not carried over: a stale handle from whatever was open before
        // would otherwise let Ctrl+S silently overwrite the wrong file.
        fileHandleRef.current = null;
        libraryIdRef.current = null;
        applyLoadedWorkflow(parseWorkflowFile(await file.text()));
      } catch (err) {
        setRejectMessage(err instanceof Error ? err.message : 'Could not read that file.');
        window.setTimeout(() => setRejectMessage(null), NOTICE_MS);
      }
    },
    [applyLoadedWorkflow],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportWorkflow = useCallback(async () => {
    if (!canPickFiles()) {
      fileInputRef.current?.click();
      return;
    }
    const handle = await pickOpenHandle();
    if (!handle) return; // user cancelled the picker
    await handleLoadWorkflowFile(await handle.getFile());
    // In the desktop app Save goes to the library, so the file stays untouched.
    if (!libraryAvailable) fileHandleRef.current = handle;
  }, [handleLoadWorkflowFile, libraryAvailable]);

  const handleOpenWorkflow = useCallback(async () => {
    if (libraryAvailable) setShowLibrary(true);
    else await handleImportWorkflow();
  }, [libraryAvailable, handleImportWorkflow]);

  const [showPresets, setShowPresets] = useState(false);
  const handleLoadPreset = useCallback(
    async (entry: PresetEntry) => {
      fileHandleRef.current = null;
      libraryIdRef.current = null;
      // The card carries no workflow, so fetching it here downloads only the
      // preset the user actually picked.
      applyLoadedWorkflow(await loadPresetWorkflow(entry.file), { isPreset: true });
      setShowPresets(false);
    },
    [applyLoadedWorkflow],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        void (e.shiftKey && libraryAvailable ? saveToLibrary(true) : handleSaveWorkflow());
      } else if (key === 'o' && libraryAvailable) {
        e.preventDefault();
        setShowLibrary(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveWorkflow, saveToLibrary, libraryAvailable]);

  return {
    libraryAvailable,
    saveToLibrary,
    setShowLibrary,
    handleSaveWorkflow,
    handleOpenWorkflow,
    handleImportWorkflow,
    handleExportWorkflow,
    handleReset,
    handleExportCode,
    setShowPresets,
    fileInputRef,
    handleLoadWorkflowFile,
    buildWorkflow,
    savedNotice,
    showPresets,
    handleLoadPreset,
    showLibrary,
    libraryIdRef,
    fileHandleRef,
    applyLoadedWorkflow,
  };
}
