/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { DataAgentPrompt, isFinalUserMessageInResponseToToolCall, isUserMessageWithImageFromToolCall, ToolCallRound, ToolResultMetadata, TsxToolUserMetadata } from './base';

const DATA_AGENT_PARTICIPANT_ID = 'dachat.data';
const MODEL_SELECTOR: vscode.LanguageModelChatSelector = {
	vendor: 'copilot',
	family: 'gpt-4o'
};

export class DataAgent implements vscode.Disposable {
	private _disposables: vscode.Disposable[] = [];
	private readonly generatedCode = new Map<string, string>();

	constructor(readonly extensionContext: vscode.ExtensionContext) {
		this._disposables.push(vscode.chat.createChatParticipant(DATA_AGENT_PARTICIPANT_ID, this.handle.bind(this)));
		this._disposables.push(vscode.commands.registerCommand('ada.showExecutedPythonCode', async (executionId: string) => {
			const code = this.generatedCode.get(executionId);
			if (code) {
				const document = await vscode.workspace.openTextDocument({
					content: code,
					language: 'python'
				});
				void vscode.window.showTextDocument(document);
			}
		}));
	}

	dispose() {
		this._disposables.forEach((d) => d.dispose());
	}

	private clearOldCode(chatContext: vscode.ChatContext) {
		const toolCallRounds = chatContext.history.filter(h => h instanceof vscode.ChatResponseTurn && Array.isArray(h.result.metadata?.toolCallsMetadata?.toolCallRounds)).map(h => (h as vscode.ChatResponseTurn).result.metadata?.toolCallsMetadata?.toolCallRounds as ToolCallRound[]).flat();
		const validToolCallIds = toolCallRounds.map(r => r.toolCalls.map(tc => tc.toolCallId)).flat();
		this.generatedCode.forEach((value, key) => {
			if (!validToolCallIds.includes(key)) {
				this.generatedCode.delete(key);
			}
		});
	}
	public async handle(
		request: vscode.ChatRequest,
		chatContext: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		const models = await vscode.lm.selectChatModels(MODEL_SELECTOR);
		if (!models || !models.length) {
			console.log('NO MODELS');
			return {};
		}

		this.clearOldCode(chatContext);

		const chat = models[0];

		const allTools = vscode.lm.tools.map((tool): vscode.LanguageModelChatTool => {
			return {
				name: tool.name,
				description: tool.description,
				parametersSchema: tool.parametersSchema ?? {}
			};
		});

		const options: vscode.LanguageModelChatRequestOptions = {
			tools: allTools,
			justification: 'Analyzing data to provide insights and recommendations.'
		};

		const prompt = await renderPrompt(
			DataAgentPrompt,
			{ userQuery: request.prompt, references: request.references, history: chatContext.history, currentToolCallRounds: [], toolInvocationToken: request.toolInvocationToken, extensionContext: this.extensionContext },
			{ modelMaxPromptTokens: chat.maxInputTokens },
			chat
		);

		let messages: vscode.LanguageModelChatMessage[] = prompt.messages as vscode.LanguageModelChatMessage[];

		const toolReferences = [...request.toolReferences];

		const toolCallRounds: ToolCallRound[] = [];

		const runWithFunctions = async (): Promise<void> => {
			const requestedTool = toolReferences.shift();
			if (requestedTool) {
				options.toolChoice = requestedTool.id;
				options.tools = allTools.filter((tool) => (tool.name === requestedTool.id));
			} else {
				options.toolChoice = undefined;
				options.tools = allTools;
			}

			console.log('SENDING REQUEST', messages);
			const toolCalls: vscode.LanguageModelToolCallPart[] = [];
			const pyodideToolCalls = toolCallRounds.map(r => r.toolCalls).flat().filter(tc => tc.name === 'ada-data_runPython');
			const isFinalResponse = messages.length && isFinalUserMessageInResponseToToolCall(messages[messages.length - 1].content + messages[messages.length - 1].content2);

			stream.progress('Analyzing');
			const response = await chat.sendRequest(messages, options, token);
			if (response.stream) {
				for await (const part of response.stream) {
					if (part instanceof vscode.LanguageModelTextPart) {
						stream.markdown(part.value);
					} else if (part instanceof vscode.LanguageModelToolCallPart) {
						console.log('RECEIVED TOOL CALL', part.name);
						const tool = vscode.lm.tools.find((tool) => (tool.name === part.name));
						if (!tool) {
							// BAD tool choice?
							stream.progress(`Unknown function: ${part.name}`);
							continue;
						}

						toolCalls.push(part);
					}
				}
			}

			if (!toolCalls.length && isFinalResponse) {
				const isSecondLastMessageAnImageLink = messages.length > 1 && isUserMessageWithImageFromToolCall(messages[messages.length - 2].content + messages[messages.length - 2].content2);
				const isSecondLastMessageTextOutput = messages.length > 1 && pyodideToolCalls.find(toolCall => messages[messages.length - 2].content2.some(c => typeof c !== 'string' && c.toolCallId === toolCall.toolCallId));
				const isThirdLastMessageAnImageResponse = messages.length > 2 && pyodideToolCalls.find(toolCall => messages[messages.length - 3].content2.some(c => typeof c !== 'string' && c.toolCallId === toolCall.toolCallId));
				// Possible the last message was an image as a result of some analysis.
				// Assumption is that if an image was shown, then some Python code was executed successfully against Pyodide
				if (isSecondLastMessageAnImageLink && isThirdLastMessageAnImageResponse && isThirdLastMessageAnImageResponse.parameters && 'code' in isThirdLastMessageAnImageResponse.parameters) {
					const message = messages[messages.length - 3].content2.find(c => typeof c !== 'string' && c.toolCallId === isThirdLastMessageAnImageResponse.toolCallId);
					const id = typeof message === 'string' ? undefined : message?.toolCallId;
					const code = isThirdLastMessageAnImageResponse.parameters.code
					if (id && code && typeof code === 'string') {
						// this.generatedCode.set(id, code);
						// stream.button({ command: 'ada.showExecutedPythonCode', title: '$(code)', arguments: [id] });
					}
				} else if (isSecondLastMessageTextOutput && isSecondLastMessageTextOutput && 'code' in isSecondLastMessageTextOutput.parameters) {
					// Possible the last message was a result of a tool call and we displayed some output & not errors.
					const message = messages[messages.length - 2].content2.find(c => typeof c !== 'string' && c.toolCallId === isSecondLastMessageTextOutput.toolCallId);
					const id = typeof message === 'string' ? undefined : message?.toolCallId;
					const code = isSecondLastMessageTextOutput.parameters.code
					if (id && code && typeof code === 'string') {
						// this.generatedCode.set(id, code);
						// stream.button({ command: 'ada.showExecutedPythonCode', title: '$(code)', arguments: [id] });
					}
				}
			}

			if (toolCalls.length) {
				const currentRound: ToolCallRound = {
					toolCalls: toolCalls,
					response: {}
				};
				toolCallRounds.push(currentRound);

				const result = (await renderPrompt(
					DataAgentPrompt,
					{ userQuery: request.prompt, references: request.references, history: chatContext.history, currentToolCallRounds: toolCallRounds, toolInvocationToken: request.toolInvocationToken, extensionContext: this.extensionContext },
					{ modelMaxPromptTokens: chat.maxInputTokens },
					chat
				));

				messages = result.messages;
				console.log('Token count', result.tokenCount);
				const toolResultMetadata = result.metadatas.getAll(ToolResultMetadata)
				if (toolResultMetadata?.length) {
					toolResultMetadata.forEach(meta => {
						if (currentRound.toolCalls.find(tc => tc.toolCallId === meta.toolCallId)) {
							currentRound.response[meta.toolCallId] = meta.result;
						}
					});
				}

				return runWithFunctions();
			}
		};

		await runWithFunctions();

		return {
			metadata: {
				toolCallsMetadata: {
					toolCallRounds
				}
			} satisfies TsxToolUserMetadata
		}
	}
}
