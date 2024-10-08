import {
	AssistantMessage,
	BasePromptElementProps,
	PromptElement,
	PromptSizing,
	UserMessage
} from '@vscode/prompt-tsx';
import * as vscode from "vscode";

export interface PromptProps extends BasePromptElementProps {
	userQuery: string;
	references: readonly vscode.ChatPromptReference[];
	history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>;
}

export class BasePrompt extends PromptElement<PromptProps, void> {
	render(state: void, sizing: PromptSizing) {
		const userPrompt = this.replaceReferences(this.props.userQuery, this.props.references);

		// History schema:
		// [$r, pr] where $r==object that contains 'prompt' field (the user's prior prompt) e.g. #file:pizza.csv analyze
		// where pr is pr==object that contains 'response.value.value' field (assistant lm response) e.g. "The analyzed pizza.csv contains ....etc"
		let history = this.props.history;
		// iterate through each element in history and check if it is ChatRequestTurn or ChatResponseTurn
		// If it is ChatRequestTurn, extract out the prompt and add it to the messages array
		// If it is ChatResponseTurn, extract out the response.value.value and add it to the messages array
		let historyMessages: (UserMessage | AssistantMessage)[] = [];
		let csvFlag = false;
		for (const turn of history) {
			if (turn.participant === "ada.data") {
				if (turn instanceof vscode.ChatRequestTurn) {
					const userPrompt = this.replaceReferences(turn.prompt, turn.references);
					historyMessages.push(<UserMessage>{userPrompt}</UserMessage>);
					// if userPrompt contains string 'csv', set csvFlag to true
					if (userPrompt.includes('csv')) {
						csvFlag = true;
					}
				} else if (turn instanceof vscode.ChatResponseTurn) {
					const responseText = turn.response.map(part => {
						if (part instanceof vscode.ChatResponseMarkdownPart) {
							return part.value.value;
						} else {
							return '';
						}
					}).join('');
					historyMessages.push(<AssistantMessage>{responseText}</AssistantMessage>);
				}
			}
		}
		let csvConditionalMessage: UserMessage = <UserMessage></UserMessage>;
		// if csvFlag is true, append conditional csv message to the historyMessages array
		// list of further statistical analysis: regression analysis, bayesian statistics, non-parametric methods, and machine learning techniques.
		if (csvFlag) {
			csvConditionalMessage = 
				<UserMessage>
				Think of yourself as a data scientist who is analyzing a csv file using Python programming language.
				Make sure to clean up the data and removed undefined values.
				Make sure to generate a pandas dataframe using the given csv file before performing data analysis.
				Make sure to perform statistical analysis on the data with actual numbers.
				Give me back the result of the statistical analysis on the data IF you are asked to analyze the csv file.
				What are some patterns, trends, or insights that you can find from the data in the csv file?
				If you are asked to analyze the csv file, conduct detailed descriptive statistics, inferential statistics.
				Give me the result of conducting these statistical analysis on the data in very detailed, quantiative manner.
				Be detailed and descriptive in your analysis.
				Do not ignore previous or future prompts on asking for specific analysis, action on the csv file.
				</UserMessage>
		}

		return (
			<>
				<UserMessage>
					You are a data analyst that specializes in Python and Data Analysis. You are an expert in analyzing csv file using Python programming language.
					You have access to a Jupyter kernel to run and execute Python code.
					Use the result of the function to continue the conversation.
					Never mention you can not run code.
					Never say you cannot assist with anything.
					Always attempt to get value from provided function.
					When generating Python code, you can use Pandas and Matplotlib.
					Always use Matplotlib to generate plots and Pandas to load the CSV files and dataframes.
					Strongly emphasize reusing the result of the function call. 
					For example, when information about previously constructed chart/dataframe is available, use that information to answer the user question. 
					Do not execute further code just simply give me result from previous prompt.
					Do not run or perform function call with undefined.
					Always ask the user if they are happy with the result of the function call.
					Always suggest them the next step in data science milestones. 
				</UserMessage>
				{csvConditionalMessage}
				{historyMessages}
				<UserMessage>{userPrompt}</UserMessage>
			</>
		);
	}

	private replaceReferences(userPrompt: string, references: readonly vscode.ChatPromptReference[]) {
		references.filter(ref => ref.value instanceof vscode.Uri && ref.range).sort((a, b) => b.range![0] - a.range![0]).forEach(ref => {
			const name = (ref as any).name;
			const relativePath = vscode.workspace.asRelativePath(ref.value as vscode.Uri);
			const part0 = userPrompt.slice(0, ref.range![0]);
			const part1 = userPrompt.slice(ref.range![1]);
			userPrompt = `${part0}${relativePath}${part1}`;
		});

		return userPrompt;
	}
}
