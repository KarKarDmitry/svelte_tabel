<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import SpecialDaysCalendar from './SpecialDaysCalendar.svelte';
	import { toast } from 'svelte-sonner';

	let rules = $derived($page.data.rules);
	let allSchedules = $derived($page.data.allSchedules);
	let templateId = $derived($page.params.id);

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
	<Button onclick={openCreate}>+ Добавить один</Button>
</div>

<div class="mt-3 grid gap-4 lg:grid-cols-[320px_1fr]">
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
			rowActions={[
				{ label: 'Редактировать', onclick: (row) => openEdit(row) },
				{ label: 'Удалить', onclick: (row) => confirmDelete(row) }
			]}
			onRowClick={(row) => openEdit(row)}
		/>
	</div>
</div>

<!-- Диалог единичного создания/редактирования -->
<Dialog bind:open={editOpen}>
	<DialogContent>
		<div class="flex flex-col gap-4">
			<p class="font-medium">{isCreate ? 'Новое' : 'Редактировать'} правило</p>

			<div class="grid grid-cols-2 gap-2">
				<select
					name="month"
					value={editRule?.month}
					onchange={(e) =>
						(editRule = { ...editRule, month: Number((e.target as HTMLSelectElement).value) })}
					class="rounded-md border border-input px-3 py-2 text-sm"
				>
					{#each months as m, i}<option value={i + 1}>{m}</option>{/each}
				</select>
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

			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={editRule?.autoTransfer}
					onchange={(e) =>
						(editRule = { ...editRule, autoTransfer: (e.target as HTMLInputElement).checked })}
				/>
				Переносить при выпадении на выходной
			</label>

			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={editRule?.preHoliday}
					onchange={(e) =>
						(editRule = { ...editRule, preHoliday: (e.target as HTMLInputElement).checked })}
				/>
				Предпраздничный день
			</label>

			{#if editRule?.preHoliday}
				<select
					value={editRule?.preScheduleId ?? ''}
					onchange={(e) =>
						(editRule = { ...editRule, preScheduleId: (e.target as HTMLSelectElement).value })}
					class="rounded-md border border-input px-3 py-2 text-sm"
				>
					<option value="">Выберите график</option>
					{#each allSchedules as s}<option value={s.id}>{s.name}</option>{/each}
				</select>
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

			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={bulkSettings.autoTransfer}
					onchange={(e) =>
						(bulkSettings = {
							...bulkSettings,
							autoTransfer: (e.target as HTMLInputElement).checked
						})}
				/>
				Переносить при выпадении на выходной
			</label>

			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={bulkSettings.preHoliday}
					onchange={(e) =>
						(bulkSettings = {
							...bulkSettings,
							preHoliday: (e.target as HTMLInputElement).checked
						})}
				/>
				Предпраздничный день
			</label>

			{#if bulkSettings.preHoliday}
				<select
					value={bulkSettings.preScheduleId}
					onchange={(e) =>
						(bulkSettings = {
							...bulkSettings,
							preScheduleId: (e.target as HTMLSelectElement).value
						})}
					class="rounded-md border border-input px-3 py-2 text-sm"
				>
					<option value="">Выберите график</option>
					{#each allSchedules as s}<option value={s.id}>{s.name}</option>{/each}
				</select>
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
