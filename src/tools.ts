import * as vscode from 'vscode';
import { execute, start_kernel } from './execution/src';

interface IFindFilesParameters {
	pattern: string;
}

export class FindFilesTool implements vscode.LanguageModelTool<IFindFilesParameters> {
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
			const strFiles = files.map((f) => f.fsPath).join('\n');
			result[
				'text/plain'
			] = `Found ${files.length} files matching "${params.pattern}":\n${strFiles}`;
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


        if (result && result["text/plain"]) {
            return {
                'text/plain': result["text/plain"]
            };
        }

        return null;
	}

	async prepareToolInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IRunPythonParameters>,
		token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Evaluating code "${options.parameters.code}"`,
		};
	}
}