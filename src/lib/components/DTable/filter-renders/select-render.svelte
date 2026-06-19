<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	let {
		value = '',
		onSearch = (_v: string) => {},
		placeholder = '',
		options = [] as { value: string; label: string }[]
	} = $props();
</script>

<Label>
	{placeholder}
	<select
		{value}
		onchange={(e) => onSearch((e.target as HTMLSelectElement).value)}
		class="flex h-9 w-auto rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
	>
		<option value="">Все</option>
		{#each options as opt}<option value={opt.value}>{opt.label}</option>{/each}
	</select>
</Label>
