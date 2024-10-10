// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// const { Worker: NodeWorker } = require("worker_threads");
import { Uri, workspace, type ExtensionContext } from 'vscode';
import type { PyodideKernel } from '../../pyodide/node/kernel';
import { KernelMessage } from '@jupyterlab/services';
import type { IExecuteRequestMsg } from '@jupyterlab/services/lib/kernel/messages';
import { createDeferred, type Deferred } from './async';

// 1. cd vscode-jupyter/src/kernels/lite/pyodide-kernel
// python -m http.server 9000
// 2. cd src/kernels/lite/pyodide-kernel/src/pyodide
// python -m http.server 8016
// 3. npm run worker-watch
// 4. npm run compile
// node ....test.js

export async function start_kernel(context: ExtensionContext) {
	debugger;
	const kernelPath = '../../pyodide/node/kernel';
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { PyodideKernel } = require(kernelPath) as typeof import('../../pyodide/node/kernel');
	const kernel = new PyodideKernel({
		baseUrl: Uri.joinPath(context.extensionUri, 'pyodide').fsPath,
		pyodideUrl: Uri.joinPath(context.extensionUri, 'pyodide', 'pyodide.js').fsPath,
		indexUrl: Uri.joinPath(context.extensionUri, 'pyodide').fsPath,
		disablePyPIFallback: false,
		location: workspace.workspaceFolders![0].uri.fsPath,
		mountDrive: true,
		pipliteUrls: [Uri.joinPath(context.extensionUri, 'pyodide', 'pypi', 'all.json').toString()],
		pipliteWheelUrl: Uri.joinPath(
			context.extensionUri,
			'pyodide',
			'pypi',
			'piplite-0.4.2-py3-none-any.whl'
		).toString(),
		id: new Date().getTime().toString(),
		loadPyodideOptions: {
			lockFileURL: Uri.joinPath(context.extensionUri, 'pyodide', 'pyodide-lock.json').fsPath,
			packages: []
		},
		name: 'pyodide',
		packagePath: Uri.joinPath(context.extensionUri, 'pyodide').fsPath,
		sendMessage: (msg) => {
			console.log('Sending message', msg);
		}
	});
	await kernel.ready;
	const info = await kernel.kernelInfoRequest();
	console.log(info);
	return kernel;
}

let executeCount = 0;
type TextOutputs = Partial<Record<'text/plain' | 'image/png' | 'text/html', string>>;
type ErrorOutput = { 'application/vnd.code.notebook.error': Error };
type ExecuteResult = TextOutputs & Partial<ErrorOutput>;

export async function execute(kernel: PyodideKernel, code: string): Promise<ExecuteResult> {
	executeCount++;
	const request = KernelMessage.createMessage<IExecuteRequestMsg>({
		channel: 'shell',
		content: { code, allow_stdin: false, store_history: true },
		msgType: 'execute_request',
		session: kernel.id,
		msgId: new Date().toISOString()
	});


	const result = await kernel.remoteKernel.execute(request.content, request);
	if ('status' in result && result.status === 'error') {
		const error = new Error(result.evalue);
		error.name = result.ename;
		const { default: stripAnsi } = await import('strip-ansi');
		error.stack = ((result.traceback as string[]) || []).map((l) => stripAnsi(l)).join('\n');
		return {
			'application/vnd.code.notebook.error': error
		};
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return getFormattedOutput((result as any).outputs as Record<string, any>[]);

}

function getFormattedOutput(outputs: Record<string, any>[]): TextOutputs {
	// iterate over the outputs array and pick an item where key = "text/plain"
	// return the value of that key
	const result: TextOutputs = {};
	outputs.forEach((output) => {
		if (output['text/plain']) {
			// There could be multiple text/plain outputs, combine them.
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
