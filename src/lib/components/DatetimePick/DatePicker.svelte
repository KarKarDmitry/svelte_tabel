<script lang="ts">
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import Calendar from '$lib/components/ui/calendar/calendar.svelte';
	import { parseDate } from '@internationalized/date';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { cn } from '$lib/utils';

	let {
		value = '',
		onchange = (_v: string) => {},
		placeholder = 'Выберите дату',
		name = '',
		disabled = false,
		longFormat = false,
		class: className
	}: {
		value?: string; // 'YYYY-MM-DD'
		onchange?: (v: string) => void;
		placeholder?: string;
		name?: string; // если задан — рендерит скрытый input для форм
		disabled?: boolean;
		longFormat?: boolean; // '31 января 2026' вместо '31.01.2026'
		class?: string;
	} = $props();

	let open = $state(false);

	const monthsGen = [
		'января',
		'февраля',
		'марта',
		'апреля',
		'мая',
		'июня',
		'июля',
		'августа',
		'сентября',
		'октября',
		'ноября',
		'декабря'
	];

	function fmt(v: string): string {
		if (!v) return '';
		const [y, m, d] = v.split('-').map(Number);
		if (longFormat) return `${d} ${monthsGen[m - 1]} ${y}`;
		return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
	}

	function select(v: any) {
		open = false;
		onchange(v?.toString() ?? '');
	}
</script>

<Popover bind:open>
	<PopoverTrigger {disabled}>
		{#snippet child({ props })}
			<button
				type="button"
				{...props}
				class={cn(
					'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50',
					className
				)}
			>
				<span class={value ? '' : 'text-muted-foreground'}>{value ? fmt(value) : placeholder}</span>
				<CalendarIcon class="size-4 shrink-0 text-muted-foreground" />
			</button>
		{/snippet}
	</PopoverTrigger>
	<PopoverContent class="w-auto p-0" align="start">
		<Calendar
			type="single"
			captionLayout="dropdown"
			value={value ? parseDate(value) : undefined}
			onValueChange={(v) => select(v)}
			locale="ru-RU"
		/>
	</PopoverContent>
</Popover>
{#if name}<input type="hidden" {name} {value} />{/if}
