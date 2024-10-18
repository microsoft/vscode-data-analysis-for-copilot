/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { ChatMessage, ChatRole, HTMLTracer, PromptRenderer } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { DataAgentPrompt, PromptProps, ToolCallRound, ToolResultMetadata, TsxToolUserMetadata } from './base';
import { Exporter } from './exportCommand';
import { logger } from './logger';

const DATA_AGENT_PARTICIPANT_ID = 'dachat.data';
const MODEL_SELECTOR: vscode.LanguageModelChatSelector = {
	vendor: 'copilot',
	family: 'gpt-4o'
};

export function toVsCodeChatMessages(messages: ChatMessage[]) {
	return messages.map(m => {
		switch (m.role) {
			case ChatRole.Assistant:
				{
					const message: vscode.LanguageModelChatMessage = vscode.LanguageModelChatMessage.Assistant(
						m.content,
						m.name
					);
					if (m.tool_calls) {
						message.content2 = [m.content];
						message.content2.push(
							...m.tool_calls.map(
								tc =>
									new vscode.LanguageModelToolCallPart(tc.function.name, tc.id, JSON.parse(tc.function.arguments))
							)
						);
					}
					return message;
				}
			case ChatRole.User:
				return vscode.LanguageModelChatMessage.User(m.content, m.name);
			case ChatRole.Function: {
				const message: vscode.LanguageModelChatMessage = vscode.LanguageModelChatMessage.User('');
				message.content2 = [new vscode.LanguageModelToolResultPart(m.name, m.content)];
				return message;
			}
			case ChatRole.Tool: {
				{
					const message: vscode.LanguageModelChatMessage = vscode.LanguageModelChatMessage.User(m.content);
					message.content2 = [new vscode.LanguageModelToolResultPart(m.tool_call_id!, m.content)];
					return message;
				}
			}
			default:
				throw new Error(
					`Converting chat message with role ${m.role} to VS Code chat message is not supported.`
				);
		}
	});
}

export class DataAgent implements vscode.Disposable {
	private _disposables: vscode.Disposable[] = [];
	private readonly exporter: Exporter;
	constructor(readonly extensionContext: vscode.ExtensionContext) {
		this.exporter = new Exporter(extensionContext);
		this._disposables.push(vscode.chat.createChatParticipant(DATA_AGENT_PARTICIPANT_ID, this.handle.bind(this)));
	}

	dispose() {
		this._disposables.forEach((d) => d.dispose());
	}

	private async _renderMessages(chat: vscode.LanguageModelChat, props: PromptProps, stream: vscode.ChatResponseStream) {
		const renderer = new PromptRenderer({ modelMaxPromptTokens: chat.maxInputTokens }, DataAgentPrompt, props, {
			tokenLength: async (text, _token) => {
				return chat.countTokens(text);
			},
			countMessageTokens: async (message: ChatMessage) => {
				return chat.countTokens(message.content);
			}
		});
		const tracer = new HTMLTracer();
		renderer.tracer = tracer;
		const result = await renderer.render();

		if (this.extensionContext.extensionMode === vscode.ExtensionMode.Development) {
			const server = await tracer.serveHTML();
			logger.info('Server address:', server.address);
			const serverUri = vscode.Uri.parse(server.address);
			stream.reference(serverUri);
		}

		return result;
	}

	public async handle(
		request: vscode.ChatRequest,
		chatContext: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		const models = await vscode.lm.selectChatModels(MODEL_SELECTOR);
		if (!models || !models.length) {
			logger.warn('NO MODELS');
			return {};
		}

		if (request.command && this.exporter.canHandle(request.command)) {
			this.exporter.invoke(request, chatContext, stream, token);
			return {};
		}

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

		const result = await this._renderMessages(chat, { userQuery: request.prompt, references: request.references, history: chatContext.history, currentToolCallRounds: [], toolInvocationToken: request.toolInvocationToken, extensionContext: this.extensionContext }, stream);
		let messages = toVsCodeChatMessages(result.messages);
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

			logger.debug('Sending request', JSON.stringify(messages, undefined, 4));
			const toolCalls: vscode.LanguageModelToolCallPart[] = [];

			stream.progress('Analyzing');
			const response = await chat.sendRequest(messages, options, token);
			if (response.stream) {
				for await (const part of response.stream) {
					if (part instanceof vscode.LanguageModelTextPart) {
						stream.markdown(part.value);
					} else if (part instanceof vscode.LanguageModelToolCallPart) {
						logger.info('Received tool call', part.name);
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

			if (toolCalls.length) {
				const currentRound: ToolCallRound = {
					toolCalls: toolCalls,
					response: {}
				};
				toolCallRounds.push(currentRound);

				const result = await this._renderMessages(chat, { userQuery: request.prompt, references: request.references, history: chatContext.history, currentToolCallRounds: toolCallRounds, toolInvocationToken: request.toolInvocationToken, extensionContext: this.extensionContext }, stream);
				messages = toVsCodeChatMessages(result.messages);
				logger.info('Token count', result.tokenCount);
				const toolResultMetadata = result.metadata.getAll(ToolResultMetadata)
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
