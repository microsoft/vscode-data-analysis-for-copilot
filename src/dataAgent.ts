/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { DataAgentPrompt, ToolCallRound, ToolResultMetadata, TsxToolUserMetadata } from './base';

const DATA_AGENT_PARTICIPANT_ID = 'ada.data';
const MODEL_SELECTOR: vscode.LanguageModelChatSelector = {
	vendor: 'copilot',
	family: 'gpt-4o'
};

interface IToolCall {
	tool: vscode.LanguageModelToolDescription;
	call: vscode.LanguageModelToolCallPart;
}

export class DataAgent implements vscode.Disposable {
	private _disposables: vscode.Disposable[] = [];

	constructor(readonly extensionContext: vscode.ExtensionContext) {
		this._disposables.push(vscode.chat.createChatParticipant(DATA_AGENT_PARTICIPANT_ID, this.handle.bind(this)));
	}

	dispose() {
		this._disposables.forEach((d) => d.dispose());
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

		const chat = models[0];

		stream.progress('Analyzing');

		const allTools = vscode.lm.tools.map((tool): vscode.LanguageModelChatTool => {
			return {
				name: tool.name,
				description: tool.description,
				parametersSchema: tool.parametersSchema ?? {}
			};
		});

		const options: vscode.LanguageModelChatRequestOptions = {
			tools: allTools,
			justification: 'Just because!'
		};

		const prompt = await renderPrompt(
			DataAgentPrompt,
			{ userQuery: request.prompt, references: request.references, history: chatContext.history, currentToolCallRounds: [], toolInvocationToken: request.toolInvocationToken, extensionContext: this.extensionContext },
			{ modelMaxPromptTokens: chat.maxInputTokens },
			chat
		);

		let messages: vscode.LanguageModelChatMessage[] = prompt.messages as vscode.LanguageModelChatMessage[];

		const toolReferences = [...request.toolReferences];
		let errorCount = 0;
		let endedWithError = false;

		const accumulatedToolResults: Record<string, vscode.LanguageModelToolResult> = {};
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
			const toolCalls: IToolCall[] = [];

			// Loop through the messages, check if there are 3 or greater # of tool call error -
			// Tell Language Model to just present the code to user without further tool call
			for (const msg of messages) {
				if (msg && msg instanceof vscode.LanguageModelChatMessage) {
					if (msg.content2 && msg.content2[0] && msg.content2[0] instanceof vscode.LanguageModelToolResultPart && msg.content2[0].content) {
						if (msg.content2[0].content === 'We encountered an error') {
							errorCount++;
							endedWithError = true;
						}
					}
				}
			}
			// Re-try the function call if we encountered an error less than 3 times
			if (errorCount < 3 && endedWithError) {
				runWithFunctions();
			}

			if (errorCount >= 3) {
				messages.push(vscode.LanguageModelChatMessage.User('We encountered an error three times. Please present only the last ran attempted code to the user. Instead of performing another function call'));
				console.log('Encountered Three errors from function call');
			}

			const response = await chat.sendRequest(messages, options, token);

			if (response.stream) {
				for await (const part of response.stream) {
					if (part instanceof vscode.LanguageModelTextPart) {
						stream.markdown(part.value);
					} else if (part instanceof vscode.LanguageModelToolCallPart) {
						const tool = vscode.lm.tools.find((tool) => (tool.name === part.name));
						if (!tool) {
							// BAD tool choice?
							stream.progress(`Unknown function: ${part.name}`);
							continue;
						}

						toolCalls.push({
							call: part,
							tool
						});
					}
				}
			}

			if (toolCalls.length) {
				const currentRound = {
					toolCalls: toolCalls.map(tc => tc.call),
					response: new Map()
				};
				toolCallRounds.push(currentRound);

				const result = (await renderPrompt(
					DataAgentPrompt,
					{ userQuery: request.prompt, references: request.references, history: chatContext.history, currentToolCallRounds: toolCallRounds, toolInvocationToken: request.toolInvocationToken, extensionContext: this.extensionContext },
					{ modelMaxPromptTokens: chat.maxInputTokens },
					chat
				));

				messages = result.messages;
				const toolResultMetadata = result.metadatas.getAll(ToolResultMetadata)
				if (toolResultMetadata?.length) {
					toolResultMetadata.forEach(meta => {
						currentRound.response.set(meta.toolCallId, meta.result);
						accumulatedToolResults[meta.toolCallId] = meta.result;
					});
				}

				return runWithFunctions();
			}
		};

		await runWithFunctions();

		return {
			metadata: {
				toolCallsMetadata: {
					toolCallResults: accumulatedToolResults,
					toolCallRounds
				}
			} satisfies TsxToolUserMetadata
		}
	}
}
