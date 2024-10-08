// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  ConfigurationTarget,
  Disposable,
  Event,
  ExtensionContext,
  OutputChannel,
  Uri,
  Range,
} from "vscode";

export type ReadWrite<T> = {
  -readonly [P in keyof T]: T[P];
};

export type ClassType<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
};

