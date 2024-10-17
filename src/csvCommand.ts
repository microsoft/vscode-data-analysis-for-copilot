/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { commands, Uri, workspace } from "vscode";

export function registerCsvCommand() {
	return commands.registerCommand('dachat.analyzeCsv', async (file: Uri) => {
		await commands.executeCommand('workbench.action.chat.open');
		await commands.executeCommand('workbench.action.chat.clearHistory');
		await commands.executeCommand('workbench.action.chat.focusInput');

		const relativePath = workspace.asRelativePath(file);
		await commands.executeCommand('workbench.action.chat.sendToNewChat', { inputValue: `@data Analyze the file ${relativePath}` });
	})
}
