// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { KernelMessage } from '@jupyterlab/services';
import type { IExecuteRequestMsg } from '@jupyterlab/services/lib/kernel/messages';
import { PyodideKernel } from './kernel';
import { createDeferred, type Deferred } from '../common/async';

function joinPath(separator: string, ...paths: string[]) {
    return paths.join(separator);
}

type TextOutputs = Partial<Record<'text/plain' | 'image/png' | 'text/html', string>>;
type ErrorOutput = { 'application/vnd.code.notebook.error': Error };
type ExecuteResult = TextOutputs & Partial<ErrorOutput>;

export interface ILogger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}

export class Kernel {
    private readonly outputs: Record<string, any>[] = [];
    private completed?: Deferred<void>;
    private readonly kernel: PyodideKernel;
    /**
     *
     * @param pyodidePath Path to the pyodide assets directory.
     * @param workerPath Path to th comlink.worker.js file.
     */
    constructor({
        pyodidePath,
        workerPath,
        location,
        packages,
        logger
    }: {
        pyodidePath: string;
        workerPath: string;
        location: string;
        packages: string[];
        logger: ILogger;
    }) {
        const separator = pyodidePath.includes('/') ? '/' : '\\';
        this.kernel = new PyodideKernel({
            baseUrl: joinPath(separator, pyodidePath),
            pyodideUrl: `file://${joinPath(separator, pyodidePath, 'pyodide.js')}`,
            indexUrl: joinPath(separator, pyodidePath),
            disablePyPIFallback: false,
            location,
            logger,
            mountDrive: true,
            pipliteUrls: [`file://${joinPath(separator, pyodidePath, 'pypi', 'all.json')}`],
            pipliteWheelUrl: `file://${joinPath(separator, pyodidePath, 'pypi', 'piplite-0.4.2-py3-none-any.whl')}`,
            commWheelUrl: `file://${joinPath(separator, pyodidePath, 'comm-0.2.2-py3-none-any.whl')}`,
            id: new Date().getTime().toString(),
            loadPyodideOptions: {
                lockFileURL: joinPath(separator, pyodidePath, 'pyodide-lock.json'),
                packages: Array.from(new Set(['matplotlib', 'pandas'].concat(packages)))
            },
            name: 'pyodide',
            workerPath,
            sendMessage: (msg: KernelMessage.IMessage<KernelMessage.MessageType>) => {
                if (!this.completed) {
                    return;
                }
                if (KernelMessage.isExecuteResultMsg(msg)) {
                    if (msg.content.data && Object.keys(msg.content.data).length) {
                        this.outputs.push(msg.content.data as any);
                    }
                    this.completed?.resolve();
                } else if (KernelMessage.isDisplayDataMsg(msg)) {
                    if (msg.content.data && Object.keys(msg.content.data).length) {
                        this.outputs.push(msg.content.data as any);
                    }
                } else if (KernelMessage.isStreamMsg(msg)) {
                    this.outputs.push({ 'text/plain': msg.content.text });
                }
            }
        });
    }

    async execute(code: string): Promise<ExecuteResult> {
        await this.kernel.ready;
        const request = KernelMessage.createMessage<IExecuteRequestMsg>({
            channel: 'shell',
            content: { code, allow_stdin: false, store_history: true },
            msgType: 'execute_request',
            session: this.kernel.id,
            msgId: new Date().toISOString()
        });

        this.completed = createDeferred<void>();
        this.outputs.length = 0;
        const result = await this.kernel.remoteKernel.execute(request.content, request);
        if ('status' in result && result.status === 'error') {
            const error = new Error(result.evalue);
            error.name = result.ename;
            const { default: stripAnsi } = await import('strip-ansi');
            error.stack = ((result.traceback as string[]) || []).map((l) => stripAnsi(l)).join('\n');
            return {
                'application/vnd.code.notebook.error': error
            };
        }
        return getFormattedOutput(this.outputs);
    }
}

function getFormattedOutput(outputs: Record<string, string>[]): TextOutputs {
    // iterate over the outputs array and pick an item where key = "text/plain"
    // return the value of that key
    const result: TextOutputs = {};
    outputs.forEach((output) => {
        if (output['text/plain']) {
            // There could be multiple text/plain outputs, combine them.
            result['text/plain'] = (result['text/plain'] || '') + output['text/plain'];
        }
        if (output['text/html']) {
            result['text/html'] = output['text/html'];
        }
        if (output['image/png']) {
            result['text/plain'] = '';
            delete result['text/html'];
            result['image/png'] = output['image/png'];
        }
    });
    return result;
}
