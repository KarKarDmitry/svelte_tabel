<script lang="ts">
	import { cn } from '$lib/utils';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	let {
		rules = [] as any[],
		selected = $bindable(new Set<number>()),
		month = $bindable(1),
		onRuleClick
	}: {
		rules: any[];
		selected: Set<number>;
		month: number;
		onRuleClick?: (rule: any) => void;
	} = $props();

	const monthsFull = [
		'Январь',
		'Февраль',
		'Март',
		'Апрель',
		'Май',
		'Июнь',
		'Июль',
		'Август',
		'Сентябрь',
		'Октябрь',
		'Ноябрь',
		'Декабрь'
	];
	const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

	// Год только для вычисления смещения дня недели (2026 — обычный год, февраль 28)
	const year = 2026;

	const firstDayOffset = $derived((new Date(year, month - 1, 1).getDay() + 6) % 7);
	const daysInMonth = $derived(new Date(year, month, 0).getDate());

	const cells = $derived.by(() => {
		const result: (number | null)[] = [];
		for (let i = 0; i < firstDayOffset; i++) result.push(null);
		for (let d = 1; d <= daysInMonth; d++) result.push(d);
		while (result.length % 7 !== 0) result.push(null);
		return result;
	});

	const rulesByDay = $derived.by(() => {
		const map = new Map<number, any>();
		for (const r of rules) {
			if (r.month === month) map.set(r.day, r);
		}
		return map;
	});

	function toggleDay(d: number) {
		const next = new Set(selected);
		if (next.has(d)) next.delete(d);
		else next.add(d);
		selected = next;
	}

	function handleDay(d: number) {
		const rule = rulesByDay.get(d);
		if (rule) {
			onRuleClick?.(rule);
		} else {
			toggleDay(d);
		}
	}
</script>

<div class="rounded-xl border bg-card p-3">
	<div class="mb-2 flex items-center justify-between">
		<button
			class="rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted"
			onclick={() => (month = month === 1 ? 12 : month - 1)}
		>
			<ArrowLeft class="size-4" />
		</button>
		<span class="text-sm font-medium">{monthsFull[month - 1]}</span>
		<button
			class="rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted"
			onclick={() => (month = month === 12 ? 1 : month + 1)}
		>
			<ArrowRight class="size-4" />
		</button>
	</div>

	<div class="grid grid-cols-7 gap-1 text-center">
		{#each weekdays as wd}
			<div class="py-1 text-xs font-medium text-muted-foreground">{wd}</div>
		{/each}

		{#each cells as d, i (d ?? `empty-${i}`)}
			{#if d === null}
				<div class="h-8"></div>
			{:else}
				{@const rule = rulesByDay.get(d)}
				{@const isSelected = selected.has(d)}
				<button
					class={cn(
						'flex h-8 items-center justify-center rounded-md text-sm transition-colors',
						rule
							? 'bg-primary font-medium text-primary-foreground hover:bg-primary/80'
							: isSelected
								? 'bg-accent font-medium text-accent-foreground ring-2 ring-primary/40'
								: 'hover:bg-muted'
					)}
					onclick={() => handleDay(d)}
					title={rule
						? `${d}.${month} — правило (клик: редактировать)`
						: isSelected
							? `${d}.${month} — выбрано (клик: убрать)`
							: `${d}.${month}`}
				>
					{d}
				</button>
			{/if}
		{/each}
	</div>

	<div class="mt-2 flex flex-wrap gap-3 border-t pt-2 text-[11px] text-muted-foreground">
		<span class="flex items-center gap-1">
			<span class="inline-block size-3 rounded bg-primary"></span>
			правило
		</span>
		<span class="flex items-center gap-1">
			<span class="inline-block size-3 rounded bg-accent ring-2 ring-primary/40"></span>
			выбрано
		</span>
	</div>
</div>
