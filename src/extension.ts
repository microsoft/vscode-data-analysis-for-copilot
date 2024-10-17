/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerCsvCommand } from './csvCommand';
import { DataAgent } from './dataAgent';
import { initializeLogger } from './logger';
import { FindFilesTool, RunPythonTool } from './tools';

export function activate(context: vscode.ExtensionContext) {
	const dataAgent = new DataAgent(context);
	const logger = initializeLogger(context);
	context.subscriptions.push(logger);
	context.subscriptions.push(dataAgent);
	context.subscriptions.push(registerCsvCommand());
	context.subscriptions.push(vscode.lm.registerTool(FindFilesTool.Id, new FindFilesTool(context)));
	context.subscriptions.push(vscode.lm.registerTool(RunPythonTool.Id, new RunPythonTool(context)));

	if (context.extensionMode === vscode.ExtensionMode.Test) {
		return {
			dataAgent
		}
	}
}

export function deactivate() { }
