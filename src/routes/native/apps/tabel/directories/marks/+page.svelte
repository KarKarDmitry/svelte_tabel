<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Input, Button } from '$lib/components/native/ui';

	const data = $derived($page.data);

	const clearUrl = $derived(data.search ? '?search=' : '/native/apps/tabel/directories/marks');

	const categoryLabels: Record<string, string> = {
		work: 'Рабочий',
		rest: 'Отдых',
		absent: 'Отсутствие',
		other: 'Прочее'
	};
</script>

<Card title="Новая метка">
	<form method="post" action="?/create">
		<Input name="name" label="Название" required />
		<Input name="shortName" label="Краткое имя" required />
		<Input name="code" label="Код" required />
		<Button type="submit" size="sm">Создать</Button>
	</form>
</Card>

<Card title={`Метки табеля (${data.dayMarks.length})`}>
	<form method="get" action="/native/apps/tabel/directories/marks" class="n-filters">
		<Input name="search" value={data.search} label="Поиск" class="n-filter-field" />
		<div class="n-filters-actions">
			<Button type="submit" size="sm">Найти</Button>
			<a class="n-clear" href={clearUrl}>Сбросить</a>
		</div>
	</form>

	<table class="native-table n-table">
		<thead>
			<tr>
				<th class="cell cell-head cell-left">Код</th>
				<th class="cell cell-head cell-left">Кратко</th>
				<th class="cell cell-head cell-left cell-fio">Название</th>
				<th class="cell cell-head">Категория</th>
				<th class="cell cell-head"></th>
			</tr>
		</thead>
		<tbody>
			{#each data.dayMarks as m}
				<tr>
					<td class="cell cell-left cell-mono">{m.code}</td>
					<td class="cell cell-left cell-mono">{m.shortName}</td>
					<td class="cell cell-left">{m.name}</td>
					<td class="cell">{categoryLabels[m.category] ?? m.category}</td>
					<td class="cell n-actions">
						<form method="post" action="?/delete" class="n-inline-form">
							<input type="hidden" name="id" value={m.id} />
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
		width: 220px;
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
