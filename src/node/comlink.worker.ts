// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * A WebWorker entrypoint that uses comlink to handle postMessage details
 */

import { expose } from 'comlink';
import { IPyodideWorkerKernel } from '../common/tokens';
import { PyodideRemoteKernel } from '../common/worker';
import nodeEndpoint from 'comlink/dist/umd/node-adapter';
import { parentPort } from 'worker_threads';
import { SyncMessaging } from '../common/syncMessagingWorker';


export class PyodideComlinkKernel extends PyodideRemoteKernel {
    /**
     * Setup custom Emscripten FileSystem
     */
    protected async initFilesystem(options: IPyodideWorkerKernel.IOptions): Promise<void> {
        if (options.mountDrive && this._localPath) {
            const { FS } = this._pyodide;
            const mountDir = this._localPath;
            FS.mkdirTree(mountDir);
            FS.mount(FS.filesystems.NODEFS, { root: mountDir }, mountDir);
            this._driveFS = FS.filesystems.NODEFS;
        }
    }
}

parentPort!.once('message', (msg: any) => {
    const worker = new PyodideComlinkKernel(new SyncMessaging(msg));
    expose(worker, nodeEndpoint(parentPort!));
});
