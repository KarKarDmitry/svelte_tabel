<script lang="ts">
	import { page } from '$app/stores';
	import { PageHeader, Card, Input, Button } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const canEdit = $derived($page.data.canEdit ?? false);
	const schedule = $derived(data.schedule);

	const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

	function minutesToHHMM(minutes: number): string {
		const h = Math.floor((minutes || 0) / 60);
		const m = (minutes || 0) % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
	}

	function parseWeekDays(v: string | null): number[] {
		if (!v) return [];
		try {
			return JSON.parse(v);
		} catch {
			return [];
		}
	}

	const weekDays = $derived(parseWeekDays(schedule.weekDays));

	const pointLabels: Record<string, string> = {
		Entry: 'Начало',
		Exit: 'Конец',
		Break: 'Перерыв'
	};

	function fmtBound(min: number): string {
		return min ? `${min} мин` : '0';
	}
</script>

<PageHeader
	title={schedule.name}
	note={`Норма часов: ${minutesToHHMM(schedule.standardWorkTime)}`}
	backHref="/native/apps/tabel/schedules"
	backLabel="К списку графиков"
/>

{#if canEdit}
	<Card title="Параметры графика">
		<form method="post" action="?/update">
			<Input name="name" label="Название" value={schedule.name} required />
			<Input
				name="hours"
				label="Норма часов (ЧЧ:ММ)"
				value={minutesToHHMM(schedule.standardWorkTime)}
				required
			/>
			<div class="n-weekdays">
				<span class="n-label">Рабочие дни</span>
				<div class="n-weekdays-row">
					{#each dayNames as name, i}
						<label class="n-wd">
							<input
								type="checkbox"
								name="weekDays"
								value={i + 1}
								checked={weekDays.includes(i + 1)}
							/>
							{name}
						</label>
					{/each}
				</div>
			</div>
			<Button type="submit" size="sm">Сохранить</Button>
		</form>
	</Card>
{/if}

<Card title={`Точки графика (${schedule.points.length})`}>
	{#if schedule.points.length === 0}
		<p class="n-empty-note">Точек нет</p>
	{:else}
		<table class="native-table">
			<thead>
				<tr>
					<th class="cell cell-head cell-left">Тип</th>
					<th class="cell cell-head">Время</th>
					<th class="cell cell-head">Окончание</th>
					<th class="cell cell-head cell-left">Границы</th>
				</tr>
			</thead>
			<tbody>
				{#each schedule.points as p}
					<tr>
						<td class="cell cell-left">{pointLabels[p.type] ?? p.type}</td>
						<td class="cell cell-mono">{p.time}</td>
						<td class="cell cell-mono">{p.endTime ?? '—'}</td>
						<td class="cell cell-left">−{fmtBound(p.leftBound)} / +{fmtBound(p.rightBound)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<style>
	.n-weekdays {
		margin-bottom: 10px;
	}
	.n-label {
		display: block;
		font-size: 13px;
		color: #4b5563;
		margin-bottom: 4px;
	}
	.n-weekdays-row {
		display: flex;
		flex-wrap: wrap;
	}
	.n-wd {
		margin-right: 10px;
		font-size: 13px;
	}
	.n-empty-note {
		color: #6b7280;
		font-size: 14px;
		margin: 0;
	}
</style>
