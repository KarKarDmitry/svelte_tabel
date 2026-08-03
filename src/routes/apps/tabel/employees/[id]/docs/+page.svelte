<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { toast } from 'svelte-sonner';

	let isDismissed = $derived($page.data.isDismissed);
	let lastDoc = $derived($page.data.lastDoc);
	let docs = $derived($page.data.documents);
	let departments = $derived($page.data.departments);
	let positions = $derived($page.data.positions);

	const typeLabels: Record<string, string> = {
		hiring: 'Приём',
		transfer: 'Перевод',
		dismissal: 'Увольнение'
	};

	let transferOpen = $state(false);
	let dismissOpen = $state(false);
	const today = new Date().toISOString().split('T')[0];

	let transferDate = $state(today);
	let transferDept = $state('');
	let transferPos = $state('');
	let dismissDate = $state(today);

	function openTransfer() {
		transferDate = today;
		transferDept = String(departments[0]?.id ?? '');
		transferPos = String(positions[0]?.id ?? '');
		transferOpen = true;
	}

	async function doTransfer() {
		const f = new FormData();
		f.set('date', transferDate);
		f.set('departmentId', String(transferDept));
		f.set('positionId', String(transferPos));
		const res = await fetch('?/transfer', { method: 'POST', body: f });
		if (res.ok) {
			transferOpen = false;
			await invalidateAll();
			toast.success('Сотрудник переведён');
		} else {
			toast.error('Не удалось перевести сотрудника');
		}
	}

	async function doDismiss() {
		const f = new FormData();
		f.set('date', dismissDate);
		const res = await fetch('?/dismiss', { method: 'POST', body: f });
		if (res.ok) {
			dismissOpen = false;
			await invalidateAll();
			toast.success('Сотрудник уволен');
		} else {
			toast.error('Не удалось уволить сотрудника');
		}
	}

	async function cancelDoc(doc: any) {
		if (!confirm(`Отменить документ "${typeLabels[doc.type] || doc.type}" от ${doc.date}?`)) return;
		const form = new FormData();
		form.set('id', String(doc.id));
		await fetch('?/cancelDoc', { method: 'POST', body: form });
		await invalidateAll();
		toast.success('Документ отменён');
	}
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'type'}
		<Badge variant={row.type === 'dismissal' ? 'destructive' : 'default'}>
			{typeLabels[row.type] || row.type}
		</Badge>
	{:else if col.key === 'departmentName'}
		{departments.find((d: any) => d.id === row.departmentId)?.name ?? '—'}
	{:else if col.key === 'positionName'}
		{positions.find((p: any) => p.id === row.positionId)?.name ?? '—'}
	{:else if col.format}
		{col.format(value, row)}
	{:else}
		{value ?? '—'}
	{/if}
{/snippet}

<div class="space-y-4">
	{#if lastDoc && !isDismissed}
		<div class="flex gap-2">
			<Dialog bind:open={transferOpen}>
				<DialogContent>
					<div class="flex flex-col gap-4">
						<p class="font-medium">Перевод сотрудника</p>
						<Input type="date" bind:value={transferDate} required />
						<select
							bind:value={transferDept}
							required
							class="rounded-md border border-input px-3 py-2 text-sm"
						>
							{#each departments as d}
								<option value={d.id}>{d.name}</option>
							{/each}
						</select>
						<select
							bind:value={transferPos}
							required
							class="rounded-md border border-input px-3 py-2 text-sm"
						>
							{#each positions as p}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
						<Button onclick={doTransfer}>Сохранить</Button>
					</div>
				</DialogContent>
			</Dialog>
			<Button onclick={openTransfer} variant="outline">Перевести</Button>

			<Dialog bind:open={dismissOpen}>
				<DialogContent>
					<div class="flex flex-col gap-4">
						<p class="mb-4 font-medium">Подтвердите увольнение</p>
						<Input type="date" bind:value={dismissDate} required />
						<Button variant="destructive" onclick={doDismiss}>Подтвердить увольнение</Button>
					</div>
				</DialogContent>
			</Dialog>
			<Button onclick={() => (dismissOpen = true)} variant="destructive">Уволить</Button>
		</div>
	{/if}

	<DTable
		data={docs}
		columns={[
			{ key: 'date', label: 'Дата' },
			{ key: 'type', label: 'Тип' },
			{ key: 'docNumber', label: 'Номер приказа', mono: true },
			{ key: 'departmentName', label: 'Подразделение' },
			{ key: 'positionName', label: 'Должность' }
		]}
		{cell}
		rowActions={[{ label: 'Отменить', onclick: (row) => cancelDoc(row) }]}
	/>
</div>
