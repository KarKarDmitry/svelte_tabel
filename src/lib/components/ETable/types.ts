import type { Snippet } from 'svelte';

export interface EColumn<T = any> {
	key: keyof T | string[];
	label: string;
	width?: number;
	sticky?: boolean;
	mono?: boolean;
	align?: Align;
	class?: string;
	headClass?: string;
	cellClass?: string;
	format?: (value: any, row: T) => string;
	render?: Snippet<[value: any, row: T, col: EColumn<T>]>;
}

export type Align = 'left' | 'center' | 'right';

export type PreparedRow<T> = {
	id: string | number;
	raw: T;
	values: Record<string, any>;
};
