
import {
  useCallback,
  useState,
} from 'react';
import { ANNOUNCE_BRANDS } from '../templates/announce.js';
import { saveDesign, loadDesign } from './designs.js';
import { type ICNewSize } from './home.js';
import {
  type ICLayout,
  applyBrandKit,
  openTemplate,
  layoutFromTemplate,
  defaultRatio,
  resizeLayout,
  type ICTemplate,
  openClean,
} from '../render/layout.js';
import { type Selection } from '../panels/studio-api.js';
import { ipcErrorMessage } from '../../playground/lib/library.js';
import { defaultLayout, findTemplate } from '../templates/templates.js';
import { startThread, goToPage } from '../templates/thread.js';
import {
  inLookOf,
} from './studio-helpers.js';
import type { Dispatch, SetStateAction } from 'react';

/** Starting a design from a template or from nothing, and leaving one with unsaved changes. */
export function useDesignLifecycle({
  setLayout,
  setSelId,
  setMultiSel,
  setTab,
  setView,
  homeBrand,
  layout,
  sceneUrl,
}: {
  setLayout: (fn: (l: ICLayout) => ICLayout) => void;
  setSelId: Dispatch<SetStateAction<Selection>>;
  setMultiSel: Dispatch<SetStateAction<string[]>>;
  setTab: Dispatch<SetStateAction<"avatar" | "templates" | "elements">>;
  setView: Dispatch<SetStateAction<"home" | "editor">>;
  homeBrand: string;
  layout: ICLayout;
  sceneUrl: string | null;
}) {
  const resetTemplate = useCallback(() => {
    setLayout((l) => {
      // A thread starts over as a whole, on the page that was open.
      const template = findTemplate(l.thread?.root ?? l.templateId);
      const fresh = layoutFromTemplate(
        template,
        undefined,
        undefined,
        l.ratio ?? defaultRatio(template),
      );
      const reset = { ...startThread(fresh, template), drafts: l.drafts, saved: l.saved };
      return l.thread ? goToPage(reset, l.thread.at) : reset;
    });
    setSelId(null);
  }, [setLayout]);

  const chooseTemplate = useCallback(
    (t: ICTemplate) => {
      setLayout((l) => {
        if (l.saved) {
          const clean = openClean(l, t, (bare) =>
            startThread(
              layoutFromTemplate(t, bare, findTemplate(l.templateId), l.ratio ?? defaultRatio(t)),
              t,
            ),
          );
          return inLookOf(clean, l, t);
        }
        return inLookOf(
          openTemplate(l, findTemplate(l.templateId), t, (cur) =>
            startThread(
              layoutFromTemplate(t, cur, findTemplate(cur.templateId), cur.ratio ?? defaultRatio(t)),
              t,
            ),
          ),
          l,
          t,
        );
      });
      setSelId(null);
    },
    [setLayout],
  );

  // Starting from home or the + menu replaces the design; undo brings the old one back.
  const startDesign = useCallback(
    (next: ICLayout) => {
      setLayout(() => next);
      setSelId(null);
      setMultiSel([]);
      setTab('templates');
      setView('editor');
    },
    [setLayout],
  );

  const newDesign = useCallback(
    (size: ICNewSize) => {
      const blank =
        'ratio' in size
          ? resizeLayout(defaultLayout(), findTemplate('blank'), size.ratio)
          : resizeLayout(defaultLayout(), findTemplate('blank'), 'custom', size);
      const kit = ANNOUNCE_BRANDS.find((b) => b.id === homeBrand)?.kit;
      startDesign(kit ? applyBrandKit(blank, kit) : blank);
    },
    [startDesign, homeBrand],
  );

  const fromTemplate = useCallback(
    (t: ICTemplate) =>
      startDesign(startThread(layoutFromTemplate(t, undefined, undefined, defaultRatio(t)), t)),
    [startDesign],
  );

  // What the person was about to do when a saved design with unsaved edits was in the way.
  const [leaving, setLeaving] = useState<{ go: () => void } | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const unsaved = !!layout.saved?.dirty;
  /** Runs `go` now, or asks first when it would drop edits the library copy does not have. */
  const leave = (go: () => void) => {
    setLeaveError(null);
    if (unsaved) setLeaving({ go });
    else go();
  };
  const saveAndLeave = () => {
    const at = layout.saved;
    if (!at || !leaving) return;
    saveDesign(layout, sceneUrl, at.name, false).then(
      () => {
        setLeaving(null);
        leaving.go();
      },
      (err) => setLeaveError(ipcErrorMessage(err)),
    );
  };
  const revertToSaved = () => {
    const at = layout.saved;
    if (!at) return;
    void loadDesign(at.id, at.name).then(
      (stored) => {
        setLayout(() => stored);
        setSelId(null);
        setMultiSel([]);
      },
      () => undefined,
    );
  };

  const goHome = () => {
    setSelId(null);
    setMultiSel([]);
    setView('home');
  };

  return {
    resetTemplate,
    chooseTemplate,
    startDesign,
    newDesign,
    fromTemplate,
    leaving,
    setLeaving,
    leaveError,
    unsaved,
    leave,
    saveAndLeave,
    revertToSaved,
    goHome,
  };
}
