/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
*--------------------------------------------------------------------------------------------*/


/**
 * Tracks wall clock time. Start time is set at contruction.
 */
export class StopWatch {
	private started = Date.now();
	public get elapsedTime() {
		return Date.now() - this.started;
	}
	public reset() {
		this.started = Date.now();
	}
}
