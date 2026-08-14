<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import DatePicker from '$lib/components/DatetimePick/DatePicker.svelte';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';
	import * as Item from '$lib/components/ui/item';
	import { Info } from '@lucide/svelte';
	import { page } from '$app/state';

	let { data }: { data: PageData } = $props();

	let canEdit = $derived(page.data.canEditEmployee ?? false);

	let assignOpen = $state(false);
	let scheduleId = $state('');
	let dateFrom = $state(new Date().toISOString().split('T')[0]);

	let editOpen = $state(false);
	let editId = $state<number | null>(null);
	let editScheduleId = $state('');
	let editDateFrom = $state('');
	let editDateTo = $state('');

	/** Активные назначения — в основном списке */
	const activeHistory = $derived(
		data.scheduleHistory.filter((r: any) => r.employeeSchedule.dateTo == null)
	);
	/** Откреплённые (закрытый период) — в Collapsible внизу */
	const detachedHistory = $derived(
		data.scheduleHistory.filter((r: any) => r.employeeSchedule.dateTo != null)
	);

	function scheduleLabel(id: string): string {
		return data.allSchedules.find((s: any) => String(s.id) === id)?.name ?? 'Выберите график';
	}

	function openAssign() {
		scheduleId = '';
		assignOpen = true;
	}

	function openEdit(row: any) {
		editId = row.employeeSchedule.id;
		editScheduleId = String(row.employeeSchedule.scheduleId);
		editDateFrom = row.employeeSchedule.dateFrom ?? new Date().toISOString().split('T')[0];
		editDateTo = row.employeeSchedule.dateTo ?? '';
		editOpen = true;
	}

	async function removeSchedule(id: number) {
		const form = new FormData();
		form.set('id', String(id));
		const res = await fetch('?/removeSchedule', { method: 'POST', body: form });
		if (res.ok) {
			toast.success('График откреплён');
		} else {
			const j = await res.json().catch(() => null);
			toast.error(j?.data?.message ?? 'Не удалось открепить график');
		}
		await invalidateAll();
	}

	async function deleteScheduleRecord(id: number) {
		if (!confirm('Удалить запись о назначении? Это действие необратимо.')) return;
		const form = new FormData();
		form.set('id', String(id));
		const res = await fetch('?/deleteScheduleRecord', { method: 'POST', body: form });
		if (res.ok) {
			toast.success('Запись удалена');
		} else {
			const j = await res.json().catch(() => null);
			toast.error(j?.data?.message ?? 'Не удалось удалить запись');
		}
		await invalidateAll();
	}
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'hours'}
		{Math.floor(row.schedule.standardWorkTime / 60)}ч
	{:else if col.key === 'name'}
		{row.schedule.name}
	{:else if col.key === 'dateFrom'}
		{row.employeeSchedule.dateFrom
			? new Date(row.employeeSchedule.dateFrom).toLocaleDateString('ru-RU')
			: '—'}
	{:else if col.key === 'dateTo'}
		{row.employeeSchedule.dateTo
			? new Date(row.employeeSchedule.dateTo).toLocaleDateString('ru-RU')
			: '—'}
	{:else}
		{value ?? '—'}
	{/if}
{/snippet}

