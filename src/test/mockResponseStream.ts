// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ChatResponseAnchorPart, ChatResponseCommandButtonPart, type ChatResponseFileTree, ChatResponseFileTreePart, ChatResponseMarkdownPart, type ChatResponsePart, ChatResponseProgressPart, ChatResponseReferencePart, type ChatResponseStream, type Command, type Location, type MarkdownString, type ThemeIcon, type Uri } from "vscode";


export class MockChatResponseStream implements ChatResponseStream {
	public readonly parts: ChatResponsePart[] = [];
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
}
