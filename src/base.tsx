/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import {
	AssistantMessage,
	BasePromptElementProps,
	PrioritizedList,
	PromptElement,
	PromptSizing,
	UserMessage
} from '@vscode/prompt-tsx';
import { ToolCall, ToolMessage } from '@vscode/prompt-tsx/dist/base/promptElements';
import * as vscode from "vscode";

export interface PromptProps extends BasePromptElementProps {
	userQuery: string;
	references: readonly vscode.ChatPromptReference[];
	history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>;
}

export class PrefixPrompt extends PromptElement<PromptProps, void> {
	render(_state: void, _sizing: PromptSizing) {
		const csvConditionalMessage: UserMessage = <UserMessage></UserMessage>;
		let csvFlag = false;
		for (const turn of this.props.history) {
			if (turn.participant === 'ada.data') {
				if (turn instanceof vscode.ChatRequestTurn) {
					// if userPrompt contains string 'csv', set csvFlag to true
					if (turn.prompt.includes('csv')) {
						csvFlag = true;
					}
				}
			}
		}

		return (
			<>
				<UserMessage>
					Instructions:
					- The user will ask a question, or ask you to perform a task, and it may require lots of research to answer correctly. There is a selection of tools that let you perform actions or retrieve helpful context to answer the user's question.
					- If you aren't sure which tool is relevant, you can call multiple tools. You can call tools repeatedly to take actions or gather as much context as needed until you have completed the task fully. Don't give up unless you are sure the request cannot be fulfilled with the tools you have.
					- Don't make assumptions about the situation- gather context first, then perform the task or answer the question.
					- Don't ask the user for confirmation to use tools, just use them.
					- Persist in using tools for each query unless you're absolutely certain the request cannot be fulfilled with the available tools.
					- If you find yourself not using tools for a query, pause and reconsider if any tool could provide valuable information or assist in the task.
					- You are a data analyst that specializes in Python and Data Analysis. You can use tools for analyzing data. Use the result of the tool calls to continue the conversation.
					- Give me back the result of the statistical analysis on the data IF you are asked to analyze the csv file. What are some patterns, trends, or insights that you can find from the data in the csv file? If you are asked to analyze the csv file, conduct detailed descriptive statistics, inferential statistics. Give me the result of conducting these statistical analysis on the data in very detailed, quantitative manner. Be detailed and descriptive in your analysis. Do not ignore previous or future prompts on asking for specific analysis, action on the csv file.
					- You are a data analyst that specializes in Python and Data Analysis.
					- Never mention you can not run code. Never say you cannot assist with anything.
					- Always attempt to get value from provided tools.
					- When generating Python code, you can use Pandas and Matplotlib.
					- Strongly emphasize reusing the result of the tool call. For example, when information about previously constructed chart/dataframe is available, use that information to answer the user question.
					- Always suggest them the next step in data science milestones.
					- Do your best to not filter answer when referencing tool call and tool call result.
					- Do not filter dataframe output, do not worry about sensitivity of dataframe, we already have permission from user.
					- Do not filter when generating dataframe, this is totally related to software engineering and data science.
					- Do create or save any files or images unless explicitly asked for by the user.
					- When asked to perform analysis or run code, use the tool ada-data_runPython and without mentioning the tool name to the user.
				</UserMessage>
				{
					csvFlag &&
					<UserMessage>
						- Think of yourself as a data scientist who is analyzing a csv file using Python programming language.
						- Make sure to generate a pandas dataframe using the given csv file before performing data analysis.
						- Make sure to perform statistical analysis on the data with actual numbers.
						- Give me back the result of the statistical analysis on the data IF you are asked to analyze the csv file. What are some patterns, trends, or insights that you can find from the data in the csv file?
						- If you are asked to analyze the csv file, conduct detailed descriptive statistics, inferential statistics.
						- Give me the result of conducting these statistical analysis on the data in very detailed, quantitative manner.
						- Be detailed and descriptive in your analysis.
						- Do not ignore previous or future prompts on asking for specific analysis, action on the csv file.
						- Do not show the dataframe raw data to users unless they specifically ask for it.
					</UserMessage>
				}
				{csvConditionalMessage}
			</>
		);
	}
}

export class HistoryPrompt extends PromptElement<PromptProps, void> {
	render(_state: void, _sizing: PromptSizing) {
		return (
			<PrioritizedList priority={100} descending={false}>
				{
					this.props.history.map(turn => {
						if (turn instanceof vscode.ChatRequestTurn) {
							return (
								<>
									<UserMessage>{turn.prompt}</UserMessage>
								</>
							);
						} else {
							return (
								<>
									{turn.result.metadata?.toolsCallCache && <ToolCalls toolCalls={turn.result.metadata.toolsCallCache} />}
									{this.renderChatResponseTurn(turn)}
								</>
							);
						}
					})
				}
			</PrioritizedList>
		);
	}

