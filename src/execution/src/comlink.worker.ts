// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// eslint-disable-next-line local-rules/node-imports
const { parentPort } = require('worker_threads');
/**
 * A WebWorker entrypoint that uses comlink to handle postMessage details
 */
// import { expose } from 'comlink';
import { PyodideRemoteKernel } from './worker';

// const worker = new PyodideRemoteKernel();
// expose(worker);

async function main() {
    // @ts-ignore no need of types
    const Comlink = await import('comlink/dist/esm/comlink.mjs');
    // @ts-ignore no need of types
    const nodeEndpoint = await import('comlink/dist/esm/node-adapter.mjs');
    const worker = new PyodideRemoteKernel();
    Comlink.expose(worker, nodeEndpoint.default(parentPort));
}
main().catch((reason) => console.error(reason));
