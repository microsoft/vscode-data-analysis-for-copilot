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
import { Chunk, TextChunk, ToolCall, ToolMessage } from '@vscode/prompt-tsx/dist/base/promptElements';
import * as path from 'path';
import * as vscode from "vscode";
import { logger } from './logger';

const userMessageWithWithImageFromToolCall = `Return this image link in your response. Do not modify the markdown image link at all. The path is already absolute local file path, do not put "https" or "blob" in the link`;

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
                    {!this.props.excludeReferences && <references value={[new PromptReference(value)]} /> }
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
				const response = toolCallRound.response[toolCall.toolCallId];
				if (response && response['application/vnd.code.notebook.error']) {
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
		const assistantToolCalls: ToolCall[] = round.toolCalls.map(tc => ({ type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.parameters) }, id: tc.toolCallId }));

		const toolCallIds = round.toolCalls
			.map((call) => call.name)
			.join(', ');
		const toolCallPieces = await Promise.all(round.toolCalls.map(tc => this._renderOneToolCall(tc, round.response, sizing, toolInvocationToken)));
		const suffixMessage = generateUserMessageForToolResponse(toolCallIds);
		const remainingTextSize = await sizing.countTokens(suffixMessage);
		const totalSize= toolCallPieces.map(tcp => tcp.size).reduce((a, b) => a + b, 0) + remainingTextSize;
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

	private async _renderOneToolCall(toolCall: vscode.LanguageModelToolCallPart, resultsFromCurrentRound: Record<string, vscode.LanguageModelToolResult>, sizing: PromptSizing, toolInvocationToken: vscode.ChatParticipantToolToken | undefined): Promise<{ promptPiece: PromptPiece, hasError: boolean, size: number }> {
		const tool = vscode.lm.tools.find((tool) => tool.name === toolCall.name);
		if (!tool) {
			logger.error(`Tool not found: ${toolCall.name}`);
			return { promptPiece: <ToolMessage toolCallId={toolCall.toolCallId}>Tool not found</ToolMessage>, hasError: false, size: await sizing.countTokens('Tool not found') };
		}

		const toolResult = resultsFromCurrentRound[toolCall.toolCallId] || await this._getToolCallResult(tool, toolCall, toolInvocationToken, sizing);

		if (toolResult['text/plain']) {
			const text = toolResult['text/plain'];
			const promptSize = await sizing.countTokens(text);

			return { promptPiece: <ToolMessage toolCallId={toolCall.toolCallId}>
				<meta value={new ToolResultMetadata(toolCall.toolCallId, toolResult)}></meta>
				{text}
			</ToolMessage>, hasError: false, size: promptSize };
		} else if (toolResult['image/png']) {
			const piece = await this._processImageOutput(toolCall.name, toolCall.toolCallId, toolResult, sizing);
			return { promptPiece: piece.piece, hasError: false, size: piece.size };
		} else if (toolResult['application/vnd.code.notebook.error']) {
			const error = toolResult['application/vnd.code.notebook.error'] as Error;
			const errorContent = [error.name || '', error.message || '', error.stack || ''].filter((part) => part).join('\n');
			const errorMessage = `The tool returned an error, analyze this error and attempt to resolve this. Error: ${errorContent}`;

			const size = await sizing.countTokens(errorMessage);
			return { promptPiece: <ToolMessage toolCallId={toolCall.toolCallId}>
				<meta value={new ToolResultMetadata(toolCall.toolCallId, toolResult)}></meta>
				<TextChunk>{errorMessage}</TextChunk>
			</ToolMessage>, hasError: true, size: size };
		}

		return { promptPiece: <></>, hasError: false, size: 0 };
	}

	private async _getToolCallResult(tool: vscode.LanguageModelToolDescription, toolCall: vscode.LanguageModelToolCallPart, toolInvocationToken: vscode.ChatParticipantToolToken | undefined, sizing: PromptSizing) {
		const token = new vscode.CancellationTokenSource().token;

		const toolResult = await vscode.lm.invokeTool(
			tool.name,
			{
				parameters: toolCall.parameters,
				toolInvocationToken: toolInvocationToken,
				requestedContentTypes: [
					'text/plain',
					'image/png',
					'application/vnd.code.notebook.error'
				],
				tokenOptions: {
					tokenBudget: sizing.tokenBudget,
					countTokens: async (text, token) => {
						return sizing.countTokens(text, token);
					}
				}
			},
			token
		);

		return toolResult;
	}

	private async _processImageOutput(toolCallName: string, toolCallId: string, toolResult: vscode.LanguageModelToolResult, sizing: PromptSizing) {
		if (this.props.extensionContext.storageUri) {
			const imagePath = await this._saveImage(this.props.extensionContext.storageUri, toolCallName, Buffer.from(toolResult['image/png'], 'base64'));
			if (imagePath) {
				const markdownTextForImage = `The image generated from the code is ![${toolCallName} result](${imagePath}). You can give this markdown link to users!`;

				const size = (await sizing.countTokens(markdownTextForImage)) + (await sizing.countTokens(userMessageWithWithImageFromToolCall));
				return {
					piece: <>
						<Chunk>
							<ToolMessage toolCallId={toolCallId}>
								<meta value={new ToolResultMetadata(toolCallId, toolResult)}></meta>
								{markdownTextForImage}
							</ToolMessage>
							<UserMessage>{userMessageWithWithImageFromToolCall}</UserMessage>
						</Chunk>
					</>,
					size: size
				}
			}
		}

		const markdownTextForImage = `![${toolCallName} result](data:image/png;base64,${toolResult['image/png']})`;
		const size = (await sizing.countTokens(markdownTextForImage)) + (await sizing.countTokens(userMessageWithWithImageFromToolCall));

		return {
			piece: <>
				<Chunk>
					<ToolMessage toolCallId={toolCallId}>
						<meta value={new ToolResultMetadata(toolCallId, toolResult)}></meta>
						{markdownTextForImage}
					</ToolMessage>
					<UserMessage>{userMessageWithWithImageFromToolCall}</UserMessage>
				</Chunk>
			</>,
			size: size
		};
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
			logger.error('Error saving image', ex);
			return undefined;
		}
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