<div>
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Графики ({activeHistory.length})</h2>
		{#if canEdit}
			<Button onclick={openAssign}>Назначить график</Button>
		{/if}
	</div>

	<DTable
		data={activeHistory}
		columns={[
			{ key: 'name', label: 'График' },
			{ key: 'hours', label: 'Норма' },
			{ key: 'dateFrom', label: 'С' }
		]}
		{cell}
		rowActions={canEdit
			? [
					{ label: 'Изменить', onclick: (row) => openEdit(row) },
					{ label: 'Открепить', onclick: (row) => removeSchedule(row.employeeSchedule.id) }
				]
			: []}
	/>

	{#if detachedHistory.length > 0}
		<Collapsible class="mt-4 rounded-xl border-2">
			<CollapsibleTrigger
				class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
			>
				<span>Откреплённые графики ({detachedHistory.length})</span>
				<ChevronDownIcon class="size-4" />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div class="p-2">
					<DTable
						data={detachedHistory}
						columns={[
							{ key: 'name', label: 'График' },
							{ key: 'hours', label: 'Норма' },
							{ key: 'dateFrom', label: 'С' },
							{ key: 'dateTo', label: 'По' }
						]}
						{cell}
						rowActions={canEdit
							? [
									{
										label: 'Изменить',
										onclick: (row) => openEdit(row)
									},
									{
										label: 'Удалить',
										onclick: (row) => deleteScheduleRecord(row.employeeSchedule.id)
									}
								]
							: []}
					/>
				</div>
			</CollapsibleContent>
		</Collapsible>
	{/if}

	<Item.Root
		variant="outline"
		class="mt-4 w-fit border-2 border-amber-500 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-900/20"
	>
		<Item.Media variant="icon">
			<Info class="size-5 text-amber-500 dark:text-amber-400" />
		</Item.Media>
		<Item.Content>
			<Item.Title class="text-amber-800 dark:text-amber-300">Рекомендация</Item.Title>
			<Item.Description>
				Назначайте один график сотруднику, чтобы избежать конфликтов при расчёте табеля и расцветке
				ячеек
			</Item.Description>
		</Item.Content>
	</Item.Root>
</div>

<Dialog bind:open={assignOpen}>
	<DialogContent>
		<form
			method="post"
			action="?/assignSchedule"
			class="flex flex-col gap-4"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						assignOpen = false;
						toast.success('График назначен');
						await invalidateAll();
					} else if (result.type === 'failure') {
						toast.error((result.data as any)?.message ?? 'Не удалось назначить график');
					}
				};
			}}
		>
			<p class="font-medium">Назначить график</p>
			<div class="flex flex-col gap-1">
				<Label>График</Label>
				<Select type="single" value={scheduleId} onValueChange={(v) => (scheduleId = v ?? '')}>
					<SelectTrigger class="w-full">
						<span>{scheduleLabel(scheduleId)}</span>
					</SelectTrigger>
					<SelectContent>
						{#each data.allSchedules as s}
							<SelectItem value={String(s.id)}>{s.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
				<input type="hidden" name="scheduleId" value={scheduleId} />
			</div>
			<div class="flex flex-col gap-1">
				<Label>Дата начала</Label>
				<DatePicker name="dateFrom" value={dateFrom} onchange={(v) => (dateFrom = v)} />
			</div>
			<Button type="submit" disabled={!scheduleId}>Назначить</Button>
		</form>
	</DialogContent>
</Dialog>

<Dialog bind:open={editOpen}>
	<DialogContent>
		<form
			method="post"
			action="?/updateSchedule"
			class="flex flex-col gap-4"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						editOpen = false;
						toast.success('Назначение обновлено');
						await invalidateAll();
					} else if (result.type === 'failure') {
						toast.error((result.data as any)?.message ?? 'Не удалось обновить назначение');
					}
				};
			}}
		>
			<p class="font-medium">Изменить назначение графика</p>
			<div class="flex flex-col gap-1">
				<Label>График</Label>
				<Select
					type="single"
					value={editScheduleId}
					onValueChange={(v) => (editScheduleId = v ?? '')}
				>
					<SelectTrigger class="w-full">
						<span>{scheduleLabel(editScheduleId)}</span>
					</SelectTrigger>
					<SelectContent>
						{#each data.allSchedules as s}
							<SelectItem value={String(s.id)}>{s.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
				<input type="hidden" name="id" value={editId ?? ''} />
				<input type="hidden" name="scheduleId" value={editScheduleId} />
			</div>
			<div class="flex flex-col gap-1">
				<Label>Дата начала</Label>
				<DatePicker name="dateFrom" value={editDateFrom} onchange={(v) => (editDateFrom = v)} />
			</div>
			<div class="flex flex-col gap-1">
				<Label>Дата окончания</Label>
				<div class="flex items-center gap-2">
					<div class="flex-1">
						<DatePicker name="dateTo" value={editDateTo} onchange={(v) => (editDateTo = v)} />
					</div>
					{#if editDateTo}
						<Button type="button" variant="outline" size="sm" onclick={() => (editDateTo = '')}>
							Очистить
						</Button>
					{/if}
				</div>
				<p class="text-xs text-muted-foreground">Пусто — график действует бессрочно</p>
			</div>
			<Button type="submit" disabled={!editScheduleId}>Сохранить</Button>
		</form>
	</DialogContent>
</Dialog>
