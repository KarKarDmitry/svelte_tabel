<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import TimeInput from '$lib/components/DatetimePick/TimeInput.svelte';
	import DatePicker from '$lib/components/DatetimePick/DatePicker.svelte';
	import DTable from '$lib/components/DTable/DTable.svelte';

	let days = $derived($page.data.days);
	let cal = $derived($page.data.calendar);
	let schedules = $derived($page.data.allSchedules);
	let canEdit = $derived($page.data.canEdit ?? false);

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
		holiday: 'bg-destructive/15 text-destructive',
		preholiday: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
		transferred_workday: 'bg-blue-100 text-primary dark:bg-blue-900/30 dark:text-blue-300',
		transferred_holiday: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
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
	rowActions={canEdit ? [{ label: 'Редактировать', onclick: (row) => openEdit(row) }] : []}
	onRowClick={canEdit ? (row) => openEdit(row) : undefined}
/>

{#snippet scheduleSelect()}
	<Select
		type="single"
		value={String(editDay?.preScheduleId ?? '')}
		onValueChange={(v) => (editDay = { ...editDay, preScheduleId: v ?? '' })}
	>
		<SelectTrigger class="w-full">
			<span
				>{schedules.find((s: any) => String(s.id) === String(editDay?.preScheduleId ?? ''))?.name ??
					'Выберите график'}</span
			>
		</SelectTrigger>
		<SelectContent>
			<SelectItem value="">Выберите график</SelectItem>
			{#each schedules as s}<SelectItem value={String(s.id)}>{s.name}</SelectItem>{/each}
		</SelectContent>
	</Select>
{/snippet}

<Dialog bind:open={editOpen}>
	<DialogContent>
		<div class="flex flex-col gap-4">
			<p class="font-medium">{editDay?.date} — {allDayTypeLabels[editDay?.dayType] || ''}</p>

			<div class="flex flex-col gap-1">
				<Label for="dayType">Тип дня</Label>
				<Select type="single" value={editDay?.dayType} onValueChange={(v) => onTypeChange(v ?? '')}>
					<SelectTrigger class="w-full">
						<span>{allDayTypeLabels[editDay?.dayType] || ''}</span>
					</SelectTrigger>
					<SelectContent>
						{#each Object.entries(allDayTypeLabels) as [key, label]}
							<SelectItem value={key}>{label}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="workTimeStr">Норма времени</Label>
				<TimeInput
					value={editDay?.workTimeStr ?? '08:00'}
					onchange={(v) => (editDay = { ...editDay, workTimeStr: v })}
				/>
			</div>

			{#if editDay?.dayType === 'preholiday'}
				<div class="flex flex-col gap-1">
					<Label for="preScheduleId">График</Label>
					{@render scheduleSelect()}
				</div>
			{/if}

			{#if editDay?.dayType === 'holiday'}
				<Label class="flex-row items-center gap-2">
					<Checkbox
						checked={editDay?.autoTransfer ?? true}
						onCheckedChange={(c) => (editDay = { ...editDay, autoTransfer: c === true })}
					/>
					Переносить при выпадении на выходной
				</Label>
				<Label class="flex-row items-center gap-2">
					<Checkbox
						checked={editDay?.preHoliday ?? true}
						onCheckedChange={(c) => (editDay = { ...editDay, preHoliday: c === true })}
					/>
					Предпраздничный день
				</Label>
				{#if editDay?.preHoliday}
					{@render scheduleSelect()}
				{/if}
			{/if}

			{#if editDay?.dayType === 'transferred_workday'}
				<div class="flex flex-col gap-1">
					<Label for="transferFrom">Перенос с</Label>
					<DatePicker
						value={editDay?.transferFrom ?? ''}
						onchange={(v) => (editDay = { ...editDay, transferFrom: v })}
					/>
				</div>
			{/if}

			<Button onclick={saveDay}>Сохранить</Button>
		</div>
	</DialogContent>
</Dialog>
