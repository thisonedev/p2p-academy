// stop() has to cancel the SDK run as well as stop reading it. completion()
// takes no AbortSignal, so an uncancelled run keeps the model generating.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const test = require('brittle');

// Same technique as chat-dedupe: chat.cjs reads os.homedir() at lookup time.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-stop-test-'));
os.homedir = function stubbedHomedir() { return path.join(tmpRoot, 'fakehome'); };

const chatPath = require.resolve('../../electron/chat.cjs');
const sdkPath = require.resolve('@qvac/sdk');

function freshChat(seen) {
  delete require.cache[sdkPath];
  delete require.cache[chatPath];
  const stub = {
    QWEN3_600M_INST_Q4: { name: 'Qwen3-0.6B-Q4_0' },
    loadModel: async () => 'model-1',
    unloadModel: async () => undefined,
    getLoadedModelInfo: async () => { throw new Error('not configured in this test'); },
    completion: () => ({
      requestId: 'answer-1',
      events: (async function* stream() {
        while (!seen.cancelled) {
          seen.started = true;
          yield { type: 'contentDelta', text: 'word ' };
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      })(),
    }),
    cancel: async ({ requestId }) => { seen.cancelled = requestId; },
  };
  require.cache[sdkPath] = { exports: stub, id: sdkPath, filename: sdkPath, loaded: true, children: [], paths: [] };
  return require(chatPath);
}

test('chat-stop-cancel - stop() cancels the running completion by its requestId', async (t) => {
  const seen = {};
  const chat = freshChat(seen);
  await chat.load('Qwen3-0.6B-Q4_0.gguf');

  const { requestId } = await chat.send({
    messages: [{ role: 'user', content: 'Write a long essay.' }],
    lessonKey: { chapter: 'x', lesson: 'y' },
  });
  while (!seen.started) await new Promise((resolve) => setTimeout(resolve, 5));

  t.ok(chat.stop(requestId), 'the request was in flight');
  t.is(seen.cancelled, 'answer-1', 'the SDK run was cancelled');
});
