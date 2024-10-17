/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, ExtensionMode, LogOutputChannel, window } from "vscode";

let logger: LogOutputChannel;

export function initializeLogger(extensionContext: ExtensionContext) {
	if (!logger) {
		logger = window.createOutputChannel('Data Analysis', { log: true });
		const debug = logger.debug;
		logger.debug = (message: string, ...args: unknown[]) => {
			if (extensionContext.extensionMode === ExtensionMode.Development) {
				console.log(message, ...args);
			}

			debug.bind(logger)(message, ...args);
		};
	}

	return logger;
}

export { logger };
