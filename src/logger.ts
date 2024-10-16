/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { window } from "vscode";

export const logger = window.createOutputChannel('Data Analysis', { log: true });
