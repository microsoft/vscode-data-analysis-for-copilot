// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { IWorker } from './types';

const RES_SIZE = 256;
const encoder = new TextEncoder();

// const exportedMethods = {
//   hello(str: string) {
//     return `hello ${str}`;
//   },
// };

const sharedCtrlBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
const ctrlBuffer = new Int32Array(sharedCtrlBuffer);
const sharedValueBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * RES_SIZE);
const valueBuffer = new Int32Array(sharedValueBuffer);
const encodeBuffer = new Uint8Array(RES_SIZE); // TextEncoder cant use SharedArrayBuffers

export function ctrlSignal(value: number) {
    Atomics.store(ctrlBuffer, 0, value);
    Atomics.notify(ctrlBuffer, 0);
}

export class SyncMessaging {
    constructor(worker: IWorker) {
        worker.postMessage({
            sharedCtrlBuffer,
            sharedValueBuffer
        });
    }

    send(message: string) {
        const length = encoder.encodeInto(message, encodeBuffer).written;
        for (let i = 0; i < length; i++) {
            Atomics.store(valueBuffer, i, encodeBuffer[i]);
        }

        ctrlSignal(length);
        // // const encoder = new TextEncoder();
        // const encoded = encoder.encode(request);
        // const len = encoded.length;
        // if (len >= RES_SIZE) {
        //   throw new Error('request too large');
        // }
        // const sharedRequestBuffer = new SharedArrayBuffer(
        //   Int32Array.BYTES_PER_ELEMENT * len,
        // );
        // const requestBuffer = new Int32Array(sharedRequestBuffer);
        // const requestView = new Uint8Array(sharedRequestBuffer);
        // requestView.set(encoded);
        // Atomics.store(ctrlBuffer, 0, len);
        // Atomics.notify(ctrlBuffer, 0);
        // await Atomics.wait(ctrlBuffer, 0, 0);
        // const response = new Uint8Array(valueBuffer.buffer, 0, len);
        // return decoder.decode(response);
    }
}
