import { PRODUCTS } from '@academy/constants';
import { loader } from 'fumadocs-core/source';
import { docs } from '@/.source';

export const source = loader({
  baseUrl: PRODUCTS.academy.href,
  source: docs.toFumadocsSource(),
});

export function getPage(params: { slug?: string[] }) {
  const slug = params.slug ?? [];
  return source.getPage(slug);
}
