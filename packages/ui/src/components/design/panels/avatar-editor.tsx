'use client';

import { useState } from 'react';
import {
  avatarSetFor,
  type ICAvatarConfig,
  randomAvatarConfig,
  EXPRESSIONS,
  TOP as AVATAR_TOP,
  BOTTOM as AVATAR_BOTTOM,
  SHOES as AVATAR_SHOES,
  ACCESSORY_LABELS,
} from '../art/avatar.js';
import { type ICAvatarEl, type ICFont } from '../render/layout.js';
import { Segments } from './segments.js';
import { ThemedSelect } from '../../ui/themed-select.js';
import type { StudioApi } from './studio-api.js';
import { FONT_OPTIONS, INPUT, LABEL, SMALL } from './panel-shared.js';
import { ChipRow, SwatchRow } from './panel-fields.js';

// A dropdown instead of a slider: a `Range` next to the font picker was too narrow to
// show its own label and track (user report).
const AVATAR_TEXT_SIZES = [
  { value: '4', label: 'Small' },
  { value: '5.5', label: 'Medium' },
  { value: '7', label: 'Large' },
  { value: '9', label: 'Extra large' },
];

const AVATAR_TOP_COLORS = ['#3a4a63', '#c8553d', '#2f6b4f', '#efe3cf', '#1a1a1a', '#8c6bff'];

const AVATAR_BOTTOM_COLORS = ['#22252b', '#4a2f22', '#7a5138', '#dfe6ee'];

/** All the config-driven avatar's controls: a scoped randomizer, category, skin, head
 *  feature, clothes, accessories and a text line. Its own rail tab (studio.tsx) while an
 *  avatar is selected, since it has far more controls than any other element type's bar. */
export function AvatarEditor({ el, api }: { el: ICAvatarEl; api: StudioApi }) {
  const [randScope, setRandScope] = useState<'earth' | 'space' | 'both'>('both');
  const set = avatarSetFor(el.config.category);
  const patchConfig = (patch: Partial<ICAvatarConfig>) =>
    api.patch(el.id, { config: { ...el.config, ...patch } });

  return (
    <div className="space-y-3">
      <div>
        <div className={LABEL}>Randomize</div>
        <div className="mb-1.5 flex gap-1">
          {(['earth', 'space', 'both'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRandScope(s)}
              className={`flex-1 rounded-md border px-1.5 py-1 text-[10px] ${randScope === s ? 'border-primary text-primary' : 'border-canvas-border text-canvas-muted-foreground'}`}
            >
              {s === 'both' ? 'Both' : s === 'earth' ? 'Earth' : 'Space'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => api.patch(el.id, { config: randomAvatarConfig(randScope) })}
          className={`${SMALL} w-full`}
        >
          Randomize
        </button>
      </div>
      <div>
        <div className={LABEL}>Category</div>
        <div className="flex gap-1.5">
          {(['earth', 'space'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                const next = avatarSetFor(c);
                patchConfig({
                  category: c,
                  skin: next.skin[2],
                  head: Object.keys(next.head)[0],
                  featureColor: next.featureColors[1],
                  accessories: el.config.accessories.filter((a) => next.accessories.includes(a)),
                });
              }}
              className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${el.config.category === c ? 'border-primary text-primary' : 'border-canvas-border text-canvas-muted-foreground'}`}
            >
              {c === 'earth' ? 'Earth' : 'Space'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className={LABEL}>Gender</div>
        <div className="flex gap-1.5">
          {(['male', 'female'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => patchConfig({ gender: g })}
              className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${el.config.gender === g ? 'border-primary text-primary' : 'border-canvas-border text-canvas-muted-foreground'}`}
            >
              {g === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className={LABEL}>Text on top</div>
        <input
          type="text"
          value={el.config.text}
          maxLength={14}
          placeholder="GM, WAGMI, your ticker..."
          onChange={(e) => patchConfig({ text: e.target.value })}
          className={`${INPUT} mb-1.5`}
        />
        <div className="flex gap-1.5">
          <div className="flex-1">
            <ThemedSelect
              id="ic-avatar-font"
              value={el.config.textFont}
              options={FONT_OPTIONS}
              onChange={(v) => patchConfig({ textFont: v as ICFont })}
            />
          </div>
          <div className="w-28">
            <ThemedSelect
              id="ic-avatar-text-size"
              value={String(el.config.textSize)}
              options={AVATAR_TEXT_SIZES}
              onChange={(v) => patchConfig({ textSize: Number(v) })}
            />
          </div>
        </div>
      </div>
      <div>
        <div className={LABEL}>Skin</div>
        <SwatchRow
          colors={set.skin}
          value={el.config.skin}
          onChange={(v) => patchConfig({ skin: v })}
        />
      </div>
      <div>
        <div className={LABEL}>Expression</div>
        <ChipRow
          options={Object.keys(EXPRESSIONS)}
          value={el.config.expression}
          onChange={(v) => patchConfig({ expression: v })}
        />
      </div>
      <div>
        <div className={LABEL}>
          {el.config.category === 'earth' ? 'Hair / headwear' : 'Head feature'}
        </div>
        <ChipRow
          options={Object.keys(set.head)}
          value={el.config.head}
          onChange={(v) => patchConfig({ head: v })}
        />
        <div className="mt-1.5">
          <SwatchRow
            colors={set.featureColors}
            value={el.config.featureColor}
            onChange={(v) => patchConfig({ featureColor: v })}
          />
        </div>
      </div>
      <div>
        <div className={LABEL}>Top</div>
        <ChipRow
          options={Object.keys(AVATAR_TOP)}
          value={el.config.top}
          onChange={(v) => patchConfig({ top: v })}
        />
        <div className="mt-1.5">
          <SwatchRow
            colors={AVATAR_TOP_COLORS}
            value={el.config.topColor}
            onChange={(v) => patchConfig({ topColor: v })}
          />
        </div>
      </div>
      <div>
        <div className={LABEL}>Bottom</div>
        <ChipRow
          options={Object.keys(AVATAR_BOTTOM)}
          value={el.config.bottom}
          onChange={(v) => patchConfig({ bottom: v })}
        />
        <div className="mt-1.5">
          <SwatchRow
            colors={AVATAR_BOTTOM_COLORS}
            value={el.config.bottomColor}
            onChange={(v) => patchConfig({ bottomColor: v })}
          />
        </div>
      </div>
      <div>
        <div className={LABEL}>Shoes</div>
        <ChipRow
          options={Object.keys(AVATAR_SHOES)}
          value={el.config.shoes}
          onChange={(v) => patchConfig({ shoes: v })}
        />
      </div>
      <div>
        <div className={LABEL}>Accessories</div>
        <Segments
          cols={3}
          options={set.accessories.map((a) => {
            const on = el.config.accessories.includes(a);
            return {
              key: a,
              label: ACCESSORY_LABELS[a] ?? a,
              on,
              onPick: () =>
                patchConfig({
                  accessories: on
                    ? el.config.accessories.filter((x) => x !== a)
                    : [...el.config.accessories, a],
                }),
            };
          })}
        />
      </div>
    </div>
  );
}
