<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DatePicker from '$lib/components/DatetimePick/DatePicker.svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { toast } from 'svelte-sonner';

	let isDismissed = $derived($page.data.isDismissed);
	let lastDoc = $derived($page.data.lastDoc);
	let docs = $derived($page.data.documents);
	let departments = $derived($page.data.departments);
	let allDepartments = $derived($page.data.allDepartments ?? $page.data.departments);
	let positions = $derived($page.data.positions);
	let canEdit = $derived($page.data.canEditEmployee ?? false);

	const typeLabels: Record<string, string> = {
		hiring: 'Приём',
		transfer: 'Перевод',
		dismissal: 'Увольнение'
	};

	let transferOpen = $state(false);
	let dismissOpen = $state(false);
	let rehireOpen = $state(false);
	const today = new Date().toISOString().split('T')[0];

	let transferDate = $state(today);
	let transferDept = $state('');
	let transferPos = $state('');
	let dismissDate = $state(today);
	let rehireDate = $state(today);
	let rehireDept = $state('');
	let rehirePos = $state('');

	function openRehire() {
		rehireDate = today;
		rehireDept = String(departments[0]?.id ?? '');
		rehirePos = String(positions[0]?.id ?? '');
		rehireOpen = true;
	}

	async function doRehire() {
		const f = new FormData();
		f.set('date', rehireDate);
		f.set('departmentId', String(rehireDept));
		f.set('positionId', String(rehirePos));
		const res = await fetch('?/rehire', { method: 'POST', body: f });
		if (res.ok) {
			rehireOpen = false;
			await invalidateAll();
			toast.success('Сотрудник принят повторно');
		} else {
			const j = await res.json().catch(() => null);
			toast.error(j?.data?.message ?? 'Не удалось оформить повторный приём');
		}
	}

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
			const j = await res.json().catch(() => null);
			toast.error(j?.data?.message ?? 'Не удалось перевести сотрудника');
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
			const j = await res.json().catch(() => null);
			toast.error(j?.data?.message ?? 'Не удалось уволить сотрудника');
		}
	}

	async function cancelDoc(doc: any) {
		if (!confirm(`Отменить документ "${typeLabels[doc.type] || doc.type}" от ${doc.date}?`)) return;
		const form = new FormData();
		form.set('id', String(doc.id));
		const res = await fetch('?/cancelDoc', { method: 'POST', body: form });
		if (res.ok) {
			toast.success('Документ отменён');
		} else {
			const j = await res.json().catch(() => null);
			toast.error(j?.data?.message ?? 'Не удалось отменить документ');
		}
		await invalidateAll();
	}
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'type'}
		<Badge variant={row.type === 'dismissal' ? 'destructive' : 'default'}>
			{typeLabels[row.type] || row.type}
		</Badge>
	{:else if col.key === 'departmentName'}
		{allDepartments.find((d: any) => d.id === row.departmentId)?.name ?? '—'}
	{:else if col.key === 'positionName'}
		{positions.find((p: any) => p.id === row.positionId)?.name ?? '—'}
	{:else if col.format}
		{col.format(value, row)}
	{:else}
		{value ?? '—'}
	{/if}
{/snippet}

<div class="space-y-4">
	{#if lastDoc && !isDismissed && canEdit}
		<div class="flex gap-2">
			<Dialog bind:open={transferOpen}>
				<DialogContent>
					<div class="flex flex-col gap-4">
						<p class="font-medium">Перевод сотрудника</p>
						<DatePicker value={transferDate} onchange={(v) => (transferDate = v)} />
						<Select type="single" bind:value={transferDept}>
							<SelectTrigger class="w-full">
								<span
									>{departments.find((d: any) => String(d.id) === transferDept)?.name ??
										'Выберите подразделение'}</span
								>
							</SelectTrigger>
							<SelectContent>
								{#each departments as d}<SelectItem value={String(d.id)}>{d.name}</SelectItem
									>{/each}
							</SelectContent>
						</Select>
						<Select type="single" bind:value={transferPos}>
							<SelectTrigger class="w-full">
								<span
									>{positions.find((p: any) => String(p.id) === transferPos)?.name ??
										'Выберите должность'}</span
								>
							</SelectTrigger>
							<SelectContent>
								{#each positions as p}<SelectItem value={String(p.id)}>{p.name}</SelectItem>{/each}
							</SelectContent>
						</Select>
						<Button onclick={doTransfer}>Сохранить</Button>
					</div>
				</DialogContent>
			</Dialog>
			<Button onclick={openTransfer} variant="outline">Перевести</Button>

			<Dialog bind:open={dismissOpen}>
				<DialogContent>
					<div class="flex flex-col gap-4">
						<p class="mb-1 font-medium">Подтвердите увольнение</p>
						<p class="mb-1 text-sm text-muted-foreground">
							При увольнении сотрудника с него будут сняты текущие графики и пропуска.
						</p>
						<DatePicker value={dismissDate} onchange={(v) => (dismissDate = v)} />
						<Button variant="destructive" onclick={doDismiss}>Далее</Button>
					</div>
				</DialogContent>
			</Dialog>
			<Button onclick={() => (dismissOpen = true)} variant="destructive">Уволить</Button>
		</div>
	{/if}

	{#if isDismissed && canEdit}
		<div class="flex gap-2">
			<Dialog bind:open={rehireOpen}>
				<DialogContent>
					<div class="flex flex-col gap-4">
						<p class="font-medium">Повторный приём</p>
						<DatePicker value={rehireDate} onchange={(v) => (rehireDate = v)} />
						<Select type="single" bind:value={rehireDept}>
							<SelectTrigger class="w-full">
								<span
									>{departments.find((d: any) => String(d.id) === rehireDept)?.name ??
										'Выберите подразделение'}</span
								>
							</SelectTrigger>
							<SelectContent>
								{#each departments as d}<SelectItem value={String(d.id)}>{d.name}</SelectItem
									>{/each}
							</SelectContent>
						</Select>
						<Select type="single" bind:value={rehirePos}>
							<SelectTrigger class="w-full">
								<span
									>{positions.find((p: any) => String(p.id) === rehirePos)?.name ??
										'Выберите должность'}</span
								>
							</SelectTrigger>
							<SelectContent>
								{#each positions as p}<SelectItem value={String(p.id)}>{p.name}</SelectItem>{/each}
							</SelectContent>
						</Select>
						<Button onclick={doRehire}>Принять повторно</Button>
					</div>
				</DialogContent>
			</Dialog>
			<Button onclick={openRehire}>Принять повторно</Button>
		</div>
	{/if}

	<DTable
		data={docs}
		columns={[
			{
				key: 'date',
				label: 'Дата',
				mono: true,
				format: (v: string) =>
					new Date(v).toLocaleString('ru-RU', {
						day: '2-digit',
						month: '2-digit',
						year: 'numeric'
					})
			},
			{ key: 'type', label: 'Тип' },
			{ key: 'docNumber', label: 'Номер приказа', mono: true },
			{ key: 'departmentName', label: 'Подразделение' },
			{ key: 'positionName', label: 'Должность' }
		]}
		{cell}
		rowActions={canEdit ? [{ label: 'Отменить', onclick: (row) => cancelDoc(row) }] : []}
	/>
</div>
