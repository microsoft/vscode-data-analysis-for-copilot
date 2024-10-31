// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { https } from 'follow-redirects';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getProxyForUrl } from 'proxy-from-env';
import { parse } from 'url';
import { spawnSync } from 'child_process';
import { Presets, SingleBar } from 'cli-progress';
import * as fs from 'fs';
import { platform } from 'os';
import * as path from 'path';
import * as tar from 'tar';
import * as unzipper from 'unzipper';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const decompress = require('decompress');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const decompressTarbz = require('decompress-tarbz2');

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


export async function extractTarBz2(file: string, dir: string) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
	if (platform() === 'win32') {
		await decompress(file, dir, {
			plugins: [
				decompressTarbz()
			]
		});
		return;
	}
	try {
		extractTarBz2UnixShell(file, dir);
	} catch (ex) {
		console.error(`Failed to extract using shell scripts`, ex);
		await decompress(file, dir, {
			plugins: [
				decompressTarbz()
			]
		});
	}
}

function extractTarBz2UnixShell(file: string, target: string) {
	const command = `tar -xf ${file}`;
	console.log(`Extracting using shell command ${command}`)
	const output = spawnSync(command, { shell: true, cwd: target });
	if (output.error) {
		throw output.error;
	}
}


export function downloadFile(url: string, dest: string) {
	if (fs.existsSync(dest)) {
		// Re-use the same file.
		return;
	}
	if (!fs.existsSync(path.dirname(dest))) {
		fs.mkdirSync(path.dirname(dest), { recursive: true });
	}
	const downloadOpts = getRequestOptions(url);
	downloadOpts.headers.accept = 'application/octet-stream';
	return new Promise<void>((resolve, reject) => {
		const file = fs.createWriteStream(dest);
		https
			.get(downloadOpts, (response) => {
				if (response.statusCode !== 200) {
					return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
				}

				const totalBytes = parseInt(response.headers['content-length'] || '0');
				const bar = new SingleBar({}, Presets.shades_classic);
				bar.start(100, 0);
				let receivedBytes = 0;
				response.on('data', function (chunk) {
					receivedBytes += chunk.length;
					const percentage = (receivedBytes * 100) / totalBytes;
					bar.update(percentage);
				});
				response.pipe(file);

				file.on('finish', () => {
					bar.stop();
					file.close(() => resolve());
				});
			})
			.on('error', (err) => reject(err));
	});
}


export async function extractFile(tgzFile: string, extractDir: string) {
	if (tgzFile.endsWith('.zip')) {
		const directory = await unzipper.Open.file(tgzFile);
		await directory.extract({ path: extractDir })
		if (fs.existsSync(path.join(extractDir, '__MACOSX'))) {
			fs.rmSync(path.join(extractDir, '__MACOSX'), { recursive: true });
		}
		return;
	}
	await tar.x({
		file: tgzFile,
		cwd: extractDir,
		'strip-components': 1
	});

	return extractDir;
}
