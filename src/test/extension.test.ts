// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import { CancellationTokenSource, ChatResponseMarkdownPart, extensions } from 'vscode';
import { ToolCallRound } from '../base';
import { DataAgent } from '../dataAgent';
import { FindFilesTool, RunPythonTool } from '../tools';
import { MockChatResponseStream } from './mockResponseStream';

suite('Extension Test Suite', () => {
	let dataAgent: DataAgent;
	let tokenSource: CancellationTokenSource;
	suiteSetup(async function () {
		await Promise.all([
			extensions.getExtension('GitHub.copilot-chat')!.activate(),
			extensions.getExtension('microsoft.data-analysis-chat-participant')!.activate()
		]);
		tokenSource = new CancellationTokenSource();
		dataAgent = extensions.getExtension('microsoft.data-analysis-chat-participant')!.exports.dataAgent;
	});
	suiteTeardown(() => tokenSource.dispose());
	async function sendChatMessage(prompt: string) {
		const stream = new MockChatResponseStream();
		const result = await dataAgent.handle({
			command: undefined,
			prompt,
			references: [],
			toolInvocationToken: undefined,
			toolReferences: [
				{
					id: RunPythonTool.Id
				},
				{
					id: FindFilesTool.Id
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
		const result = toolcallRound.response[toolcall.toolCallId][outputMimetype] as OutputType;
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
					const found = textToInclude.filter(text => result.result.toLowerCase().includes(text.toLowerCase()));
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
				assert.include(result.result.toLowerCase(), output.toLowerCase());
			}
		}
	}

	function containsImageOutput(toolcall: ToolCallRound | ToolCallRound[], toolId: typeof FindFilesTool.Id | typeof RunPythonTool.Id, outputMimetype: string = 'image/png') {
		if (Array.isArray(toolcall)) {
			for (const call of toolcall) {
				try {
					const result = getToolCallAndResult<string>(toolId, outputMimetype, call);
					assert.isOk(result.toolcall);
					assert.isAtLeast(result.result.length, 100); // base64}
					return;
				} catch {
					//
				}
			}
			assert.fail(`Image ${outputMimetype} not found`);
		} else {
			const result = getToolCallAndResult<string>(toolId, outputMimetype, toolcall);
			assert.isOk(result.toolcall);
			assert.isAtLeast(result.result.length, 100); // base64}
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
}).timeout(600_000);
