// Regression: `current` is only set when a load finishes, so calls made
// during a load each started their own sdk.loadModel for the same file.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const test = require('brittle');

// The sandbox has no model file, and this suite must not download one.
process.env.ACADEMY_NO_DIRECT_FETCH = '1';

// Sandbox the models root by rebinding os.homedir() to point at a tmp dir.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-load-inflight-test-'));
const stubbedHome = path.join(tmpRoot, 'fakehome');
const realHomedir = os.homedir;
os.homedir = function stubbedHomedir() { return stubbedHome; };
fs.mkdirSync(path.join(stubbedHome, '.qvac', 'models'), { recursive: true });

const chatPath = require.resolve('../../electron/chat.cjs');
const sdkPath = require.resolve('@qvac/sdk');

function freshChat(loadModelImpl) {
  delete require.cache[sdkPath];
  delete require.cache[chatPath];
  const stub = {
    QWEN3_4B_INST_Q4_K_M: { name: 'Qwen3-4B-Q4_K_M' },
    QWEN3_1_7B_INST_Q4: { name: 'Qwen3-1.7B-Q4_0' },
    QWEN3_600M_INST_Q4: { name: 'Qwen3-0.6B-Q4_0' },
    QWEN3_8B_INST_Q4_K_M: { name: 'Qwen3-8B-Q4_K_M' },
    LLAMA_3_2_1B_INST_Q4_0: { name: 'Llama-3.2-1B-Instruct-Q4_0' },
    loadModel: async () => loadModelImpl(),
    unloadModel: async () => undefined,
    getLoadedModelInfo: async () => { throw new Error('not configured in this test'); },
  };
  require.cache[sdkPath] = { exports: stub, id: sdkPath, filename: sdkPath, loaded: true, children: [], paths: [] };
  return require(chatPath);
}

test('chat-load-inflight - overlapping loads of one model share a single sdk.loadModel', async (t) => {
  let calls = 0;
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const chat = freshChat(async () => {
    calls += 1;
    await gate;
    return 'mid';
  });
  const first = chat.load('Qwen3-4B-Q4_K_M.gguf');
  const second = chat.load('Qwen3-4B-Q4_K_M.gguf');
  const third = chat.load('Qwen3-4B-Q4_K_M.gguf');
  finish();
  const results = await Promise.all([first, second, third]);
  t.is(calls, 1, 'sdk.loadModel ran once');
  for (const result of results) t.is(result.modelName, 'Qwen3-4B-Q4_K_M.gguf');
  await chat.unload();
});

test('chat-load-inflight - a failed load does not block the next one', async (t) => {
  let calls = 0;
  let fail = true;
  const chat = freshChat(async () => {
    calls += 1;
    if (fail) throw new Error('forced loadModel failure');
    return 'mid';
  });
  await t.exception(() => chat.load('Qwen3-4B-Q4_K_M.gguf'), /forced loadModel failure/);
  const failedCalls = calls;
  fail = false;
  const result = await chat.load('Qwen3-4B-Q4_K_M.gguf');
  t.is(result.modelName, 'Qwen3-4B-Q4_K_M.gguf');
  t.is(calls, failedCalls + 1, 'the next load reached sdk.loadModel again');
  await chat.unload();
});

test('chat-load-inflight - cleanup runs at end of test session', (t) => {
  os.homedir = realHomedir;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  t.pass();
});
