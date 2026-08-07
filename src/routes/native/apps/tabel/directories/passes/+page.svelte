<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Input, Button } from '$lib/components/native/ui';

	const data = $derived($page.data);

	function qs(extra: Record<string, string | undefined>): string {
		const p = new URLSearchParams();
		if (data.seriaSearch) p.set('seria', data.seriaSearch);
		if (data.numberSearch) p.set('number', data.numberSearch);
		for (const [k, v] of Object.entries(extra)) {
			if (v) p.set(k, v);
			else p.delete(k);
		}
		const s = p.toString();
		return s ? '?' + s : '';
	}

	const clearUrl = $derived(qs({ seria: undefined, number: undefined }));

	function ownerName(r: any): string {
		if (!r.owner) return '—';
		return `${r.owner.lastName} ${r.owner.firstName}`;
	}
</script>

<Card title="Новый пропуск">
	<form method="post" action="?/create">
		<Input name="seria" label="Серия" placeholder="Напр. 242" />
		<Input name="number" label="Номер" required />
		<Button type="submit" size="sm">Создать</Button>
	</form>
</Card>

<Card title={`Пропуска (${data.passes.length})`}>
	<form method="get" action="/native/apps/tabel/directories/passes" class="n-filters">
		<Input name="seria" value={data.seriaSearch} label="Серия" class="n-filter-field" />
		<Input name="number" value={data.numberSearch} label="Номер" class="n-filter-field" />
		<div class="n-filters-actions">
			<Button type="submit" size="sm">Найти</Button>
			<a class="n-clear" href={clearUrl}>Сбросить</a>
		</div>
	</form>

	<table class="native-table n-table">
		<thead>
			<tr>
				<th class="cell cell-head cell-left">Серия</th>
				<th class="cell cell-head cell-left">Номер</th>
				<th class="cell cell-head cell-left cell-fio">Владелец</th>
				<th class="cell cell-head"></th>
			</tr>
		</thead>
		<tbody>
			{#each data.passes as r}
				<tr>
					<td class="cell cell-left cell-mono">{r.pass.seria ?? ''}</td>
					<td class="cell cell-left cell-mono">{r.pass.number}</td>
					<td class="cell cell-left">{ownerName(r)}</td>
					<td class="cell n-actions">
						<form method="post" action="?/delete" class="n-inline-form">
							<input type="hidden" name="id" value={r.pass.id} />
							<Button type="submit" variant="ghost" size="sm">Удалить</Button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</Card>

<style>
	.n-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		margin-bottom: 12px;
	}
	:global(.n-filters .n-field.n-filter-field) {
		width: 180px;
		margin: 0 12px 12px 0;
	}
	.n-filters-actions {
		display: flex;
		align-items: center;
		margin: 0 0 12px;
	}
	.n-clear {
		font-size: 13px;
		color: #6b7280;
		text-decoration: none;
		margin-left: 8px;
	}
	.n-table {
		margin-top: 4px;
	}
	.n-actions {
		white-space: nowrap;
	}
	.n-inline-form {
		display: inline;
	}
</style>
