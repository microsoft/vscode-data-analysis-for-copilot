// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Mocha from 'mocha';
import * as path from 'path';

type SetupOptions = Mocha.MochaOptions;


/**
 * Configure the test environment and return the options required to run mocha tests.
 */
function configure(): SetupOptions {
	return {
		ui: 'tdd',
		color: true,
		timeout: 600_000,
	};
}

/**
 * Runner, invoked by VS Code.
 * More info https://code.visualstudio.com/api/working-with-extensions/testing-extension
 *
 * @export
 * @returns {Promise<void>}
 */
export async function run(): Promise<void> {
	const mocha = new Mocha(configure());
	// Setup test files that need to be run.
	[path.join(__dirname, 'extension.test.js')].forEach((file) => mocha.addFile(file));

	// Run the tests.
	await new Promise<void>((resolve, reject) => {
		mocha.run((failures) => {
			if (failures > 0) {
				return reject(new Error(`${failures} total failures`));
			}
			resolve();
		});
	});
}
