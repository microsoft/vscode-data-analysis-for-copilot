// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Generates license file for all Pyodide packages/dependencies used.

import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import * as unzipper from 'unzipper';
import { downloadContents, downloadFile, extractTarBz2, PYTHON_VERSION_SHORT } from './common';

const filesToIgnore: string[] = [
	// These are built by us, and licence covered by pyodide license
	path.join('node', 'index.js.map'),
	path.join('node', 'index.js'),
	path.join('node', 'index.d.ts'),
	path.join('node', 'comlink.worker.js'),
	path.join('node', 'comlink.worker.js.map'),
	// These are covered by pyodide license
	path.join('schema', 'piplite.v0.schema.json'),
	path.join('pypi', 'all.json'),
	path.join('pyodide.mjs.map'),
	path.join('pyodide.mjs'),
	path.join('pyodide.js.map'),
	path.join('pyodide.js'),
	path.join('pyodide.d.ts'),
	path.join('pyodide.asm.wasm'),
	path.join('pyodide.asm.js'),
	path.join('pyodide-lock.json'),
	path.join('package.json'),
	path.join('ffi.d.ts'),
	// pyodide license
	path.join('PYODIDE_LICENSE'),
	path.join('LICENSE'),
	path.join('python_stdlib.zip'),
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
	if (file.endsWith('.whl') || file.endsWith('.zip')) {
		return generateWheelLicense(file);
	} else if (file.endsWith('.whl.metadata')) {
		// Ignore metadata files.
	} else if (fs.statSync(file).isDirectory()) {
		// Ignore directories.
	} else {
		console.error('License not generated for', file);
	}
}

async function generateWheelLicense(file: string): Promise<LicenseInfo> {
	const extractDir = path.join(tmpdir(), path.basename(file));
	if (fs.existsSync(extractDir)) {
		fs.rmSync(extractDir, { recursive: true });
	}
	const directory = await unzipper.Open.file(file);
	await directory.extract({ path: extractDir })

	const info: LicenseInfo = {
		file,
		licenses: [],
		name: '',
		projectUrl: '',
		version: ''
	};

	const files = fs.readdirSync(extractDir, { recursive: true }).map(f => path.join(extractDir, f));
	const fileName = path.basename(file);
	if (PackageInformation[fileName]) {
		info.name = PackageInformation[fileName].name;
		info.version = PackageInformation[fileName].version;
		info.projectUrl = PackageInformation[fileName].projectUrl;
		const file = PackageInformation[fileName].licenses[0].file;
		if (file.endsWith('.tar.gz')) {
			info.licenses.push({
				file,
				contents: await getLicenseFromTar(file)
			});
		} else {
			info.licenses.push({
				file,
				contents: await downloadContents(file)
			});
		}
	}
	else {
		const licenseFiles = files.filter(f => path.basename(f).startsWith('LICENSE') && fs.statSync(f).isFile());
		info.licenses.push(...licenseFiles.map(f => ({ file: f, contents: fs.readFileSync(f, 'utf-8') })));
	}
	if (info.licenses.length === 0) {
		throw new Error(`No license file found in ${extractDir}`);
	}
	if (info.licenses.some(l => l.contents.indexOf('GPL') >= 0 && l.file !== PSFLicense)) {
		throw new Error(`GPL license found in ${file}`);
	}

	if (!info.version || !info.name || !info.projectUrl) {
		const metadata = files.filter(f => path.basename(f).startsWith('METADATA') && fs.statSync(f).isFile());
		if (metadata.length === 0) {
			throw new Error(`No metadata file found in ${extractDir}`);
		}
		const metadataContents = fs.readFileSync(metadata[0], 'utf-8');

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
	}
	if (info.projectUrl) {
		info.projectUrl = info.projectUrl.substring(info.projectUrl.indexOf('http'));
	}
	return info;
}

async function getLicenseFromTar(tarUrl: string): Promise<string> {
	const filename = tarUrl.split('/').reverse()[0];
	const tarFile = path.join(__dirname, '..', 'temp', filename);
	if (!fs.existsSync(tarFile)) {
		console.debug(`Downloading ${filename} (${tarUrl})`);
		await downloadFile(tarUrl, tarFile);
		console.debug(`Downloaded to ${tarFile}`);
	}
	const dir = path.join(__dirname, '..', 'temp');
	const targetDir = path.join(dir, filename.replace('.tar.gz', '').replace('.tar', ''));
	if (fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}
	console.debug(`Extracting into ${dir}`);
	await extractTarBz2(tarFile, dir);
	return fs.readFileSync(path.join(targetDir, 'LICENSE')).toString();
}

