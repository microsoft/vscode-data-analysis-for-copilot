/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import type { Kernel } from '../pyodide/node/index';
import { logger } from './logger';

export const ErrorMime = 'application/vnd.code.notebook.error';

interface IFindFilesParameters {
	pattern: string;
}

export class FindFilesTool implements vscode.LanguageModelTool<IFindFilesParameters> {
	public static Id = 'dachat_data_findFiles';
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
		const content: vscode.LanguageModelTextPart[] = []
		const currentWorkspaceFolders = vscode.workspace.workspaceFolders;

		if (currentWorkspaceFolders?.length === 1) {
			const relativePaths = files.map((file) => vscode.workspace.asRelativePath(file, false));
			content.push(new vscode.LanguageModelTextPart(`Found ${files.length} files matching "${params.pattern}":\n${relativePaths.join('\n')}`));
		} else {
			const strFiles = files.map((f) => f.fsPath).join('\n');
			content.push(new vscode.LanguageModelTextPart(`Found ${files.length} files matching "${params.pattern}":\n${strFiles}.`));
		}

		return new vscode.LanguageModelToolResult(content);
	}

	async prepareInvocation(
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
	public static Id = 'dachat_data_runPython';
	private _kernel: Kernel;
	private pendingRequests: Promise<unknown> = Promise.resolve();
	constructor(context: vscode.ExtensionContext) {
		const pyodidePath = vscode.Uri.joinPath(context.extensionUri, 'pyodide');
		const kernelPath = vscode.Uri.joinPath(pyodidePath, 'node', 'index.js').fsPath;
		const workerPath = vscode.Uri.joinPath(pyodidePath, 'node', 'comlink.worker.js').fsPath;
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { Kernel } = require(kernelPath) as typeof import('../pyodide/node/index');
		const folder = vscode.workspace.workspaceFolders?.length ? vscode.workspace.workspaceFolders[0].uri.fsPath : ''
		this._kernel = new Kernel({
			pyodidePath: pyodidePath.fsPath, workerPath, location: folder, packages: [
				vscode.Uri.file(path.join(pyodidePath.fsPath, 'seaborn-0.13.2-py3-none-any.whl')).toString()
			],
			logger: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				error: (message: string, ...args: any[]) => logger.error(`Pyodide => ${message}`, ...args),
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				info: (message: string, ...args: any[]) => logger.info(`Pyodide => ${message}`, ...args)
			}
		});
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IRunPythonParameters>,
		_token: vscode.CancellationToken
	) {
		const code = sanitizePythonCode(options.parameters.code);
		logger.debug(`Executing Python Code for "${options.parameters.reason}"`);
		logger.debug(`Code => `);
		logger.debug(code);

		this.pendingRequests = this.pendingRequests.finally().then(() => this._kernel.execute(code));
		const result = await this.pendingRequests as Awaited<ReturnType<typeof Kernel.prototype.execute>>;

		logger.debug(`Result => `);
		Object.keys(result || {}).forEach(key => {
			logger.debug(`${key} :`);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			logger.debug((result as any)[key]);
		});

		const content: (vscode.LanguageModelPromptTsxPart | vscode.LanguageModelTextPart)[] = []
		if (result && result['text/plain']) {
			content.push(new vscode.LanguageModelTextPart(result['text/plain']));
		}

		if (result && result['image/png']) {
			content.push(new vscode.LanguageModelPromptTsxPart(result['image/png'], 'image/png'));
		}

		if (result && result['application/vnd.code.notebook.error']) {
			const error = result['application/vnd.code.notebook.error'] as Error;
			// We need to ensure we pass back plain objects to VS Code that can be serialized..
			content.push(new vscode.LanguageModelPromptTsxPart({
				name: error.name || '',
				message: error.message || '',
				stack: error.stack || ''
			}, 'application/vnd.code.notebook.error'));
		}
		return new vscode.LanguageModelToolResult(content);
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IRunPythonParameters>,
		_token: vscode.CancellationToken
	) {
		const reasonMessage = options.parameters.reason ? `: "${options.parameters.reason}"` : '';
		return {
			invocationMessage: `Executing Code${reasonMessage}`
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
