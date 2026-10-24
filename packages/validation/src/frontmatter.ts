import { z } from 'zod';

// The same fields as fumadocs-mdx's frontmatterSchema. Importing that loads
// fumadocs-core and its markdown stack into every process that imports this package.
const frontmatterSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  full: z.boolean().optional(),
  _openapi: z.looseObject({}).optional(),
});

const lessonTest = z.object({
  id: z.string(),
  description: z.string(),
  pattern: z.string().optional(),
  contains: z.string().optional(),
});

const lessonQuestionAnswer = z.object({
  text: z.string(),
  correct: z.boolean(),
  // Shown when this wrong answer is picked.
  feedback: z.string().optional(),
});

const lessonQuestion = z.object({
  id: z.string(),
  text: z.string(),
  answers: z.array(lessonQuestionAnswer),
});

// argv slot the runner fills before the lesson's snippet runs.
const lessonArgvSlot = z.object({
  name: z.string(),
  // Where the runner looks up the value at run time.
  from: z.enum([
    'state:lastProviderPublicKey',
    'literal',
  ]),
  // Used when `from: 'literal'`. Acts as a fallback when no override is set.
  default: z.string().optional(),
  // Human-readable label shown in the runner header override input.
  label: z.string().optional(),
});

const requirementsKindSchema = z.enum(['heavy-run', 'large-download']);

export const lessonFrontmatter = frontmatterSchema.extend({
  // Upstream SDK file this lesson's answer was vendored from; the sync workflow uses it to detect drift and refresh the copy.
  sourceExample: z.string().optional(),
  // sha256-prefix hash of the upstream file at last review; mismatches in CI flag stale vendored copies.
  sourceExampleHash: z.string().optional(),
  // Set to true to skip this lesson from the sync workflow.
  noSync: z.boolean().optional(),
  // Pedagogical fields: tests run against the runner's editor, hints progressively unlock, expectedOutput drives the simulated Run.
  hints: z.array(z.string()).optional(),
  expectedOutput: z.array(z.string()).optional(),
  tests: z.array(lessonTest).optional(),
  questions: z.array(lessonQuestion).optional(),
  platforms: z.array(z.enum(['node', 'web', 'mobile', 'desktop'])).optional(),
  // False for a lesson that only works on the machine running it, e.g. one
  // that serves a port a paired device could never reach. Defaults to true.
  pairedMode: z.boolean().optional(),
  // What this lesson costs to run, when that is more than the rest: a large
  // download, a long render. Shown before the student starts it, as label and value rows.
  requirements: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).optional(),
  // The lesson's cost labels: one, or both in a list. `large-download` goes on any lesson whose
  // models total more than 5 GB. Defaults to 'heavy-run' when there are requirements.
  requirementsKind: z.union([requirementsKindSchema, z.array(requirementsKindSchema).min(1)]).optional(),
  // False for a lesson that names a model it may never load, so Run does not
  // fetch that model ahead of the code. Defaults to true.
  prefetchModels: z.boolean().optional(),
  // argv slots the runner resolves before executing the lesson's snippet.
  argv: z.array(lessonArgvSlot).optional(),
  // Hints for the consent prompt, unioned with the host's own detectors (the real trust boundary); network is ordered none < localhost < all.
  network: z.enum(['none', 'localhost', 'all']).optional(),
  device: z.array(z.string()).optional(),
});
