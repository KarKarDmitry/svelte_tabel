<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import SpecialDaysCalendar from './SpecialDaysCalendar.svelte';
	import { toast } from 'svelte-sonner';

	let rules = $derived($page.data.rules);
	let allSchedules = $derived($page.data.allSchedules);
	let templateId = $derived($page.params.id);
	let canEdit = $derived($page.data.canEdit ?? false);

	let editOpen = $state(false);
	let editRule = $state<any>(null);
	let isCreate = $state(false);
	let deleteTarget = $state<any>(null);
	let deleteOpen = $state(false);

	// Мультивыбор дней для bulk-создания
	let selectedDays = $state<Set<number>>(new Set());
	let calMonth = $state(1);
	let bulkOpen = $state(false);
	let bulkSettings = $state({ autoTransfer: false, preHoliday: false, preScheduleId: '' });

	const months = [
		'Янв',
		'Фев',
		'Мар',
		'Апр',
		'Май',
		'Июн',
		'Июл',
		'Авг',
		'Сен',
		'Окт',
		'Ноя',
		'Дек'
	];

	async function refresh() {
		const res = await fetch(`/apps/tabel/calendar/templates/${templateId}/special_days`);
		if (res.ok) {
			const j = await res.json();
			rules = j.rules;
		}
		selectedDays = new Set();
	}

	function openCreate() {
		isCreate = true;
		editRule = { month: 1, day: 1, autoTransfer: false, preHoliday: false, preScheduleId: '' };
		editOpen = true;
	}

	function openEdit(rule: any) {
		isCreate = false;
		editRule = { ...rule, preScheduleId: rule.preScheduleId ?? '' };
		editOpen = true;
	}

	function openBulk() {
		bulkSettings = { autoTransfer: false, preHoliday: false, preScheduleId: '' };
		bulkOpen = true;
	}

	function confirmDelete(row: any) {
		deleteTarget = row;
		deleteOpen = true;
	}

	async function save() {
		const f = new FormData();
		if (!isCreate) f.set('id', String(editRule.id));
		f.set('month', String(editRule.month));
		f.set('day', String(editRule.day));
		f.set('autoTransfer', editRule.autoTransfer ? 'on' : '');
		f.set('preHoliday', editRule.preHoliday ? 'on' : '');
		if (editRule.preScheduleId) f.set('preScheduleId', String(editRule.preScheduleId));

		const method = isCreate ? 'POST' : 'PATCH';
		const res = await fetch(`/apps/tabel/calendar/templates/${templateId}/special_days`, {
			method,
			body: f
		});
		if (res.ok) {
			editOpen = false;
			await refresh();
		}
	}

	async function saveBulk() {
		const days = [...selectedDays].map((day) => ({ month: calMonth, day }));
		const res = await fetch(
			`/apps/tabel/calendar/templates/${templateId}/special_days?action=bulk`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					days,
					autoTransfer: bulkSettings.autoTransfer,
					preHoliday: bulkSettings.preHoliday,
					preScheduleId: bulkSettings.preScheduleId || null
				})
			}
		);
		if (res.ok) {
			const j = await res.json();
			bulkOpen = false;
			await refresh();
			toast.success(`Добавлено правил: ${j.count ?? days.length}`);
		} else {
			toast.error('Не удалось добавить правила');
		}
	}

	async function doDelete() {
		if (!deleteTarget) return;
		const f = new FormData();
		f.set('id', String(deleteTarget.id));
		const res = await fetch(`/apps/tabel/calendar/templates/${templateId}/special_days`, {
			method: 'DELETE',
			body: f
		});
		deleteOpen = false;
		deleteTarget = null;
		if (res.ok) toast.success('Правило удалено');
		else toast.error('Не удалось удалить правило');
		await refresh();
	}
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'date'}<span class="font-mono"
			>{String(row.month).padStart(2, '0')}.{String(row.day).padStart(2, '0')}</span
		>
	{:else if col.key === 'autoTransfer'}<Badge variant={row.autoTransfer ? 'default' : 'outline'}
			>{row.autoTransfer ? 'Да' : 'Нет'}</Badge
		>
	{:else if col.key === 'preHoliday'}<Badge variant={row.preHoliday ? 'default' : 'outline'}
			>{row.preHoliday ? 'Да' : 'Нет'}</Badge
		>
	{:else if col.key === 'preSchedule'}{row.preScheduleId
			? (allSchedules.find((s: any) => s.id === row.preScheduleId)?.name ?? '—')
			: '—'}
	{:else}{value ?? '—'}
	{/if}
{/snippet}

