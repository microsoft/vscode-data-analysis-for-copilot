// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatCommand, ChatResponseAnchorPart, ChatResponseCommandButtonPart, type ChatResponseFileTree, ChatResponseFileTreePart, ChatResponseMarkdownPart, type ChatResponsePart, ChatResponseProgressPart, ChatResponseReferencePart, ChatResponseReferencePartStatusKind, type ChatResponseStream, ChatVulnerability, type Command, type Location, type MarkdownString, TextEdit, type ThemeIcon, type Uri } from "vscode";


export class MockChatResponseStream implements ChatResponseStream {
	public readonly parts: ChatResponsePart[] = [];
	public readonly edits = new Map<string, (TextEdit | TextEdit[])[]>();
	clear() {
		this.parts.length = 0;
	}
	markdown(value: string | MarkdownString): void {
		if (this.parts.length > 0) {
			const item = this.parts[this.parts.length - 1];
			if (item instanceof ChatResponseMarkdownPart) {
				this.parts[this.parts.length - 1] = new ChatResponseMarkdownPart(item.value.value + (typeof value === 'string' ? value : value.value));
				return;
			}
		}
		this.parts.push(new ChatResponseMarkdownPart(value));
	}
	anchor(value: Uri | Location, title?: string): void {
		this.parts.push(new ChatResponseAnchorPart(value, title));
	}
	button(command: Command): void {
		this.parts.push(new ChatResponseCommandButtonPart(command));
	}
	filetree(value: ChatResponseFileTree[], baseUri: Uri): void {
		this.parts.push(new ChatResponseFileTreePart(value, baseUri));
	}
	progress(value: string): void {
		this.parts.push(new ChatResponseProgressPart(value));
	}
	reference(value: Uri | Location, iconPath?: Uri | ThemeIcon | { light: Uri; dark: Uri; }): void {
		this.parts.push(new ChatResponseReferencePart(value, iconPath));
	}
	push(part: ChatResponsePart): void {
		if (part instanceof ChatResponseMarkdownPart) {
			this.markdown(part.value);
		} else {
			this.parts.push(part);
		}
	}
	textEdit(_target: Uri, _edits: TextEdit | TextEdit[]): void {
		//
	}
	markdownWithVulnerabilities(_value: string | MarkdownString, _vulnerabilities: ChatVulnerability[]): void {
		//
	}
	codeblockUri(_uri: Uri): void {
		//
	}
	detectedParticipant(_participant: string, _command?: ChatCommand): void {
		//
	}
	confirmation(_title: string, _message: string, _data: any, _buttons?: string[]): void {

	}
	warning(_message: string | MarkdownString): void {
		//
	}
	reference2(_value: Uri | Location | string | { variableName: string; value?: Uri | Location; }, _iconPath?: Uri | ThemeIcon | { light: Uri; dark: Uri; }, _options?: { status?: { description: string; kind: ChatResponseReferencePartStatusKind; }; }): void {
		//
	}
	codeCitation(_value: Uri, _license: string, _snippet: string): void {
		//
	}
}
