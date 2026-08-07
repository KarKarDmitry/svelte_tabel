<script lang="ts">
	import { page } from '$app/stores';
	import { PageHeader, Card, Input, Select, Button, Flex } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const canEdit = $derived($page.data.canEdit ?? false);
	const calendar = $derived(data.calendar);
	const days = $derived(data.days);

	const monthNames = [
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

	const dayTypeLabels: Record<string, string> = {
		workday: 'Рабочий день',
		weekend: 'Выходной',
		holiday: 'Праздник',
		preholiday: 'Предпраздничный',
		transferred_workday: 'Перенесённый рабочий'
	};

	const today = new Date().toISOString().split('T')[0];

	const dayMap = $derived(new Map<string, any>(days.map((d: any) => [String(d.date), d])));

	function dayClass(date: string): string {
		const dt = dayMap.get(date);
		if (!dt) return 'n-cd-empty';
		switch (dt.dayType) {
			case 'workday':
				return 'n-cd-work';
			case 'weekend':
				return 'n-cd-weekend';
			case 'holiday':
				return 'n-cd-holiday';
			case 'preholiday':
				return 'n-cd-preholiday';
			case 'transferred_workday':
				return 'n-cd-transfer';
			default:
				return 'n-cd-empty';
		}
	}

	function dayTitle(date: string): string {
		const dt = dayMap.get(date);
		if (!dt) return '';
		return dayTypeLabels[dt.dayType] ?? dt.dayType;
	}

	function buildMonth(year: number, month: number) {
		const first = new Date(year, month - 1, 1);
		// 0 = Пн ... 6 = Вс
		const offset = (first.getDay() + 6) % 7;
		const daysInMonth = new Date(year, month, 0).getDate();
		const weeks: ({ num: number; cls: string; title: string } | null)[][] = [];
		let week: ({ num: number; cls: string; title: string } | null)[] = [];
		for (let i = 0; i < offset; i++) week.push(null);
		for (let d = 1; d <= daysInMonth; d++) {
			const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			week.push({ num: d, cls: dayClass(date), title: dayTitle(date) });
			if (week.length === 7) {
				weeks.push(week);
				week = [];
			}
		}
		if (week.length) {
			while (week.length < 7) week.push(null);
			weeks.push(week);
		}
		return weeks;
	}

	const months = $derived(
		Array.from({ length: 12 }, (_, i) => ({
			name: monthNames[i],
			weeks: buildMonth(calendar.year, i + 1)
		}))
	);
</script>

<PageHeader
	title={calendar.name}
	note={`Год: ${calendar.year} · Основной: ${calendar.isDefault ? 'да' : 'нет'}`}
	backHref="/native/apps/tabel/calendar/list"
	backLabel="К списку календарей"
/>

{#if canEdit}
	<Card title="Изменить день">
		<form method="post" action="?/updateDay">
			<Input name="date" label="Дата" type="date" value={today} required />
			<Select
				name="dayType"
				label="Тип дня"
				options={Object.entries(dayTypeLabels).map(([value, label]) => ({ value, label }))}
				required
			/>
			<Input
				name="workTime"
				label="Рабочие часы (десятичные, напр. 8 или 7.2)"
				value="8"
				type="number"
				step="0.1"
			/>
			<Select
				name="scheduleId"
				label="График"
				options={data.allSchedules.map((s: any) => ({ value: s.id, label: s.name }))}
			/>
			<Button type="submit" size="sm">Сохранить день</Button>
		</form>
	</Card>
{/if}

<Flex gap={10} maxWidth="600px">
	{#each months as m}
		<div class="n-cal-item">
			<table class="n-cal">
				<thead>
					<tr>
						<th colspan="7" class="n-cal-month">{m.name} {calendar.year}</th>
					</tr>
					<tr>
						{#each ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as wd}
							<th class="n-cal-wd">{wd}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each m.weeks as week}
						<tr>
							{#each week as day}
								{#if day}
									<td class="n-cal-day {day.cls}" title={day.title}>{day.num}</td>
								{:else}
									<td class="n-cal-day n-cd-empty"></td>
								{/if}
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/each}
</Flex>

<style>
	.n-cal {
		border-collapse: collapse;
		width: 100%;
		font-family: 'Tahoma', 'Arial', sans-serif;
		font-size: 11px;
		margin-bottom: 6px;
	}
	.n-cal-month {
		font-size: 12px;
		font-weight: bold;
		text-align: center;
		padding: 3px 0;
		background: #f5f5f5;
		border: 1px solid #d0d0d0;
	}
	.n-cal-wd {
		font-weight: normal;
		color: #6b7280;
		text-align: center;
		padding: 1px 2px;
		border: 1px solid #e5e5e5;
	}
	.n-cal-day {
		text-align: center;
		padding: 2px 1px;
		border: 1px solid #e5e5e5;
		min-width: 16px;
	}
	.n-cd-empty {
		background: #ffffff;
	}
	.n-cd-work {
		background: #f0fdf4;
	}
	.n-cd-weekend {
		background: #e5e7eb;
		color: #4b5563;
	}
	.n-cd-holiday {
		background: #fee2e2;
		color: #b91c1c;
		font-weight: bold;
	}
	.n-cd-preholiday {
		background: #ffedd5;
		color: #9a3412;
	}
	.n-cd-transfer {
		background: #dbeafe;
		color: #1e40af;
	}
</style>
