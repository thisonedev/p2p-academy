import { PRODUCTS, pageTitle } from '@academy/constants';
import { Playground } from '@academy/ui';

export const metadata = {
  title: pageTitle(PRODUCTS.playground.nav),
};

export default function Page() {
  return <Playground />;
}
