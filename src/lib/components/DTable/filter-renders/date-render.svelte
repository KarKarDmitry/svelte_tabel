<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { value = '', onSearch = (_v: string) => {}, placeholder = '' } = $props();

	let timer: any;
	function handleInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		clearTimeout(timer);
		timer = setTimeout(() => onSearch(v), 300);
	}
</script>

<Label>
	{placeholder}
	<Input type="date" {value} oninput={handleInput} class="w-auto" />
</Label>
