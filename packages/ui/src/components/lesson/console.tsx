'use client';

import { Loader2 } from 'lucide-react';
import { useRef, useEffect, useContext } from 'react';
import type { LessonConsoleProps } from './console-types.js';
import { ConsoleBackgroundContext, ShuffleWord, TimelineRow } from './console-rail.js';
import {
  CheckCard,
  ConfirmCard,
  EmptyState,
  MediaCard,
  RunCard,
  UserBubble,
  checkState,
} from './console-cards.js';
import { AssistantBubble, RawContent } from './console-markdown.js';

export function LessonConsole({ entries, onStopCheck, emptyStateText, onConfirm, topBorder = true }: LessonConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Streaming keeps this effect firing every chunk; pinning unconditionally made it
  // impossible to scroll up mid-reply. Stick to the bottom only while already there.
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [entries]);

  // Whatever is still going, named once for the pinned line below. Keeping it
  // out of the scroller is the point: it used to sit after the last output and
  // walk down the panel as more arrived.
  const busy = entries.some(
    (e) => (e.kind === 'run' && e.status === 'running') || (e.kind === 'chat-assistant' && e.streaming),
  );
  const background = useContext(ConsoleBackgroundContext);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${topBorder ? 'border-t border-canvas-border' : ''}`}>
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 space-y-0 overflow-x-hidden overflow-y-auto p-3 text-sm"
      style={{ backgroundColor: background }}
    >
      {entries.length === 0 ? <EmptyState text={emptyStateText} /> : null}
      {entries.map((entry) => {
        if (entry.kind === 'chat-user') return <UserBubble key={entry.id} content={entry.content} />;
        if (entry.kind === 'chat-assistant') {
          // The pinned line below already covers an answer with nothing in it
          // yet, so it gets no row of its own until it has something to say.
          if (entry.streaming && entry.content.length === 0) return null;
          return (
            <TimelineRow key={entry.id} state={entry.streaming ? 'thinking' : 'success'} card>
              {entry.raw ? <RawContent content={entry.content} /> : <AssistantBubble content={entry.content} />}
            </TimelineRow>
          );
        }
        // No outer dot: the run's own stages carry theirs, and this one used
        // to appear the moment a run started, before it had anything to show.
        if (entry.kind === 'run') return <RunCard key={entry.id} entry={entry} />;
        if (entry.kind === 'confirm') {
          return (
            <TimelineRow key={entry.id} state={entry.answer === null ? 'thinking' : 'success'} card>
              <ConfirmCard entry={entry} onAnswer={(answer) => onConfirm?.(entry.id, answer)} />
            </TimelineRow>
          );
        }
        if (entry.kind === 'media') {
          return (
            <TimelineRow key={entry.id} state="success" card>
              <MediaCard entry={entry} />
            </TimelineRow>
          );
        }
        return (
          <TimelineRow key={entry.id} state={checkState(entry)} card>
            <CheckCard entry={entry} onStop={() => onStopCheck(entry.id)} />
          </TimelineRow>
        );
      })}
    </div>
    {busy ? (
      <p
        className="flex items-center gap-2 px-4 py-2 font-mono text-xs text-canvas-muted-foreground"
        style={{ backgroundColor: background }}
      >
        <Loader2 className="size-3 animate-spin" />
        <ShuffleWord active />
      </p>
    ) : null}
    </div>
  );
}
