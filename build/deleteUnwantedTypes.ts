// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';

[
    path.join(__dirname, '..', 'pyodide', 'common'),
    path.join(__dirname, '..', 'pyodide', 'node', 'kernel.d.ts'),
    path.join(__dirname, '..', 'pyodide', 'node', 'comlink.worker.d.ts'),
    path.join(__dirname, '..', 'pyodide', 'tsconfig.tsbuildinfo')
].forEach((p) => {
    if (!fs.existsSync(p)) {
        return;
    }
    if (fs.statSync(p).isDirectory()) {
        fs.rmSync(p, { recursive: true });
    } else {
        fs.unlinkSync(p);
    }
});
