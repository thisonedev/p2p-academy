'use client';

import { Download } from 'lucide-react';
import { createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Set only by PlaygroundConsole, so lesson chat grows no button. 'table'
// content is real markdown already; 'text' still needs OCR's pipe-row
// normalizing before it can export.
export const TableExportContext = createContext<((content: string, kind: 'table' | 'text') => void) | null>(null);

// The raw markdown behind the bubble currently rendering, so the table
// component below can slice out its own source instead of re-serializing.
const RawMarkdownContext = createContext('');

/** One line of a real CSV field-by-field, honoring quoted fields with an
 *  embedded comma or a doubled `""` escaped quote. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

/** A CSV-formatted agent reply is bare comma rows, no markdown table syntax,
 *  so it renders as a plain paragraph with no export button by default. */
function looksLikeCsv(text: string): boolean {
  if (text.includes('|')) return false;
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return false;
  const counts = lines.map((l) => parseCsvLine(l).length);
  // A single ordinary sentence can have one comma; a real one-row CSV
  // reply (our common case, no header) needs at least 3 fields to tell
  // the two apart with just this.
  const minFields = lines.length === 1 ? 3 : 2;
  if (counts[0] < minFields || !counts.every((c) => c === counts[0])) return false;
  // A CSV field is a short value; a comma-split paragraph clause is a run
  // of several words. Words per field tells a real row from a long sentence.
  const wordCount = text.trim().split(/\s+/).length;
  const totalFields = counts.reduce((sum, c) => sum + c, 0);
  return wordCount / totalFields <= 4;
}

// Worth downloading if multi-line or past one sentence; a one-word answer
// isn't, a translation or transcript is.
// A rendered table carries its own export button, so the whole-reply button
// would sit on top of it.
function containsMarkdownTable(text: string): boolean {
  return text.split('\n').some((line) => {
    const row = line.trim();
    return row.includes('|') && /^[|\s:-]+$/.test(row) && (row.match(/-/g)?.length ?? 0) >= 2;
  });
}

function isSubstantialText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.includes('\n')) return true;
  if (trimmed.length > 160) return true;
  const sentenceEnders = trimmed.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;
  return sentenceEnders > 1;
}

/** Reuses the table export popup by faking a header row and separator; a
 *  single headerless CSV row still round-trips, becoming that "header". */
