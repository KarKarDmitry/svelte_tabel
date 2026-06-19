<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let {
		value = '',
		onSearch = (_v: string) => {},
		placeholder = '',
		refs = [] as { name: string }[],
		listId = ''
	} = $props();

	let timer: any;
	function handleInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		clearTimeout(timer);
		timer = setTimeout(() => onSearch(v), 300);
	}
</script>

<Label>
	{placeholder}
	<Input {value} oninput={handleInput} list={listId} placeholder="Введите текст" class="w-auto" />
	{#if refs.length > 0}
		<datalist id={listId}>
			{#each refs as r}<option value={r.name}></option>{/each}
		</datalist>
	{/if}
</Label>
