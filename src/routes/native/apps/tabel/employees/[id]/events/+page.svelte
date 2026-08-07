<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Button, EmptyState } from '$lib/components/native/ui';
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

	function shiftMonth(dy: number, dm: number): { year: number; month: number } {
		const d = new Date(year, month - 1 + dm, 1);
		return { year: d.getFullYear(), month: d.getMonth() + 1 };
	}

	const prev = $derived(shiftMonth(0, -1));
	const next = $derived(shiftMonth(0, 1));

	function fmtDT(dt: string): string {
		return new Date(dt).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<Card title={`События турникета — ${months[month - 1]} ${year}`}>
	<div class="n-months">
		<Button
			href={`/native/apps/tabel/employees/${data.employee?.id}/events?year=${prev.year}&month=${prev.month}`}
			variant="outline"
			size="sm"><ArrowLeft size={14} style="vertical-align:middle" />&nbsp;Пред.</Button
		>
		<Button
			href={`/native/apps/tabel/employees/${data.employee?.id}/events?year=${next.year}&month=${next.month}`}
			variant="outline"
			size="sm">След.&nbsp;<ArrowRight size={14} style="vertical-align:middle" /></Button
		>
	</div>

	{#if data.events.length === 0}
		<EmptyState text="Нет событий за этот месяц" />
	{:else}
		<table class="native-table">
			<thead>
				<tr>
					<th class="cell cell-head cell-left">Дата и время</th>
					<th class="cell cell-head cell-left">Событие</th>
					<th class="cell cell-head">Пропуск</th>
				</tr>
			</thead>
			<tbody>
				{#each data.events as ev}
					<tr>
						<td class="cell cell-left cell-mono">{fmtDT(ev.datetime)}</td>
						<td class="cell cell-left">{ev.eventName}</td>
						<td class="cell cell-mono">
							{ev.passSeria ? `${ev.passSeria} ${ev.passNumber}` : ev.passNumber}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
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
</style>
