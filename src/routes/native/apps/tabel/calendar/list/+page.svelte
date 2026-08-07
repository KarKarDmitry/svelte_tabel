<script lang="ts">
	import { page } from '$app/stores';
	import {
		PageHeader,
		Card,
		Input,
		Select,
		Button,
		Badge,
		EmptyState
	} from '$lib/components/native/ui';

	const data = $derived($page.data);
	const canEdit = $derived($page.data.canEdit ?? false);

	const now = new Date().getFullYear();
	const years = Array.from({ length: 11 }, (_, i) => now - 5 + i);
</script>

<PageHeader title="Календари" note={`Всего: ${data.calendars.length}`} />

<p class="native-note">
	<a class="native-link" href="/native/apps/tabel/calendar/templates">Шаблоны календаря</a>
</p>

{#if canEdit}
	<Card title="Сгенерировать календарь">
		<form method="post" action="?/generate">
			<Input name="name" label="Название" placeholder="Например: Производственный 2026" required />
			<Select
				name="templateId"
				label="Шаблон"
				options={data.templates.map((t: any) => ({ value: t.id, label: t.name }))}
				required
			/>
			<Select
				name="year"
				label="Год"
				options={years.map((y) => ({ value: y, label: String(y) }))}
				required
			/>
			<Button type="submit" size="sm">Создать</Button>
		</form>
	</Card>
{/if}

{#if data.calendars.length === 0}
	<EmptyState text="Календарей пока нет" />
{:else}
	<table class="native-table n-table">
		<thead>
			<tr>
				<th class="cell cell-head cell-left cell-fio">Название</th>
				<th class="cell cell-head">Год</th>
				<th class="cell cell-head">Статус</th>
				{#if canEdit}
					<th class="cell cell-head"></th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each data.calendars as c}
				<tr>
					<td class="cell cell-left">
						<a class="n-row-link" href="/native/apps/tabel/calendar/list/{c.id}/main">{c.name}</a>
					</td>
					<td class="cell cell-mono">{c.year}</td>
					<td class="cell">
						{#if c.isDefault}
							<Badge variant="success">Основной</Badge>
						{:else}
							<Badge variant="muted">Обычный</Badge>
						{/if}
					</td>
					{#if canEdit}
						<td class="cell n-actions">
							{#if !c.isDefault}
								<form method="post" action="?/setDefault" class="n-inline-form">
									<input type="hidden" name="id" value={c.id} />
									<Button type="submit" variant="outline" size="sm">Сделать основным</Button>
								</form>
							{/if}
							<form method="post" action="?/delete" class="n-inline-form">
								<input type="hidden" name="id" value={c.id} />
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
	.n-row-link {
		color: #1d4ed8;
		text-decoration: none;
	}
	.n-row-link:hover {
		text-decoration: underline;
	}
	.n-actions {
		white-space: nowrap;
	}
	.n-inline-form {
		display: inline;
		margin-right: 4px;
	}
</style>
