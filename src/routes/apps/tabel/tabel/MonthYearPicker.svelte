<script lang="ts">
	import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	let {
		year = $bindable(new Date().getFullYear()),
		month = $bindable(new Date().getMonth() + 1),
		onChange
	}: {
		year: number;
		month: number;
		onChange?: (year: number, month: number) => void;
	} = $props();

	let open = $state(false);
	let selYear = $state(year);
	let selMonth = $state(month);

	const months = [
		'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
		'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
	];

	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

	function selectMonth(m: number) {
		selMonth = m;
		apply();
	}

	function selectYear(y: number) {
		selYear = y;
		apply();
	}

	function apply() {
		open = false;
		if (selYear !== year || selMonth !== month) {
			onChange?.(selYear, selMonth);
		}
	}
</script>

<Popover bind:open>
	<PopoverTrigger>
		{#snippet child({ props })}
			<Button variant="outline" size="sm" class="w-40 justify-start font-normal" {...props}>
				{months[month - 1]}
				{year}
			</Button>
		{/snippet}
	</PopoverTrigger>

	<PopoverContent class="w-72 p-0" align="start">
		<div class="flex">
			<!-- Месяцы -->
			<div class="flex-1 border-r">
				<div class="border-b px-3 py-2 text-center text-xs font-medium text-muted-foreground">
					Месяц
				</div>
				<ScrollArea class="h-64">
					<div class="flex flex-col">
						{#each months as mName, i}
							<button
								class={cn(
									'w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent',
									i + 1 === selMonth && 'bg-accent font-medium text-accent-foreground'
								)}
								onclick={() => selectMonth(i + 1)}
							>
								{mName}
							</button>
						{/each}
					</div>
				</ScrollArea>
			</div>

			<!-- Годы -->
			<div class="flex-1">
				<div class="border-b px-3 py-2 text-center text-xs font-medium text-muted-foreground">
					Год
				</div>
				<ScrollArea class="h-64">
					<div class="flex flex-col">
						{#each years as y}
							<button
								class={cn(
									'w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent',
									y === selYear && 'bg-accent font-medium text-accent-foreground'
								)}
								onclick={() => selectYear(y)}
							>
								{y}
							</button>
						{/each}
					</div>
				</ScrollArea>
			</div>
		</div>
	</PopoverContent>
</Popover>
