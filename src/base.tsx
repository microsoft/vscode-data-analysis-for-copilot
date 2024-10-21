/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import {
	AssistantMessage,
	BasePromptElementProps,
	PrioritizedList,
	PromptElement,
	PromptElementProps,
	PromptMetadata,
	PromptPiece,
	PromptReference,
	PromptSizing,
	UserMessage,
} from '@vscode/prompt-tsx';
import { Chunk, TextChunk, ToolCall, ToolMessage, ToolResult } from '@vscode/prompt-tsx/dist/base/promptElements';
import * as path from 'path';
import * as vscode from "vscode";
import { logger } from './logger';
import { RunPythonTool } from './tools';

const ImagePrefix = `8a59d504`;

const userMessageWithWithImageFromToolCall = `Return this image link in your response. Do not modify the markdown image link at all. The path is already absolute local file path, do not put "https" or "blob" in the link`;

export function isImageGeneratedByUs(imageName: string) {
	return imageName.startsWith(`result-${RunPythonTool.Id}-${ImagePrefix}-`);
}

export function isUserMessageWithImageFromToolCall(message: string) {
	return message.includes(userMessageWithWithImageFromToolCall);
}

export function isFinalUserMessageInResponseToToolCall(message: string) {
	return message.includes('Above is the result of calling the functions') && message.includes('Try your best to utilize the request, response from previous chat history.Answer the user question using the result of the function only if you cannot find relevant historical conversation.');
}

function generateUserMessageForToolResponse(toolCallIds: string) {
	return `Above is the result of calling the functions ${toolCallIds}. Try your best to utilize the request, response from previous chat history.Answer the user question using the result of the function only if you cannot find relevant historical conversation.`;
}

export interface ToolCallRound {
	toolCalls: vscode.LanguageModelToolCallPart[];
	response: Record<string, vscode.LanguageModelToolResult>;
}

export interface ToolCallsMetadata {
	toolCallRounds: ToolCallRound[];
}

export interface TsxToolUserMetadata {
	toolCallsMetadata: ToolCallsMetadata;
}

export interface PromptProps extends BasePromptElementProps {
	userQuery: string;
	references: readonly vscode.ChatPromptReference[];
	history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>;
	currentToolCallRounds: ToolCallRound[];
	toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
	extensionContext: vscode.ExtensionContext;
}


interface PromptReferencesProps extends BasePromptElementProps {
	references: ReadonlyArray<vscode.ChatPromptReference>;
	excludeReferences?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class PromptReferences extends PromptElement<PromptReferencesProps, void> {
	render(_state: void, _sizing: PromptSizing): PromptPiece {
		return (
			<UserMessage>
				{this.props.references.map((ref, _index) => (
					<PromptReferenceElement ref={ref} excludeReferences={this.props.excludeReferences} />
				))}
			</UserMessage>
		);
	}
}

interface PromptReferenceProps extends BasePromptElementProps {
	ref: vscode.ChatPromptReference;
	excludeReferences?: boolean;
}

export type TagProps = PromptElementProps<{
	name: string;
}>;

export class Tag extends PromptElement<TagProps> {
	private static readonly _regex = /^[a-zA-Z_][\w.-]*$/;

