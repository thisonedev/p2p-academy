'use client';

import { X } from 'lucide-react';
import { isCode, sampleCode, type ICCodeData, type ICCodeLang, CODE_LANGS } from '../art/code.js';
import { type ICArtEl } from '../render/layout.js';
import { isChart } from '../art/charts.js';
import { IconButton } from '../../ui/icon-button.js';
import { SegmentGroup, SegmentButton } from '../../ui/segment-group.js';
import type { StudioApi } from './studio-api.js';
import { ChartDrawer } from './chart-drawer.js';
import { INPUT, LABEL } from './panel-shared.js';

/** The side drawer for editing a chart's data or a code block. */
export function EditDrawer({ api, id }: { api: StudioApi; id: string }) {
  const el = api.layout.els.find((e) => e.id === id);
  if (el?.t === 'art' && isChart(el.art)) return <ChartDrawer api={api} el={el} />;
  if (el?.t === 'art' && isCode(el.art)) return <CodeDrawer api={api} el={el} />;
  // Photos have their editing, remove background included, in the inspector's Image section.
  return null;
}

/** The right-side panel a code window's Code button opens: the code, its file name, language and look. */
function CodeDrawer({ api, el }: { api: StudioApi; el: ICArtEl }) {
  const code = el.code ?? sampleCode();
  const set = (p: Partial<ICCodeData>) => api.patch(el.id, { code: { ...code, ...p } });
  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-canvas-border bg-canvas-muted p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-canvas-foreground">Code</span>
        <IconButton
          onClick={() => api.setEdit(null)}
          aria-label="Close"
        >
          <X className="size-4" />
        </IconButton>
      </div>
      <textarea
        value={code.text}
        onChange={(e) => set({ text: e.target.value })}
        spellCheck={false}
        rows={14}
        className={`${INPUT} mt-3 resize-y whitespace-pre font-mono text-[11.5px] leading-relaxed`}
      />
      <div className={`${LABEL} mt-3`}>File name</div>
      <input
        value={code.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="No tab"
        className={INPUT}
      />
      <div className={`${LABEL} mt-3`}>Language</div>
      <select
        value={code.lang}
        onChange={(e) => set({ lang: e.target.value as ICCodeLang })}
        className={INPUT}
      >
        {CODE_LANGS.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <div className={`${LABEL} mt-3`}>Theme</div>
      <SegmentGroup className="text-[12px]">
        {(['dark', 'light'] as const).map((t) => (
          <SegmentButton key={t} on={code.theme === t} lit="canvas" className="flex-1" onClick={() => set({ theme: t })}>
            {t === 'dark' ? 'Dark' : 'Light'}
          </SegmentButton>
        ))}
      </SegmentGroup>
      <label className="mt-3 flex items-center gap-2 text-[12px] text-canvas-muted-foreground">
        <input
          type="checkbox"
          checked={code.lines}
          onChange={(e) => set({ lines: e.target.checked })}
          className="accent-emerald-500"
        />
        Line numbers
      </label>
    </div>
  );
}
