<script lang="ts">
	import { page } from '$app/stores';
	import {
		Card,
		Button,
		Collapsible,
		CollapsibleSubheader,
		EmptyState,
		Flex
	} from '$lib/components/native/ui';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	const data = $derived($page.data);
	const year = $derived(data.year);
	const month = $derived(data.month);

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

	function shiftMonth(dm: number): { year: number; month: number } {
		const d = new Date(year, month - 1 + dm, 1);
		return { year: d.getFullYear(), month: d.getMonth() + 1 };
	}

	const prev = $derived(shiftMonth(-1));
	const next = $derived(shiftMonth(1));

	function fmt(min: number | null): string {
		if (min == null) return '';
		return (min / 60).toFixed(1);
	}

	function calLabel(d: any): string {
		if (!d) return '';
		switch (d.dayType) {
			case 'workday':
				return 'Рабочий день';
			case 'weekend':
				return 'Выходной';
			case 'holiday':
				return 'Праздник';
			case 'preholiday':
				return 'Предпраздничный';
			case 'transferred_workday':
				return 'Перенесённый';
			default:
				return '';
		}
	}

	function weekday(d: string): string {
		return new Date(d).toLocaleDateString('ru-RU', { weekday: 'short' });
	}

	function dayTitle(day: any): string {
		return `${new Date(day.date).getDate()} ${weekday(day.date)} · ${day.dayMarkCode ?? '—'} · ${fmt(day.reportWorkTime ?? day.shiftWorkTime)} ч`;
	}

	function daySummary(day: any): string {
		const parts: string[] = [];
		if (day.rawWorkTime != null) parts.push(`Сырое: ${fmt(day.rawWorkTime)}`);
		if (day.shiftWorkTime != null) parts.push(`Сменное: ${fmt(day.shiftWorkTime)}`);
		if (day.reportNightWorkTime != null) parts.push(`Ночные: ${fmt(day.reportNightWorkTime)}`);
		if (day.extraMarkCode) parts.push(`Доп: ${day.extraMarkCode}`);
		const cl = calLabel(day.calendarDay);
		if (cl) parts.push(cl);
		return parts.length ? parts.join(' · ') : 'Нет данных';
	}

	function fmtTime(dt: string): string {
		return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
	}

	const totalMinutes = $derived(
		data.days.reduce((s: number, d: any) => s + (d.reportWorkTime ?? d.shiftWorkTime ?? 0), 0)
	);
	const totalNight = $derived(
		data.days.reduce((s: number, d: any) => s + (d.reportNightWorkTime ?? 0), 0)
	);
</script>

<Card title={`Табельный учёт — ${months[month - 1]} ${year}`}>
	<div class="n-months">
		<Button
			href={`/native/apps/tabel/employees/${data.employee?.id}/worktime?year=${prev.year}&month=${prev.month}`}
			variant="outline"
			size="sm"><ArrowLeft size={14} style="vertical-align:middle" />&nbsp;Пред.</Button
		>
		<span class="n-month-label">{months[month - 1]} {year}</span>
		<Button
			href={`/native/apps/tabel/employees/${data.employee?.id}/worktime?year=${next.year}&month=${next.month}`}
			variant="outline"
			size="sm">След.&nbsp;<ArrowRight size={14} style="vertical-align:middle" /></Button
		>
	</div>

	{#if data.days.every((d: any) => !d.dayMarkCode && (d.reportWorkTime ?? d.shiftWorkTime) == null)}
		<EmptyState text="Нет записей за этот месяц" />
	{:else}
		<Flex gap={10}>
			{#each data.days as day}
				<div class="n-card-wrap">
					<Collapsible id={`wt_${day.date}`} title={dayTitle(day)}>
						<table class="native-table n-details">
							<tbody>
								{#if day.extraMarkCode}
									<tr>
										<td class="cell cell-head cell-left">Доп. метка</td>
										<td class="cell cell-left">
											{day.extraMarkCode}
											{#if day.extraMarkMinutes != null}
												({fmt(day.extraMarkMinutes)} ч){/if}
										</td>
									</tr>
								{/if}
								{#if day.rawWorkTime != null}
									<tr>
										<td class="cell cell-head cell-left">Фактически</td>
										<td class="cell cell-left">{fmt(day.rawWorkTime)} ч</td>
									</tr>
								{/if}
								{#if day.shiftWorkTime != null}
									<tr>
										<td class="cell cell-head cell-left">По графику</td>
										<td class="cell cell-left">{fmt(day.shiftWorkTime)} ч</td>
									</tr>
								{/if}
								<tr>
									<td class="cell cell-head cell-left">Отчёт</td>
									<td class="cell cell-left">{fmt(day.reportWorkTime)} ч</td>
								</tr>
								{#if day.reportNightWorkTime != null}
									<tr>
										<td class="cell cell-head cell-left">Ночные</td>
										<td class="cell cell-left">{fmt(day.reportNightWorkTime)} ч</td>
									</tr>
								{/if}
								<tr>
									<td class="cell cell-head cell-left">Календарь</td>
									<td class="cell cell-left">{calLabel(day.calendarDay) || '—'}</td>
								</tr>
							</tbody>
						</table>

						{#if day.events.length > 0}
							<p class="n-events-title">События турникета ({day.events.length}):</p>
							<table class="native-table n-details">
								<tbody>
									{#each day.events as e}
										<tr>
											<td class="cell cell-left cell-mono">{fmtTime(e.datetime)}</td>
											<td class="cell cell-left">{e.eventName}</td>
											<td class="cell cell-mono">
												{e.passSeria ? `${e.passSeria} ` : ''}{e.passNumber ?? `#${e.passId}`}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</Collapsible>
					<CollapsibleSubheader id={`wt_${day.date}`}>
						{daySummary(day)}
					</CollapsibleSubheader>
				</div>
			{/each}
		</Flex>

		<div class="n-totals">
			Всего отработано: {Math.round(totalMinutes / 60)} ч
			{#if totalNight > 0}
				<span class="n-totals-night">из них ночных: {Math.round(totalNight / 60)} ч</span>
			{/if}
		</div>
	{/if}
</Card>

<style>
	.n-months {
		margin-bottom: 10px;
	}
	.n-month-label {
		margin: 0 10px;
		font-size: 14px;
		font-weight: 600;
	}
	.n-card-wrap {
		margin-bottom: 4px;
		width: 300px;
	}
	.n-details {
		width: 100%;
	}
	.n-events-title {
		font-size: 12px;
		color: #6b7280;
		margin: 6px 0 2px;
	}
	.n-totals {
		margin-top: 12px;
		border-top: 1px solid #eeeeee;
		padding-top: 10px;
		font-size: 14px;
		font-weight: 600;
	}
	.n-totals-night {
		margin-left: 12px;
		font-weight: normal;
		color: #6b7280;
	}
</style>