	render() {
		const { name } = this.props;

		if (!Tag._regex.test(name)) {
			throw new Error(`Invalid tag name: ${this.props.name}`);
		}

		return (
			<>
				{'<' + name + '>'}<br />
				<>
					{this.props.children}<br />
				</>
				{'</' + name + '>'}<br />
			</>
		);
	}
}

class PromptReferenceElement extends PromptElement<PromptReferenceProps> {
	async render(_state: void, _sizing: PromptSizing): Promise<PromptPiece | undefined> {
		const value = this.props.ref.value;
		// TODO make context a list of TextChunks so that it can be trimmed
		if (value instanceof vscode.Uri) {
			const fileContents = (await vscode.workspace.fs.readFile(value)).toString();
			return (
				<Tag name="context">
					{!this.props.excludeReferences && <references value={[new PromptReference(value)]} />}
					{value.fsPath}:<br />
					``` <br />
					{fileContents}<br />
					```<br />
				</Tag>
			);
		} else if (value instanceof vscode.Location) {
			const rangeText = (await vscode.workspace.openTextDocument(value.uri)).getText(value.range);
			return (
				<Tag name="context">
					{!this.props.excludeReferences && <references value={[new PromptReference(value)]} />}
					{value.uri.fsPath}:{value.range.start.line + 1}-$<br />
					{value.range.end.line + 1}: <br />
					```<br />
					{rangeText}<br />
					```
				</Tag>
			);
		} else if (typeof value === 'string') {
			return <Tag name="context">{value}</Tag>;
		}
	}
}

export class DataAgentPrompt extends PromptElement<PromptProps, void> {
	render(_state: void, _sizing: PromptSizing) {
		const shouldStopRetry = this.shouldStopRetry();

		const userPrompt = this.replaceReferences(this.props.userQuery, this.props.references);
		return (
			<>
				<Instructions history={this.props.history} priority={1000} />
				<History history={this.props.history} priority={500} flexGrow={1} toolInvocationToken={this.props.toolInvocationToken} extensionContext={this.props.extensionContext} />

				{/* <PromptReferences
                    references={this.props.references}
					flexGrow={2}
                    priority={450}
                /> */}

				<UserMessage priority={1000}>{userPrompt}</UserMessage>
				<ToolCalls toolCallRounds={this.props.currentToolCallRounds} priority={1000} toolInvocationToken={this.props.toolInvocationToken} extensionContext={this.props.extensionContext} ></ToolCalls>
				{shouldStopRetry && <UserMessage>We encountered an error three times. Please present only the last ran attempted code to the user. Instead of performing another function call</UserMessage>}
			</>
		);
	}

