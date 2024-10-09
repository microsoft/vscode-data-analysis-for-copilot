// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs';
import { https } from 'follow-redirects';
import { parse } from 'url';
import * as path from 'path';
import { getProxyForUrl } from 'proxy-from-env';
import { tmpdir } from 'os';
import * as tar from 'tar';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { PYODIDE_VERSION } from './constants';

function getApiUrl() {
    return `https://api.github.com/repos/jupyterlite/pyodide-kernel/releases/tags/v${PYODIDE_VERSION}`;
}

type ReleaseInfo = {
    assets: {
        url: string;
        browser_download_url: string;
        name: string;
        content_type: string;
        size: number;
    }[];
};
export async function downloadPyodideKernel() {
    const contents = await downloadContents(getApiUrl());
    const json: ReleaseInfo = JSON.parse(contents);
    const fileToDownload = json.assets.find((asset) =>
        asset.name.toLowerCase().startsWith('jupyterlite-pyodide-kernel-0')
    )!;
    console.debug(`Download ${fileToDownload.url}`);
    const tarFile = path.join(tmpdir(), fileToDownload.name);
    await downloadFile(fileToDownload.url, tarFile);
    console.debug(`Downloaded to ${tarFile}`);
    const dir = path.join(__dirname, '..', 'out');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    await extractFile(tarFile, dir);
    await deleteUnwantedFiles(dir);
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
        fs.unlinkSync(dest);
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
                response.pipe(file);
                file.on('finish', () => {
                    file.close(() => resolve());
                });
            })
            .on('error', (err) => reject(err));
    });
}

async function extractFile(tgzFile: string, extractDir: string) {
    await tar.x({
        file: tgzFile,
        cwd: extractDir,
        'strip-components': 1
    });

    return extractDir;
}
