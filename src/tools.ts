import * as vscode from 'vscode';
import { execute, start_kernel } from './execution/src';

interface IFindFilesParameters {
	pattern: string;
}

export class FindFilesTool implements vscode.LanguageModelTool<IFindFilesParameters> {
    constructor(readonly context: vscode.ExtensionContext) {
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IFindFilesParameters>,
		token: vscode.CancellationToken
	) {
		const params = options.parameters as IFindFilesParameters;
		const files = await vscode.workspace.findFiles(
			params.pattern,
			'**/node_modules/**',
			undefined,
			token
		);

		const result: vscode.LanguageModelToolResult = {};
		if (options.requestedContentTypes.includes('text/plain')) {
			const currentWorkspaceFolders = vscode.workspace.workspaceFolders;

			if (currentWorkspaceFolders?.length === 1) {
				const relativePaths = files.map((file) =>
					vscode.workspace.asRelativePath(file, false)
				);
				result['text/plain'] = `Found ${files.length} files matching "${params.pattern}":\n${relativePaths.join('\n')}`;
			} else {
				const strFiles = files.map((f) => f.fsPath).join('\n');
				result[
					'text/plain'
				] = `Found ${files.length} files matching "${params.pattern}":\n${strFiles}.`;
			}
		}

		return result;
	}

	async prepareToolInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IFindFilesParameters>,
		token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Searching workspace for "${options.parameters.pattern}"`,
		};
	}
}

interface IRunPythonParameters {
	code: string;
}

export class RunPythonTool implements vscode.LanguageModelTool<IRunPythonParameters> {
    private _kernelPromise: Promise<any>;
    constructor(context: vscode.ExtensionContext) {
        this._kernelPromise = start_kernel(context);
    }

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IRunPythonParameters>,
		token: vscode.CancellationToken
	) {
        
        const kernel = await this._kernelPromise;
        const result = await execute(kernel, options.parameters.code);

		console.log(result);
		let resultData: { [key: string]: any } = {};
        if (result && result["text/plain"]) {
			resultData["text/plain"] = result["text/plain"];
        }

		if (result && result['image/png']) {
			resultData['image/png'] = result['image/png'];
		}

		if (result && result["application/vnd.code.notebook.error"]) {
			resultData["application/vnd.code.notebook.error"] = result["application/vnd.code.notebook.error"];
		}
        return resultData;
	}

	async prepareToolInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IRunPythonParameters>,
		token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Evaluating \n---\n\`\`\`${JSON.stringify(options.parameters.code)}\`\`\``,
		};
	}
}