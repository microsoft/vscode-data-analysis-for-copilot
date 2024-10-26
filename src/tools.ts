/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import type { Kernel } from '../pyodide/node/index';
import { logger } from './logger';

export const ErrorMime = 'application/vnd.code.notebook.error';
const ImagePrefix = `8a59d504`;

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
		const params = options.input as IFindFilesParameters;
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
			invocationMessage: `Searching workspace for "${options.input.pattern}"`
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
	constructor(readonly context: vscode.ExtensionContext) {
		const pyodidePath = vscode.Uri.joinPath(context.extensionUri, 'pyodide');
		const kernelPath = vscode.Uri.joinPath(pyodidePath, 'node', 'index.js').fsPath;
		const workerPath = vscode.Uri.joinPath(pyodidePath, 'node', 'comlink.worker.js').fsPath;
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { Kernel } = require(kernelPath) as typeof import('../pyodide/node/index');
		const folder = vscode.workspace.workspaceFolders?.length ? vscode.workspace.workspaceFolders[0].uri.fsPath : ''
		this._kernel = new Kernel({
			pyodidePath: pyodidePath.fsPath.replace(/\\/g, '/'),
			workerPath: workerPath.replace(/\\/g, '/'),
			location: folder.replace(/\\/g, '/'),
			packages: [
				vscode.Uri.joinPath(pyodidePath, 'seaborn-0.13.2-py3-none-any.whl').fsPath.replace(/\\/g, '/')
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
		const code = sanitizePythonCode(options.input.code);
		logger.debug(`Executing Python Code for "${options.input.reason}"`);
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
			content.push(await this._processImageOutput(result['image/png']));
		}

		if (result && result['application/vnd.code.notebook.error']) {
			throw result['application/vnd.code.notebook.error'] as Error;
		}
		return new vscode.LanguageModelToolResult(content);
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IRunPythonParameters>,
		_token: vscode.CancellationToken
	) {
		const reasonMessage = options.input.reason ? `: "${options.input.reason}"` : '';
		return {
			invocationMessage: `Executing Code${reasonMessage}`
		};
	}

	private async _processImageOutput(base64Png: string) {
		const userMessageWithWithImageFromToolCall = `Return this image link in your response. Do not modify the markdown image link at all. The path is already absolute local file path, do not put "https" or "blob" in the link`;
		if (this.context.storageUri) {
			const imagePath = await this._saveImage(this.context.storageUri, RunPythonTool.Id, Buffer.from(base64Png, 'base64'));
			if (imagePath) {
				const markdownTextForImage = `The image generated from the code is ![${RunPythonTool.Id} result](${imagePath}). You can give this markdown link to users!`;
				return new vscode.LanguageModelTextPart(markdownTextForImage + '\n' + userMessageWithWithImageFromToolCall);
			}
		}

		const markdownTextForImage = `![${RunPythonTool.Id} result](data:image/png;base64,${base64Png})`;
		return new vscode.LanguageModelTextPart(markdownTextForImage + '\n' + userMessageWithWithImageFromToolCall);
	}

	private async _saveImage(storageUri: vscode.Uri, tool: string, imageBuffer: Buffer): Promise<string | undefined> {
		try {
			await vscode.workspace.fs.stat(storageUri);
		} catch {
			await vscode.workspace.fs.createDirectory(storageUri);
		}

		const storagePath = storageUri.fsPath;
		const imagePath = path.join(storagePath, `result-${tool}-${ImagePrefix}-${Date.now()}.png`);
		const imageUri = vscode.Uri.file(imagePath);
		try {
			await vscode.workspace.fs.writeFile(imageUri, imageBuffer);
			return imageUri.toString();
		} catch (ex) {
			logger.error('Error saving image', ex);
			return undefined;
		}
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
