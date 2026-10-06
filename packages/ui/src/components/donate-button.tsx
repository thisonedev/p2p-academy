'use client';

import { Check, Copy, Heart, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

// Same address as the README's Funding section.
const ADDRESS = '0x409072a91aa81C9759E1170993e29F8Ec83E6405';
const CONTACT = 'https://thisonedev.github.io/';

/** A Donate button that opens a sheet with the wallet address, a copy button and a QR code. */
export function DonateButton() {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || qr) return;
    QRCode.toDataURL(ADDRESS, { margin: 1, width: 360 })
      .then(setQr)
      .catch(() => undefined);
  }, [open, qr]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const copy = () => {
    void navigator.clipboard.writeText(ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-fuchsia-400/40 px-3 py-1.5 text-sm text-fuchsia-300 hover:bg-fuchsia-400/10"
      >
        <Heart className="size-3.5" /> Donate
      </button>
      {open && (
        // biome-ignore lint/a11y/noStaticElementInteractions: clicking the dimmed backdrop closes the sheet
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Donate"
            className="w-full max-w-sm rounded-xl border border-canvas-border bg-canvas-muted p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <p className="flex-1 text-sm text-canvas-foreground">
                The Academy is a community-owned project. Every coin goes a long way.
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-canvas-muted-foreground hover:text-canvas-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mx-auto mt-4 flex size-44 items-center justify-center rounded-lg bg-white p-2">
              {/* biome-ignore lint/performance/noImgElement: a generated data URL */}
              {qr && <img src={qr} alt="Wallet address QR code" className="size-full" />}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-canvas-border bg-canvas px-2.5 py-2 text-xs text-canvas-foreground">
                {ADDRESS}
              </code>
              <button
                type="button"
                title={copied ? 'Copied' : 'Copy address'}
                aria-label="Copy address"
                onClick={copy}
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-canvas-border bg-canvas text-canvas-muted-foreground hover:text-canvas-foreground"
              >
                {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              {['USDT', 'USDC', 'ETH'].map((t) => (
                <span key={t} className="rounded-md border border-canvas-border px-2 py-0.5 text-canvas-muted-foreground">
                  {t}
                </span>
              ))}
              <a
                href={CONTACT}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-canvas-muted-foreground underline hover:text-canvas-foreground"
              >
                Sponsorships and grants
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