const PSFLicense = `https://raw.githubusercontent.com/python/cpython/refs/heads/${PYTHON_VERSION_SHORT}/LICENSE`;
const PackageInformation: Record<string, LicenseInfo> = {
	// Defined here https://github.com/pyodide/pyodide/blob/main/packages/pyodide-unix-timezones/meta.yaml
	'pyodide_unix_timezones-1.0.0-py3-none-any.whl': {
		file: '',
		name: '',
		version: '',
		licenses: [{ file: 'https://raw.githubusercontent.com/joemarshall/pyodide-unix-timezones/refs/heads/main/LICENSE', contents: '' }],
		projectUrl: 'https://github.com/joemarshall/pyodide-unix-timezones/tree/main'
	},
	// https://github.com/pyodide/pyodide/blob/main/packages/ssl/meta.yaml
	// PSF license is in Python distro, get from there.
	// See here for how it is built https://github.com/pyodide/pyodide/blob/main/packages/ssl/meta.yaml
	// You can see that python-3.12.1.tgz is extracted and _hashopenssl.c is compiled.
	// And the license is at the bottom of the above meta.yaml file.
	// The license is included in the same python-3.12.1.tgz file.
	// TODO: Download https://www.python.org/ftp/python/$(PYSTABLEVERSION)/Python-$(PYVERSION).tgz
	// Where PYSTABLEVERSION = 3.12.1
	// Where PYVERSION = 3.12.1
	// The above values are defined in https://github.com/pyodide/pyodide/blob/main/Makefile.envs
	// Extract the LICENSE file from the above tgz and include that.
	// Or get it from github.
	'ssl-1.0.0-py2.py3-none-any.whl': {
		file: '',
		licenses: [{ file: PSFLicense, contents: '' }],
		projectUrl: 'https://github.com/pyodide/pyodide/tree/0.27.0a2',
		name: '',
		version: ''
	},
	// Same as SSL license
	'hashlib-1.0.0-py2.py3-none-any.whl': {
		file: '',
		name: '',
		version: '',
		licenses: [{ file: PSFLicense, contents: '' }],
		projectUrl: 'https://github.com/pyodide/pyodide/tree/0.27.0a2'
	},
	// Same as SSL license
	'pydoc_data-1.0.0-py2.py3-none-any.whl': {
		file: '',
		name: '',
		version: '',
		licenses: [{ file: PSFLicense, contents: '' }],
		projectUrl: 'https://github.com/pyodide/pyodide/tree/0.27.0a2'
	},
	// Same as SSL license
	'sqlite3-1.0.0-py2.py3-none-any.whl': {
		file: '',
		name: '',
		version: '',
		licenses: [{ file: PSFLicense, contents: '' }],
		projectUrl: 'https://github.com/pyodide/pyodide/tree/0.27.0a2'
	},
	'pydecimal-1.0.0-py2.py3-none-any.whl': {
		file: '',
		name: '',
		version: '',
		licenses: [{ file: PSFLicense, contents: '' }],
		projectUrl: 'https://github.com/pyodide/pyodide/tree/0.27.0a2'
	},
	// Same as SSL license
	'lzma-1.0.0-py2.py3-none-any.whl': {
		file: '',
		name: '',
		version: '',
		licenses: [{ file: PSFLicense, contents: '' }],
		projectUrl: 'https://github.com/pyodide/pyodide/tree/0.27.0a2'
	},
	'openssl-1.1.1w.zip': {
		file: '',
		name: 'openssl', // There is no metadata file, hence we must define this, found here https://github.com/openssl/openssl/releases/tag/OpenSSL_1_1_1v.
		version: '1.1.1w', // There is no metadata file, hence we must define this, found here https://github.com/openssl/openssl/releases/tag/OpenSSL_1_1_1v.
		licenses: [{ file: 'https://www.openssl.org/source/openssl-1.1.1w.tar.gz', contents: '' }],
		projectUrl: 'https://www.openssl.org'
	}
};
