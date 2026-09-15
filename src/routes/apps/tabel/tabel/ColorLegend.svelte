<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';
	import CircleQuestionMarkIcon from '@lucide/svelte/icons/circle-question-mark';
	import PinIcon from '@lucide/svelte/icons/pin';
	import PinOffIcon from '@lucide/svelte/icons/pin-off';
	import type { ColorLegendItem } from '$lib/apps/tabel/utils';

	let { items = [] }: { items?: ColorLegendItem[] } = $props();

	let open = $state(false);
	let pinned = $state(false);

	function pin() {
		open = false;
		pinned = true;
	}
</script>

{#snippet legendList()}
	<div class="flex flex-col gap-1.5">
		{#each items as item (item.key)}
			<div class="flex items-center gap-2 text-xs">
				<span
					class="size-4 shrink-0 rounded border border-muted-foreground/40"
					style="background-color: {item.bg};{item.fg ? ` color: ${item.fg};` : ''}"
				></span>
				<span class={item.bold ? 'font-semibold' : ''} style={item.fg ? `color: ${item.fg}` : ''}
					>{item.label}</span
				>
			</div>
		{/each}
	</div>
{/snippet}

<Popover bind:open>
	<PopoverTrigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				size="icon-sm"
				aria-label="Расцветка табеля"
				title="Расцветка табеля"
			>
				<CircleQuestionMarkIcon class="size-4" />
			</Button>
		{/snippet}
	</PopoverTrigger>
	<PopoverContent class="w-80" align="end">
		<div class="flex items-start justify-between gap-2">
			<p class="text-sm font-medium">Расцветка табеля</p>
			<Button variant="ghost" size="xs" class="-mt-1 -mr-2 gap-1" onclick={pin}>
				<PinIcon class="size-3.5" />
				Pin
			</Button>
		</div>
		{@render legendList()}
	</PopoverContent>
</Popover>

{#if pinned}
	<div
		class="fixed top-4 right-4 z-50 max-h-[80vh] w-72 overflow-auto rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
	>
		<div class="mb-2 flex items-start justify-between gap-2">
			<p class="text-sm font-medium">Расцветка табеля</p>
			<Button
				variant="ghost"
				size="icon-xs"
				class="-mt-1 -mr-1"
				aria-label="Открепить расцветку"
				title="Открепить"
				onclick={() => (pinned = false)}
			>
				<PinOffIcon class="size-3.5" />
			</Button>
		</div>
		{@render legendList()}
	</div>
{/if}
