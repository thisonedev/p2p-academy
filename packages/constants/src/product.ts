export const PRODUCT_NAME = 'P2P Academy';

// The products inside the app. A new one gets its entry here and the nav picks it up.
export const PRODUCTS = {
  academy: { name: 'Academy', nav: 'Learn', href: '/courses' },
  playground: { name: 'Playground', nav: 'Play', href: '/playground' },
} as const;

export function pageTitle(page: string): string {
  return `${page} · ${PRODUCT_NAME}`;
}