function csvToMarkdownTable(text: string): string {
  const rows = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parseCsvLine);
  const escape = (cell: string) => cell.replace(/\|/g, '\\|');
  const [header, ...body] = rows;
  return [
    `| ${header.map(escape).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((r) => `| ${r.map(escape).join(' | ')} |`),
  ].join('\n');
}

// Prose stays stripped to plain sentences server-side; GFM tables survive that
// stripping (it never touches `|`), so this is the one construct worth parsing.
const MARKDOWN_COMPONENTS = {
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown's mdast `node` prop
  p: ({ children, node }: { children?: React.ReactNode; node?: any }) => {
    const onExportTable = useContext(TableExportContext);
    const raw = useContext(RawMarkdownContext);
    const source = node?.position && raw ? raw.slice(node.position.start.offset, node.position.end.offset) : null;
    const isCsv = onExportTable && source && looksLikeCsv(source);
    return (
      <div className="group relative">
        {isCsv ? (
          <button
            type="button"
            onClick={() => onExportTable(csvToMarkdownTable(source), 'table')}
            className="absolute top-0 right-0 z-10 rounded border border-canvas-border bg-canvas-muted p-1 text-canvas-muted-foreground opacity-0 transition-opacity hover:text-emerald-400 group-hover:opacity-100"
            title="Export this CSV"
            aria-label="Export this CSV"
          >
            <Download className="size-3" />
          </button>
        ) : null}
        <p className="wrap-anywhere whitespace-pre-wrap first:mt-0 last:mb-0 my-1.5">{children}</p>
      </div>
    );
  },
  // biome-ignore lint/suspicious/noExplicitAny: react-markdown's mdast `node` prop
  table: ({ children, node }: { children?: React.ReactNode; node?: any }) => {
    const onExportTable = useContext(TableExportContext);
    const raw = useContext(RawMarkdownContext);
    const source =
      onExportTable && node?.position && raw ? raw.slice(node.position.start.offset, node.position.end.offset) : null;
    return (
      <div className="group relative my-1.5">
        {source ? (
          <button
            type="button"
            onClick={() => source && onExportTable?.(source, 'table')}
            className="absolute top-1.5 right-1.5 z-10 rounded border border-canvas-border bg-canvas-muted p-1 text-canvas-muted-foreground opacity-0 transition-opacity hover:text-emerald-400 group-hover:opacity-100"
            title="Export this table"
            aria-label="Export this table"
          >
            <Download className="size-3" />
          </button>
        ) : null}
        <div className="overflow-x-auto rounded-md">
          {/* min-w-full, not w-full: a wide column (a long description) can push the
           *  table past its container instead of every other column getting crushed
           *  down to a letter-wrapped sliver; the wrapper above scrolls the overflow. */}
          <table className="min-w-full border-collapse text-left">{children}</table>
        </div>
      </div>
    );
  },
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-canvas-border/50 text-canvas-muted-foreground">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="min-w-16 whitespace-nowrap border border-canvas-border px-2 py-1 font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="min-w-16 border border-canvas-border px-2 py-1">{children}</td>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-canvas-border/50 px-1 py-0.5">{children}</code>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-emerald-400 underline">
      {children}
    </a>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-1.5 list-decimal space-y-0.5 pl-6">{children}</ol>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-1.5 list-disc space-y-0.5 pl-6">{children}</ul>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="pl-0.5">{children}</li>,
};

export function AssistantBubble({ content }: { content: string }) {
  const onExportTable = useContext(TableExportContext);
  return (
    <div className="group relative wrap-anywhere font-mono text-xs text-canvas-foreground">
      {onExportTable && isSubstantialText(content) && !containsMarkdownTable(content) ? (
        <button
          type="button"
          onClick={() => onExportTable(content, 'table')}
          className="absolute top-0 right-0 z-10 rounded border border-canvas-border bg-canvas-muted p-1 text-canvas-muted-foreground opacity-0 transition-opacity hover:text-emerald-400 group-hover:opacity-100"
          title="Export this result"
          aria-label="Export this result"
        >
          <Download className="size-3" />
        </button>
      ) : null}
      <RawMarkdownContext.Provider value={content}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
          {content}
        </ReactMarkdown>
      </RawMarkdownContext.Provider>
    </div>
  );
}

// A `| cell | cell |` line from ocr.cjs's own table rows, not general markdown:
// no header/separator row, so a plain `|`-bounded line is the whole signal.
// A leading `~` (stripped before splitting) marks a label:value pair that
// never had real ruled borders in the source, unlike a genuine grid table.
function splitRawTableRow(line: string): string[] {
  const inner = line.trim().replace(/^~?\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

const isRawTableLine = (line: string) => /^~?\|.*\|$/.test(line.trim());

const isBorderlessTableLine = (line: string) => line.trim().startsWith('~');

/** `RawContent` parses a bare `| cell | cell |` line itself, no separator
 *  needed; a real Markdown consumer (the exporter's remark-gfm pass) does
 *  need one, so exporting OCR's raw text runs this first. Border styling is
 *  a display-only concern, so the `~` marker doesn't survive into export. */
export function normalizeRawTableRows(content: string): string {
  const lines = content.split('\n');
  const out: string[] = [];
  let columnCount = 0;
  for (const line of lines) {
    if (isRawTableLine(line)) {
      const stripped = line.trim().replace(/^~/, '');
      out.push(stripped);
      if (columnCount === 0) {
        columnCount = splitRawTableRow(line).length;
        out.push(`| ${Array(columnCount).fill('---').join(' | ')} |`);
      }
    } else {
      out.push(line);
      columnCount = 0;
    }
  }
  return out.join('\n');
}

/** Renders OCR's raw text as preformatted text, except `|`-rowed lines,
 *  which render as an actual table set apart from the surrounding prose. */
export function RawContent({ content }: { content: string }) {
  const onExportTable = useContext(TableExportContext);
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let textLines: string[] = [];
  // One table can mix real grid rows and borderless label:value rows (a
  // totals line borrowing the grid's own columns), so border-ness is
  // tracked per row, not once for the whole block.
  let tableRows: { cells: string[]; borderless: boolean }[] = [];
  const flushText = () => {
    if (textLines.length === 0) return;
    blocks.push(
      <div
        key={blocks.length}
        className="wrap-anywhere whitespace-pre-wrap font-mono text-xs text-canvas-foreground"
      >
        {textLines.join('\n')}
      </div>,
    );
    textLines = [];
  };
  const flushTable = () => {
    if (tableRows.length === 0) return;
    const colCount = Math.max(...tableRows.map((row) => row.cells.length));
    blocks.push(
      <div key={blocks.length} className="overflow-x-auto rounded-md">
        <table className="my-1.5 min-w-full border-collapse text-left font-mono text-xs">
          <tbody>
            {tableRows.map((row, r) => {
              const cellBorder = row.borderless ? '' : 'border border-canvas-border';
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows never reorder within one render
                <tr key={r}>
                  {Array.from({ length: colCount }, (_, c) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells never reorder within one render
                    <td key={c} className={`${cellBorder} px-2 py-1 align-top text-canvas-foreground`}>
                      {row.cells[c] ?? ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>,
    );
    tableRows = [];
  };
  for (const line of lines) {
    if (isRawTableLine(line)) {
      flushText();
      tableRows.push({ cells: splitRawTableRow(line), borderless: isBorderlessTableLine(line) });
    } else {
      flushTable();
      textLines.push(line);
    }
  }
  flushText();
  flushTable();
  return (
    <div className="group relative">
      {onExportTable && isSubstantialText(content) ? (
        <button
          type="button"
          onClick={() => onExportTable(content, 'text')}
          className="absolute top-0 right-0 z-10 rounded border border-canvas-border bg-canvas-muted p-1 text-canvas-muted-foreground opacity-0 transition-opacity hover:text-emerald-400 group-hover:opacity-100"
          title="Export this output"
          aria-label="Export this output"
        >
          <Download className="size-3" />
        </button>
      ) : null}
      {blocks}
    </div>
  );
}
