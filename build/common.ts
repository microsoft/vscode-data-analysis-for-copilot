// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { https } from 'follow-redirects';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getProxyForUrl } from 'proxy-from-env';
import { parse } from 'url';

export const PYTHON_VERSION = '3.12.1'; // Version of Python used in Pyodide, check https://github.com/pyodide/pyodide/blob/main/Makefile.envs
export const PYTHON_VERSION_SHORT = '3.12'; // Version of Python used in Pyodide, check https://github.com/pyodide/pyodide/blob/main/Makefile.envs
export const PYODIDE_VERSION = '0.27.0a2';
export const PYODIDE_KERNEL_VERSION = '0.4.3';

export function downloadContents(url: string) {
	return new Promise<string>((resolve, reject) => {
		let result = '';
		https.get(getRequestOptions(url), (response) => {
			if (response.statusCode !== 200) {
				return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
			}
			response.on('data', (d) => (result += d.toString()));
			response.on('end', () => resolve(result));
		});
	});
}


export function getRequestOptions(url: string) {
	const token = process.env['GITHUB_TOKEN'];
	const proxy = getProxyForUrl(url);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const downloadOpts: Record<string, any> = {
		headers: {
			'user-agent': 'vscode-pyodide'
		},
		// ...new URL(url)
		...parse(url)
	};

	if (token) {
		downloadOpts.headers.authorization = `token ${token}`;
	}

	if (proxy !== '') {
		Object.assign(downloadOpts, {
			...downloadOpts,
			agent: new HttpsProxyAgent(proxy)
		});
	}

	return downloadOpts;
}
