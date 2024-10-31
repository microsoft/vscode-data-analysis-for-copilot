/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
*--------------------------------------------------------------------------------------------*/

import { commands, ExtensionContext } from 'vscode';
import { getLastErrors } from './logger';

export function registerIssueReporter(context: ExtensionContext) {
	return commands.registerCommand('dachat.reportIssue', () => {
		commands.executeCommand('workbench.action.openIssueReporter', {
			extensionId: context.extension.id,
			issueBody: issueBody,
			data: getIssueData()
		});
	});
}

const issueBody = `
<!-- Please fill in all XXX markers -->
# Behaviour

XXX

## Steps to reproduce:

1. XXX

<!--
**After** creating the issue on GitHub, you can add screenshots and GIFs of what is happening.
Consider tools like https://gifcap.dev, https://www.screentogif.com/ for GIF creation.
-->

<!-- **NOTE**: Please do provide logs from Data Analysis Output panel. -->
<!-- Use the command \`Output: Focus on Output View\`, select \`Data Analysis\` from the dropdown -->
<!-- Copy the output and past it in the XXX region -->

# Outputs

<details>

<summary>Output from Data Analysis Output Panel</summary>

<p>

\`\`\`
XXX
\`\`\`

</p>
</details>
`;


function getIssueData() {
	const error = getLastErrors().trim();
	if (!error) {
		return '';
	}
	return `
<details>
<summary>Last few Errors</summary>
<p>

\`\`\`
${error}
\`\`\`
</p>
</details>
`;
};
