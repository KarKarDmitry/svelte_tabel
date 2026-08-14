<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Input, Button, EmptyState } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const canEdit = $derived($page.data.canEdit ?? false);
	const isAdmin = $derived($page.data.isAdmin ?? false);

	const clearUrl = $derived(
		data.search ? '?search=' : '/native/apps/tabel/directories/departments'
	);
</script>

{#if canEdit}
	<Card title="Новое подразделение">
		<form method="post" action="?/create">
			<Input name="name" label="Название" required />
			<Button type="submit" size="sm">Создать</Button>
		</form>
	</Card>
{/if}

<Card title={`Подразделения (${data.departments.length})`}>
	<form method="get" action="/native/apps/tabel/directories/departments" class="n-filters">
		<Input name="search" value={data.search} label="Поиск" class="n-filter-field" />
		<div class="n-filters-actions">
			<Button type="submit" size="sm">Найти</Button>
			<a class="n-clear" href={clearUrl}>Сбросить</a>
		</div>
	</form>

	{#if data.departments.length === 0}
		<EmptyState text="Ничего не найдено" />
	{:else}
		<table class="native-table n-table">
			<thead>
				<tr>
					<th class="cell cell-head cell-left cell-fio">Название</th>
					{#if canEdit}
						<th class="cell cell-head"></th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each data.departments as d}
					<tr>
						<td class="cell cell-left">{d.name}</td>
						{#if canEdit}
							<td class="cell n-actions">
								<form method="post" action="?/update" class="n-inline-form n-edit">
									<input type="hidden" name="id" value={d.id} />
									<input type="text" name="name" value={d.name} class="n-edit-input" />
									<Button type="submit" variant="outline" size="sm">Переименовать</Button>
								</form>
								{#if isAdmin}
									<form method="post" action="?/delete" class="n-inline-form">
										<input type="hidden" name="id" value={d.id} />
										<Button type="submit" variant="ghost" size="sm">Удалить</Button>
									</form>
								{/if}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<style>
	.n-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		margin-bottom: 12px;
	}
	:global(.n-filters .n-field.n-filter-field) {
		width: 240px;
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
	.n-edit {
		margin-right: 6px;
	}
	.n-edit-input {
		width: 180px;
		padding: 2px 6px;
		font-size: 13px;
		border: 1px solid #c3c3c3;
		border-radius: 4px;
		margin-right: 4px;
	}
</style>
