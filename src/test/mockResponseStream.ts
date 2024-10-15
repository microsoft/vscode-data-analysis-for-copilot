// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ChatResponseAnchorPart, ChatResponseCommandButtonPart, type ChatResponseFileTree, ChatResponseFileTreePart, ChatResponseMarkdownPart, type ChatResponsePart, ChatResponseProgressPart, ChatResponseReferencePart, type ChatResponseStream, type Command, type Location, type MarkdownString, type ThemeIcon, type Uri } from "vscode";


export class MockChatResponseStream implements ChatResponseStream {
	public readonly parts: ChatResponsePart[] = [];
	public static instance: MockChatResponseStream;
	constructor(private readonly stream: ChatResponseStream) {
		MockChatResponseStream.instance = this;
	}
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
		this.stream.markdown(value);
	}
	anchor(value: Uri | Location, title?: string): void {
		this.parts.push(new ChatResponseAnchorPart(value, title));
		this.stream.anchor(value, title);
	}
	button(command: Command): void {
		this.parts.push(new ChatResponseCommandButtonPart(command));
		this.stream.button(command);
	}
	filetree(value: ChatResponseFileTree[], baseUri: Uri): void {
		this.parts.push(new ChatResponseFileTreePart(value, baseUri));
		this.stream.filetree(value, baseUri);
	}
	progress(value: string): void {
		this.parts.push(new ChatResponseProgressPart(value));
		this.stream.progress(value);
	}
	reference(value: Uri | Location, iconPath?: Uri | ThemeIcon | { light: Uri; dark: Uri; }): void {
		this.parts.push(new ChatResponseReferencePart(value, iconPath));
		this.stream.reference(value, iconPath);
	}
	push(part: ChatResponsePart): void {
		if (part instanceof ChatResponseMarkdownPart) {
			this.markdown(part.value);
		} else {
			this.parts.push(part);
			this.stream.push(part);
		}
	}
}
