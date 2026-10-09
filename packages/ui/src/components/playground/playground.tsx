'use client';
import {
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type OnConnect,
  addEdge,
  ReactFlow,
  Background,
  ReactFlowProvider,
} from '@xyflow/react';
import {
  Save,
  Copy,
  Library,
  Pencil,
  FolderOpen,
  FileUp,
  FileDown,
  RotateCcw,
  Download,
  FileCode,
  ChevronDown,
  Loader2,
  Square,
  Play,
  Eraser,
  Sparkles,
  GripVertical,
} from 'lucide-react';
import { type ReactNode, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { type ConsoleEntry } from '../lesson/console-types.js';
import { normalizeRawTableRows } from '../lesson/console-markdown.js';
import { parseLayout, type ICLayout, pickPartner } from '../design/render/layout.js';
import { logoColor } from '../design/brand/logo-color.js';
import { DesignStudio } from '../design/studio/studio.js';
import { PlaygroundConfigPopup } from './config-popup.js';
import { PlaygroundConsole } from './console.js';
import { type ExportFormat, buildConversationMarkdown } from './lib/export.js';
import { PlaygroundExportPopup } from './export-popup.js';
import { PlaygroundFlowEdge } from './flow/flow-edge.js';
import { PlaygroundPresetsModal } from './presets-modal.js';
import { slotFromHandle, setSlotDefault } from '../design/render/slots.js';
import { PlaygroundLibraryModal } from './library-modal.js';
import { PlaygroundFlowNode } from './flow/flow-node.js';
import { PLAYGROUND_NODE_DEFS, typesCompatible, BRANCH_COLOR, PORT_COLOR } from './flow/node-defs.js';
import { PLAYGROUND_DRAG_MIME, PlaygroundPalette } from './palette.js';
import type { PlaygroundNodeData } from './flow/types.js';
import { IconButton } from '../ui/icon-button.js';
import { useOutsidePress } from '../../hooks/use-outside-press.js';
import {
  INITIAL_GRAPH,
  inputKindFor,
  makeNode,
  nextId,
  withNodePrompt,
} from './flow/graph.js';
import '@xyflow/react/dist/style.css';
import '../../lib/academy.js';

const NODE_TYPES = { playgroundNode: PlaygroundFlowNode };

const EDGE_TYPES = { playgroundEdge: PlaygroundFlowEdge };

// The start node's flow position (see initialGraph) plus half its own size.
const START_NODE_CENTER = { x: 130 + 24, y: 20 + 24 };

const VIEWPORT_ZOOM = 0.85;

// setCenter puts this point in the exact middle of the pane; targeting a point
// below the node keeps it horizontally centered but pushes it up into the
// canvas's upper portion instead of dead center.
const VIEWPORT_FOCUS = { x: START_NODE_CENTER.x, y: START_NODE_CENTER.y + 220 };

const DEFAULT_PANEL_WIDTH = 410;

// The drag handle's own w-3 (12px); reserved so it (and a sliver of the
// canvas) never gets shoved out of the row by the panel claiming its width too.
const RESIZE_HANDLE_WIDTH = 12;

const EXPORT_FORMATS: ExportFormat[] = ['pdf', 'markdown', 'txt', 'csv', 'docx', 'xlsx'];


import { held } from './held-state.js';
import { useNodeRunners } from './use-node-runners.js';
import { useWorkflowFiles } from './use-workflow-files.js';
import { useWorkflowRun } from './use-workflow-run.js';
import { FIT_VIEW_DELAY_MS, FIT_VIEW_OPTIONS } from './lib/fit-view.js';
import { NOTICE_MS } from '../../lib/timings.js';

function PlaygroundCanvas({
  workflowName,
  setWorkflowName,
  setEditingName,
  bar,
  nameField,
}: {
  workflowName: string;
  setWorkflowName: (value: string | ((prev: string) => string)) => void;
  setEditingName: (value: boolean) => void;
  /** Where in the page's header bar the toolbar is drawn. */
  bar: HTMLElement | null;
  /** The field the name is typed into while it is being renamed. It stands in for the menu. */
  nameField: ReactNode | null;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PlaygroundNodeData>>(
    held.current?.nodes ?? INITIAL_GRAPH.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    held.current?.edges ?? INITIAL_GRAPH.edges,
  );
  const [entries, setEntries] = useState<ConsoleEntry[]>(held.current?.entries ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Owned here so clicks inside the studio cannot close it.
  const [studioNodeId, setStudioNodeId] = useState<string | null>(null);
  // Bundled samples only make sense for a node that came in with a preset;
  // a node dragged in afterward only ever offers "Your file". Per-node, so
  // loading one preset doesn't leak samples onto everything added later.
  const presetNodeIdsRef = useRef<Set<string>>(new Set());
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const [exportRequest, setExportRequest] = useState<{
    title: string;
    markdown: string;
    formats: ExportFormat[];
    defaultName: string;
  } | null>(null);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  // Capture phase: the React Flow canvas stops propagation on its own pane
  // clicks, so a bubble-phase listener never sees a click on the canvas.
  useOutsidePress(fileMenuRef, () => setShowFileMenu(false), { active: showFileMenu, capture: true });
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, setCenter, fitView } = useReactFlow();
  const centerOnStart = useCallback(
    (duration?: number) =>
      setCenter(VIEWPORT_FOCUS.x, VIEWPORT_FOCUS.y, { zoom: VIEWPORT_ZOOM, duration }),
    [setCenter],
  );

  // Current width is the floor: dragging left only ever grows it back to here.
  useEffect(() => {
    if (!isResizingPanel) return;
    const onMove = (e: PointerEvent) => {
      const rect = rowRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = rect.right - e.clientX;
      setPanelWidth(Math.min(rect.width - RESIZE_HANDLE_WIDTH, Math.max(0, next)));
    };
    const onUp = () => setIsResizingPanel(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isResizingPanel]);

  const isValidConnection = useCallback(
    (conn: Connection | Edge) => {
      const source = nodes.find((n) => n.id === conn.source);
      const target = nodes.find((n) => n.id === conn.target);
      if (!source || !target) return false;
      const outType = PLAYGROUND_NODE_DEFS[source.data.kind]?.output;
      const inType = slotFromHandle(conn.targetHandle)
        ? 'value'
        : PLAYGROUND_NODE_DEFS[target.data.kind]?.input;
      const ok = typesCompatible(outType, inType);
      if (!ok) {
        setRejectMessage(
          `Doesn't fit: "${PLAYGROUND_NODE_DEFS[source.data.kind]?.label}" doesn't plug into "${PLAYGROUND_NODE_DEFS[target.data.kind]?.label}".`,
        );
        window.setTimeout(() => setRejectMessage(null), NOTICE_MS);
      }
      return ok;
    },
    [nodes],
  );

  // A slot takes one value, so a new wire into it replaces the old one.
  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge(
          connection,
          slotFromHandle(connection.targetHandle)
            ? eds.filter(
                (e) =>
                  !(e.target === connection.target && e.targetHandle === connection.targetHandle),
              )
            : eds,
        ),
      ),
    [setEdges],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(PLAYGROUND_DRAG_MIME);
      if (!kind || !PLAYGROUND_NODE_DEFS[kind] || PLAYGROUND_NODE_DEFS[kind].inactive) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const node = makeNode(kind, position.x - 100, position.y - 30);
      setNodes((nds) => [...nds, node]);
      setSelectedId(node.id);
    },
    [screenToFlowPosition, setNodes],
  );

  const runners = useNodeRunners(setEntries);
  const {
    replyAudioRef,
    setAssistantEntry,
    stopRequested,
    handleConfirmAnswer,
    replyClip,
  } = runners;

  const {
    setNodeErrors,
    nodeErrors,
    isRunning,
    handleStop,
    handleRun,
  } = useWorkflowRun({ nodes, edges, setNodes, setEntries, runners });

  const {
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
    commitStudioLayout,
    buildWorkflow,
    savedNotice,
    showPresets,
    handleLoadPreset,
    showLibrary,
    libraryIdRef,
    fileHandleRef,
    applyLoadedWorkflow,
  } = useWorkflowFiles({
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
  });

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const studioNode = nodes.find((n) => n.id === studioNodeId) ?? null;
  const anchorEl = selectedId
    ? (wrapperRef.current?.querySelector<HTMLElement>(`[data-id="${selectedId}"]`) ?? null)
    : null;
  // What's actually feeding the selected node, so its popup can hide fields
  // (like If's "Column") that only make sense for a particular input shape.
  const selectedInputKind = selectedNode ? inputKindFor(selectedNode.id, nodes, edges) : null;

  const conversationMarkdown = buildConversationMarkdown(entries);
  // Gated on a reply or a run actually having something to show, not just a
  // sent question: entries.length alone goes up the instant a message is sent,
  // before the model has said anything back.
  const hasExportableOutput = entries.some(
    (e) =>
      (e.kind === 'chat-assistant' && e.content.trim().length > 0) ||
      (e.kind === 'run' && e.lines.some((l) => l.line.trim().length > 0)) ||
      e.kind === 'media',
  );

  // `hasError` is render-only (never saved with the workflow); only the errored
  // nodes get a new object, so the rest of the canvas doesn't re-render.
  const nodesForRender = useMemo(
    () =>
      nodeErrors.size === 0
        ? nodes
        : nodes.map((n) =>
            nodeErrors.has(n.id) ? { ...n, data: { ...n.data, hasError: true } } : n,
          ),
    [nodes, nodeErrors],
  );

  // Splits `edgeId` into source -> newNode -> target, dropping the old edge.
  // The new node lands at the midpoint between the two it now sits between.
  const handleInsertNode = useCallback(
    (edgeId: string, kind: string) => {
      const edge = edges.find((e) => e.id === edgeId);
      const def = PLAYGROUND_NODE_DEFS[kind];
      if (!edge || !def) return;
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) return;
      const newId = nextId();
      setNodes((prev) => [
        ...prev,
        {
          id: newId,
          type: 'playgroundNode',
          position: {
            x: (sourceNode.position.x + targetNode.position.x) / 2,
            y: (sourceNode.position.y + targetNode.position.y) / 2,
          },
          data: { kind, fields: def.defaultFields() },
        },
      ]);
      setEdges((prev) => [
        ...prev.filter((e) => e.id !== edgeId),
        {
          id: nextId(),
          source: edge.source,
          target: newId,
          sourceHandle: edge.sourceHandle,
          targetHandle: null,
        },
        {
          id: nextId(),
          source: newId,
          target: edge.target,
          sourceHandle: null,
          targetHandle: edge.targetHandle,
        },
      ]);
    },
    [edges, nodes, setNodes, setEdges],
  );
  // A wire is colored by what's actually flowing through it: the branch
  // color for If's Yes/No, otherwise the source node's declared output type.
  const edgesForRender = useMemo(
    () =>
      edges.map((e) => {
        const branch =
          e.sourceHandle === 'true' || e.sourceHandle === 'false' ? e.sourceHandle : null;
        const outputType =
          PLAYGROUND_NODE_DEFS[nodes.find((n) => n.id === e.source)?.data.kind ?? '']?.output;
        const targetType =
          PLAYGROUND_NODE_DEFS[nodes.find((n) => n.id === e.target)?.data.kind ?? '']?.input ??
          null;
        const dataType = branch ? 'bool' : (outputType ?? 'any');
        const color = branch
          ? BRANCH_COLOR[branch]
          : (outputType && PORT_COLOR[outputType]) || PORT_COLOR.flow;
        return {
          ...e,
          type: 'playgroundEdge',
          style: { stroke: color },
          data: { dataType, targetType, onInsert: handleInsertNode },
        };
      }),
    [edges, nodes, handleInsertNode],
  );
  const fileMenuGroups = useMemo(
    () => [
      {
        color: 'var(--color-port-table)',
        items: libraryAvailable
          ? [
              {
                label: 'Save',
                shortcut: '⌘S',
                icon: Save,
                disabled: isRunning,
                onSelect: () => void saveToLibrary(false),
              },
              {
                label: 'Save as copy',
                shortcut: '⇧⌘S',
                icon: Copy,
                disabled: isRunning,
                onSelect: () => void saveToLibrary(true),
              },
              {
                label: 'Open from library',
                shortcut: '⌘O',
                icon: Library,
                disabled: isRunning,
                onSelect: () => setShowLibrary(true),
              },
              {
                label: 'Rename',
                icon: Pencil,
                disabled: false,
                onSelect: () => setEditingName(true),
              },
            ]
          : [
              {
                label: 'Save',
                shortcut: '⌘S',
                icon: Save,
                disabled: isRunning,
                onSelect: () => void handleSaveWorkflow(),
              },
              {
                label: 'Open',
                icon: FolderOpen,
                disabled: isRunning,
                onSelect: () => void handleOpenWorkflow(),
              },
              {
                label: 'Rename',
                icon: Pencil,
                disabled: false,
                onSelect: () => setEditingName(true),
              },
            ],
      },
      ...(libraryAvailable
        ? [
            {
              color: 'var(--color-kind-transfer)',
              items: [
                {
                  label: 'Import .json',
                  icon: FileUp,
                  disabled: isRunning,
                  onSelect: () => void handleImportWorkflow(),
                },
                {
                  label: 'Export .json',
                  icon: FileDown,
                  disabled: isRunning,
                  onSelect: () => void handleExportWorkflow(),
                },
              ],
            },
          ]
        : []),
      {
        color: 'var(--color-port-bool)',
        items: [
          { label: 'Reset workflow', icon: RotateCcw, disabled: isRunning, onSelect: handleReset },
          ...(hasExportableOutput
            ? [
                {
                  label: 'Export data',
                  icon: Download,
                  disabled: isRunning,
                  onSelect: () =>
                    setExportRequest({
                      title: 'Export conversation',
                      markdown: conversationMarkdown,
                      formats: EXPORT_FORMATS,
                      defaultName: workflowName,
                    }),
                },
              ]
            : []),
          {
            label: 'Export as project',
            icon: FileCode,
            disabled: isRunning,
            onSelect: () => void handleExportCode(),
          },
        ],
      },
    ],
    [
      isRunning,
      libraryAvailable,
      saveToLibrary,
      handleImportWorkflow,
      handleExportWorkflow,
      handleSaveWorkflow,
      handleOpenWorkflow,
      handleReset,
      hasExportableOutput,
      conversationMarkdown,
      workflowName,
      handleExportCode,
    ],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {/* The toolbar is drawn in the page's header bar, which lies outside this component. */}
      {bar &&
        createPortal(
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <div className="relative shrink-0" ref={fileMenuRef}>
            {/* The workflow's name is the menu: nothing follows it, so its length moves nothing. */}
            {nameField ?? (
              <button
                type="button"
                onClick={() => setShowFileMenu((prev) => !prev)}
                onDoubleClick={() => {
                  setShowFileMenu(false);
                  setEditingName(true);
                }}
                className={`inline-flex max-w-72 items-center gap-1 rounded-md px-1.5 py-1 text-label text-canvas-muted-foreground outline-none transition-colors hover:bg-canvas hover:text-canvas-foreground focus-visible:ring-1 focus-visible:ring-primary/30 ${showFileMenu ? 'bg-canvas text-canvas-foreground' : ''}`}
                title="File"
                aria-label="File menu"
              >
                <span className="truncate">{workflowName}</span>
                <ChevronDown
                  className={`size-3 shrink-0 transition-transform ${showFileMenu ? 'rotate-180' : ''}`}
                />
              </button>
            )}
            {showFileMenu && (
              <div className="absolute left-0 top-full z-10 mt-1 w-60 rounded-md border border-canvas-border bg-canvas p-1.5 shadow-lg">
                {fileMenuGroups.map((group, groupIndex) => (
                  <div key={group.items.map((item) => item.label).join('|')}>
                    {groupIndex > 0 && <div className="my-1.5 h-px bg-canvas-border" />}
                    {group.items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setShowFileMenu(false);
                          item.onSelect();
                        }}
                        disabled={item.disabled}
                        className="flex w-full items-center gap-2.5 rounded px-1.5 py-1.5 text-left text-xs text-canvas-foreground hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-md"
                          style={{
                            color: group.color,
                            backgroundColor: `color-mix(in oklab, ${group.color} 16%, var(--color-canvas-muted))`,
                          }}
                        >
                          <item.icon className="size-3.5" />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && (
                          <span className="text-micro text-canvas-muted-foreground">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1 text-canvas-muted-foreground sm:gap-2">
          <button
            type="button"
            onClick={isRunning ? handleStop : handleRun}
            disabled={isRunning && stopRequested}
            className={
              isRunning
                ? stopRequested
                  ? 'inline-flex shrink-0 items-center gap-1.5 rounded-md bg-canvas-muted px-2.5 py-1 text-xs font-semibold text-canvas-muted-foreground disabled:cursor-not-allowed disabled:opacity-60'
                  : 'inline-flex shrink-0 items-center justify-center rounded p-1.5 text-danger transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40'
                : 'inline-flex shrink-0 items-center justify-center rounded p-1.5 text-canvas-muted-foreground transition-colors hover:bg-canvas-muted hover:text-canvas-foreground disabled:cursor-not-allowed disabled:opacity-40'
            }
            title={stopRequested ? 'Stopping…' : isRunning ? 'Stop run' : 'Run'}
            aria-label={stopRequested ? 'Stopping' : isRunning ? 'Stop run' : 'Run'}
          >
            {isRunning ? (
              stopRequested ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Stopping…</span>
                </>
              ) : (
                <Square className="size-4 fill-current" />
              )
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </button>
          <IconButton
            look="toolbar"
            onClick={handleReset}
            disabled={isRunning}
            title="Reset playground"
            aria-label="Reset playground"
          >
            <RotateCcw className="size-4" />
          </IconButton>
          <IconButton
            look="toolbar"
            onClick={() => setEntries([])}
            disabled={entries.length === 0 || isRunning}
            title="Clear output"
            aria-label="Clear output"
          >
            <Eraser className="size-4" />
          </IconButton>
          <IconButton
            look="toolbar"
            onClick={() => setShowPresets(true)}
            disabled={isRunning}
            title="Presets"
            aria-label="Presets"
          >
            <Sparkles className="size-4" />
          </IconButton>
          {/* Fallback only: used when the File System Access API isn't available.
           *  Extension-based accept, not a MIME type, which some OS file dialogs
           *  don't reliably match against an actual .json file's reported type. */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleLoadWorkflowFile(file);
            }}
          />
        </div>
      </div>,
          bar,
        )}

      <div ref={rowRef} className="flex min-h-0 flex-1">
        <div ref={wrapperRef} className="relative h-full min-w-0 flex-1">
          <ReactFlow
            nodes={nodesForRender}
            edges={edgesForRender}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onNodeDoubleClick={(_, node) => {
              if (node.data.kind === 'image-constructor') setStudioNodeId(node.id);
            }}
            onPaneClick={() => setSelectedId(null)}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onInit={() => centerOnStart()}
          >
            <Background gap={22} color="var(--color-flow-grid)" />
          </ReactFlow>

          {selectedNode && anchorEl && (
            <PlaygroundConfigPopup
              nodeId={selectedNode.id}
              kind={selectedNode.data.kind}
              fields={selectedNode.data.fields}
              anchorEl={anchorEl}
              inputKind={selectedInputKind}
              isPreset={presetNodeIdsRef.current.has(selectedNode.id)}
              onChange={(key, value) =>
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === selectedNode.id
                      ? { ...n, data: { ...n.data, fields: { ...n.data.fields, [key]: value } } }
                      : n,
                  ),
                )
              }
              onDelete={() => {
                setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                setEdges((eds) =>
                  eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
                );
                setSelectedId(null);
              }}
              onClose={() => setSelectedId(null)}
              onOpenStudio={() => {
                setStudioNodeId(selectedNode.id);
                setSelectedId(null);
              }}
              onLayoutChange={(update) =>
                setNodes((nds) =>
                  nds.map((n) => {
                    const layout =
                      n.id === selectedNode.id ? parseLayout(n.data.fields.layout) : null;
                    if (!layout) return n;
                    const next = JSON.stringify(update(layout));
                    return {
                      ...n,
                      data: { ...n.data, fields: { ...n.data.fields, layout: next } },
                    };
                  }),
                )
              }
              onSlotChange={(name, value, ratio) => {
                const nodeId = selectedNode.id;
                const update = (fn: (layout: ICLayout) => ICLayout) =>
                  setNodes((nds) =>
                    nds.map((n) => {
                      const layout = n.id === nodeId ? parseLayout(n.data.fields.layout) : null;
                      if (!layout) return n;
                      return {
                        ...n,
                        data: {
                          ...n.data,
                          fields: { ...n.data.fields, layout: JSON.stringify(fn(layout)) },
                        },
                      };
                    }),
                  );
                update((layout) => setSlotDefault(layout, name, value, ratio));
                // A new partner logo recolors the partner's side, as Replace logo does in the studio.
                if (name === 'partner_logo') {
                  void logoColor(value).then((color) => {
                    if (color) update((layout) => pickPartner(layout, color));
                  });
                }
              }}
            />
          )}
          {studioNode && (
            <DesignStudio
              layoutRaw={withNodePrompt(
                studioNode.data.fields.layout,
                studioNode.data.fields.prompt,
              )}
              sceneCacheRaw={studioNode.data.fields.sceneCache}
              onSave={(layout) => commitStudioLayout(studioNode.id, layout)}
              onSaveShortcut={(layout) => {
                commitStudioLayout(studioNode.id, layout);
                const prompt = parseLayout(layout)?.prompt;
                const built = buildWorkflow();
                built.nodes = built.nodes.map((n) =>
                  n.id === studioNode.id
                    ? {
                        ...n,
                        fields: {
                          ...n.fields,
                          layout,
                          ...(prompt !== undefined ? { prompt } : {}),
                        },
                      }
                    : n,
                );
                return handleSaveWorkflow(built, true);
              }}
              onClose={() => setStudioNodeId(null)}
            />
          )}

          {savedNotice && !rejectMessage && (
            <div className="fixed bottom-6 left-1/2 z-toast -translate-x-1/2 rounded-lg border border-primary/40 bg-canvas-muted px-4 py-2 font-mono text-label text-primary-soft shadow-lg">
              {savedNotice}
            </div>
          )}
          {rejectMessage && (
            <div className="fixed bottom-6 left-1/2 z-toast -translate-x-1/2 rounded-lg border border-danger/40 bg-canvas-muted px-4 py-2 font-mono text-label text-danger shadow-lg">
              {rejectMessage}
            </div>
          )}
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setIsResizingPanel(true);
          }}
          aria-label="Resize output panel"
          title="Drag to resize"
          className="group relative flex w-3 shrink-0 cursor-col-resize items-center justify-center bg-transparent"
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-canvas-border" />
          <GripVertical className="relative z-10 size-3 text-canvas-muted-foreground transition-colors group-hover:text-canvas-foreground" />
        </button>

        <div style={{ width: panelWidth }} className="h-full shrink-0 overflow-hidden bg-canvas">
          <PlaygroundConsole
            entries={entries}
            setEntries={setEntries}
            onExportTable={(content, kind) =>
              setExportRequest({
                title: kind === 'table' ? 'Export table' : 'Export output',
                // Raw output still needs its pipe-rows turned into real
                // markdown table syntax; a table's own source is that already.
                markdown: kind === 'table' ? content : normalizeRawTableRows(content),
                formats: EXPORT_FORMATS,
                defaultName: workflowName,
              })
            }
            onConfirm={handleConfirmAnswer}
            // onBuildWorkflow intentionally not wired up: chat-driven workflow
            // building isn't ready to ship yet. Leaving handleGenerateWorkflow
            // itself in place (unused) so this is a one-line re-enable later.
          />
        </div>
      </div>

      {exportRequest && (
        <PlaygroundExportPopup
          title={exportRequest.title}
          initialMarkdown={exportRequest.markdown}
          formats={exportRequest.formats}
          defaultName={exportRequest.defaultName}
          onClose={() => setExportRequest(null)}
        />
      )}
      {showPresets && (
        <PlaygroundPresetsModal onClose={() => setShowPresets(false)} onSelect={handleLoadPreset} />
      )}
      {showLibrary && (
        <PlaygroundLibraryModal
          currentId={libraryIdRef.current}
          onClose={() => setShowLibrary(false)}
          onOpen={(entry, workflow) => {
            fileHandleRef.current = null;
            applyLoadedWorkflow(workflow);
            libraryIdRef.current = entry.id;
            setShowLibrary(false);
          }}
          onOpenDesign={(_entry, layout) => {
            const raw = JSON.stringify(layout);
            // An untouched Create design node takes the design; otherwise a new one joins the run.
            const empty = nodes.find((n) => {
              if (n.data.kind !== 'image-constructor') return false;
              const current = parseLayout(n.data.fields.layout);
              return !current || (current.templateId === 'blank' && current.els.length === 0);
            });
            let targetId: string;
            if (empty) {
              targetId = empty.id;
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === empty.id
                    ? { ...n, data: { ...n.data, fields: { ...n.data.fields, layout: raw } } }
                    : n,
                ),
              );
            } else {
              // To the right of everything, one row under the trigger, so its wire crosses no node.
              const start = nodes.find((n) => n.data.kind === 'start');
              const right = Math.max(0, ...nodes.map((n) => n.position.x));
              const node = makeNode(
                'image-constructor',
                right + 260,
                (start?.position.y ?? 0) + 180,
              );
              node.data.fields = { ...node.data.fields, layout: raw };
              targetId = node.id;
              setNodes((nds) => [...nds, node]);
              if (start)
                setEdges((eds) => [...eds, { id: nextId(), source: start.id, target: node.id }]);
              window.setTimeout(() => fitView(FIT_VIEW_OPTIONS), FIT_VIEW_DELAY_MS);
            }
            setShowLibrary(false);
            setSelectedId(null);
            setStudioNodeId(targetId);
          }}
          onImport={() => {
            setShowLibrary(false);
            void handleImportWorkflow();
          }}
          onCurrentChanged={(change) => {
            if (change.deleted) libraryIdRef.current = null;
            if (change.renamed) setWorkflowName(change.renamed);
          }}
        />
      )}
      {replyClip && (
        // biome-ignore lint/a11y/useMediaCaption: synthesized speech has no caption track to attach
        <audio
          key={replyClip.seq}
          ref={replyAudioRef}
          src={replyClip.url}
          autoPlay
          className="hidden"
        />
      )}
    </div>
  );
}