	private shouldStopRetry() {
		let errorCount = 0;
		let endedWithError = false;
		for (const toolCallRound of this.props.currentToolCallRounds) {
			toolCallRound.toolCalls.forEach((toolCall) => {
				const response = getToolResultValue<Error>(toolCallRound.response[toolCall.callId], 'application/vnd.code.notebook.error');
				if (response) {
					errorCount++;
					endedWithError = true;
				}
			});
		}

		return errorCount >= 3 && endedWithError;
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

interface InstructionsProps extends BasePromptElementProps {
	history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>;
}

class Instructions extends PromptElement<InstructionsProps, void> {
	render(_state: void, _sizing: PromptSizing) {
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

		return <UserMessage priority={1000}>
			<TextChunk>
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
				- Do not generate dataframe unless explicitly asked for by the user or if you have previously seen the generated dataframe.
				- Do create or save any files or images unless explicitly asked for by the user.
				- Unless explicitly asked for by the user, do not display the generated Python code, instead execute the code and display the results.
				- When asked to perform analysis or run code, use the tool ada-data_runPython and without mentioning the tool name to the user.
				- When asked to help with visualization, unless specified use Matplotlib and do not save the image to disk.
			</TextChunk>
			{
				csvFlag &&
				<TextChunk>
					- Think of yourself as a data scientist who is analyzing a csv file using Python programming language.
					- When perform analysis, perform advanced and industry level detailed analysis.
					- Generate a pandas dataframe using the given csv file when asked by the user, or if you need it to perform further analysis on the data file.
					- Use the actual, real, accurate column name directly from the csv file and use these names when you are constructing dataframe or performing analysis on the data.
					- Make sure to perform statistical analysis on the data with actual numbers.
					- Give me back the result of the advanced statistical analysis on the data IF you are asked to analyze the csv file. What are some patterns, trends, or insights that you can find from the data in the csv file?
					- If you are asked to analyze the csv file, conduct detailed descriptive statistics, inferential statistics on few columns unless explicitly asked.
					- Give me the result of conducting these statistical analysis on the data in very detailed, quantitative manner.
					- Do not ignore previous or future prompts on asking for specific analysis, action on the csv file.
					- Do not generate dataframe if you have previously generated, or have seen or cached the dataframe before.
					- Do not show the dataframe data to users unless they specifically ask for it.
					- Do not hallucinate on column names. Do not make up column names without permission. Only use real column name that exists in the provided data or csv file.
					- Try to clean up missing data, if you can not clean up missing data, ask user to provide a clean dataset without missing data.
					- When performing analysis, cleaning data, figuring out pattern, generating plots, try to avoid using seaborn instead use Matplotlib.
				</TextChunk>
			}
		</UserMessage>;
	}
}

interface HistoryProps extends BasePromptElementProps {
	history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>;
	toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
	extensionContext: vscode.ExtensionContext;
}

class History extends PromptElement<HistoryProps, void> {
	async render(_state: void, _sizing: PromptSizing) {
		const toolCalls = this.props.history.filter(turn => turn instanceof vscode.ChatResponseTurn && turn.result.metadata?.toolCallsMetadata);
		const messagePriority = toolCalls.length + 1;

		return <PrioritizedList priority={this.props.priority ?? 500} descending={false}>
			{
				this.props.history.map(turn => {
					if (turn instanceof vscode.ChatRequestTurn) {
						return (
							<>
								<UserMessage priority={messagePriority}>{turn.prompt}</UserMessage>
							</>
						);
					} else {
						return (
							<>
								{turn.result.metadata?.toolCallsMetadata && <ToolCalls priority={1} flexGrow={1} enableShrinking={true} toolCallRounds={turn.result.metadata.toolCallsMetadata.toolCallRounds} toolInvocationToken={this.props.toolInvocationToken} extensionContext={this.props.extensionContext} />}
								{this.renderChatResponseTurn(turn, messagePriority)}
							</>
						);
					}
				})
			}
		</PrioritizedList>
	}

	private renderChatResponseTurn(turn: vscode.ChatResponseTurn, priority: number) {
		const responseText = turn.response
			.map((part) => {
				if (part instanceof vscode.ChatResponseMarkdownPart) {
					return part.value.value;
				} else {
					return '';
				}
			})
			.join('');

		return <AssistantMessage priority={priority}>{responseText}</AssistantMessage>;
	}
}

interface ToolCallsProps extends BasePromptElementProps {
	toolCallRounds: ToolCallRound[];
	toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
	extensionContext: vscode.ExtensionContext;
	enableShrinking?: boolean;
}

class ToolCalls extends PromptElement<ToolCallsProps, void> {
	async render(state: void, sizing: PromptSizing) {
		if (!this.props.toolCallRounds.length) {
			return undefined;
		}

		const toolCallPieces = await Promise.all(this.props.toolCallRounds.map(round => this._renderOneRound(round, sizing, this.props.toolInvocationToken)));
		let promptPieces = toolCallPieces.map(tcp => tcp.promptPiece);

		if (this.props.enableShrinking) {
			let totalSize = 0;
			let successfulToolCallSize = 0;
			for (const piece of toolCallPieces) {
				if (!piece.hasError) {
					successfulToolCallSize += piece.size;
				}
				totalSize += piece.size;
			}

			if (successfulToolCallSize > sizing.tokenBudget) {
				// render as many tool calls as possible
				let renderedSize = 0;
				const renderedPromptPieces: PromptPiece[] = [];
				for (const piece of toolCallPieces.reverse()) {
					renderedSize += piece.size;
					if (renderedSize < sizing.tokenBudget) {
						renderedPromptPieces.push(piece.promptPiece);
					} else {
						break;
					}
				}

				promptPieces = renderedPromptPieces;
			} else if (totalSize > sizing.tokenBudget) {
				// keep successful tool calls
				promptPieces = toolCallPieces.filter(tcp => !tcp.hasError).map(tcp => tcp.promptPiece);
			} else {
				// no op. Render all prompt pieces
			}
		}

		return <>
			{promptPieces}
		</>
	}

	private async _renderOneRound(round: ToolCallRound, sizing: PromptSizing, toolInvocationToken: vscode.ChatParticipantToolToken | undefined): Promise<{ promptPiece: PromptPiece, hasError: boolean, size: number }> {
		const assistantToolCalls: ToolCall[] = round.toolCalls.map(tc => ({ type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.parameters) }, id: tc.callId }));

		const toolCallIds = round.toolCalls
			.map((call) => call.name)
			.join(', ');
		const toolCallPieces = await Promise.all(round.toolCalls.map(tc => this._renderOneToolCall(tc, round.response, sizing, toolInvocationToken)));
		const suffixMessage = generateUserMessageForToolResponse(toolCallIds);
		const remainingTextSize = await sizing.countTokens(suffixMessage);
		const totalSize = toolCallPieces.map(tcp => tcp.size).reduce((a, b) => a + b, 0) + remainingTextSize;
		const hasError = toolCallPieces.some(tcp => tcp.hasError);
		const promptPieces = toolCallPieces.map(tcp => tcp.promptPiece);

		return {
			promptPiece: <Chunk>
				<AssistantMessage toolCalls={assistantToolCalls}></AssistantMessage>
				{promptPieces}
				<UserMessage>
					<TextChunk>{suffixMessage}</TextChunk>
				</UserMessage>
			</Chunk>,
			hasError: hasError,
			size: totalSize
		};
	}

