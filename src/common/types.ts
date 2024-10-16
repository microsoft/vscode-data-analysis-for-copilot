// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IWorker {
    /**
     * Send a message to the worker that is received via `require('node:worker_threads').parentPort.on('message')`.
     * See `port.postMessage()` for more details.
     * @since v10.5.0
     */
    postMessage(value: unknown, transferList?: unknown): void;
    /**
     * Stop all JavaScript execution in the worker thread as soon as possible.
     */
    terminate(): void;
}

export interface ILogger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}