export function Playground() {
  const [workflowName, setWorkflowName] = useState(held.current?.workflowName ?? 'My Workflow');
  const [editingName, setEditingName] = useState(false);
  const commitWorkflowName = useCallback(() => {
    setWorkflowName((prev) => prev.trim() || 'My Workflow');
    setEditingName(false);
  }, []);
  const [bar, setBar] = useState<HTMLElement | null>(null);
  const nameField = editingName ? (
    <input
      // biome-ignore lint/a11y/noAutofocus: opened by the user's own choice of Rename
      autoFocus
      value={workflowName}
      onChange={(e) => setWorkflowName(e.target.value)}
      onBlur={commitWorkflowName}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          commitWorkflowName();
        }
      }}
      className="w-44 rounded border border-primary/60 bg-canvas px-1.5 py-0.5 text-label text-canvas-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
    />
  ) : null;
  return (
    // The same frame and header bar the Design Studio has, so the two pages match.
    <div className="h-[calc(100vh-3.5rem)] p-3 sm:p-4">
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-canvas-border bg-canvas">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-canvas-border bg-canvas-muted px-4 py-3 font-mono">
        <div className="flex h-7 shrink-0 items-center text-sm font-semibold text-canvas-foreground">Playground</div>
        <div ref={setBar} className="flex min-w-0 flex-1" />
      </div>
      <div className="flex min-h-0 flex-1">
      <PlaygroundPalette />
      <ReactFlowProvider>
        <PlaygroundCanvas
          workflowName={workflowName}
          setWorkflowName={setWorkflowName}
          setEditingName={setEditingName}
          bar={bar}
          nameField={nameField}
        />
      </ReactFlowProvider>
      </div>
    </div>
    </div>
  );
}
