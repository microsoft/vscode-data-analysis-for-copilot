import * as vscode from 'vscode';
import type { PyodideKernel } from '../pyodide/node/kernel';
import { execute, start_kernel } from './execution';
import { KernelMessage } from '@jupyterlab/services';

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
}

export class RunPythonTool implements vscode.LanguageModelTool<IRunPythonParameters> {
	private _kernelPromise: Promise<PyodideKernel>;
	private readonly messageEmitter = new vscode.EventEmitter<KernelMessage.IMessage>();
	constructor(context: vscode.ExtensionContext) {
		this._kernelPromise = start_kernel(context, this.messageEmitter);
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IRunPythonParameters>,
		_token: vscode.CancellationToken
	) {
		const kernel = await this._kernelPromise;
		const code = sanitizePythonCode(options.parameters.code);
		const result = await execute(kernel, this.messageEmitter, code);

		console.log(result);
		const resultData: { [key: string]: unknown } = {};
		if (result && result['text/plain']) {
			resultData['text/plain'] = result['text/plain'];
		}

		if (result && result['image/png']) {
			resultData['image/png'] = result['image/png'];
		}

		if (result && result['application/vnd.code.notebook.error']) {
			resultData['application/vnd.code.notebook.error'] = result['application/vnd.code.notebook.error'];
		}
		return resultData;
	}

	async prepareToolInvocation(
		_options: vscode.LanguageModelToolInvocationPrepareOptions<IRunPythonParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Executing Python Code`
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

