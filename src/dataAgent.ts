import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { PrefixPrompt, renderPromptWithHistory, UserRequestPrompt } from './base';

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

	constructor() {
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

        const historyMessages = renderPromptWithHistory(request.prompt, request.references, chatContext);

        const userRequestPrompt = await renderPrompt(
			UserRequestPrompt,
			{ userQuery: request.prompt, references: request.references, history: chatContext.history },
			{ modelMaxPromptTokens: chat.maxInputTokens },
			chat
		);

		const messages: vscode.LanguageModelChatMessage[] = [
            ...(prefixPrompt.messages as vscode.LanguageModelChatMessage[]),
            ...(historyMessages as vscode.LanguageModelChatMessage[]),
            ...(userRequestPrompt.messages as vscode.LanguageModelChatMessage[])
        ];

		const cacheMessagesForCurrentRun: vscode.LanguageModelChatMessage[] = [];

		const toolReferences = [...request.toolReferences];
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
						const message = vscode.LanguageModelChatMessage.User('');
						const markdownTextForImage = `![${toolCall.tool.id} result](data:image/png;base64,${toolResult['image/png']})`;
						message.content2 = [
							new vscode.LanguageModelToolResultPart(toolCall.call.toolCallId, markdownTextForImage)
						];
						messages.push(message);
						cacheMessagesForCurrentRun.push(message);
						toolResultInserted = true;
					}

					if (toolResult['application/vnd.code.notebook.error']) {
						// const message = vscode.LanguageModelChatMessage.User('');
						// const error: Error = toolResult['application/vnd.code.notebook.error'];
						// message.content2 = [
						//     new vscode.LanguageModelToolResultPart(
						//     // new vscode.LanguageModelToolResultPart(
						//         toolCall.call.toolCallId,
						//         `Error: ${error.message} (${error.name})\n${error.stack}`,
						//         true
						//     )
						// ];
						// messages.push(message);
						const message = vscode.LanguageModelChatMessage.User('');
						message.content2 = [
							new vscode.LanguageModelToolResultPart(toolCall.call.toolCallId, 'We encountered an error')
						];
						messages.push(message);
						cacheMessagesForCurrentRun.push(message);

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
						`Do not filter dataframe output. If you encountered error or fail three times after calling the tool, just present the code to the user.
						Above is the result of calling the functions ${toolCalls
							.map((call) => call.tool.id)
							.join(
								', '
							)}. Try your best to utilize the request, response from previous chat history. Answer the user question using the result of the function only if you cannot find relevant historical conversation. Do not filter the response. Do not filter when displaying dataset.`
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
}
