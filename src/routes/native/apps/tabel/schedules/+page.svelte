<script lang="ts">
	import { page } from '$app/stores';
	import { PageHeader, Card, Input, Button, EmptyState } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const canEdit = $derived($page.data.canEdit ?? false);

	const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

	function minutesToHHMM(minutes: number): string {
		const h = Math.floor((minutes || 0) / 60);
		const m = (minutes || 0) % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
	}

	function weekDaysLabel(v: string | null): string {
		if (!v) return '—';
		try {
			const days: number[] = JSON.parse(v);
			return days.map((d) => dayNames[d - 1]).join(', ');
		} catch {
			return '—';
		}
	}
</script>

<PageHeader title="Графики" note={`Всего: ${data.schedules.length}`} />

{#if canEdit}
	<Card title="Новый график">
		<form method="post" action="?/create">
			<Input name="name" label="Название" placeholder="Например: Смена 1" required />
			<Input name="hours" label="Норма часов (ЧЧ:ММ)" value="08:00" required />
			<div class="n-weekdays">
				<span class="n-label">Рабочие дни</span>
				<div class="n-weekdays-row">
					{#each dayNames as name, i}
						<label class="n-wd">
							<input type="checkbox" name="weekDays" value={i + 1} />
							{name}
						</label>
					{/each}
				</div>
			</div>
			<Button type="submit" size="sm">Создать</Button>
		</form>
	</Card>
{/if}

{#if data.schedules.length === 0}
	<EmptyState text="Графиков пока нет" />
{:else}
	<table class="native-table n-table">
		<thead>
			<tr>
				<th class="cell cell-head cell-left cell-fio">Название</th>
				<th class="cell cell-head">Норма часов</th>
				<th class="cell cell-head cell-left">Рабочие дни</th>
			</tr>
		</thead>
		<tbody>
			{#each data.schedules as s}
				<tr>
					<td class="cell cell-left">
						<a class="n-row-link" href="/native/apps/tabel/schedules/{s.id}">{s.name}</a>
					</td>
					<td class="cell cell-mono">{minutesToHHMM(s.standardWorkTime)}</td>
					<td class="cell cell-left">{weekDaysLabel(s.weekDays)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.n-table {
		margin-top: 4px;
	}
	.n-row-link {
		color: #1d4ed8;
		text-decoration: none;
	}
	.n-row-link:hover {
		text-decoration: underline;
	}
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
		gap: 0;
	}
	.n-wd {
		margin-right: 10px;
		font-size: 13px;
	}
</style>
