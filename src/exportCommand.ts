/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
*--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { EOL } from 'os';
import { unescape } from 'querystring';
import { promisify } from 'util';
import { CancellationToken, ChatContext, ChatRequest, ChatResponseMarkdownPart, ChatResponseStream, ChatResponseTurn, ExtensionContext, l10n, NotebookCellData, NotebookCellKind, NotebookCellOutput, NotebookData, ThemeIcon, window, workspace } from "vscode";
import { getToolResultValue, isErrorMessageResponse, TsxToolUserMetadata } from "./base";
import { logger } from "./logger";
import { uint8ArrayToBase64 } from "./platform/common/string";
import { RunPythonTool } from "./tools";
import sanitize from 'sanitize-filename';

const JupyterNotebookView = 'jupyter-notebook';
// enum CellOutputMimeTypes {
// 	error = 'application/vnd.code.notebook.error',
// 	stderr = 'application/vnd.code.notebook.stderr',
// 	stdout = 'application/vnd.code.notebook.stdout'
// }

// const textMimeTypes = ['text/plain', 'text/markdown', CellOutputMimeTypes.stderr, CellOutputMimeTypes.stdout];
export class Exporter {
	private readonly jupyterExporter: JupyterNotebookExporter;
	private readonly pythonExporter: PythonScriptExporter;

	constructor(private readonly context: ExtensionContext) {
		this.jupyterExporter = new JupyterNotebookExporter(context);
		this.pythonExporter = new PythonScriptExporter(context, this.jupyterExporter);
	}
	public canHandle(command: string) {
		return command === 'export';
	}
	public async invoke(request: ChatRequest,
		chatContext: ChatContext,
		stream: ChatResponseStream,
		token: CancellationToken) {
		const notebook = l10n.t('Jupyter Notebook');
		const python = l10n.t('Python Script');
		const format = await window.showQuickPick([
			{
				label: notebook,
				iconPath: new ThemeIcon('notebook'),
			},
			{
				label: python,
				iconPath: new ThemeIcon('snake'),
			},
		], { canPickMany: false, matchOnDescription: true, matchOnDetail: true, placeHolder: l10n.t('Export As...') })

		switch (format?.label) {
			case notebook: {
				await this.jupyterExporter.invoke(request, chatContext, stream, token);
				return {}
			}
			case python: {
				await this.pythonExporter.invoke(request, chatContext, stream, token);
				return {}
			}
		}
	}
}

export class JupyterNotebookExporter {
	public readonly command = 'exportNotebook';
	constructor(private readonly context: ExtensionContext) {

	}
	public async invoke(request: ChatRequest,
		chatContext: ChatContext,
		stream: ChatResponseStream,
		token: CancellationToken) {
		const notebookData = await this.export(request, chatContext, stream, token);
		if (notebookData) {
			void workspace.openNotebookDocument(JupyterNotebookView, notebookData).then(doc => window.showNotebookDocument(doc));
		}
	}

	public async export(request: ChatRequest,
		chatContext: ChatContext,
		_stream: ChatResponseStream,
		_token: CancellationToken): Promise<NotebookData | undefined> {
		const history = chatContext.history;
		const responses: ChatResponseTurn[] = history.filter(h => (h instanceof ChatResponseTurn)).filter(h => h.command !== 'export');
		if (!responses.length) {
			window.showInformationMessage(l10n.t('No history to export'));
			return;
		}
		const cells: NotebookCellData[] = [];
		for (const response of responses) {
			if (!(response instanceof ChatResponseTurn)) {
				continue;
			}

			const toolCallRounds = (response.result.metadata as TsxToolUserMetadata | undefined)?.toolCallsMetadata.toolCallRounds || [];
			for (const round of toolCallRounds) {
				// We're only interested in the Python calls for now
				// Ignore the file search and other tool calls.

				round.toolCalls.filter(tool => tool.name === RunPythonTool.Id).forEach(tool => {
					if (isErrorMessageResponse(getToolResultValue(round.response[tool.callId]) || '')) {
						logger.debug(`Ignoring tool call as there was an error`);
						return;
					}

					const parameters = tool.parameters as { code: string; reason: string };
					if (!parameters.code && !parameters.reason) {
						logger.warn(`Ignoring tool call as code & reason are empty`);
						return;
					}

					if (parameters.reason) {
						cells.push(new NotebookCellData(NotebookCellKind.Markup, parameters.reason, 'markdown'));
					}
					if (parameters.code) {
						const codeCell = new NotebookCellData(NotebookCellKind.Code, parameters.code, 'python');
						const outputs: NotebookCellOutput[] = []
						codeCell.outputs = outputs;
						cells.push(codeCell);
					}

					// result.content.forEach((output) =>{
					// 	if (isTextPart(output) && output.value){
					// 		outputs.push(new NotebookCellOutput([NotebookCellOutputItem.stdout(output.value)]));
					// 	}
					// 	// let value = getToolResultValue<string | string[] | object>(result, mime);
					// 	// if (typeof value === 'undefined') {
					// 	// 	return;
					// 	// } else if (
					// 	// 	(mime.startsWith('text/') || textMimeTypes.includes(mime)) &&
					// 	// 	(Array.isArray(value) || typeof value === 'string')
					// 	// ) {
					// 	// 	const stringValue = Array.isArray(value) ? concatMultilineString(value as string[]) : value;
					// 	// 	outputs.push(new NotebookCellOutput([NotebookCellOutputItem.text(stringValue, mime)]));
					// 	// } else if (mime.startsWith('image/') && typeof value === 'string') {
					// 	// 	outputs.push(new NotebookCellOutput([new NotebookCellOutputItem(base64ToUint8Array(value), mime)]));
					// 	// } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
					// 	// 	outputs.push(new NotebookCellOutput([NotebookCellOutputItem.text(JSON.stringify(value), mime)]));
					// 	// } else {
					// 	// 	// For everything else, treat the data as strings (or multi-line strings).
					// 	// 	value = Array.isArray(value) ? concatMultilineString(value) : value;
					// 	// 	outputs.push(new NotebookCellOutput([NotebookCellOutputItem.text(value as string, mime)]));
					// 	// }
					// });
				})
			}

			const resultCells = new Map<number, NotebookCellData>();
			await Promise.all(response.response.filter(r => r instanceof ChatResponseMarkdownPart).map(async (r, i) => {
				const { markdown, attachments } = await createAttachments(r.value.value);
				if (markdown) {
					const cell = new NotebookCellData(NotebookCellKind.Markup, markdown, 'markdown');
					if (attachments) {
						cell.metadata = {
							attachments
						}
					}
					resultCells.set(i, cell);
				}
			}));
			Array.from(resultCells.values()).forEach(cell => cells.push(cell));
		}

		if (!cells.length) {
			window.showInformationMessage(l10n.t('No history to export'));
			return;
		}

		const notebookData = new NotebookData(cells);
		notebookData.metadata = {
			cells: [],
			metadata: {
				language_info: {
					name: 'python'
				}
			}
		};

		return notebookData;
	}
}

