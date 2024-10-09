// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// const { Worker: NodeWorker } = require("worker_threads");
import * as path from 'path';
import { Uri, workspace, type ExtensionContext } from 'vscode';
import { Worker as NodeWorker } from 'worker_threads';

// 1. cd vscode-jupyter/src/kernels/lite/pyodide-kernel
// python -m http.server 9000
// 2. cd src/kernels/lite/pyodide-kernel/src/pyodide
// python -m http.server 8016
// 3. npm run worker-watch
// 4. npm run compile
// node ....test.js

export async function start_kernel(context: ExtensionContext) {
    const Comlink = require('comlink');
    const w = new NodeWorker(path.join(context.extensionUri.fsPath, 'out', 'comlink.worker.js'));
    w.on('message', (message) => {
        message && 'log' in message ? console.log(`> ${message.log} ${JSON.stringify(message.data)}`) : undefined;

        console.log('Message', message);
    });
    const nodeEndpoint = require('comlink/dist/umd/node-adapter.js');
    const remote = Comlink.wrap(nodeEndpoint(w));
    // const name = await remote.name;
    // console.error("End", name);
    // const result = await remote.doSomething();
    // console.error("End", result);
    const options = {
        baseUrl: Uri.joinPath(context.extensionUri, 'pyodide').fsPath,
        pyodideUrl: Uri.joinPath(context.extensionUri, 'pyodide', 'pyodide', 'pyodide.js').fsPath,
        indexUrl: Uri.joinPath(context.extensionUri, 'pyodide', 'pyodide').fsPath,
        disablePyPIFallback: false,
        location: workspace.workspaceFolders![0].uri.fsPath,
        mountDrive: true,
        pipliteUrls: [Uri.joinPath(context.extensionUri, 'pyodide', 'pypi', 'all.json').toString()],
        pipliteWheelUrl: Uri.joinPath(
            context.extensionUri,
            'pyodide',
            'pypi',
            'piplite-0.0.10-py3-none-any.whl'
        ).toString()
    };
    await remote.initialize(options);
    return remote;
}

let executeCount = 0;
export async function execute(kernel: any, code: string) {
    executeCount++;
    const header = { header: { msg_id: executeCount.toString() } };
    const result = await kernel.execute({ code }, header);
    if ('status' in result && result.status === 'error') {
        const output: Record<string, any> = {
            error: result
        };

        return output;
    }

    return getFormattedOutput(result.outputs as Record<string, any>[]);
}

function getFormattedOutput(outputs: Record<string, any>[]) {
    // iterate over the outputs array and pick an item where key = "text/plain"
    // return the value of that key
    const result: Record<string, string> = { 'text/plain': '' };
    outputs.forEach((output) => {
        if (output['text/plain']) {
            result['text/plain'] = (result['text/plain'] || '') + output['text/plain'];
        }
        if (output['text/html']) {
            result['text/html'] = output['text/html'];
        }
        if (output['image/png']) {
            result['text/plain'] = '';
            delete result['text/html'];
            result['image/png'] = output['image/png'];
        }
    });
    return result;
}
