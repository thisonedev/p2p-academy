'use client';

import { formatGb } from '@academy/constants';
import type { AcademyDeviceInfo } from '@academy/validation';
import { Box, Cpu, MemoryStick, HardDrive, Database, Tag, Package } from 'lucide-react';
import { type ReactNode, useState, useEffect } from 'react';
import { SectionLabel } from '../ui/section-label.js';

export function DeviceTable({ info }: { info: AcademyDeviceInfo }) {
  const rows: { icon: ReactNode; label: string; value: string; hint?: string }[] = [
    { icon: <Box className="size-4" />, label: 'Operating system', value: info.osLabel, hint: info.arch },
    {
      icon: <Cpu className="size-4" />,
      label: 'Processor',
      value: info.model,
      hint: `${info.cpuPhysicalCores} physical · ${info.cpuCores} logical cores`,
    },
    { icon: <MemoryStick className="size-4" />, label: 'Memory', value: formatGb(info.memoryBytes) },
    {
      icon: <HardDrive className="size-4" />,
      label: 'Storage',
      value: formatGb(info.storageBytes),
      hint: `${formatGb(info.storageFreeBytes)} free · ${info.storagePath}`,
    },
    {
      icon: <Database className="size-4" />,
      label: 'Graphics',
      value: info.gpu ?? 'Not detected',
      hint: info.gpu ? undefined : 'GPU info is unavailable on this platform.',
    },
  ];
  return (
    <ul className="divide-y divide-canvas-border overflow-hidden rounded-lg border border-canvas-border bg-canvas">
      {rows.map((r) => (
        <li
          key={r.label}
          className="flex items-start gap-3 px-4 py-3 sm:px-5"
        >
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-canvas-muted text-primary">
            {r.icon}
          </span>
          <div className="min-w-0 flex-1">
            <SectionLabel>
              {r.label}
            </SectionLabel>
            <p className="mt-0.5 truncate font-mono text-sm text-canvas-foreground" title={r.value}>
              {r.value}
            </p>
            {r.hint ? <p className="mt-0.5 text-xs text-canvas-muted-foreground">{r.hint}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

const QVAC_SDK_PACKAGE = '@qvac/sdk';

function stripSemverRange(range: string): string {
  return range.replace(/^[\^~]/, '');
}

export function AboutTable() {
  const [pkg, setPkg] = useState<{ version: string; commit?: string | null; dependencies?: Record<string, string> } | null>(null);

  useEffect(() => {
    setPkg(window.academy?.pkg?.() ?? null);
  }, []);

  const qvacSdkRange = pkg?.dependencies?.[QVAC_SDK_PACKAGE];
  const rows: { icon: ReactNode; label: string; value: string; hint?: string }[] = [
    {
      icon: <Tag className="size-4" />,
      label: 'App version',
      value: pkg?.version ? `${pkg.version}${pkg.commit ? ` (${pkg.commit.slice(0, 7)})` : ''}` : 'Unknown',
    },
    {
      icon: <Package className="size-4" />,
      label: 'QVAC SDK',
      value: qvacSdkRange ? stripSemverRange(qvacSdkRange) : 'Unknown',
    },
  ];
  return (
    <ul className="divide-y divide-canvas-border overflow-hidden rounded-lg border border-canvas-border bg-canvas">
      {rows.map((r) => (
        <li key={r.label} className="flex items-start gap-3 px-4 py-3 sm:px-5">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-canvas-muted text-primary">
            {r.icon}
          </span>
          <div className="min-w-0 flex-1">
            <SectionLabel>
              {r.label}
            </SectionLabel>
            <p className="mt-0.5 truncate font-mono text-sm text-canvas-foreground" title={r.value}>
              {r.value}
            </p>
            {r.hint ? <p className="mt-0.5 text-xs text-canvas-muted-foreground">{r.hint}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