export class PythonScriptExporter {
	public readonly command = 'exportPython';
	constructor(private readonly context: ExtensionContext, private readonly jupyterExport: JupyterNotebookExporter) {

	}
	public async invoke(request: ChatRequest,
		chatContext: ChatContext,
		stream: ChatResponseStream,
		token: CancellationToken) {

		const content = await this.export(request, chatContext, stream, token);
		if (content) {
			void workspace.openTextDocument({ language: 'python', content }).then(doc => window.showTextDocument(doc));
		}
	}

	public async export(request: ChatRequest,
		chatContext: ChatContext,
		stream: ChatResponseStream,
		token: CancellationToken) {

		const notebookData = await this.jupyterExport.export(request, chatContext, stream, token);
		if (notebookData) {
			const cellMarker = '# %%';
			let content = '';
			notebookData.cells.forEach(cell => {
				if (cell.kind === NotebookCellKind.Markup) {
					content += `${cellMarker} [markdown]${EOL}`
					content += cell.value.split(/\r?\n/).map(line => `# ${line}`).join(EOL);
				} else {
					content += `${cellMarker}${EOL}`
					content += cell.value;
				}
				content += EOL
				content += EOL
			})
			return content;
		}
	}
}



// Copied from Jupyter extension.
export function concatMultilineString(str: string | string[]): string {
	if (Array.isArray(str)) {
		let result = '';
		for (let i = 0; i < str.length; i += 1) {
			const s = str[i];
			if (i < str.length - 1 && !s.endsWith('\n')) {
				result = result.concat(`${s}\n`);
			} else {
				result = result.concat(s);
			}
		}
		return result;
	}
	return str.toString();
}


export function extractMarkdownImages(markdown: string): { name: string; link: string }[] {
	const imageRegex = /\[([^\]]+)\]\(([^)]+.png)\)/gm;
	const matches: { name: string; link: string }[] = [];
	let match;
	while ((match = imageRegex.exec(markdown)) !== null) {
		const name = match[1];
		const link = match[2];
		matches.push({ name, link });
	}

	return matches;
}

export async function createAttachments(markdown: string): Promise<{ markdown: string, attachments?: Record<string, { 'image/png': string }> }> {
	const images = extractMarkdownImages(markdown);
	if (!images || !images.length) {
		return { markdown };
	}

	const attachments: Record<string, { 'image/png': string }> = {};
	await Promise.all(images.map(async ({ name, link }) => {
		try {
			const file = unescape(link.startsWith('file://') ? link.substring('file://'.length) : link);
			const bytes = await promisify(fs.readFile)(file);
			const base64 = uint8ArrayToBase64(bytes);
			name = `${sanitize(name).replace(/ /g, '')}.png`;
			attachments[name] = { 'image/png': base64 };
			markdown = markdown.replace(link, `attachment:${name}`);
		} catch (ex) {
			logger.error(`Failed to generate attachment for an image`, ex);
		}
	}));

	return Object.keys(attachments).length ? { markdown, attachments } : { markdown };
}
