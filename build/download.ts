// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Presets, SingleBar } from 'cli-progress';
import { https } from 'follow-redirects';
import * as fs from 'fs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as path from 'path';
import { getProxyForUrl } from 'proxy-from-env';
import * as tar from 'tar';
import { parse } from 'url';
import { PYODIDE_VERSION } from './common';
import * as unzipper from 'unzipper';
import { spawnSync } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const decompress = require('decompress');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const decompressTarbz = require('decompress-tarbz2');

function getApiUrl() {
	return `https://api.github.com/repos/microsoft/Advanced-Data-Analysis-for-Copilot/releases/tags/${PYODIDE_VERSION}`;
}
const pyodideApiUri = 'https://api.github.com/repos/pyodide/pyodide/releases/tags/0.26.2';
const packagesToKeep = ['attrs-', 'decorator', 'distutils', 'fonttools', 'hashlib',
	'matplotlib', 'micropip', 'numpy', 'mpmpath', 'openssl', 'package.json', 'pandas',
	'pydecimal', 'pyodide', 'python_date', 'python_std', 'pytz', 'six', 'sqlite', 'ssl',
	// These are definitely required to get things running.
	'pydoc_data', 'lzma-', 'distutils', 'ffi.d.ts', 'packaging-', 'traitlets-', 'ipython-',
	// These are definitely required to get simple execution like `what is the current time`
	'asttokens', 'executing', 'prompt_toolkit', 'pure_eval', 'pygments', 'stack_data', 'wcwidth',
	// These are definitely required to get simple execution like plot a matplot lib graph
	'cycler', 'kiwisolver', 'pillow', 'pyparsing'
]

type ReleaseInfo = {
	assets: {
		url: string;
		browser_download_url: string;
		name: string;
		content_type: string;
		size: number;
	}[];
};
export async function downloadPyodideScripts() {
	spawnSync('git restore --source=pyodide --worktree resources/pyodide.zip', { cwd: path.join(__dirname, '..'), shell: true });
	const tarFile = path.join(__dirname, '..', 'resources', 'pyodide.zip');
	const dir = path.join(__dirname, '..', 'pyodide');
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
	await extractFile(tarFile, path.join(__dirname, '..', 'pyodide'));
	console.debug(`Extracted to ${dir}`);
}

export async function downloadPyodideArtifacts() {
	const contents = await downloadContents(pyodideApiUri);
	const json: ReleaseInfo = JSON.parse(contents);
	const fileToDownload = json.assets.find((asset) =>
		asset.name.toLowerCase().startsWith('pyodide-0') && asset.name.toLowerCase().endsWith('.tar.bz2')
	)!;
	console.debug(`Downloading ${fileToDownload.name} (${fileToDownload.url})`);
	const tarFile = path.join(__dirname, '..', 'temp', fileToDownload.name);
	if (!fs.existsSync(path.dirname(tarFile))) {
		fs.mkdirSync(path.dirname(tarFile), { recursive: true });
	}
	await downloadFile(fileToDownload.url, tarFile);
	console.debug(`Downloaded to ${tarFile}`);
	const dir = path.join(__dirname, '..', 'temp');
	console.debug(`Extracting into ${dir}`);
	// Extraction is slow, use the previously extracted files if they exist.
	if (!fs.existsSync(path.join(dir, 'pyodide')) || !fs.readdirSync(path.join(dir, 'pyodide')).length) {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
		await decompress(tarFile, dir, {
			plugins: [
				decompressTarbz()
			]
		});
	}

	// Extract only the files we need.
	fs.readdirSync(path.join(dir, 'pyodide')).forEach(file => {
		const dest = path.join(__dirname, '..', 'pyodide', file);
		const source = path.join(dir, 'pyodide', file);
		if (file.toLowerCase().endsWith('-tests.tar')) {
			return;
		}
		if (fs.existsSync(dest)) {
			fs.rmSync(dest, { recursive: true });
		}
		if (!fs.existsSync(path.dirname(dest))) {
			fs.mkdirSync(path.dirname(dest), { recursive: true });
		}

		if (packagesToKeep.some(keep => file.toLowerCase().startsWith(keep.toLowerCase()))) {
			if (fs.statSync(source).isDirectory()) {
				fs.cpSync(source, dest, { recursive: true });
			} else {
				fs.copyFileSync(source, dest);
			}
		}
	});
	console.debug(`Extracted to ${dir}`);
}

async function deleteUnwantedFiles(dir: string) {
	const files = [
		path.join(dir, 'lib'),
		path.join(dir, 'style'),
		path.join(dir, 'package.json'),
		path.join(dir, 'tsconfig.tsbuildinfo')
	];
	files.forEach((file) => {
		if (fs.existsSync(file)) {
			fs.rmSync(file, { recursive: true });
		}
	});
	const pypiFiles = fs.readdirSync(path.join(dir, 'pypi'));
	pypiFiles
		.filter((file) => file.toLowerCase().startsWith('widgetsnbextension'))
		.forEach((file) => fs.rmSync(path.join(dir, 'pypi', file), { recursive: true }));
}

function getRequest(url: string) {
	const token = process.env['GITHUB_TOKEN'];
	const proxy = getProxyForUrl(getApiUrl());
	const downloadOpts: Record<string, any> = {
		headers: {
			'user-agent': 'vscode-zeromq'
		},
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

function downloadContents(url: string) {
	return new Promise<string>((resolve, reject) => {
		let result = '';
		https.get(getRequest(url), (response) => {
			if (response.statusCode !== 200) {
				return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
			}
			response.on('data', (d) => (result += d.toString()));
			response.on('end', () => resolve(result));
		});
	});
}

function downloadFile(url: string, dest: string) {
	if (fs.existsSync(dest)) {
		// Re-use the same file.
		return;
	}
	if (!fs.existsSync(path.dirname(dest))) {
		fs.mkdirSync(path.dirname(dest), { recursive: true });
	}
	const downloadOpts = getRequest(url);
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


async function extractFile(tgzFile: string, extractDir: string) {
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

async function main() {
	const pyodideDir = path.join(__dirname, '..', 'pyodide');
	if (fs.existsSync(pyodideDir)) {
		fs.rmSync(pyodideDir, { recursive: true });
	}
	await downloadPyodideScripts();
	await downloadPyodideArtifacts();
}

main();
