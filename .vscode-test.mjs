import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	version: 'insiders',
	mocha: {
		timeout: 600_000
	},
	workspaceFolder: 'scenarios',
	platform:'desktop',
	useInstallation:{
		fromMachine: true
	}
});
