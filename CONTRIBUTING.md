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

Local builds download the `comm` and `seaborn` wheels directly. Azure Pipelines
instead stages the wheels from the authenticated `Monaco/vscode` feed and sets
`PYODIDE_WHEEL_DIR` for install and packaging. When updating either wheel, update
its download URL in [build/download.ts](build/download.ts) and its version and
SHA-256 in [build/pyodide-wheels.txt](build/pyodide-wheels.txt). Also update the
filename where the kernel loads the wheel:

- **seaborn:** Update the wheel filename in [src/tools.ts](src/tools.ts).
- **comm:** Update `commWheelUrl` in [src/node/index.ts on the `pyodide` branch](https://github.com/microsoft/vscode-data-analysis-for-copilot/blob/pyodide/src/node/index.ts).
  Follow [that branch's build instructions](https://github.com/microsoft/vscode-data-analysis-for-copilot/blob/pyodide/README.md)
  to rebuild and commit `resources/pyodide.zip` on `pyodide`. The extension build takes the archive from that branch.
