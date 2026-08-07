<script lang="ts">
	import { page } from '$app/stores';
	import { PageHeader, Card, Input, Button, EmptyState } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const canEdit = $derived($page.data.canEdit ?? false);
</script>

<PageHeader
	title="Шаблоны календаря"
	backHref="/native/apps/tabel/calendar/list"
	backLabel="К списку календарей"
/>

{#if canEdit}
	<Card title="Новый шаблон">
		<form method="post" action="?/create">
			<Input name="name" label="Название" placeholder="Например: Стандартная неделя" required />
			<Button type="submit" size="sm">Создать</Button>
		</form>
	</Card>
{/if}

{#if data.templates.length === 0}
	<EmptyState text="Шаблонов пока нет" />
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
			{#each data.templates as t}
				<tr>
					<td class="cell cell-left">{t.name}</td>
					{#if canEdit}
						<td class="cell n-actions">
							<form method="post" action="?/delete" class="n-inline-form">
								<input type="hidden" name="id" value={t.id} />
								<Button type="submit" variant="ghost" size="sm">Удалить</Button>
							</form>
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
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
