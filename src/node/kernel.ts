// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BasePyodideKernel } from '../common/kernel';
import type { PyodideKernel as PyodideKernelTypes } from '../common/kernel';
import { Worker } from 'node:worker_threads';
/**
 * A kernel that executes Python code with Pyodide.
 */
export class PyodideKernel extends BasePyodideKernel {
    /**
     * Instantiate a new PyodideKernel
     *
     * @param options The instantiation options for a new PyodideKernel
     */
    constructor(options: PyodideKernelTypes.IOptions) {
        super(options);
    }

    /**
     * Load the worker.
     *
     * ### Note
     *
     * Subclasses must implement this typographically almost _exactly_ for
     * webpack to find it.
     */
    protected override initWorker(options: PyodideKernelTypes.IOptions): Worker {
        return new Worker(options.workerPath, {});
    }
}
