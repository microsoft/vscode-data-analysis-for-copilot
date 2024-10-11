/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { renderPrompt } from '@vscode/prompt-tsx';
import * as path from 'path';
import * as vscode from 'vscode';
import { HistoryPrompt, PrefixPrompt, UserRequestPrompt } from './base';

const DATA_AGENT_PARTICIPANT_ID = 'ada.data';
const MODEL_SELECTOR: vscode.LanguageModelChatSelector = {
	vendor: 'copilot',
	family: 'gpt-4o'
};

interface IToolCall {
	tool: vscode.LanguageModelToolDescription;
	call: vscode.LanguageModelToolCallPart;
	result: Thenable<vscode.LanguageModelToolResult>;
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
				name: tool.id,
				description: tool.description,
				parametersSchema: tool.parametersSchema ?? {}
			};
		});

		const options: vscode.LanguageModelChatRequestOptions = {
			tools: allTools,
			justification: 'Just because!'
		};

		const prefixPrompt = await renderPrompt(
			PrefixPrompt,
			{ userQuery: request.prompt, references: request.references, history: chatContext.history },
			{ modelMaxPromptTokens: chat.maxInputTokens },
			chat
		);

		const historyMessages = await renderPrompt(
			HistoryPrompt,
			{ userQuery: request.prompt, references: request.references, history: chatContext.history },
			{ modelMaxPromptTokens: chat.maxInputTokens },
			chat
		);

		console.log('HISTORY MESSAGES', historyMessages.messages);

		const userRequestPrompt = await renderPrompt(
			UserRequestPrompt,
			{ userQuery: request.prompt, references: request.references, history: chatContext.history },
			{ modelMaxPromptTokens: chat.maxInputTokens },
			chat
		);

		const messages: vscode.LanguageModelChatMessage[] = [
			...(prefixPrompt.messages as vscode.LanguageModelChatMessage[]),
			...(historyMessages.messages as vscode.LanguageModelChatMessage[]),
			...(userRequestPrompt.messages as vscode.LanguageModelChatMessage[])
		];

		const cacheMessagesForCurrentRun: vscode.LanguageModelChatMessage[] = [];

		const toolReferences = [...request.toolReferences];
		let errorCount = 0;
		let endedWithError = false;

		const runWithFunctions = async (): Promise<void> => {
			const requestedTool = toolReferences.shift();
			if (requestedTool) {
				options.toolChoice = requestedTool.id;
				options.tools = allTools.filter((tool) => tool.name === requestedTool.id);
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
						const tool = vscode.lm.tools.find((tool) => tool.id === part.name);
						if (!tool) {
							// BAD tool choice?
							stream.progress(`Unknown function: ${part.name}`);
							continue;
						}

						try {
							JSON.parse(part.parameters);
						} catch (err) {
							console.error(part.parameters);
							if (part.parameters && typeof part.parameters === 'string') {
								part.parameters = JSON.stringify({ code: part.parameters });
							} else {
								throw new Error(
									`Got invalid tool use parameters: "${part.parameters}". (${(err as Error).message})`
								);
							}
						}

						toolCalls.push({
							call: part,
							result: vscode.lm.invokeTool(
								tool.id,
								{
									parameters: JSON.parse(part.parameters),
									toolInvocationToken: request.toolInvocationToken,
									requestedContentTypes: [
										'text/plain',
										'image/png',
										'application/vnd.code.notebook.error'
									]
								},
								token
							),
							tool
						});
					}
				}
			}

			if (toolCalls.length) {
				const assistantMsg = vscode.LanguageModelChatMessage.Assistant('');
				assistantMsg.content2 = toolCalls.map(
					(toolCall) =>
						new vscode.LanguageModelToolCallPart(
							toolCall.tool.id,
							toolCall.call.toolCallId,
							toolCall.call.parameters
						)
				);
				let toolErrorInserted = false
				messages.push(assistantMsg);
				cacheMessagesForCurrentRun.push(assistantMsg);
				for (const toolCall of toolCalls) {
					// NOTE that the result of calling a function is a special content type of a USER-messag
					const toolResult = await toolCall.result;
					let toolResultInserted = false;

					if (toolResult['text/plain']) {
						const message = vscode.LanguageModelChatMessage.User('');
						message.content2 = [
							new vscode.LanguageModelToolResultPart(toolCall.call.toolCallId, toolResult['text/plain']!)
						];
						messages.push(message);
						cacheMessagesForCurrentRun.push(message);
						toolResultInserted = true;
					}

					if (toolResult['image/png']) {
						const imageMessages = await this._processImageOutput(toolCall, toolResult);
						messages.push(...imageMessages);
						cacheMessagesForCurrentRun.push(...imageMessages);
						toolResultInserted = true;
					}

					if (toolResult['application/vnd.code.notebook.error']) {
						const error = toolResult['application/vnd.code.notebook.error'] as Error;
						const message = vscode.LanguageModelChatMessage.User('The tool returned an error, analyze this error and attempt to resolve this.');
						const errorContent = [error.name || '', error.message || '', error.stack || ''].filter((part) => part).join('\n');
						message.content2 = [
							new vscode.LanguageModelToolResultPart(toolCall.call.toolCallId, `Error: ${errorContent}`)
						];
						messages.push(message);
						cacheMessagesForCurrentRun.push(message);
						toolErrorInserted = true
						toolResultInserted = true;
					}

					if (!toolResultInserted) {
						// we need to debug
						console.log(toolResult);
					}
				}

				// IMPORTANT The prompt must end with a USER message (with no tool call)
				messages.push(
					vscode.LanguageModelChatMessage.User(
						`${toolErrorInserted ? 'If you fail three times after calling the tool, just present the code to the user.' : ''}
						Above is the result of calling the functions ${toolCalls
							.map((call) => call.tool.id)
							.join(
								', '
							)
						}. Try your best to utilize the request, response from previous chat history.Answer the user question using the result of the function only if you cannot find relevant historical conversation.`
					)
				);

				// RE-enter
				return runWithFunctions();
			}
		};

		await runWithFunctions();

		// stream.markdown(fragment);
		return { metadata: { toolsCallCache: cacheMessagesForCurrentRun } };
	}

	private async _processImageOutput(toolCall: IToolCall, toolResult: vscode.LanguageModelToolResult): Promise<vscode.LanguageModelChatMessage[]> {
		const messages: vscode.LanguageModelChatMessage[] = [];

		const message = vscode.LanguageModelChatMessage.User('');
		if (this.extensionContext.storageUri) {
			const imagePath = await this._saveImage(this.extensionContext.storageUri, toolCall.tool.id, Buffer.from(toolResult['image/png'], 'base64'));
			if (imagePath) {
				const markdownTextForImage = `The image generated from the code is ![${toolCall.tool.id} result](${imagePath}). You can give this markdown link to users!`;
				message.content2 = [
					new vscode.LanguageModelToolResultPart(toolCall.call.toolCallId, markdownTextForImage)
				];
				messages.push(message);
				const userMessage = vscode.LanguageModelChatMessage.User('Return this image link in your response. Do not modify the markdown image link at all. The path is already absolute local file path, do not put "https" or "blob" in the link');
				messages.push(userMessage);

				return messages;
			}
		}

		const markdownTextForImage = `![${toolCall.tool.id} result](data:image/png;base64,${toolResult['image/png']})`;
		message.content2 = [
			new vscode.LanguageModelToolResultPart(toolCall.call.toolCallId, markdownTextForImage)
		];
		messages.push(message);

		return messages;
	}

	private async _saveImage(storageUri: vscode.Uri, tool: string, imageBuffer: Buffer): Promise<string | undefined> {
		try {
			await vscode.workspace.fs.stat(storageUri);
		} catch {
			await vscode.workspace.fs.createDirectory(storageUri);
		}

		const storagePath = storageUri.fsPath;
		const imagePath = path.join(storagePath, `result-${tool}-${Date.now()}.png`);
		const imageUri = vscode.Uri.file(imagePath);
		try {
			await vscode.workspace.fs.writeFile(imageUri, imageBuffer);
			const encodedPath = encodeURI(imageUri.fsPath);
			return encodedPath;
		} catch (ex) {
			console.error('Error saving image', ex);
			return undefined;
		}
	}
}
