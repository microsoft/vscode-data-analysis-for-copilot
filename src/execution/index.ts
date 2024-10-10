// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { KernelMessage } from '@jupyterlab/services';
import type { IExecuteRequestMsg } from '@jupyterlab/services/lib/kernel/messages';
import { Uri, workspace, type EventEmitter, type ExtensionContext } from 'vscode';
import { PyodideKernel } from '../../pyodide/node/kernel';
import { createDeferred, type Deferred } from '../platform/common/async';

export class MessageHandler {
	private readonly messages = new Map<string, Deferred<KernelMessage.IMessage>>();
	constructor() {

	}
	public getResponse(id: string) {
		return this.getMessageHandler(id).promise;
	}
	public getMessageHandler(id: string) {
		if (!this.messages.has(id)) {
			this.messages.set(id, createDeferred<KernelMessage.IMessage>());
		}
		return this.messages.get(id)!;
	}
	handleResponse(msg: KernelMessage.IMessage) {
		this.getMessageHandler(msg.parent_header.msg_id).resolve(msg);
	}
}
export async function start_kernel(context: ExtensionContext, messageHandler: EventEmitter<KernelMessage.IMessage>) {
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
		packagePath: Uri.joinPath(context.extensionUri, 'out').fsPath,
		sendMessage: (msg) => {
			console.log('Sending message', msg);
			messageHandler.fire(msg)
		}
	});
	await kernel.ready;
	const info = await kernel.kernelInfoRequest();
	console.log(info);
	return kernel;
}

type TextOutputs = Partial<Record<'text/plain' | 'image/png' | 'text/html', string>>;
type ErrorOutput = { 'application/vnd.code.notebook.error': Error };
type ExecuteResult = TextOutputs & Partial<ErrorOutput>;

export async function execute(kernel: PyodideKernel, messageHandler: EventEmitter<KernelMessage.IMessage>, code: string): Promise<ExecuteResult> {
	const request = KernelMessage.createMessage<IExecuteRequestMsg>({
		channel: 'shell',
		content: { code, allow_stdin: false, store_history: true },
		msgType: 'execute_request',
		session: kernel.id,
		msgId: new Date().toISOString()
	});

	const outputs: Record<string, string>[] = [];
	const executeResultReceived = createDeferred<void>();
	const disposable = messageHandler.event((msg) => {
		if (KernelMessage.isExecuteResultMsg(msg)) {
			if (msg.content.data && Object.keys(msg.content.data).length) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				outputs.push(msg.content.data as any);
			}
			executeResultReceived.resolve();
		}
		if (KernelMessage.isDisplayDataMsg(msg)) {
			if (msg.content.data && Object.keys(msg.content.data).length) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				outputs.push(msg.content.data as any);
			}
		}
		if (KernelMessage.isStreamMsg(msg)) {
			outputs.push({ 'text/plain': msg.content.text });
		}
	});
	try {
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
		await executeResultReceived.promise;
		return getFormattedOutput(outputs);
	} finally {
		disposable.dispose();
	}

}

function getFormattedOutput(outputs: Record<string, string>[]): TextOutputs {
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
