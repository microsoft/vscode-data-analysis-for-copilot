/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DataAgent } from './dataAgent';
import { FindFilesTool, RunPythonTool } from './tools';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(new DataAgent(context));
	context.subscriptions.push(vscode.lm.registerTool('dachat_data_findFiles', new FindFilesTool(context)));
	context.subscriptions.push(vscode.lm.registerTool('dachat_data_runPython', new RunPythonTool(context)));
}

export function deactivate() { }
