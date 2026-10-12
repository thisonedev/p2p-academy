import { createInterface } from "node:readline/promises";
import { startRpcServer, stopRpcServer, close } from "@qvac/sdk";

const host = "10.0.0.2"; // this machine's private IPv4 address
const topic = "my-private-rpc-group";

try {
  // 1: start an RPC server on the private address

  // 2: serve until Enter is pressed, then stop the server
} catch (error) {
  console.error("✖", String(error));
  process.exitCode = 1;
} finally {
  await close();
}
