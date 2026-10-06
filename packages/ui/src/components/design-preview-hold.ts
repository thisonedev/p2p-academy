// One pause for every video preview in the Export sheet. Several previews play at once there,
// one a size, and while they play they take time from the render of a download.

interface Playing {
  playing: boolean;
}

export const previews = {
  paused: false,
  /** Seconds played so far, which stand still while paused. Previews that share a clock read
   *  this, so every size stays in step through a pause. */
  played: 0,
  last: 0,
  clocks: new Set<Playing>(),
  seen: null as Event | null,
  /** Pauses or plays every preview. */
  set(paused: boolean): void {
    this.paused = paused;
    for (const clock of this.clocks) clock.playing = !paused;
  },
  /** Flips them once for a click or a key press, however many previews heard it. */
  toggle(e?: Event): void {
    if (e && e === this.seen) return;
    this.seen = e ?? null;
    this.set(!this.paused);
  },
  /** The shared clock at this frame. Any number of previews may ask in one frame. */
  at(now: number): number {
    if (now !== this.last) {
      if (!this.paused && this.last) this.played += Math.min(1, (now - this.last) / 1000);
      this.last = now;
    }
    return this.played;
  },
  /** A preview's clock joins on mount and leaves on unmount. */
  join(clock: Playing): () => void {
    clock.playing = !this.paused;
    this.clocks.add(clock);
    return () => {
      this.clocks.delete(clock);
    };
  },
};
