/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { Kernel } from '../pyodide/node/index';

interface IFindFilesParameters {
	pattern: string;
}

export class FindFilesTool implements vscode.LanguageModelTool<IFindFilesParameters> {
	constructor(readonly context: vscode.ExtensionContext) { }

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IFindFilesParameters>,
		token: vscode.CancellationToken
	) {
		const params = options.parameters as IFindFilesParameters;
		let files = await vscode.workspace.findFiles(params.pattern, '**/node_modules/**', undefined, token);
		if (files.length === 0) {
			files = await vscode.workspace.findFiles(`**/${params.pattern}`, '**/node_modules/**', undefined, token);
		}
		const result: vscode.LanguageModelToolResult = {};
		if (options.requestedContentTypes.includes('text/plain')) {
			const currentWorkspaceFolders = vscode.workspace.workspaceFolders;

			if (currentWorkspaceFolders?.length === 1) {
				const relativePaths = files.map((file) => vscode.workspace.asRelativePath(file, false));
				result['text/plain'] =
					`Found ${files.length} files matching "${params.pattern}":\n${relativePaths.join('\n')}`;
			} else {
				const strFiles = files.map((f) => f.fsPath).join('\n');
				result['text/plain'] = `Found ${files.length} files matching "${params.pattern}":\n${strFiles}.`;
			}
		}

		return result;
	}

	async prepareToolInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IFindFilesParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Searching workspace for "${options.parameters.pattern}"`
		};
	}
}

interface IRunPythonParameters {
	code: string;
	reason: string;
}

export class RunPythonTool implements vscode.LanguageModelTool<IRunPythonParameters> {
	private _kernel: Kernel;
	private pendingRequests: Promise<unknown> = Promise.resolve();
	constructor(context: vscode.ExtensionContext) {
		const pyodidePath = vscode.Uri.joinPath(context.extensionUri, 'pyodide');
		const kernelPath = vscode.Uri.joinPath(pyodidePath, 'node', 'index.js').fsPath;
		const workerPath = vscode.Uri.joinPath(pyodidePath, 'node', 'comlink.worker.js').fsPath;
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { Kernel } = require(kernelPath) as typeof import('../pyodide/node/index');
		const folder = vscode.workspace.workspaceFolders?.length ? vscode.workspace.workspaceFolders[0].uri.fsPath : ''
		this._kernel = new Kernel(pyodidePath.fsPath, workerPath, folder);
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IRunPythonParameters>,
		_token: vscode.CancellationToken
	) {
		const code = sanitizePythonCode(options.parameters.code);
		this.pendingRequests = this.pendingRequests.finally().then(() => this._kernel.execute(code));
		const result = await this.pendingRequests as Awaited<ReturnType<typeof Kernel.prototype.execute>>;

		console.log(result);
		const resultData: { [key: string]: unknown } = {};
		if (result && result['text/plain']) {
			resultData['text/plain'] = result['text/plain'];
		}

		if (result && result['image/png']) {
			resultData['image/png'] = result['image/png'];
		}

		if (result && result['application/vnd.code.notebook.error']) {
			const error = result['application/vnd.code.notebook.error'] as Error;
			// We need to ensure we pass back plain objects to VS Code that can be serialized..
			resultData['application/vnd.code.notebook.error'] = {
				name: error.name || '',
				message: error.message || '',
				stack: error.stack || ''
			};
		}
		return resultData;
	}

	async prepareToolInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IRunPythonParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Executing Code: "${options.parameters.reason}"`
		};
	}
}

/**
 * Sometimes the code can be a markdown code block, in which case we need to remove the code block.
 */
function sanitizePythonCode(code: string) {
	if (code.startsWith('```python')) {
		code = code.substring('```python'.length);
	}
	if (code.endsWith('```')) {
		code = code.substring(0, code.length - '```'.length);
	}
	return code;
}
