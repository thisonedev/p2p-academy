import { pageTitle } from '@academy/constants';
import { SettingsPage } from '@academy/ui';

export const metadata = {
  title: pageTitle('Settings'),
};

export default function Page() {
  return <SettingsPage />;
}

export const dynamic = 'force-static';
