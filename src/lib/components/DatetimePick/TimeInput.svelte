<script lang="ts">
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { cn } from '$lib/utils';

	let {
		value = '',
		onchange = (_v: string) => {},
		name = '',
		step = 5,
		class: className
	}: {
		value?: string; // 'HH:MM'
		onchange?: (v: string) => void;
		name?: string; // если задан — рендерит скрытый input для форм
		step?: number; // шаг минут (по умолчанию 5)
		class?: string;
	} = $props();

	const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
	const minutes = $derived(
		Array.from({ length: 60 / step }, (_, i) => String(i * step).padStart(2, '0'))
	);

	const curHour = $derived(value ? value.split(':')[0] : '');
	const curMinute = $derived(value ? value.split(':')[1] : '');

	function setHour(v: string) {
		onchange(`${v}:${value ? value.split(':')[1] : '00'}`);
	}

	function setMinute(v: string) {
		onchange(`${value ? value.split(':')[0] : '00'}:${v}`);
	}
</script>

<div class={cn('flex items-center gap-1', className)}>
	<Select type="single" value={curHour} onValueChange={(v) => setHour(v ?? '00')}>
		<SelectTrigger class="w-18">
			<span>{curHour || '--'}</span>
		</SelectTrigger>
		<SelectContent>
			{#each hours as h}<SelectItem value={h}>{h}</SelectItem>{/each}
		</SelectContent>
	</Select>
	<span class="text-muted-foreground">:</span>
	<Select type="single" value={curMinute} onValueChange={(v) => setMinute(v ?? '00')}>
		<SelectTrigger class="w-18">
			<span>{curMinute || '--'}</span>
		</SelectTrigger>
		<SelectContent>
			{#each minutes as m}<SelectItem value={m}>{m}</SelectItem>{/each}
		</SelectContent>
	</Select>
	{#if name}<input type="hidden" {name} {value} />{/if}
</div>
