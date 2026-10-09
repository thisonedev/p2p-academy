'use client';

import { X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { artFor, artUrl } from '../art/art.js';
import { type ICArtEl } from '../render/layout.js';
import {
  type ICTable,
  type ICColumnInfo,
  type ICSummary,
  MAX_POINTS,
  SUMMARIES,
  sampleData,
  type ChartKind,
  tableToChart,
  MAX_FILE_MB,
  parseTable,
  columnInfo,
  guessLabel,
  type ICChartData,
  parseChartData,
  num,
  CHART_KINDS,
  short,
  chartCsv,
} from '../art/charts.js';
import { Segments } from './segments.js';
import { ThemedSelect } from '../../ui/themed-select.js';
import { Overlay } from '../../ui/overlay.js';
import { IconButton } from '../../ui/icon-button.js';
import { columnLetter } from '../../../lib/column-letter.js';
import { INPUT, LABEL, SMALL } from './panel-shared.js';
import type { StudioApi } from './studio-api.js';

interface ImportState {
  name: string;
  table: ICTable;
  info: ICColumnInfo[];
  label: number;
  cols: number[];
  hideEmpty: boolean;
  summary: ICSummary;
}

/** The step between loading a file and charting it: which column labels the points, which columns
 *  to draw, and how many rows become one point. */
function ChartImport({
  state,
  points,
  onChange,
  onCancel,
  onImport,
}: {
  state: ImportState;
  points: number;
  onChange: (next: ImportState) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  const { table, info, label, cols, hideEmpty, summary } = state;
  const rows = table.rows.length;
  const per = Math.ceil(rows / MAX_POINTS);
  const shown = info
    .map((c, i) => [c, i] as const)
    .filter(([c, i]) => i !== label && !(hideEmpty && c.empty));
  const toggle = (i: number) =>
    onChange({
      ...state,
      cols: cols.includes(i)
        ? cols.filter((c) => c !== i)
        : [...cols, i].sort((a, b) => a - b).slice(0, 12),
    });
  return (
    <div className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-canvas-border bg-canvas p-4 text-[12px]">
      <div className="font-semibold">Import {state.name}</div>
      <div className="mt-0.5 text-[11.5px] text-canvas-muted-foreground">
        {rows.toLocaleString()} rows · {info.length} columns
      </div>

      <div className={`${LABEL} mt-4`}>Label each point with</div>
      <ThemedSelect
        value={String(label)}
        options={info.map((c, i) => ({ value: String(i), label: c.name, disabled: c.empty }))}
        onChange={(v) => {
          const next = Number(v);
          onChange({ ...state, label: next, cols: cols.filter((c) => c !== next) });
        }}
      />

      <div className="mt-4 flex items-center">
        <div className={`${LABEL} mb-0 flex-1`}>Columns to chart</div>
        <label className="flex items-center gap-1.5 text-[11px] text-canvas-muted-foreground">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => onChange({ ...state, hideEmpty: e.target.checked })}
          />
          Remove empty columns
        </label>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {shown.map(([c, i]) => {
          const usable = !c.empty && c.numeric >= 0.8;
          return (
            <label
              key={i}
              title={
                usable
                  ? undefined
                  : c.empty
                    ? 'This column is empty'
                    : 'This column holds text, not numbers'
              }
              className={`flex items-center gap-2 rounded-md border border-canvas-border px-2 py-1.5 ${usable ? 'cursor-pointer hover:bg-canvas-muted' : 'opacity-40'}`}
            >
              <input
                type="checkbox"
                disabled={!usable}
                checked={cols.includes(i)}
                onChange={() => toggle(i)}
              />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {!usable && (
                <span className="text-[10.5px] text-canvas-muted-foreground">
                  {c.empty ? 'empty' : 'text'}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {cols.length >= 12 && (
        <p className="mt-1.5 text-[11px] text-canvas-muted-foreground">
          Up to 12 columns per chart.
        </p>
      )}

      {rows > MAX_POINTS && (
        <>
          <div className={`${LABEL} mt-4`}>Each point shows</div>
          <ThemedSelect
            value={summary}
            options={SUMMARIES.map(([value, name]) => ({ value, label: name }))}
            onChange={(v) => onChange({ ...state, summary: v as ICSummary })}
          />
          {summary === 'ohlc' && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-canvas-muted-foreground">
              Uses the first picked column{cols.length > 1 ? ` (${info[cols[0]]?.name})` : ''} and
              draws it as candles.
            </p>
          )}
        </>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-canvas-muted-foreground">
        {rows > MAX_POINTS
          ? `Charts show up to ${MAX_POINTS.toLocaleString()} points, so every ${per.toLocaleString()} rows in order become one point. All rows are used; only those ${points.toLocaleString()} points are kept with the design.`
          : `All ${rows.toLocaleString()} rows become points.`}
      </p>
      <div className="mt-auto flex justify-end gap-2 pt-4">
        <button type="button" className={SMALL} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!cols.length}
          className="rounded-md border border-primary/60 px-3 py-1 text-[12px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
          onClick={onImport}
        >
          Import {cols.length ? `${cols.length} ${cols.length === 1 ? 'column' : 'columns'}` : ''}
        </button>
      </div>
    </div>
  );
}

const SHEET_GREEN = '#217346';

/** The right-side panel a chart's Data button opens: its type, a summary of its data with an editor
 *  to open, and a switch that makes it a workflow input in Play. */
export function ChartDrawer({ api, el }: { api: StudioApi; el: ICArtEl }) {
  const data = el.data ?? sampleData(el.art as ChartKind);
  const [paste, setPaste] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [pending, setPending] = useState<ImportState | null>(null);
  const pendingData = useMemo(
    () =>
      pending && pending.cols.length
        ? tableToChart(pending.table, pending.label, pending.cols, pending.summary)
        : null,
    [pending],
  );
  const load = async (file: File) => {
    if (file.size > MAX_FILE_MB * 1e6) {
      setError(
        `This file is ${Math.round(file.size / 1e6)} MB. The limit is ${MAX_FILE_MB} MB: filter or total it in a spreadsheet first, or connect it in Play.`,
      );
      return;
    }
    const table = parseTable(await file.text());
    if (!table || !table.rows.length) {
      setError('This file has no rows a chart can use.');
      return;
    }
    const info = columnInfo(table);
    const label = guessLabel(info);
    const cols = info
      .map((_, i) => i)
      .filter((i) => i !== label && !info[i].empty && info[i].numeric >= 0.8)
      .slice(0, 12);
    setError(null);
    setPending({ name: file.name, table, info, label, cols, hideEmpty: true, summary: 'average' });
  };
  const [error, setError] = useState<string | null>(null);
  const set = (next: ICChartData) => api.patch(el.id, { data: next });
  const apply = (raw: string) => {
    const parsed = parseChartData(raw);
    if (!parsed || !parsed.labels.length) {
      setError('Use one row per point: a label, then a number for each column.');
      return false;
    }
    setError(null);
    set(parsed);
    return true;
  };
  const setValue = (row: number, col: number, raw: string) => {
    const n = num(raw);
    set({
      ...data,
      series: data.series.map((s, k) =>
        k === col
          ? { ...s, values: s.values.map((v, i) => (i === row ? (Number.isNaN(n) ? v : n) : v)) }
          : s,
      ),
    });
  };
  // A block copied from a spreadsheet, pasted into one cell, fills from there down and right.
  // `col` -1 is the label column. Pasted into the first label with a header row, it replaces all.
  const pasteGrid = (row: number, col: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    if (row === 0 && col === -1 && apply(text)) return;
    const grid = text
      .replace(/\r/g, '')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.split(/\t|,(?=\S)/));
    const labels = data.labels.slice();
    const series = data.series.map((x) => ({ ...x, values: x.values.slice() }));
    grid.forEach((cells, dr) => {
      const i = row + dr;
      while (labels.length <= i) {
        labels.push('');
        for (const x of series) x.values.push(0);
      }
      cells.forEach((raw, dc) => {
        const c = col + dc;
        if (c === -1) {
          labels[i] = raw.trim();
          return;
        }
        while (series.length <= c)
          series.push({ name: `Column ${series.length + 1}`, values: labels.map(() => 0) });
        const n = num(raw);
        series[c].values[i] = Number.isNaN(n) ? 0 : n;
      });
    });
    setError(null);
    set({ ...data, labels, series });
  };
  const taken = new Set(api.layout.els.map((e) => e.slot).filter(Boolean));
  const slotName =
    el.slot ??
    (['chart', 'chart_2', 'chart_3', 'chart_4'].find((n) => !taken.has(n)) || 'chart_data');

  const bg = api.layout.bg;
  const backdrop =
    bg.mode === 'gradient'
      ? `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`
      : bg.mode === 'transparent'
        ? '#11131a'
        : bg.color;
  const preview = artFor({ ...el, data });
  const pendingPreview = pendingData
    ? artFor({
        ...el,
        art: pending?.summary === 'ohlc' ? 'chart-candles' : el.art,
        data: pendingData,
      })
    : undefined;

  const types = (
    <Segments
      cols={3}
      options={CHART_KINDS.map(([kind, name]) => ({
        key: kind,
        label: name,
        on: el.art === kind,
        onPick: () => api.patch(el.id, { art: kind }),
      }))}
    />
  );

  const td = 'border border-paper-border p-0';
  const input =
    'block w-full min-w-0 bg-transparent px-2 py-1 text-[11.5px] text-paper-foreground outline-none focus:bg-paper-focus';
  const gutter =
    'border border-paper-border bg-paper-muted px-2 py-1 text-center text-[10.5px] text-paper-muted-foreground';

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-canvas-border bg-canvas-muted p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-canvas-foreground">Chart</span>
        <IconButton
          onClick={() => api.setEdit(null)}
          aria-label="Close"
        >
          <X className="size-3.5" />
        </IconButton>
      </div>

      <div className={`${LABEL} mt-3`}>Type</div>
      {types}
      {el.art === 'chart-candles' && data.series.length < 4 && (
        <p className="mt-1.5 text-[11px] text-warning">
          Candles need four columns: open, high, low, close.
        </p>
      )}

      <div className={`${LABEL} mt-4`}>Data</div>
      <div className="text-[11.5px] text-canvas-muted-foreground">
        {data.labels.length.toLocaleString()} rows · {data.series.length}{' '}
        {data.series.length === 1 ? 'column' : 'columns'}
      </div>
      <button type="button" className={`${SMALL} mt-2 w-full`} onClick={() => setSheet(true)}>
        Edit data
      </button>
      <button
        type="button"
        title={
          el.slot
            ? 'In Play, connect a node that outputs CSV or JSON to this input on the Create design node. Click to stop using it as an input.'
            : 'In Play, a node that outputs CSV or JSON, such as an API call or a spreadsheet, can fill this chart through the Create design node.'
        }
        onClick={() => api.patch(el.id, { slot: el.slot ? undefined : slotName })}
        className={`${SMALL} mt-2 w-full shrink-0 ${el.slot ? 'border-primary/50 text-primary-soft' : ''}`}
      >
        {el.slot ? `Workflow input: ${el.slot}` : 'Use as workflow input'}
      </button>

      {sheet &&
        createPortal(
          <Overlay onClose={() => setSheet(false)} className="z-[70] p-6 font-mono">
            <div className="flex h-[82vh] w-[min(1240px,96vw)] flex-col rounded-2xl border border-canvas-border bg-canvas-muted p-4 text-canvas-foreground shadow-2xl">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm font-semibold">Chart data</span>
                <span className="text-[11.5px] text-canvas-muted-foreground">
                  {data.labels.length.toLocaleString()} rows · {data.series.length}{' '}
                  {data.series.length === 1 ? 'column' : 'columns'}
                </span>
                <button
                  type="button"
                  onClick={() => setSheet(false)}
                  className={`${SMALL} ml-auto`}
                >
                  Done
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-4">
                {pending ? (
                  <ChartImport
                    state={pending}
                    points={pendingData?.labels.length ?? 0}
                    onChange={setPending}
                    onCancel={() => setPending(null)}
                    onImport={() => {
                      if (pendingData)
                        api.patch(el.id, {
                          data: pendingData,
                          ...(pending.summary === 'ohlc' ? { art: 'chart-candles' } : {}),
                        });
                      setPending(null);
                    }}
                  />
                ) : (
                  // The sheet, drawn like the spreadsheet export preview: letters, row numbers, a header row.
                  <div className="flex min-h-0 flex-col">
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-canvas-border bg-white">
                      <table className="border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className="sticky left-0 z-10 border border-paper-border bg-paper-muted px-2 py-1" />
                            {[-1, ...data.series.map((_, k) => k)].map((c) => (
                              <th
                                key={c}
                                className="border border-paper-border px-2 py-1 text-center text-[10.5px] font-semibold text-white"
                                style={{ backgroundColor: SHEET_GREEN }}
                              >
                                {columnLetter(c + 1)}
                              </th>
                            ))}
                            <th className="w-6 border border-paper-border bg-paper-muted" />
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className={`${gutter} sticky left-0`}>1</td>
                            <td
                              className={`${td} min-w-32 bg-paper-subtle px-2 py-1 text-[11.5px] font-semibold text-paper-muted-foreground`}
                            >
                              Label
                            </td>
                            {data.series.map((s, k) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: columns have no id of their own
                              <td key={k} className={`${td} group relative min-w-32 bg-paper-subtle`}>
                                <input
                                  value={s.name}
                                  aria-label={`Column ${columnLetter(k + 1)} name`}
                                  onChange={(e) =>
                                    set({
                                      ...data,
                                      series: data.series.map((x, j) =>
                                        j === k ? { ...x, name: e.target.value } : x,
                                      ),
                                    })
                                  }
                                  className={`${input} font-semibold`}
                                />
                                {data.series.length > 1 && (
                                  <button
                                    type="button"
                                    title="Remove this column"
                                    onClick={() =>
                                      set({
                                        ...data,
                                        series: data.series.filter((_, j) => j !== k),
                                      })
                                    }
                                    className="absolute right-1 top-1.5 hidden rounded text-paper-dimmer hover:text-danger-strong group-hover:block"
                                  >
                                    <X className="size-3" />
                                  </button>
                                )}
                              </td>
                            ))}
                            <td className={td} />
                          </tr>
                          {data.labels.map((label, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id of their own
                            <tr key={i} className="group">
                              <td className={`${gutter} sticky left-0`}>{i + 2}</td>
                              <td className={`${td} bg-white`}>
                                <input
                                  value={label}
                                  aria-label={`Row ${i + 1} label`}
                                  onPaste={(e) => pasteGrid(i, -1, e)}
                                  onChange={(e) =>
                                    set({
                                      ...data,
                                      labels: data.labels.map((l, j) =>
                                        j === i ? e.target.value : l,
                                      ),
                                    })
                                  }
                                  className={input}
                                />
                              </td>
                              {data.series.map((s, k) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: columns have no id of their own
                                <td key={k} className={`${td} bg-white`}>
                                  <input
                                    defaultValue={short(s.values[i] ?? 0)}
                                    key={`${i}-${k}-${s.values[i]}`}
                                    aria-label={`${s.name}, row ${i + 1}`}
                                    onPaste={(e) => pasteGrid(i, k, e)}
                                    onBlur={(e) => setValue(i, k, e.target.value)}
                                    onKeyDown={(e) =>
                                      e.key === 'Enter' && (e.target as HTMLInputElement).blur()
                                    }
                                    className={`${input} text-right tabular-nums`}
                                  />
                                </td>
                              ))}
                              <td className={`${td} bg-white text-center`}>
                                <button
                                  type="button"
                                  title="Remove this row"
                                  onClick={() =>
                                    set({
                                      ...data,
                                      labels: data.labels.filter((_, j) => j !== i),
                                      series: data.series.map((x) => ({
                                        ...x,
                                        values: x.values.filter((_, j) => j !== i),
                                      })),
                                    })
                                  }
                                  className="invisible px-1 text-paper-dimmer hover:text-danger-strong group-hover:visible"
                                >
                                  <X className="size-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={SMALL}
                        onClick={() =>
                          set({
                            ...data,
                            labels: [...data.labels, ''],
                            series: data.series.map((x) => ({
                              ...x,
                              values: [...x.values, x.values[x.values.length - 1] ?? 0],
                            })),
                          })
                        }
                      >
                        + Row
                      </button>
                      <button
                        type="button"
                        className={SMALL}
                        onClick={() =>
                          set({
                            ...data,
                            series: [
                              ...data.series,
                              {
                                name: `Column ${data.series.length + 1}`,
                                values: data.labels.map(() => 0),
                              },
                            ],
                          })
                        }
                      >
                        + Column
                      </button>
                      <button
                        type="button"
                        className={`${SMALL} ml-auto`}
                        onClick={() => setPaste(paste === null ? chartCsv(data) : null)}
                      >
                        {paste === null ? 'Paste CSV or JSON' : 'Close'}
                      </button>
                      <label className={`${SMALL} flex cursor-pointer items-center`}>
                        Load file
                        <input
                          type="file"
                          accept=".csv,.tsv,.json,text/csv,application/json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) void load(file);
                          }}
                        />
                      </label>
                    </div>
                    {paste !== null && (
                      <div className="mt-2 flex gap-2">
                        <textarea
                          value={paste}
                          onChange={(e) => setPaste(e.target.value)}
                          spellCheck={false}
                          rows={5}
                          className={`${INPUT} font-mono text-[11px] leading-relaxed`}
                        />
                        <button
                          type="button"
                          className={`${SMALL} self-end`}
                          onClick={() => apply(paste) && setPaste(null)}
                        >
                          Apply
                        </button>
                      </div>
                    )}
                    {error && <div className="mt-1.5 text-[11px] text-danger">{error}</div>}
                    <p className="mt-2 text-[11px] leading-relaxed text-canvas-muted-foreground">
                      Paste cells from Google Sheets or Excel into any cell, or load a CSV or JSON
                      file up to {MAX_FILE_MB} MB. Charts keep up to {MAX_POINTS.toLocaleString()}{' '}
                      points.
                    </p>
                  </div>
                )}

                {/* The chart as it will look, in the design's own colors and background. */}
                <div className="flex min-h-0 flex-col">
                  <div
                    className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-canvas-border p-5"
                    style={{ background: backdrop }}
                  >
                    {preview && (
                      // biome-ignore lint/performance/noImgElement: a local SVG data URL
                      <img
                        src={artUrl(pendingPreview ?? preview, el.colors)}
                        alt="Chart preview"
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="mt-2">{types}</div>
                </div>
              </div>
            </div>
          </Overlay>,
          document.body,
        )}
    </div>
  );
}
