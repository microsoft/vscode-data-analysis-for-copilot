// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import { CancellationTokenSource, ChatResponseMarkdownPart, commands, extensions, LanguageModelChat, lm } from 'vscode';
import { getToolResultValue, ToolCallRound } from '../base';
import { DataAgent, MODEL_SELECTOR } from '../dataAgent';
import { FindFilesTool, RunPythonTool } from '../tools';
import { MockChatResponseStream } from './mockResponseStream';

suite('Extension Test Suite', () => {
	let dataAgent: DataAgent;
	let tokenSource: CancellationTokenSource;
	let model: LanguageModelChat;
	// let stubRenderMessages: sinon.SinonStub;
	suiteSetup(async function () {
		await Promise.all([
			extensions.getExtension('GitHub.copilot-chat')!.activate(),
			extensions.getExtension('ms-vscode.vscode-copilot-data-analysis')!.activate()
		]);
		await commands.executeCommand('workbench.action.chat.open');
		tokenSource = new CancellationTokenSource();
		dataAgent = extensions.getExtension('ms-vscode.vscode-copilot-data-analysis')!.exports.dataAgent;
		const models = await lm.selectChatModels(MODEL_SELECTOR);
		if (!models || !models.length) {
			throw new Error('NO MODELS');
		}
		model = models[0];
	});
	suiteTeardown(() => {
		tokenSource.dispose();
		// stubRenderMessages.restore();
	});
	async function sendChatMessage(prompt: string) {
		const stream = new MockChatResponseStream();
		const result = await dataAgent.handle({
			command: undefined,
			prompt,
			references: [],
			model,
			toolInvocationToken: undefined,
			toolReferences: [
				{
					name: RunPythonTool.Id
				},
				{
					name: FindFilesTool.Id
				}
			]
		},
			{
				history: []
			}, stream, new CancellationTokenSource().token);

		const toolcallsRounds = (result.metadata as any).toolCallsMetadata.toolCallRounds as ToolCallRound[];

		return {
			toolcallsRounds,
			stream
		}
	}
	function getToolCallAndResult<OutputType>(toolId: typeof FindFilesTool.Id | typeof RunPythonTool.Id, outputMimetype: string, toolcallRound: ToolCallRound) {
		const toolcall = toolcallRound.toolCalls.find(t => t.name === toolId)!;
		const result = getToolResultValue<OutputType>(toolcallRound.response[toolcall.callId], outputMimetype);
		return {
			toolcall,
			result
		};
	}

	function containsTextOutput(toolcall: ToolCallRound | ToolCallRound[], toolId: typeof FindFilesTool.Id | typeof RunPythonTool.Id, outputMimetype: string, textToInclude: string[]) {
		if (Array.isArray(toolcall)) {
			for (const call of toolcall.filter(t => t.toolCalls.find(c => c.name === toolId))) {
				try {
					const result = getToolCallAndResult<string>(toolId, outputMimetype, call);
					assert.isOk(result.toolcall);
					const found = textToInclude.filter(text => result.result?.toLowerCase().includes(text.toLowerCase()));
					if (found.length === textToInclude.length) {
						return;
					}
				} catch {
					//
				}
			}
			assert.fail(`Text ${textToInclude.join(', ')} not found in ${outputMimetype} for ${toolId}`);

		} else {
			const result = getToolCallAndResult<string>(toolId, outputMimetype, toolcall);
			assert.isOk(result.toolcall);
			for (const output of textToInclude) {
				assert.include(result.result?.toLowerCase(), output.toLowerCase());
			}
		}
	}

	function containsImageOutput(toolcall: ToolCallRound | ToolCallRound[], toolId: typeof FindFilesTool.Id | typeof RunPythonTool.Id, outputMimetype: string = 'image/png') {
		if (Array.isArray(toolcall)) {
			for (const call of toolcall) {
				try {
					const result = getToolCallAndResult<string>(toolId, outputMimetype, call);
					assert.isOk(result.toolcall);
					assert.isAtLeast((result.result || '').length, 100); // base64}
					return;
				} catch {
					//
				}
			}
			assert.fail(`Image ${outputMimetype} not found`);
		} else {
			const result = getToolCallAndResult<string>(toolId, outputMimetype, toolcall);
			assert.isOk(result.toolcall);
			assert.isAtLeast((result.result || '').length, 100); // base64}
		}
	}

	function containsExecutedCode(toolcall: ToolCallRound | ToolCallRound[], expectedCode: string[]) {
		let code = '';
		if (Array.isArray(toolcall)) {
			for (const call of toolcall) {
				code = (call.toolCalls.find(t => t.name === RunPythonTool.Id)!.parameters as any)!.code;
				if (code) {
					const fragments = expectedCode.slice();
					const found = fragments.filter(fragment => code.toLowerCase().includes(fragment.toLowerCase()));
					if (found.length === fragments.length) {
						return;
					}
				}
			}
			assert.fail(`Code ${expectedCode.join(', ')} not found in toolcall`);
		} else {
			code = (toolcall.toolCalls.find(t => t.name === RunPythonTool.Id)!.parameters as any)!.code;
			assert.isOk(code);
			for (const fragment of expectedCode) {
				assert.include(code.toLowerCase(), fragment.toLowerCase());
			}
		}
	}

	function containsError(toolcall: ToolCallRound | ToolCallRound[], toolId: typeof FindFilesTool.Id | typeof RunPythonTool.Id, expectedError: { name?: string[]; message?: string[]; stack?: string[] }) {
		let error: Error | undefined;
		if (Array.isArray(toolcall)) {
			for (const call of toolcall.filter(t => t.toolCalls.some(c => c.name === toolId))) {
				try {
					const result = getToolCallAndResult<Error>(toolId, 'application/vnd.code.notebook.error', call);
					assert.isOk(result.toolcall);
					assert.isOk(result.result);
					error = result.result;

					// There could be other errors in the responses.
					for (const stack of (expectedError.name || [])) {
						assert.include((error.name || '').toLowerCase(), stack.toLowerCase());
					}
					for (const stack of (expectedError.message || [])) {
						assert.include((error.message || '').toLowerCase(), stack.toLowerCase());
					}
					for (const stack of (expectedError.stack || [])) {
						assert.include((error.stack || '').toLowerCase(), stack.toLowerCase());
					}

					return;
				} catch {
					//
				}
			}
		} else {
			const result = getToolCallAndResult<Error>(toolId, 'application/vnd.code.notebook.error', toolcall);
			assert.isOk(result.toolcall);
			error = result.result;
			if (!error) {
				assert.fail(`Error not found`);
			}
			for (const stack of (expectedError.name || [])) {
				assert.include((error.name || '').toLowerCase(), stack.toLowerCase());
			}
			for (const stack of (expectedError.message || [])) {
				assert.include((error.message || '').toLowerCase(), stack.toLowerCase());
			}
			for (const stack of (expectedError.stack || [])) {
				assert.include((error.stack || '').toLowerCase(), stack.toLowerCase());
			}
		}
	}

	function getLastMarkdownStream(stream: MockChatResponseStream) {
		const mdPart = stream.parts[stream.parts.length - 1].value as unknown as ChatResponseMarkdownPart;
		return typeof mdPart.value === 'string' ? mdPart.value : mdPart.value.value;

	}

	test('Analyze csv', async () => {
		const { toolcallsRounds } = await sendChatMessage('@data Analyze the contents of housing.csv file');

		// We must import pandas and open the csv file
		containsExecutedCode(toolcallsRounds, ['import pandas', 'pd.read_csv', 'housing.csv']);
	});

	test('Analyze csv and display any images', async () => {
		const { stream, toolcallsRounds } = await sendChatMessage('@data analyze the data in housing.csv to understand the relationship between the variables and display any images that are generated as a result');

		// We must import pandas and open the csv file
		containsExecutedCode(toolcallsRounds, ['import pandas', 'pd.read_csv', 'housing.csv']);

		// We must have at least 2 python tool calls.
		// 1. to load some of the data & gets some basic stats, the next to analyze that and generate some graphs and the like.

		// Finally the last message display to the user must contain a markdown image.
		const markdown = getLastMarkdownStream(stream).toLowerCase();
		assert.include(markdown, '.png)') // File will be png
		assert.include(markdown, `result-${RunPythonTool.Id}`.toLowerCase()) // File name has a specific format.
	});

	test('Failure retries', async () => {
		const { stream, toolcallsRounds } = await sendChatMessage('@data generate a histogram of number of movies per bond actor from the jamesbond.csv file');

		// First call should be to generate an image, and this should fail with an invalid column error.
		containsError(toolcallsRounds, RunPythonTool.Id, { name: ['class', 'keyerror'] });

		// Second call should be to generate a list of column names.
		containsTextOutput(toolcallsRounds, RunPythonTool.Id, 'text/plain', ['bondactorname', 'writer']);

		// Final call should be to generate a image
		containsImageOutput(toolcallsRounds, RunPythonTool.Id);

		// Finally the last message display to the user must contain the markdown image.
		const markdown = getLastMarkdownStream(stream).toLowerCase();
		assert.include(markdown, '.png)') // File will be png
		assert.include(markdown, `result-${RunPythonTool.Id}`.toLowerCase()) // File name has a specific format.
	});

	test('Generate plot using seaborn', async () => {
		const { stream, toolcallsRounds } = await sendChatMessage('@data generate and display a simple plot with seaborn using the data from housing.csv');

		// Second call should be to generate an image using seaborn
		containsExecutedCode(toolcallsRounds, ['import seaborn']);

		// Finally the last message display to the user must contain the markdown image.
		const markdown = getLastMarkdownStream(stream).toLowerCase();
		assert.include(markdown, '.png)') // File will be png
		assert.include(markdown, `result-${RunPythonTool.Id}`.toLowerCase()) // File name has a specific format.
	});

	// test('Make sure to include context', async () => {
	// 	stubRenderMessages = sinon.stub(dataAgent as any, '_renderMessages');
	// 	await sendChatMessage('analyze housing.csv with #file:HelloThere ');
	// 	assert.isTrue(stubRenderMessages.calledOnce, '_renderMessages should be called once');
	// 	const callArgs = stubRenderMessages.getCall(0).args;
	// 	assert.deepEqual(callArgs[1].references, {}, 'References should match the given references'); // TODO: Should check if reference for #file:HelloThere is inside
	// });

}).timeout(600_000);
