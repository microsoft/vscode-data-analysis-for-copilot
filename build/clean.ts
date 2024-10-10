// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';

const out = path.join(__dirname, '..', 'pyodide');
if (fs.existsSync(out)) {
    fs.rmSync(out, { recursive: true });
}
