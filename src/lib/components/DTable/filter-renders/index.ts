import StringRender from './string-render.svelte';
import SelectRender from './select-render.svelte';
import DateRender from './date-render.svelte';

export const filterRenders: Record<FilterType, any> = {
	string: StringRender,
	select: SelectRender,
	date: DateRender
};

export type FilterType = 'string' | 'select' | 'date';
