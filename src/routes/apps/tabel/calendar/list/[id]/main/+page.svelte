<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import DatePicker from '$lib/components/DatetimePick/DatePicker.svelte';
	import TimeInput from '$lib/components/DatetimePick/TimeInput.svelte';

	let days = $derived($page.data.days);
	let cal = $derived($page.data.calendar);
	let schedules = $derived($page.data.allSchedules);
	let canEdit = $derived($page.data.canEdit ?? false);
	let editDay = $state<any>(null);
	let editOpen = $state(false);

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

	const dayTypeColors: Record<string, string> = {
		workday: 'bg-green-100 text-green-800',
		weekend: 'bg-gray-100 text-gray-500',
		holiday: 'bg-red-100 text-red-800',
		preholiday: 'bg-yellow-100 text-yellow-800',
		transferred_workday: 'bg-blue-100 text-blue-800',
		transferred_holiday: 'bg-purple-100 text-purple-800'
	};

	const dayTypeLabels: Record<string, string> = {
		workday: 'Рабочий',
		weekend: 'Выходной',
		holiday: 'Праздник',
		preholiday: 'Сокращённый',
		transferred_workday: 'Перенос (раб)',
		transferred_holiday: 'Перенос (вых)'
	};

	const months = [
		'Январь',
		'Февраль',
		'Март',
		'Апрель',
		'Май',
		'Июнь',
		'Июль',
		'Август',
		'Сентябрь',
		'Октябрь',
		'Ноябрь',
		'Декабрь'
	];
	const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

	function getMonthDays(year: number, month: number) {
		return days.filter((d: any) => {
			const [y, m] = d.date.split('-');
			return Number(y) === year && Number(m) === month;
		});
	}

	function defaultWorkTime(type: string): string {
		if (type === 'workday') return '08:00';
		if (type === 'weekend' || type === 'holiday' || type === 'transferred_holiday') return '00:00';
		return '08:00';
	}

	function openEdit(day: any) {
		editDay = {
			...day,
			workTimeStr: defaultWorkTime(day.dayType),
			autoTransfer: day.dayType === 'holiday' ? (day.autoTransfer ?? true) : false,
			preHoliday: day.dayType === 'holiday' ? (day.preHoliday ?? true) : false,
			preScheduleId: day.scheduleId ?? ''
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
		const [h, m] = (editDay.workTimeStr || '08:00').split(':').map(Number);
		f.set('workTime', String(h * 60 + (m || 0)));
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

<div class="space-y-4 pt-4">
	<div class="flex flex-wrap gap-4">
		{#each months as mname, mi}
			{@const monthDays = getMonthDays(cal.year, mi + 1)}
			{#if monthDays.length > 0}
				<Card class="min-w-100 flex-1 p-0 pt-2">
					<CardHeader>
						<CardTitle>
							{mname}
							{cal.year}
						</CardTitle>
					</CardHeader>
					<CardContent class="p-1 pt-0">
						<div class="grid grid-cols-7 gap-0.5">
							{#each dayNames as dn}
								<div class="pb-1 text-center text-xs font-medium text-gray-500">
									{dn}
								</div>
							{/each}
							{#each Array(new Date(cal.year, mi, 1).getDay() === 0 ? 6 : new Date(cal.year, mi, 1).getDay() - 1) as _}
								<div></div>
							{/each}
							{#each monthDays as day}
								{@const dayNum = Number(day.date.split('-')[2])}
								{@const colors = dayTypeColors[day.dayType] || 'bg-gray-50'}
								<button
									class="rounded border p-1 text-center text-xs {colors} cursor-pointer hover:ring-1 hover:ring-gray-400"
									onclick={canEdit ? () => openEdit(day) : undefined}
									title="{dayTypeLabels[day.dayType] || day.dayType} — {day.workTime}мин"
								>
									<div class="font-medium">{dayNum}</div>
									<div class="text-[9px] leading-tight">{dayTypeLabels[day.dayType] || '-'}</div>
									{#if day.workTime !== null && day.workTime !== undefined}
										<div class="text-[10px]">{Math.floor(day.workTime / 60)}ч</div>
									{/if}
								</button>
							{/each}
						</div>
					</CardContent>
				</Card>
			{/if}
		{/each}
	</div>
</div>

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
			<p class="font-medium">{editDay?.date} — {dayTypeLabels[editDay?.dayType] || ''}</p>

			<div class="flex flex-col gap-1">
				<Label for="dayType">Тип дня</Label>
				<Select type="single" value={editDay?.dayType} onValueChange={(v) => onTypeChange(v ?? '')}>
					<SelectTrigger class="w-full">
						<span>{dayTypeLabels[editDay?.dayType] || ''}</span>
					</SelectTrigger>
					<SelectContent>
						{#each Object.entries(dayTypeLabels) as [key, label]}
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
						checked={editDay?.autoTransfer ?? false}
						onCheckedChange={(c) => (editDay = { ...editDay, autoTransfer: c === true })}
					/>
					Переносить при выпадении на выходной
				</Label>
				<Label class="flex-row items-center gap-2">
					<Checkbox
						checked={editDay?.preHoliday ?? false}
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
