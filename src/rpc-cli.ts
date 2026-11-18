import { parseRpcArgs, runRpc } from './rpc-runner.js';
Promise.resolve().then(() => runRpc(parseRpcArgs(process.argv.slice(2)))).catch(error => {
  console.error(`[rpc] ${error instanceof Error ? error.message : 'Error inesperado'}`);
  process.exitCode = 1;
});
