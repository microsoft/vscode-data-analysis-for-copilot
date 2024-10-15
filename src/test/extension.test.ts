// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import * as sinon from 'sinon';
import { ChatResponseMarkdownPart, ChatResult, commands, extensions } from 'vscode';
import { ToolCallRound } from '../base';
import { DataAgent } from '../dataAgent';
import { MockChatResponseStream } from './mockResponseStream';
import { FindFilesTool, RunPythonTool } from '../tools';

suite('Extension Test Suite', () => {
	suiteSetup(async function () {
		await Promise.all([
			extensions.getExtension('GitHub.copilot-chat')!.activate(),
			extensions.getExtension('microsoft.data-analysis-chat-participant')!.activate()
		]);
		await commands.executeCommand('workbench.action.chat.open', { query: '' });
		await commands.executeCommand('workbench.action.chat.clearHistory');
	});
	teardown(() => sinon.restore())
	function stubHandler() {
		const stub = sinon.stub(DataAgent.prototype, 'handle');
		return new Promise<{ result: ChatResult; stream: MockChatResponseStream; toolcallsRounds: ToolCallRound[] }>((resolve, reject) => {
			stub.callsFake(async function (this: DataAgent, request, chatContext, stream, token) {
				try {
					const newStream = new MockChatResponseStream(stream);
					const result = await stub.wrappedMethod.call(this, request, chatContext, newStream, token);
					console.log(result)
					const toolcallsRounds = (result.metadata as any).toolCallsMetadata.toolCallRounds as ToolCallRound[];
					resolve({ result, stream: newStream, toolcallsRounds });
					return result;
				} catch (ex) {
					reject(ex);
					throw ex;
				}
			});
		});
	}
	async function sendChatMessage(inputValue: string) {
		const promise = stubHandler();
		await commands.executeCommand('workbench.action.chat.focusInput');
		await commands.executeCommand('workbench.action.chat.sendToNewChat', { inputValue });
		return promise;
	}
	function getToolCallAndResult<OutputType>(toolId: typeof FindFilesTool.Id | typeof RunPythonTool.Id, outputMimetype: string, toolcallRound: ToolCallRound) {
		const toolcall = toolcallRound.toolCalls.find(t => t.name === toolId)!;
		const result = toolcallRound.response[toolcall.toolCallId][outputMimetype] as OutputType;
		return {
			toolcall,
			result
		};
	}

	function containsTextOutput(toolcall: ToolCallRound, toolId: typeof FindFilesTool.Id | typeof RunPythonTool.Id, outputMimetype: string, textToInclude: string[]) {
		const result = getToolCallAndResult<string>(toolId, outputMimetype, toolcall);
		assert.isOk(result.toolcall);
		for (const output of textToInclude) {
			assert.include(result.result.toLowerCase(), output.toLowerCase());
		}
	}

	function containsImageOutput(toolcall: ToolCallRound, toolId: typeof FindFilesTool.Id | typeof RunPythonTool.Id, outputMimetype: string ='image/png') {
		const result = getToolCallAndResult<string>(toolId, outputMimetype, toolcall);
		assert.isOk(result.toolcall);
		assert.isAtLeast(result.result.length, 100); // base64
	}

	function containsError(toolcall: ToolCallRound, toolId: typeof FindFilesTool.Id | typeof RunPythonTool.Id, error: { name?: string[]; message?: string[]; stack?: string[] }) {
		const result = getToolCallAndResult<Error>(toolId, 'application/vnd.code.notebook.error', toolcall);
		assert.isOk(result.toolcall);
		for (const stack of (error.name || [])) {
			assert.include((result.result.name || '').toLowerCase(), stack.toLowerCase());
		}
		for (const stack of (error.message || [])) {
			assert.include((result.result.message || '').toLowerCase(), stack.toLowerCase());
		}
		for (const stack of (error.stack || [])) {
			assert.include((result.result.stack || '').toLowerCase(), stack.toLowerCase());
		}
	}

	function getLastMarkdownStream(stream: MockChatResponseStream) {
		const mdPart = stream.parts[stream.parts.length - 1].value as unknown as ChatResponseMarkdownPart;
		return typeof mdPart.value === 'string' ? mdPart.value : mdPart.value.value;

	}

	test('Failure retries', async () => {
		const { stream, toolcallsRounds } = await sendChatMessage('@ada generate a histogram of number of movies per bond actor from the jamesbond.csv file');

		// First tool call must be for the file and it should find the file.
		containsTextOutput(toolcallsRounds[0], FindFilesTool.Id, 'text/plain', ['Found 1', 'jamesbond.csv']);

		// Second call should be to generate an image, and this should fail with an invalid column error.
		containsError(toolcallsRounds[1], RunPythonTool.Id, { name: ['class', 'keyerror'] });

		// Third call should be to generate a list of column names.
		containsTextOutput(toolcallsRounds[2], RunPythonTool.Id, 'text/plain', ['bondactorname', 'writer']);

		// Final call should be to generate a image
		containsImageOutput(toolcallsRounds[3], RunPythonTool.Id);

		// Finally the last message display to the user must contain the markdown image.
		const markdown = getLastMarkdownStream(stream).toLowerCase();
		assert.include(markdown, '.png)') // File will be png
		assert.include(markdown, `result-${RunPythonTool.Id}`.toLowerCase()) // File name has a specific format.
	});
}).timeout(600_000);
