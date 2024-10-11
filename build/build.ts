// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from 'path';
import * as fs from 'fs';
import { downloadPyodideKernel } from './download';

function copyPyodideFiles() {
    copyNodeScripts();
}

function copyNodeScripts() {
    const kernelSpecsDTS = path.join(__dirname, '..', 'node_modules/@jupyterlite/kernel/lib/kernelspecs.d.ts');
    const commonDir = path.join(__dirname, '..', 'pyodide', 'node');
    if (!fs.existsSync(commonDir)) {
        fs.mkdirSync(commonDir, { recursive: true });
    }
    fs.copyFileSync(kernelSpecsDTS, path.join(commonDir, path.basename(kernelSpecsDTS)));
}

async function renameLicence() {
    const dir = path.join(__dirname, '..', 'pyodide');
    const oldLic = path.join(dir, 'LICENSE');
    const newLic = path.join(dir, 'PYODIDE_LICENSE');
    if (!fs.existsSync(oldLic) && fs.existsSync(newLic)) {
        return;
    }
    fs.renameSync(oldLic, newLic);
}

async function main() {
    await downloadPyodideKernel();
    copyPyodideFiles();
    renameLicence();
}

main();
