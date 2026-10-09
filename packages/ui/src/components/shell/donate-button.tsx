'use client';

import { CONTACT_URL } from '@academy/constants';
import { Check, Copy, Heart, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { copyText } from '../../lib/clipboard.js';
import { Overlay } from '../ui/overlay.js';
import { IconButton } from '../ui/icon-button.js';
import { useEscape } from '../../hooks/use-escape.js';
import { useFlash } from '../../hooks/use-flash.js';

// Same address as the README's Funding section.
const ADDRESS = '0x409072a91aa81C9759E1170993e29F8Ec83E6405';

const COINS = [
  ['USDT', '#26a17b'],
  ['USDC', '#2775ca'],
  ['ETH', '#8c9eff'],
] as const;

/** The four ticks around the QR code, one per corner. */
const CORNERS = [
  'left-0 top-0 rounded-tl-md border-l-[1.5px] border-t-[1.5px]',
  'right-0 top-0 rounded-tr-md border-r-[1.5px] border-t-[1.5px]',
  'bottom-0 left-0 rounded-bl-md border-b-[1.5px] border-l-[1.5px]',
  'bottom-0 right-0 rounded-br-md border-b-[1.5px] border-r-[1.5px]',
];

/** A Donate button that opens a sheet with a QR code, the wallet address and a copy button. */
export function DonateButton() {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, flashCopied] = useFlash<true>();

  useEffect(() => {
    if (!open || qr) return;
    QRCode.toDataURL(ADDRESS, { margin: 1, width: 360 })
      .then(setQr)
      .catch(() => undefined);
  }, [open, qr]);

  useEscape(() => setOpen(false), open);

  const copy = () => {
    void copyText(ADDRESS).then(() => flashCopied(true));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-support/40 px-3 py-1.5 text-sm text-support hover:bg-support/10"
      >
        <Heart className="size-3.5" /> Donate
      </button>
      {open && (
        <Overlay onClose={() => setOpen(false)}>
          {/* A one pixel gradient edge: the padding shows the gradient around the panel inside. */}
          <div
            role="dialog"
            aria-label="Donate"
            className="w-full max-w-sm rounded-[18px] bg-[linear-gradient(160deg,rgba(240,171,252,.55),var(--color-canvas-border)_35%,var(--color-canvas-border)_65%,rgba(143,191,138,.5))] p-px shadow-[0_30px_60px_-15px_rgba(0,0,0,.7),0_0_80px_-30px_rgba(240,171,252,.35)]"
          >
            <div className="relative rounded-[17px] bg-canvas-muted bg-[radial-gradient(120%_60%_at_50%_0%,rgba(240,171,252,.1),transparent_60%)] px-5.5 pb-4.5 pt-5.5">
              <IconButton
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4"
              >
                <X className="size-4" />
              </IconButton>
              <p className="text-center font-mono text-micro font-semibold uppercase tracking-[0.14em] text-support">
                Donate
              </p>
              <p className="mt-1.5 text-center text-title font-semibold tracking-tight text-canvas-foreground">
                Support the Academy
              </p>
              <div className="relative mx-auto mt-5 size-51 p-2.5">
                {CORNERS.map((c) => (
                  <span key={c} aria-hidden className={`absolute size-4 border-support/80 ${c}`} />
                ))}
                <div className="flex size-full items-center justify-center rounded-[10px] bg-white p-2.5">
                  {/* biome-ignore lint/performance/noImgElement: a generated data URL */}
                  {qr && <img src={qr} alt="Wallet address QR code" className="size-full" />}
                </div>
              </div>
              <div className="mt-4 flex justify-center gap-3.5 font-mono text-caption text-canvas-muted-foreground">
                {COINS.map(([name, color]) => (
                  <span key={name} className="inline-flex items-center gap-1.5">
                    <span className="size-[7px] rounded-full" style={{ background: color }} />
                    {name}
                  </span>
                ))}
              </div>
              <code className="mt-4 block truncate rounded-[10px] border border-canvas-border bg-canvas px-3 py-2.5 text-center font-mono text-xs text-canvas-foreground">
                {ADDRESS.slice(0, 10)}
                <span className="text-canvas-dimmer">{ADDRESS.slice(10, -10)}</span>
                {ADDRESS.slice(-10)}
              </code>
              <button
                type="button"
                onClick={copy}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary p-2.5 text-body font-semibold text-fd-primary-foreground hover:brightness-105"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? 'Copied' : 'Copy address'}
              </button>
              <p className="mt-4 text-center text-caption leading-relaxed text-canvas-muted-foreground">
                The Academy is a community-owned project. Every coin goes a long way. For
                sponsorships and grants, reach out{' '}
                <a
                  href={CONTACT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-canvas-foreground"
                >
                  here
                </a>
                .
              </p>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}
