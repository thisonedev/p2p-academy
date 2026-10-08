'use client';

import { useUserHydrated, useUserStore } from '@academy/core';
import { DonateButton } from '../shell/donate-button.js';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { DevicesPanel } from './devices-panel.js';
import { PendingRequestsSection } from './device-sections.js';
import { ProfileOnboarding } from '../account/profile-onboarding.js';
import { Card } from '../ui/card.js';
import { isDesktopApp } from '../../lib/academy.js';
import { AboutTable, DeviceTable } from './settings-tables.js';
import { PerDeviceRunLog } from './per-device-run-log.js';
import { ModelsTab } from './models-tab.js';
import { useSettingsModels } from './use-settings-models.js';

const SETTINGS_TABS = [
  { id: 'models', label: 'Models' },
  { id: 'profile', label: 'Profile' },
  { id: 'paired', label: 'Paired devices' },
  { id: 'device', label: 'My device' },
  { id: 'about', label: 'About' },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

export function SettingsPage() {
  const hydrated = useUserHydrated();
  const username = useUserStore((s) => s.username);
  const openSignInPrompt = useUserStore((s) => s.openSignInPrompt);
  const router = useRouter();

  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabId>('models');

  // Settings is desktop-only; on web, bounce back to the home page rather than show a dead page.
  useEffect(() => {
    setIsDesktop(isDesktopApp());
  }, []);

  useEffect(() => {
    if (isDesktop === false) router.replace('/');
  }, [isDesktop, router]);

  const m = useSettingsModels({ hydrated, username, openSignInPrompt });
  const { loadError, device } = m;

  if (!hydrated || isDesktop === null) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm text-canvas-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!isDesktop) {
    // Redirect already scheduled. Keep the loading frame so a production build
    // doesn't paint Electron's #070707 window as a blank black screen.
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm text-canvas-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!username) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Settings
          </p>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-canvas-foreground sm:text-4xl">
            Sign in to continue
          </h1>
          <p className="max-w-xl text-sm text-canvas-muted-foreground sm:text-base">
            Settings are tied to your account so progress, downloaded models, and device details
            stay together across rebuilds.
          </p>
        </header>
        <button
          type="button"
          onClick={openSignInPrompt}
          className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-emerald-400"
        >
          Sign in
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center gap-1 text-xs text-canvas-muted-foreground transition-colors hover:text-canvas-foreground"
      >
        <span aria-hidden>←</span>
        <span>Back</span>
      </button>
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Settings
        </p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-canvas-foreground sm:text-4xl">
          Your workspace
        </h1>
        <p className="max-w-2xl text-sm text-canvas-muted-foreground sm:text-base">
          Manage the models downloaded for the lessons, pair with another device, and see
          what hardware QVAC runs on. Share the device details when reporting a lesson that
          misbehaves on your hardware.
        </p>
      </header>

      {loadError ? (
        <div className="mb-6 rounded-md border border-red-300/40 bg-red-300/10 p-3 text-sm text-red-300">
          {loadError}
        </div>
      ) : null}

      <div role="tablist" aria-label="Settings sections" className="mb-6 flex flex-wrap gap-2">
        {SETTINGS_TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`settings-panel-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-lg border px-3.5 py-2 font-mono text-[11.5px] uppercase tracking-[0.06em] transition-colors ${
                isActive
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-canvas-border text-canvas-muted-foreground hover:text-canvas-foreground'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'models' ? <ModelsTab m={m} /> : null}

      {activeTab === 'profile' ? (
        <section
          role="tabpanel"
          id="settings-panel-profile"
          aria-labelledby="settings-tab-profile"
          className="space-y-5 pb-8 sm:pb-12"
        >
          <ProfileOnboarding />
        </section>
      ) : null}

      {activeTab === 'paired' ? (
        <section
          role="tabpanel"
          id="settings-panel-paired"
          aria-labelledby="settings-tab-paired"
          className="pb-8 sm:pb-12"
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card muted>
              <h2 className="mb-1 text-lg font-semibold text-canvas-foreground sm:text-xl">
                Paired devices
              </h2>
              <p className="mb-4 text-sm text-canvas-muted-foreground">
                Pair this desktop with another install to run lessons across machines. All
                pairing happens peer-to-peer, no server in the path.
              </p>
              <DevicesPanel />
            </Card>
            <Card muted>
              <h2 className="mb-1 text-lg font-semibold text-canvas-foreground sm:text-xl">
                Activity
              </h2>
              <p className="mb-4 text-sm text-canvas-muted-foreground">
                Pending pair requests and run history for paired devices.
              </p>
              <div className="space-y-6">
                <PendingRequestsSection />
                <PerDeviceRunLog />
              </div>
            </Card>
          </div>
        </section>
      ) : null}

      {activeTab === 'device' ? (
        <Card as="section" muted
          role="tabpanel"
          id="settings-panel-device"
          aria-labelledby="settings-tab-device"
        >
          <h2 className="mb-1 text-lg font-semibold text-canvas-foreground sm:text-xl">
            My device
          </h2>
          <p className="mb-4 text-sm text-canvas-muted-foreground">
            Hardware QVAC sees on this machine. Different devices run the same lesson at very
            different speeds.
          </p>
          {device === null ? (
            <p className="text-sm text-canvas-muted-foreground">
              {isDesktop ? 'Loading…' : 'Open the desktop app to see device details.'}
            </p>
          ) : (
            <DeviceTable info={device} />
          )}
        </Card>
      ) : null}

      {activeTab === 'about' ? (
        <Card as="section" muted
          role="tabpanel"
          id="settings-panel-about"
          aria-labelledby="settings-tab-about"
        >
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-canvas-foreground sm:text-xl">About</h2>
            <DonateButton />
          </div>
          <p className="mb-4 text-sm text-canvas-muted-foreground">
            App version and the QVAC SDK version this build was compiled and tested against.
          </p>
          <AboutTable />
        </Card>
      ) : null}
    </main>
  );
}