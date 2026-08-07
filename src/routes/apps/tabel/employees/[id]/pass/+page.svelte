<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import DatePicker from '$lib/components/DatetimePick/DatePicker.svelte';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';
	import { page } from '$app/state';

	let { data }: { data: PageData } = $props();

	let canEdit = $derived(page.data.canEditEmployee ?? false);

	let assignOpen = $state(false);
	let passId = $state('');
	let dateFrom = $state(new Date().toISOString().split('T')[0]);

	function passLabel(id: string): string {
		const p = data.allPasses.find((x: any) => String(x.id) === id);
		return p ? `${p.seria ? `${p.seria} ` : ''}${p.number}` : 'Выберите пропуск';
	}

	function openAssign() {
		passId = '';
		assignOpen = true;
	}

	async function removePass(id: number) {
		const form = new FormData();
		form.set('id', String(id));
		const res = await fetch('?/removePass', { method: 'POST', body: form });
		if (res.ok) {
			toast.success('Пропуск снят');
		} else {
			const j = await res.json().catch(() => null);
			toast.error(j?.data?.message ?? 'Не удалось снять пропуск');
		}
		await invalidateAll();
	}
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'passLabel'}
		<span class="font-mono">{row.pass.seria ? `${row.pass.seria} ` : ''}{row.pass.number}</span>
	{:else if col.key === 'dateFrom'}
		{row.employeePass.dateFrom ?? '—'}
	{:else if col.key === 'dateTo'}
		{row.employeePass.dateTo ?? 'текущий'}
	{:else}
		{value ?? '—'}
	{/if}
{/snippet}

<div>
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Пропуска ({data.passHistory.length})</h2>
		{#if canEdit}
			<Button onclick={openAssign}>Выдать пропуск</Button>
		{/if}
	</div>

	<DTable
		data={data.passHistory}
		columns={[
			{ key: 'passLabel', label: 'Пропуск' },
			{
				key: 'dateFrom',
				label: 'Выдан',
				mono: true,
				format: (v: string) =>
					new Date(v).toLocaleString('ru-RU', {
						day: '2-digit',
						month: '2-digit',
						year: 'numeric'
					})
			},
			{
				key: 'dateTo',
				label: 'Закрыт',
				mono: true,
				format: (v: string) =>
					new Date(v).toLocaleString('ru-RU', {
						day: '2-digit',
						month: '2-digit',
						year: 'numeric'
					})
			}
		]}
		{cell}
		rowActions={canEdit
			? [{ label: 'Открепить', onclick: (row) => removePass(row.employeePass.id) }]
			: []}
	/>
</div>

<Dialog bind:open={assignOpen}>
	<DialogContent>
		<form
			method="post"
			action="?/assignPass"
			class="flex flex-col gap-4"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'failure') {
						toast.error((result.data as any)?.message ?? 'Не удалось выдать пропуск');
					}
				};
			}}
		>
			<p class="font-medium">Выдать пропуск</p>
			<Select type="single" value={passId} onValueChange={(v) => (passId = v ?? '')}>
				<SelectTrigger class="w-full">
					<span>{passLabel(passId)}</span>
				</SelectTrigger>
				<SelectContent>
					{#each data.allPasses.filter((p: any) => !(data as any).occupiedPassIds?.includes(p.id)) as p}
						<SelectItem value={String(p.id)}>{p.seria ? `${p.seria} ` : ''}{p.number}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
			<input type="hidden" name="passId" value={passId} />
			<DatePicker name="dateFrom" value={dateFrom} onchange={(v) => (dateFrom = v)} />
			<Button type="submit" disabled={!passId}>Выдать</Button>
		</form>
	</DialogContent>
</Dialog>
