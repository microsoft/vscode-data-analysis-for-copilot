// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';

if (fs.existsSync(path.join(__dirname, '..', 'out'))) {
	fs.rmSync(path.join(__dirname, '..', 'out'), { recursive: true });
}
if (fs.existsSync(path.join(__dirname, '..', 'temp'))) {
	fs.rmSync(path.join(__dirname, '..', 'temp'), { recursive: true });
}
