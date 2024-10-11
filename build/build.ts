// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from 'path';
import * as fs from 'fs';
import { downloadCommWheel, downloadPyodideKernel } from './download';

async function renameLicense() {
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
    await downloadCommWheel();

    renameLicense();
}

main();