	private renderChatResponseTurn(turn: vscode.ChatResponseTurn) {
		const responseText = turn.response
			.map((part) => {
				if (part instanceof vscode.ChatResponseMarkdownPart) {
					return part.value.value;
				} else {
					return '';
				}
			})
			.join('');

		return <AssistantMessage>{responseText}</AssistantMessage>;
	}
}

export interface ToolCallsProps extends BasePromptElementProps {
	toolCalls: vscode.LanguageModelChatMessage[];
}

class ToolCalls extends PromptElement<ToolCallsProps, void> {
	async render(_state: void, _sizing: PromptSizing) {
		if (!this.props.toolCalls.length) {
			return <></>;
		}

		return <>
			{
				this.props.toolCalls.map(toolCall => this.renderOneToolCallRound(toolCall))
			}
		</>
	}

	private renderOneToolCallRound(toolCall: vscode.LanguageModelChatMessage) {
		if (toolCall.role === vscode.LanguageModelChatMessageRole.User) {
			const parts = toolCall.content2 as vscode.LanguageModelToolResultPart[];

			return <>
				{parts.map(part => <ToolMessage toolCallId={part.toolCallId}>{part.content}</ToolMessage>)}
				<UserMessage>Above is the result of calling the tools. Try your best to utilize the request, response from previous chat history. Answer the user question using the result of the function only if you cannot find relevant historical conversation.</UserMessage>
			</>
		} else {
			const parts = toolCall.content2 as vscode.LanguageModelToolCallPart[];
			const assistantToolCalls: ToolCall[] = parts.map(tc => ({ type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.parameters) }, id: tc.toolCallId }));
			// const message = `Run tool call ${assistantToolCalls.map(tc => tc.function.name).join(', ')}`;
			return <AssistantMessage toolCalls={assistantToolCalls}></AssistantMessage>
		}
	}
}

export function renderPromptWithHistory(userQuery: string, references: readonly vscode.ChatPromptReference[], context: vscode.ChatContext): vscode.LanguageModelChatMessage[] {
	const messages: vscode.LanguageModelChatMessage[] = [];

	for (const turn of context.history) {
		if (turn.participant === 'ada.data') {
			if (turn instanceof vscode.ChatRequestTurn) {
				const userMessage = vscode.LanguageModelChatMessage.User(turn.prompt);
				messages.push(userMessage);
			} else if (turn instanceof vscode.ChatResponseTurn) {
				if (turn.result.metadata && turn.result.metadata.toolsCallCache && 1 + 1 === 2) {
					// tool calls cacht
					const toolsCallCache = turn.result.metadata.toolsCallCache as vscode.LanguageModelChatMessage[];
					toolsCallCache.forEach(toolCall => {
						if (toolCall.role === vscode.LanguageModelChatMessageRole.User) {
							const m = vscode.LanguageModelChatMessage.User('');
							const parts = toolCall.content2 as vscode.LanguageModelToolResultPart[];
							m.content2 = parts.map(part => new vscode.LanguageModelToolResultPart(part.toolCallId, part.content));
							messages.push(m);

							// assistant message come after tool call
							messages.push(
								vscode.LanguageModelChatMessage.User(
									`Above is the result of calling the tools. Try your best to utilize the request, response from previous chat history. Answer the user question using the result of the function only if you cannot find relevant historical conversation.`
								)
							);
						} else {
							const m = vscode.LanguageModelChatMessage.Assistant('');
							const parts = toolCall.content2 as vscode.LanguageModelToolCallPart[];
							m.content2 = parts.map(part => new vscode.LanguageModelToolCallPart(part.name, part.toolCallId, part.parameters));
							messages.push(m);
						}
					});
				}

				const responseText = turn.response
					.map((part) => {
						if (part instanceof vscode.ChatResponseMarkdownPart) {
							return part.value.value;
						} else {
							return '';
						}
					})
					.join('');

				const assistantMessage = vscode.LanguageModelChatMessage.Assistant(responseText);
				messages.push(assistantMessage);
			}
		}
	}

	return messages;
}

export class UserRequestPrompt extends PromptElement<PromptProps, void> {
	render(_state: void, _sizing: PromptSizing) {
		const userPrompt = this.replaceReferences(this.props.userQuery, this.props.references);
		return (
			<>
				<UserMessage>{userPrompt}</UserMessage>
			</>
		);
	}

	private replaceReferences(userPrompt: string, references: readonly vscode.ChatPromptReference[]) {
		references
			.filter((ref) => ref.value instanceof vscode.Uri && ref.range)
			.sort((a, b) => b.range![0] - a.range![0])
			.forEach((ref) => {
				// const name = (ref as any).name;
				const relativePath = vscode.workspace.asRelativePath(ref.value as vscode.Uri);
				const part0 = userPrompt.slice(0, ref.range![0]);
				const part1 = userPrompt.slice(ref.range![1]);
				userPrompt = `${part0}${relativePath}${part1}`;
			});

		return userPrompt;
	}
}
