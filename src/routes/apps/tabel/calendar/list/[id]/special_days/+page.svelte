<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';

	let days = $derived($page.data.days);
	let cal = $derived($page.data.calendar);
	let schedules = $derived($page.data.allSchedules);

	let editDay = $state<any>(null);
	let editOpen = $state(false);

	function defaultWorkTime(type: string): string {
		if (type === 'workday') return '08:00';
		if (type === 'weekend' || type === 'holiday' || type === 'transferred_holiday') return '00:00';
		return '08:00';
	}

	$effect(() => {
		if (editDay && editDay.dayType === 'preholiday' && editDay.preScheduleId) {
			const s = schedules.find((s: any) => String(s.id) === String(editDay.preScheduleId));
			if (s) {
				const h = Math.floor(s.standardWorkTime / 60);
				const m = s.standardWorkTime % 60;
				editDay.workTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
			}
		}
	});

	const dayTypeLabels: Record<string, string> = {
		holiday: 'Праздник',
		preholiday: 'Сокращённый',
		transferred_workday: 'Перенос (рабочий)',
		transferred_holiday: 'Перенос (выходной)'
	};

	const dayTypeColors: Record<string, string> = {
		holiday: 'bg-red-100 text-red-800',
		preholiday: 'bg-yellow-100 text-yellow-800',
		transferred_workday: 'bg-blue-100 text-blue-800',
		transferred_holiday: 'bg-purple-100 text-purple-800'
	};

	const allDayTypeLabels: Record<string, string> = {
		workday: 'Рабочий',
		weekend: 'Выходной',
		holiday: 'Праздник',
		preholiday: 'Сокращённый',
		transferred_workday: 'Перенос (раб)',
		transferred_holiday: 'Перенос (вых)'
	};

	const specialDays = $derived(
		days.filter((d: any) => d.dayType !== 'workday' && d.dayType !== 'weekend')
	);

	function openEdit(day: any) {
		editDay = {
			...day,
			workTimeStr: defaultWorkTime(day.dayType),
			preScheduleId: day.scheduleId ?? '',
			autoTransfer: day.dayType === 'holiday' ? true : false,
			preHoliday: day.dayType === 'holiday' ? true : false
		};
		editOpen = true;
	}

	function onTypeChange(type: string) {
		editDay = {
			...editDay,
			dayType: type,
			workTimeStr: defaultWorkTime(type),
			autoTransfer: type === 'holiday' ? true : false,
			preHoliday: type === 'holiday' ? true : false
		};
	}

	async function saveDay() {
		const f = new FormData();
		f.set('date', editDay.date);
		f.set('dayType', editDay.dayType);
		if (editDay.workTimeStr) {
			const [h, m] = editDay.workTimeStr.split(':').map(Number);
			f.set('workTime', String(h * 60 + (m || 0)));
		}
		if (editDay.transferFrom) f.set('transferFrom', editDay.transferFrom);
		if (editDay.dayType === 'holiday' || editDay.dayType === 'preholiday') {
			if (editDay.preScheduleId) f.set('scheduleId', String(editDay.preScheduleId));
		}
		if (editDay.dayType === 'holiday') {
			f.set('autoTransfer', editDay.autoTransfer ? 'on' : '');
			f.set('preHoliday', editDay.preHoliday ? 'on' : '');
			if (editDay.preScheduleId) f.set('preScheduleId', String(editDay.preScheduleId));
		}
		const res = await fetch(`/apps/tabel/calendar/list/${cal.id}/days`, {
			method: 'PATCH',
			body: f
		});
		if (res.ok) {
			const r2 = await fetch(`/apps/tabel/calendar/list/${cal.id}/days`);
			if (r2.ok) {
				const j2 = await r2.json();
				if (j2.days) days = j2.days;
			}
			editOpen = false;
		}
	}
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'date'}{row.date}
	{:else if col.key === 'dayType'}
		<span
			class="inline-block rounded px-2 py-0.5 text-xs font-medium {dayTypeColors[row.dayType] ||
				''}">{dayTypeLabels[row.dayType] || row.dayType}</span
		>
	{:else if col.key === 'hours'}{row.workTime !== null
			? `${Math.floor(row.workTime / 60)}ч ${row.workTime % 60}м`
			: '—'}
	{:else if col.key === 'transferFrom'}{row.transferFrom ?? '—'}
	{:else}{value ?? '—'}
	{/if}
{/snippet}

