# Contributing to this extension

---

### Prerequisites

1. [Node.js](https://nodejs.org/) (see `.nvmrc`)
4. Windows, macOS, or Linux
5. [Visual Studio Code](https://code.visualstudio.com/)
6. VS Code extensions defined in `.vscode/extensions.json`

### Setup

```shell
npm i # This can be a little slow the first time (downloading and extracting of a 300Mb file).
```

You can also compile from the command-line. For a full compile you can use:

```shell
npm run watch
```

For incremental builds you can use the following commands depending on your needs:

```shell
npm run watch
```

Sometimes you will need to run `npm run clean` and even `rm -r out dist temp pyodide`.
This is especially true if you have added or removed files.

### Errors and Warnings

TypeScript errors and warnings will be displayed in the `Problems` window of Visual Studio Code.


#### Building Pyodide Scripts

See details in the `README.md` of the `pyodide` branch.
