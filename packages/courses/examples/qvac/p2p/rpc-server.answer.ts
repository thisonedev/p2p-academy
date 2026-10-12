import { createInterface } from "node:readline/promises";
import { startRpcServer, stopRpcServer, close } from "@qvac/sdk";

const host = "10.0.0.2"; // this machine's private IPv4 address
const topic = "my-private-rpc-group";

try {
  const server = await startRpcServer({
    host,
    allowNonLoopbackHost: true,
    discoveryTopic: topic,
  });

  const input = createInterface({ input: process.stdin, output: process.stderr });
  try {
    console.error(`▸ Serving ${server.url}; RDMA capable: ${server.rdmaCapable}`);
    await input.question("▸ Press Enter to stop after clients unload their models.\n");
  } finally {
    input.close();
    await stopRpcServer({ serverId: server.serverId });
  }
} catch (error) {
  console.error("✖", String(error));
  process.exitCode = 1;
} finally {
  await close();
}
