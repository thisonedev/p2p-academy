import { PRODUCTS, pageTitle } from '@academy/constants';
import { DesignStudioPage } from '@academy/ui';

export const metadata = {
  title: pageTitle(PRODUCTS.studio.nav),
};

export default function Page() {
  return <DesignStudioPage />;
}
