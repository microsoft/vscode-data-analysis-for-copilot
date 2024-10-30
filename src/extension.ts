/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerCsvCommand } from './csvCommand';
import { DataAgent } from './dataAgent';
import { initializeLogger } from './logger';
import { FindFilesTool, InstallPythonPackageTool, RunPythonTool } from './tools';

export function activate(context: vscode.ExtensionContext) {
	const dataAgent = new DataAgent(context);
	const logger = initializeLogger(context);
	context.subscriptions.push(logger);
	context.subscriptions.push(dataAgent);
	context.subscriptions.push(registerCsvCommand());
	context.subscriptions.push(vscode.lm.registerTool(FindFilesTool.Id, new FindFilesTool(context)));
	const pythonTool = new RunPythonTool(context);
	context.subscriptions.push(vscode.lm.registerTool(RunPythonTool.Id, pythonTool));
	context.subscriptions.push(vscode.lm.registerTool(InstallPythonPackageTool.Id, new InstallPythonPackageTool(pythonTool)));

	if (context.extensionMode === vscode.ExtensionMode.Test) {
		return {
			dataAgent
		}
	}
}

export function deactivate() { }
