// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Kernel } = require('../pyodide/node/index');

const pyodideDir = '<pyodide>';

async function main() {
    const kernel = new Kernel({
        logger: {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        },
        packages: [],
        pyodidePath: pyodideDir,
        location: __dirname.replace(/\\/g, '/'),
        workerPath: `${__dirname}/../pyodide/node/comlink.worker.js`
    });
    try {
        const outputs = await kernel.execute('print(1243)');
        console.log(outputs);
    } catch (ex) {
        // eslint-disable-next-line no-debugger
        debugger;
        console.log(ex);
    }
}

main();