	private async _renderOneToolCall(toolCall: vscode.LanguageModelToolCallPart, resultsFromCurrentRound: Record<string, vscode.LanguageModelToolResult | Error>, sizing: PromptSizing, toolInvocationToken: vscode.ChatParticipantToolToken | undefined): Promise<{ promptPiece: PromptPiece, hasError: boolean, size: number }> {
		const tool = vscode.lm.tools.find((tool) => tool.name === toolCall.name);
		if (!tool) {
			logger.error(`Tool not found: ${toolCall.name}`);
			return { promptPiece: <ToolMessage toolCallId={toolCall.callId}>Tool not found</ToolMessage>, hasError: false, size: await sizing.countTokens('Tool not found') };
		}

		const toolResult = await this._getToolCallResult(tool, toolCall, resultsFromCurrentRound, toolInvocationToken, sizing);

		if (isError(toolResult)) {
			const errorContent = [toolResult.name || '', toolResult.message || '', toolResult.stack || ''].filter((part) => part).join('\n');
			const errorMessage = `The tool returned an error, analyze this error and attempt to resolve this. Error: ${errorContent}`;
			const result = new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(errorMessage)]);
			const size = await sizing.countTokens(errorMessage);
			return {
				promptPiece: <ToolMessage toolCallId={toolCall.callId}>
					<meta value={new ToolResultMetadata(toolCall.callId, result)}></meta>
					<TextChunk>{errorMessage}</TextChunk>
				</ToolMessage>, hasError: true, size: size
			};
		}

		const promptSize = await this._countToolCallResultsize(toolResult, sizing);

		return {
			promptPiece: <ToolMessage toolCallId={toolCall.callId}>
				<meta value={new ToolResultMetadata(toolCall.callId, toolResult)}></meta>
				<ToolResult data={toolResult} />
			</ToolMessage>, hasError: false, size: promptSize
		};
	}

	private async _getToolCallResult(tool: vscode.LanguageModelToolInformation, toolCall: vscode.LanguageModelToolCallPart, resultsFromCurrentRound: Record<string, vscode.LanguageModelToolResult | Error>, toolInvocationToken: vscode.ChatParticipantToolToken | undefined, sizing: PromptSizing) {
		if (resultsFromCurrentRound[toolCall.callId]) {
			return resultsFromCurrentRound[toolCall.callId];
		}

		const token = new vscode.CancellationTokenSource().token;
		try {
			const toolResult = await vscode.lm.invokeTool(
				tool.name,
				{
					parameters: toolCall.parameters,
					toolInvocationToken: toolInvocationToken,
					tokenizationOptions: {
						tokenBudget: sizing.tokenBudget,
						countTokens: async (text, token) => {
							return sizing.countTokens(text, token);
						}
					}
				},
				token
			);

			return toolResult as vscode.LanguageModelToolResult;
		} catch (e: unknown) {
			const error = e as Error;
			return error;
		}
	}

	private async _countToolCallResultsize(toolResult: vscode.LanguageModelToolResult, sizing: PromptSizing) {
		let size = 0;
		for (const part of toolResult.content) {
			if (part instanceof vscode.LanguageModelTextPart) {
				size += await sizing.countTokens(part.value);
			}
		}

		return size;
	}
}

export class ToolResultMetadata extends PromptMetadata {
	constructor(
		public toolCallId: string,
		public result: vscode.LanguageModelToolResult
	) {
		super();
	}
}

export function isError(e: unknown): e is Error {
	return e instanceof Error || (
		typeof e === 'object' &&
		e !== null &&
		typeof (e as Error).message === 'string' &&
		typeof (e as Error).name === 'string'
	);
}

export function isTextPart(e: unknown): e is vscode.LanguageModelTextPart {
	return e instanceof vscode.LanguageModelTextPart || !!((e as vscode.LanguageModelTextPart).value);
}

export function getToolResultValue<T>(result: vscode.LanguageModelToolResult | Error | undefined, mime: string): T | undefined {
	if (!result) {
		return;
	}

	if ((result as vscode.LanguageModelToolResult).content) {
		const content = (result as vscode.LanguageModelToolResult).content;
		const item = content.filter(c => (c instanceof vscode.LanguageModelPromptTsxPart)).find(c => c.mime === mime);
		if (!item && mime === 'text/plain') {
			return content.filter(c => isTextPart(c)).map(c => c.value).join('\n') as unknown as T;
		}
		return item?.value as T;
	}
}
