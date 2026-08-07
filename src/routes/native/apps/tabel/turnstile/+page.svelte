<script lang="ts">
	import { page } from '$app/stores';
	import {
		PageHeader,
		Button,
		Input,
		Select,
		Pagination,
		EmptyState
	} from '$lib/components/native/ui';

	const data = $derived($page.data);

	/** Собрать URL с текущими фильтрами + переданными изменениями */
	function qs(extra: Record<string, string | undefined>): string {
		const p = new URLSearchParams();
		for (const k of ['search', 'eventId', 'dateFrom', 'dateTo']) {
			const v = data[k] != null && data[k] !== '' ? String(data[k]) : '';
			if (v) p.set(k, v);
		}
		for (const [k, v] of Object.entries(extra)) {
			if (v) p.set(k, v);
			else p.delete(k);
		}
		const s = p.toString();
		return s ? '?' + s : '';
	}

	const clearUrl = $derived(
		qs({
			page: undefined,
			search: undefined,
			eventId: undefined,
			dateFrom: undefined,
			dateTo: undefined
		})
	);

	const eventOptions = $derived(
		data.eventTypes.map((e: any) => ({ value: String(e.id), label: e.name }))
	);
</script>

<PageHeader title="События турникета" note={`Всего: ${data.total}`} />

<form method="get" action="/native/apps/tabel/turnstile" class="n-filters">
	<Input
		name="search"
		value={data.search}
		placeholder="ФИО или таб. №..."
		label="Поиск"
		class="n-filter-search"
	/>
	<Select
		name="eventId"
		value={data.eventId ? String(data.eventId) : ''}
		label="Событие"
		options={eventOptions}
		class="n-filter-field"
	/>
	<Input name="dateFrom" value={data.dateFrom} label="Дата с" type="date" class="n-filter-field" />
	<Input name="dateTo" value={data.dateTo} label="Дата по" type="date" class="n-filter-field" />
	<div class="n-filters-actions">
		<Button type="submit" size="sm">Найти</Button>
		<a class="n-clear" href={clearUrl}>Сбросить</a>
	</div>
</form>

{#if data.events.length === 0}
	<EmptyState text="Событий за период не найдено" />
{:else}
	<table class="native-table n-table">
		<thead>
			<tr>
				<th class="cell cell-head cell-left">Дата и время</th>
				<th class="cell cell-head cell-left">Событие</th>
				<th class="cell cell-head cell-num">Таб. №</th>
				<th class="cell cell-head cell-left cell-fio">Сотрудник</th>
			</tr>
		</thead>
		<tbody>
			{#each data.events as ev}
				<tr>
					<td class="cell cell-left cell-mono">
						{new Date(ev.datetime).toLocaleString('ru-RU', {
							day: '2-digit',
							month: '2-digit',
							year: 'numeric',
							hour: '2-digit',
							minute: '2-digit'
						})}
					</td>
					<td class="cell cell-left">{ev.eventName}</td>
					<td class="cell cell-mono cell-num">{ev.employeeNumber}</td>
					<td class="cell cell-left">
						<a class="n-row-link" href="/native/apps/tabel/employees/{ev.employeeId}/main">
							{ev.fullName}
						</a>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

{#if data.totalPages > 1}
	<Pagination
		page={data.page}
		totalPages={data.totalPages}
		makeHref={(p) => qs({ page: String(p) })}
	/>
{/if}

<style>
	.n-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		margin-bottom: 14px;
	}
	:global(.n-filters .n-field.n-filter-search) {
		width: 240px;
		margin: 0 12px 12px 0;
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
	.n-clear:hover {
		text-decoration: underline;
	}
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
</style>