<DTable
	data={specialDays}
	columns={[
		{ key: 'date', label: 'Дата' },
		{ key: 'dayType', label: 'Тип' },
		{ key: 'hours', label: 'Часов' },
		{ key: 'transferFrom', label: 'Перенос с' }
	]}
	{cell}
	rowActions={[{ label: 'Редактировать', onclick: (row) => openEdit(row) }]}
	onRowClick={(row) => openEdit(row)}
/>

<Dialog bind:open={editOpen}>
	<DialogContent>
		<div class="flex flex-col gap-4">
			<p class="font-medium">{editDay?.date} — {allDayTypeLabels[editDay?.dayType] || ''}</p>

			<div class="flex flex-col gap-1">
				<label for="dayType" class="text-sm font-medium">Тип дня</label>
				<select
					id="dayType"
					value={editDay?.dayType}
					onchange={(e) => onTypeChange((e.target as HTMLSelectElement).value)}
					class="rounded-md border border-input px-3 py-2 text-sm"
				>
					{#each Object.entries(allDayTypeLabels) as [key, label]}<option value={key}
							>{label}</option
						>{/each}
				</select>
			</div>

			<div class="flex flex-col gap-1">
				<label for="workTimeStr" class="text-sm font-medium">Норма времени</label>
				<Input
					id="workTimeStr"
					type="time"
					value={editDay?.workTimeStr ?? '08:00'}
					oninput={(e) =>
						(editDay = { ...editDay, workTimeStr: (e.target as HTMLInputElement).value })}
				/>
			</div>

			{#if editDay?.dayType === 'preholiday'}
				<div class="flex flex-col gap-1">
					<label for="preScheduleId" class="text-sm font-medium">График</label>
					<select
						id="preScheduleId"
						bind:value={editDay.preScheduleId}
						class="rounded-md border border-input px-3 py-2 text-sm"
					>
						<option value="">Выберите график</option>
						{#each schedules as s}<option value={s.id}>{s.name}</option>{/each}
					</select>
				</div>
			{/if}

			{#if editDay?.dayType === 'holiday'}
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={editDay?.autoTransfer ?? true}
						onchange={(e) =>
							(editDay = { ...editDay, autoTransfer: (e.target as HTMLInputElement).checked })}
					/>
					Переносить при выпадении на выходной
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={editDay?.preHoliday ?? true}
						onchange={(e) =>
							(editDay = { ...editDay, preHoliday: (e.target as HTMLInputElement).checked })}
					/>
					Предпраздничный день
				</label>
				{#if editDay?.preHoliday}
					<select
						bind:value={editDay.preScheduleId}
						class="rounded-md border border-input px-3 py-2 text-sm"
					>
						<option value="">Выберите график</option>
						{#each schedules as s}<option value={s.id}>{s.name}</option>{/each}
					</select>
				{/if}
			{/if}

			{#if editDay?.dayType === 'transferred_workday'}
				<div class="flex flex-col gap-1">
					<label for="transferFrom" class="text-sm font-medium">Перенос с</label>
					<Input
						id="transferFrom"
						type="date"
						value={editDay?.transferFrom ?? ''}
						oninput={(e) =>
							(editDay = { ...editDay, transferFrom: (e.target as HTMLInputElement).value })}
					/>
				</div>
			{/if}

			<Button onclick={saveDay}>Сохранить</Button>
		</div>
	</DialogContent>
</Dialog>
