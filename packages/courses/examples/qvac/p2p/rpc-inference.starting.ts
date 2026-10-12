import {
  discoverRpcServers,
  getRpcDeviceMap,
  loadModel,
  completion,
  unloadModel,
  close,
  LLAMA_3_2_1B_INST_Q4_0,
} from "@qvac/sdk";

const topic = "my-private-rpc-group";

try {
  // 1: discover servers on the topic and keep two

  // 2: map the servers' devices to aliases

  // 3: load the model across the mapped devices

  // 4: stream a completion, then unload the model
} catch (error) {
  console.error("✖", String(error));
  process.exitCode = 1;
} finally {
  await close();
}
