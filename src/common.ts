/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

export function getToolName(tool: vscode.LanguageModelToolDescription) {
	return (tool as unknown as { id: string }).id ?? tool.name;
}
