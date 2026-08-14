<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	let {
		value = '',
		onSearch = (_v: string) => {},
		placeholder = '',
		options = [] as { value: string; label: string }[]
	} = $props();

	const currentLabel = $derived(options.find((o) => o.value === value)?.label ?? 'Все');
</script>

<Label>
	{placeholder}
	<Select type="single" {value} onValueChange={(v) => onSearch(v ?? '')}>
		<SelectTrigger>
			<span>{currentLabel}</span>
		</SelectTrigger>
		<SelectContent>
			<SelectItem value="">Все</SelectItem>
			{#each options as opt}
				<SelectItem value={opt.value}>
					{opt.label}
				</SelectItem>
			{/each}
		</SelectContent>
	</Select>
</Label>
