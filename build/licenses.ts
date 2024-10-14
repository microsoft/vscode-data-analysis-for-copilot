// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Generates license file for all Pyodide packages/dependencies used.

import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import * as unzipper from 'unzipper';

const filesToIgnore: string[] = [
	path.join('schema', 'piplite.v0.schema.json'),
	path.join('pypi', 'all.json'),
	path.join('node', 'index.js.map'),
	path.join('node', 'index.js'),
	path.join('node', 'index.d.ts'),
	path.join('node', 'comlink.worker.js'),
	path.join('node', 'comlink.worker.js.map'),
	path.join('pyodide.mjs.map'),
	path.join('pyodide.mjs'),
	path.join('pyodide.js.map'),
	path.join('pyodide.js'),
	path.join('pyodide.d.ts'),
	path.join('pyodide.asm.wasm'),
	path.join('pyodide.asm.js'),
	path.join('pyodide-lock.json'),
	path.join('PYODIDE_LICENSE'),
	path.join('LICENSE'),
	path.join('package.json'),
	path.join('ffi.d.ts'),
];

type LicenseInfo = {
	licenses: { file: string; contents: string }[];
	file: string;
	projectUrl: string;
	name: string;
	version: string;
}
/**
 * 1. We ship code from this repo (modified)
 * https://github.com/jupyterlite/pyodide-kernel/tree/main/packages/pyodide-kernel
 * 2. We ship the wheels, schema files from https://github.com/jupyterlite/pyodide-kernel/releases/download/v0.4.2/jupyterlite-pyodide-kernel-0.4.2.tgz
 * These get downloaded and extracted into `pyodide/pypi`, `pyodide/scripts` folder.
 * 3. These are files in the `pyodide` folder that are shipped as well (wheels, zip files, etc)
 */

export async function generateLicenses() {
	await getLicenseFiles();
}

async function getLicenseFiles() {
	const root = path.join(__dirname, '..', 'pyodide');
	const result = fs.readdirSync(root, { recursive: true }) as string[];
	const files = result.filter(file => filesToIgnore.indexOf(file) === -1 ? true : false);
	const licenses = (await Promise.all(files.map(async file => {
		return generateLicense(path.join(root, file));
	}))).filter(l => l !== undefined) as LicenseInfo[];

	const header: string[] = [
		'THIRD-PARTY SOFTWARE NOTICES AND INFORMATION',
		'Do Not Translate or Localize',
		'',
		'This extension for Visual Studio Code incorporates third party material from the projects listed below. The original copyright notice and the license under which Microsoft received such third party material are set forth below. Microsoft reserves all other rights not expressly granted, whether by implication, estoppel or otherwise.',
		'',
	];

	licenses.unshift({
		licenses: [{ file: path.join(__dirname, '..', 'pyodide', 'LICENSE'), contents: fs.readFileSync(path.join(__dirname, '..', 'pyodide', 'LICENSE'), 'utf-8') }],
		file: path.join(__dirname, '..', 'pyodide', 'LICENSE'),
		name: 'pyodide',
		version: '0.26.2',
		projectUrl: 'https://github.com/pyodide/pyodide',
	})
	const contents: string[] = [];
	licenses.forEach((l, i) => {
		const prefix = `${i + 1}.`.padEnd(4);
		header.push(`${prefix} ${l.name} (${l.projectUrl})`);
		contents.push(`%% ${l.name} NOTICES, INFORMATION, AND LICENSE BEGIN HERE`);
		contents.push(`=========================================`);
		l.licenses.forEach((license, i) => {
			if (i > 0) {
				contents.push('');
				contents.push('');
			}
			contents.push(license.contents);
		});
		contents.push(`=========================================`);
		contents.push(`END OF ${l.name} NOTICES, INFORMATION, AND LICENSE`);
		contents.push('');
	});

	const licenseFile = path.join(__dirname, '..', 'ThirdPartyPackageNotices.txt');
	fs.writeFileSync(licenseFile, header.join('\n') + '\n\n\n' + contents.join('\n'));
}

async function generateLicense(file: string) {
	if (file.endsWith('.whl')) {
		return generateWheelLicense(file);
	}
}

async function generateWheelLicense(file: string): Promise<LicenseInfo> {
	const extractDir = path.join(tmpdir(), path.basename(file));
	if (fs.existsSync(extractDir)) {
		fs.rmSync(extractDir, { recursive: true });
	}
	const directory = await unzipper.Open.file(file);
	await directory.extract({ path: extractDir })
	// console.error(`Extracting ${file} to ${extractDir}`);

	const files = fs.readdirSync(extractDir, { recursive: true }).map(f => path.join(extractDir, f));
	const licenseFiles = files.filter(f => path.basename(f).startsWith('LICENSE') && fs.statSync(f).isFile());
	const metadata = files.filter(f => path.basename(f).startsWith('METADATA') && fs.statSync(f).isFile());
	if (licenseFiles.length === 0) {
		throw new Error(`No license file found in ${extractDir}`);
	}
	if (metadata.length === 0) {
		throw new Error(`No metadata file found in ${extractDir}`);
	}
	const metadataContents = fs.readFileSync(metadata[0], 'utf-8');
	const info = {
		author: { name: '', email: '' },
		file: file,
		licenses: licenseFiles.map(f => ({ file: f, contents: fs.readFileSync(f, 'utf-8') })),
		name: '',
		projectUrl: '',
		version: ''
	};
	if (info.licenses.some(l => l.contents.indexOf('GPL') >= 0)) {
		throw new Error(`GPL license found in ${file}`);
	}

	for (const line of metadataContents.split('\n')) {
		if (line.startsWith('Name:')) {
			info.name = line.split('Name:')[1].trim();
		}
		if (line.startsWith('Version:')) {
			info.version = line.split('Version:')[1].trim();
		}
		if (line.startsWith('Home-page:')) {
			info.projectUrl = info.projectUrl || line.split('Home-page:')[1].trim();
		}
		if (line.startsWith('Project-URL:')) {
			info.projectUrl = info.projectUrl || line.split('Project-URL:')[1].trim();
		}
	}
	if (info.projectUrl) {
		info.projectUrl = info.projectUrl.substring(info.projectUrl.indexOf('http'));
	}
	return info;
}
