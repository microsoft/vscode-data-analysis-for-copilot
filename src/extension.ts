// import { renderPrompt } from "@vscode/prompt-tsx";
import * as vscode from "vscode";
import { execute, start_kernel } from "./execution/src";
import { renderPrompt } from "@vscode/prompt-tsx";
import { BasePrompt } from "./base";
import { FindFilesTool, RunPythonTool } from "./tools";
const DATA_AGENT_PARTICIPANT_ID = "ada.data";

interface IDataAgentChatResult extends vscode.ChatResult {
    metadata: {
        command: string;
    };
}

const MODEL_SELECTOR: vscode.LanguageModelChatSelector = {
    vendor: "copilot",
    family: 'gpt-4o'
};

function parseApiResponse(apiResponse: string) {
    const _escape = (str: string) => {
        // Regular expression to target and escape \n within quoted strings only
        const regex = /(?:\"|')(?:\\.|[^\"'\\])*?(?:\\n)?(?:\\.|[^\"'\\])*?(?:\"|')/g;

        const escapedResponse = apiResponse.replace(regex, function (match) {
            return match.replace(/\n/g, '\\n');
        });

        const jsonObject = JSON.parse(escapedResponse);
        return jsonObject;
    }

    let args: { code: string } = { code: "" };

    try {
        args = JSON.parse(apiResponse);
        return args;
    } catch (e) {
    }

    try {
        args = _escape(apiResponse);
        return args;
    } catch (e) {
    }

    return {
        code: apiResponse
    };
}

interface IToolCall {
    tool: vscode.LanguageModelToolDescription;
    call: vscode.LanguageModelChatResponseToolCallPart;
    result: Thenable<vscode.LanguageModelToolResult>;
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.lm.registerTool('ada-data_findFiles', new FindFilesTool()));
    context.subscriptions.push(vscode.lm.registerTool('ada-data_runPython', new RunPythonTool(context)));

    const dataAgentHandler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> => {
        const models = await vscode.lm.selectChatModels(MODEL_SELECTOR);
        if (!models || !models.length) {
            console.log("NO MODELS");
            return {};
        }

        const chat = models[0];

        stream.progress("Analyzing");

        const allTools = vscode.lm.tools.map((tool): vscode.LanguageModelChatTool => {
            return {
                name: tool.id,
                description: tool.description,
                parametersSchema: tool.parametersSchema ?? {}
            };
        });

        const options: vscode.LanguageModelChatRequestOptions = {
            tools: allTools,
            justification: "Just because!",
        };

        const renderedPrompt = await renderPrompt(
            BasePrompt,
            { userQuery: request.prompt, references: request.references, history: context.history },
            { modelMaxPromptTokens: chat.maxInputTokens },
            chat);
        
        const messages: vscode.LanguageModelChatMessage[] = renderedPrompt.messages as vscode.LanguageModelChatMessage[];
        const toolReferences = [...request.toolReferences];
        const runWithFunctions = async (): Promise<any> => {
            const requestedTool = toolReferences.shift();
            if (requestedTool) {
                options.toolChoice = requestedTool.id;
                options.tools = allTools.filter(tool => tool.name === requestedTool.id);
            } else {
                options.toolChoice = undefined;
                options.tools = allTools;
            }

            console.log("SENDING REQUEST", messages);
            const toolCalls: IToolCall[] = [];
            const response = await chat.sendRequest(messages, options, token);

            if (response.stream) {
                for await (const part of response.stream) {
                    if (part instanceof vscode.LanguageModelChatResponseTextPart) {
                        stream.markdown(part.value);
                    } else if (
                        part instanceof vscode.LanguageModelChatResponseToolCallPart
                    ) {
                        const tool = vscode.lm.tools.find(tool => tool.id === part.name);
                        if (!tool) {
                            // BAD tool choice?
                            stream.progress(`Unknown function: ${part.name}`);
                            continue;
                        }

                        let parameters: any;
                        try {
                            parameters = JSON.parse(part.parameters);
                        } catch (err) {
                            throw new Error(`Got invalid tool use parameters: "${part.parameters}". (${(err as Error).message})`);
                        }

                        const requestedContentType = 'text/plain';
                        toolCalls.push({
                            call: part,
                            result: vscode.lm.invokeTool(tool.id, { parameters: JSON.parse(part.parameters), toolInvocationToken: request.toolInvocationToken, requestedContentTypes: [requestedContentType] }, token),
                            tool
                        });
                    }
                }
            }

            if (toolCalls.length) {
                const assistantMsg = vscode.LanguageModelChatMessage.Assistant('');
                assistantMsg.content2 = toolCalls.map(toolCall => new vscode.LanguageModelChatResponseToolCallPart(toolCall.tool.id, toolCall.call.toolCallId, toolCall.call.parameters));
                messages.push(assistantMsg);
                for (const toolCall of toolCalls) {
                    // NOTE that the result of calling a function is a special content type of a USER-message
                    const message = vscode.LanguageModelChatMessage.User('');

                    message.content2 = [new vscode.LanguageModelChatMessageToolResultPart(toolCall.call.toolCallId, (await toolCall.result)['text/plain']!)];
                    messages.push(message);
                }

                // IMPORTANT The prompt must end with a USER message (with no tool call)
                messages.push(vscode.LanguageModelChatMessage.User(`Above is the result of calling the functions ${toolCalls.map(call => call.tool.id).join(', ')}. Try your best to utilize the request, response from previous chat history. Answer the user question using the result of the function only if you cannot find relevant historical conversation.`));

                // RE-enter
                return runWithFunctions();

            }
        };

        await runWithFunctions();

        // stream.markdown(fragment);
        return { metadata: { command: "analyze" } };
    };

    //TODO: Create data agent that users can talk to
    const dataAgent = vscode.chat.createChatParticipant(
        DATA_AGENT_PARTICIPANT_ID,
        dataAgentHandler
    );
}


export function deactivate() { }