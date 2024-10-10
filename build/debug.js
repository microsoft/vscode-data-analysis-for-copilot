// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.


// eslint-disable-next-line @typescript-eslint/no-require-imports
const {Kernel} = require( '../pyodide/node/index');

const pyodideDir = '<pyodide dir>';

async function main(){
    const kernel = new Kernel(pyodideDir,
        `${pyodideDir}/node/comlink.worker.js`,
        __dirname
    );
    try {
        const outputs = await  kernel.execute('print(1243)')
        console.log(outputs);
    } catch (ex){
        // eslint-disable-next-line no-debugger
        debugger;
        console.log(ex);
    }
}

main();
