/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, ExtensionMode, LogOutputChannel, window } from "vscode";
import { StopWatch } from "./platform/common/stopwatch";

let logger: LogOutputChannel;

const lastSeenError = {
	timer: new StopWatch(),
	error: ''
}

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
		const error = logger.error;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		logger.error = (errorMsg: string | Error, ...args: any[]) => {
			// Get track of the last known error for issue reporting purposes.
			lastSeenError.timer.reset();
			lastSeenError.error = [`${getTime()} ${errorMsg.toString()}`].concat(args.map(arg => `${arg}`)).join('\n');
			error.bind(logger)(errorMsg, ...args);
		}
	}

	return logger;
}


function getTime() {
	const now = new Date();
	return now.toTimeString().split(' ')[0];
}

function getLastErrors() {
	// If we haven't see any errors in the past 20 minutes, no point reporting any old errors.
	if (!lastSeenError.error || lastSeenError.timer.elapsedTime > 20 * 60 * 1000) {
		return '';
	}
	return lastSeenError.error;
}

export { getLastErrors, logger };

