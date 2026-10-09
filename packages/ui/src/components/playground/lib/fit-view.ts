// Node cards need a render pass before React Flow knows their real size, so a fit
// after adding or loading nodes waits a tick.
export const FIT_VIEW_DELAY_MS = 50;
export const FIT_VIEW_OPTIONS = { padding: 0.2, duration: 300 } as const;