<div class="flex items-center justify-between">
	<h2 class="text-lg font-semibold">Особые дни ({rules.length})</h2>
	{#if canEdit}
		<Button onclick={openCreate}>+ Добавить один</Button>
	{/if}
</div>

<div class="mt-3 grid gap-4 lg:grid-cols-[320px_1fr]">
	{#if canEdit}
		<!-- Календарь -->
		<div class="flex flex-col gap-2">
			<SpecialDaysCalendar
				{rules}
				bind:selected={selectedDays}
				bind:month={calMonth}
				onRuleClick={(rule) => openEdit(rule)}
			/>
			<Button onclick={openBulk} disabled={selectedDays.size === 0}>
				Добавить выбранные ({selectedDays.size})
			</Button>
		</div>
	{/if}

	<!-- Таблица -->
	<div class="min-w-0">
		<DTable
			data={rules}
			{cell}
			columns={[
				{ key: 'date', label: 'Дата' },
				{ key: 'autoTransfer', label: 'Перенос' },
				{ key: 'preHoliday', label: 'Предпразд.' },
				{ key: 'preSchedule', label: 'График' }
			]}
			rowActions={canEdit
				? [
						{ label: 'Редактировать', onclick: (row) => openEdit(row) },
						{ label: 'Удалить', onclick: (row) => confirmDelete(row) }
					]
				: []}
			onRowClick={canEdit ? (row) => openEdit(row) : undefined}
		/>
	</div>
</div>

<!-- Диалог единичного создания/редактирования -->
<Dialog bind:open={editOpen}>
	<DialogContent>
		<div class="flex flex-col gap-4">
			<p class="font-medium">{isCreate ? 'Новое' : 'Редактировать'} правило</p>

			<div class="grid grid-cols-2 gap-2">
				<Select
					type="single"
					value={String(editRule?.month ?? 1)}
					onValueChange={(v) => (editRule = { ...editRule, month: Number(v ?? 1) })}
				>
					<SelectTrigger class="w-full">
						<span>{months[(editRule?.month ?? 1) - 1]}</span>
					</SelectTrigger>
					<SelectContent>
						{#each months as m, i}<SelectItem value={String(i + 1)}>{m}</SelectItem>{/each}
					</SelectContent>
				</Select>
				<Input
					name="day"
					type="number"
					min="1"
					max="31"
					value={editRule?.day}
					oninput={(e) =>
						(editRule = { ...editRule, day: Number((e.target as HTMLInputElement).value) })}
					required
				/>
			</div>

			<Label class="flex-row items-center gap-2">
				<Checkbox
					checked={editRule?.autoTransfer}
					onCheckedChange={(c) => (editRule = { ...editRule, autoTransfer: c === true })}
				/>
				Переносить при выпадении на выходной
			</Label>

			<Label class="flex-row items-center gap-2">
				<Checkbox
					checked={editRule?.preHoliday}
					onCheckedChange={(c) => (editRule = { ...editRule, preHoliday: c === true })}
				/>
				Предпраздничный день
			</Label>

			{#if editRule?.preHoliday}
				<Select
					type="single"
					value={String(editRule?.preScheduleId ?? '')}
					onValueChange={(v) => (editRule = { ...editRule, preScheduleId: v ?? '' })}
				>
					<SelectTrigger class="w-full">
						<span
							>{allSchedules.find(
								(s: any) => String(s.id) === String(editRule?.preScheduleId ?? '')
							)?.name ?? 'Выберите график'}</span
						>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">Выберите график</SelectItem>
						{#each allSchedules as s}<SelectItem value={String(s.id)}>{s.name}</SelectItem>{/each}
					</SelectContent>
				</Select>
			{/if}

			<Button onclick={save}>{isCreate ? 'Создать' : 'Сохранить'}</Button>
		</div>
	</DialogContent>
</Dialog>

<!-- Диалог bulk-создания -->
<Dialog bind:open={bulkOpen}>
	<DialogContent>
		<div class="flex flex-col gap-4">
			<p class="font-medium">
				Добавить {selectedDays.size} дн. ({calMonth} месяц)
			</p>

			<Label class="flex-row items-center gap-2">
				<Checkbox
					checked={bulkSettings.autoTransfer}
					onCheckedChange={(c) => (bulkSettings = { ...bulkSettings, autoTransfer: c === true })}
				/>
				Переносить при выпадении на выходной
			</Label>

			<Label class="flex-row items-center gap-2">
				<Checkbox
					checked={bulkSettings.preHoliday}
					onCheckedChange={(c) => (bulkSettings = { ...bulkSettings, preHoliday: c === true })}
				/>
				Предпраздничный день
			</Label>

			{#if bulkSettings.preHoliday}
				<Select
					type="single"
					value={bulkSettings.preScheduleId}
					onValueChange={(v) => (bulkSettings = { ...bulkSettings, preScheduleId: v ?? '' })}
				>
					<SelectTrigger class="w-full">
						<span
							>{allSchedules.find((s: any) => String(s.id) === bulkSettings.preScheduleId)?.name ??
								'Выберите график'}</span
						>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">Выберите график</SelectItem>
						{#each allSchedules as s}<SelectItem value={String(s.id)}>{s.name}</SelectItem>{/each}
					</SelectContent>
				</Select>
			{/if}

			<Button onclick={saveBulk}>Создать</Button>
		</div>
	</DialogContent>
</Dialog>

<Dialog bind:open={deleteOpen}>
	<DialogContent>
		<p class="font-bold">Удалить правило?</p>
		<p class="text-sm text-gray-500">
			Вы уверены, что хотите удалить правило на {String(deleteTarget?.month).padStart(
				2,
				'0'
			)}.{String(deleteTarget?.day).padStart(2, '0')}?
		</p>
		<div class="flex justify-end gap-2">
			<Button variant="outline" onclick={() => (deleteOpen = false)}>Отмена</Button>
			<Button variant="destructive" onclick={doDelete}>Удалить</Button>
		</div>
	</DialogContent>
</Dialog>
