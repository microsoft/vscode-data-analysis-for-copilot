// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const RES_SIZE = 256;
const decoder = new TextDecoder('utf8');

const decodeBuffer = new Uint8Array(RES_SIZE); // TextDecoder cant use SharedArrayBuffers

export class SyncMessaging {
    private readonly ctrlBuffer: Int32Array;
    private readonly valueBuffer: Int32Array;

    constructor({
        sharedCtrlBuffer,
        sharedValueBuffer
    }: {
        sharedCtrlBuffer: SharedArrayBuffer;
        sharedValueBuffer: SharedArrayBuffer;
    }) {
        this.ctrlBuffer = new Int32Array(sharedCtrlBuffer);
        this.valueBuffer = new Int32Array(sharedValueBuffer);
    }

    public wait(): string {
        const length = this.ctrlWait();
        // read response
        for (let i = 0; i < length; i++) {
            decodeBuffer[i] = Atomics.load(this.valueBuffer, i);
        }
        // decodeBuffer.set(valueBuffer)
        const res = decoder.decode(decodeBuffer.slice(0, length));

        console.error('wait', res);
        return res;
    }

    ctrlWait() {
        Atomics.store(this.ctrlBuffer, 0, 0);
        Atomics.wait(this.ctrlBuffer, 0, 0);
        return this.ctrlBuffer[0];
    }
}

// self.addEventListener(
//   'message',
//   (e) => {
//     console.debug('worker started');
//     const { sharedCtrlBuffer, sharedValueBuffer } = e.data;
//     ctrlBuffer = new Int32Array(sharedCtrlBuffer);
//     valueBuffer = new Int32Array(sharedValueBuffer);
//     main();
//   },
//   false,
// );
