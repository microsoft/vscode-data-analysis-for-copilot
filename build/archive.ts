// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from 'path';
import * as fs from 'fs';
import archiver from 'archiver';

function main() {
    // create a file to stream archive data to.
    const outputFile = path.join(__dirname, '..', 'resources', 'pyodide.zip');
    if (fs.existsSync(outputFile)) {
        fs.rmSync(outputFile);
    }
    if (!fs.existsSync(path.dirname(outputFile))) {
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    }
    const output = fs.createWriteStream(outputFile);
    const archive = archiver('zip', {});

    // pipe archive data to the file
    archive.pipe(output);
    // append files from a sub-directory, putting its contents at the root of archive
    archive.directory(path.join(__dirname, '..', 'pyodide/'), false);
    archive.finalize();
    console.log('Pyodide (release) archive created in resources/pyodide.zip');
}

main();
