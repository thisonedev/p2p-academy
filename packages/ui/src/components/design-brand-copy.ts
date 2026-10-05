// Tether and QVAC copy for templates whose layouts every brand shares, so a Tether or QVAC post
// names its own products. Keyed by pack, family and layer role; a role that repeats takes its
// values in order.

import { type ICTemplate, refit } from './design-layout.js';

type Copy = Record<string, string | string[]>;

const COPY: Record<'tether' | 'qvac', Record<string, Copy>> = {
  tether: {
    'Announcement/ecosystem': {
      title: 'New USDT integrations  |  Aug 10-23',
      category: ['WALLETS', 'PAYMENTS', 'EXCHANGES', 'DEFI', 'LENDING', 'REMITTANCE', 'MERCHANTS', 'CARDS', 'INFRA', 'SECURITY'],
    },
    'Partnership/fan': { headline: 'Tether × Partner rewards', cta: 'Learn more' },
    'Info/volume': { headline: 'Lifetime USDT transfer volume' },
    'Info/breakdown': {
      headline: 'USDT supply tops $140B',
      subtitle: 'USDT supply by network ($B)',
      series_1: 'Tron',
      series_2: 'Ethereum',
      series_3: 'Solana',
      series_4: 'TON',
      series_5: 'Other',
    },
    'Info/compare': {
      headline: 'How people send money',
      caption: ['cash first', 'digital first'],
      label: ['Cash 80%', 'USDT 80%'],
      note: ['USDT 20%', 'Cash 20%'],
    },
    'Info/coin-grids': { headline: 'Transfer fees cut in half', amount: ['$1.00 fee', '$0.50 fee'] },
    'Info/merge': {
      headline: 'We moved to a new network',
      new_lane: 'New network Faster, cheaper',
      old_lane: 'Old network Slower, costlier',
      moment: 'The migration',
    },
    'Info/halvings': { headline: 'Transfer fees keep falling' },
    'Info/report': { headline: 'Transparency Report' },
    'Product Updates/release': { product: 'Wallet', version: '2.4.0' },
    'Product Updates/feature': { product: 'WDK', headline: 'Gasless USDT transfers, built in.' },
    'Product Updates/drop': { tagline: 'Wallets, payments and swaps in one kit', product: 'WDK' },
    'Product Updates/spotlight': { headline: 'Your money, your keys', sub: 'Meet the new Tether wallet. Self-custody by default.' },
    'Product Updates/surface': { headline: 'Your dollars, in your pocket', sub: 'Hold, send and receive USDT anywhere.' },
    'Threads/howto-cover': { headline: 'Send USDT in 4 steps' },
    'Threads/guide-cover': {
      headline: '4 steps to your first USDT payment',
      step_1: 'Get a wallet',
      step_2: 'Add USDT',
      step_3: 'Paste the address',
      step_4: 'Send in one tap',
    },
    'Threads/teardown-cover': { headline: 'How USDT redemptions work', sub: 'The process, step by step. Eight posts.' },
    'Threads/list-cover': { headline: '7 ways to use USDT this week' },
  },
  qvac: {
    'Announcement/ecosystem': {
      title: 'New QVAC integrations  |  Aug 10-23',
      category: ['LLMS', 'SPEECH', 'VISION', 'AGENTS', 'TRANSLATION', 'OCR', 'SEARCH', 'DEVICES', 'TOOLS', 'APPS'],
    },
    'Partnership/fan': { headline: 'The QVAC × Partner hackathon', cta: 'Sign up' },
    'Info/volume': { number: '2.1M', headline: 'Models downloaded peer to peer' },
    'Info/breakdown': {
      headline: 'Local inference tops 50M runs',
      subtitle: 'Runs by task (M)',
      series_1: 'Chat',
      series_2: 'Speech',
      series_3: 'Vision',
      series_4: 'Translation',
      series_5: 'Other',
    },
    'Info/compare': {
      headline: 'Where AI runs',
      caption: ['cloud first', 'local first'],
      label: ['Cloud 80%', 'Local 80%'],
      note: ['Local 20%', 'Cloud 20%'],
    },
    'Info/coin-grids': { headline: 'Model size cut in half', amount: ['16 GB model', '8 GB model'] },
    'Info/merge': {
      headline: 'We moved inference on-device',
      new_lane: 'On-device Local models',
      old_lane: 'Cloud API Remote models',
      moment: 'The switch',
    },
    'Info/halvings': { headline: 'Models keep shrinking' },
    'Info/report': { headline: 'Local AI Report' },
    'Info/growth': { headline: 'QVAC DOWNLOADS CROSS 4.6M' },
    'Info/reserve': { period_label: 'MONTHLY UPDATE', stat: '38K+', stat_label: 'NEW DEVELOPERS' },
    'Product Updates/spotlight': { headline: 'Your AI, on your device', sub: 'Meet the new QVAC app. Private by default.' },
    'Product Updates/floating': { sub: 'Chat, transcribe and translate without leaving the app.' },
    'Threads/howto-cover': {
      headline: 'Run your first local model in 4 steps',
      wallet_title: 'Pick a model',
      wallet_1: 'Qwen3 8B',
      wallet_2: 'Whisper',
      wallet_3: 'Llama 3.2',
      wallet_4: 'Stable Diffusion',
    },
    'Threads/guide-cover': {
      headline: '4 steps to your first local model',
      step_1: 'Install the SDK',
      step_2: 'Pick a model',
      step_3: 'Load it once',
      step_4: 'Prompt it offline',
    },
    'Threads/explainer-cover': { headline: 'Your model, on your laptop.', sub: 'How local inference works, in six posts.' },
    'Threads/teardown-cover': { headline: 'How QVAC runs a model offline', sub: 'The runtime, piece by piece. Eight posts.' },
    'Threads/list-cover': { headline: '7 local models I use this week' },
    'Threads/recap-cover': { stat_label_2: 'new models' },
  },
};

/** The template with its brand's own copy, in every size. Other brands come back unchanged. */
export function withBrandCopy(t: ICTemplate): ICTemplate {
  const copy = t.brand === 'tether' || t.brand === 'qvac' ? COPY[t.brand][`${t.pack}/${t.family}`] : undefined;
  if (!copy) return t;
  const apply = (els: ICTemplate['els']) => {
    const seen = new Map<string, number>();
    return els.map((e) => {
      if (e.t !== 'text' && e.t !== 'pill') return e;
      const value = copy[e.role];
      if (value === undefined) return e;
      const n = seen.get(e.role) ?? 0;
      seen.set(e.role, n + 1);
      const text = Array.isArray(value) ? value[n] : value;
      // Keeps the line count each size was designed with.
      return text === undefined ? e : { ...e, text: refit(text, e.text) };
    });
  };
  return {
    ...t,
    els: apply(t.els),
    variants: t.variants && Object.fromEntries(Object.entries(t.variants).map(([r, els]) => [r, apply(els ?? [])])),
  };
}
