<script lang="ts">
	import { page } from '$app/stores';
	import {
		PageHeader,
		Button,
		Input,
		Select,
		Badge,
		Pagination,
		EmptyState,
		Grid,
		GridItem
	} from '$lib/components/native/ui';

	const data = $derived($page.data);

	/** Собрать URL с текущими фильтрами + переданными изменениями */
	function qs(extra: Record<string, string | undefined>): string {
		const p = new URLSearchParams();
		for (const k of ['search', 'department', 'position', 'status']) {
			const v = data[k] || '';
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
			department: undefined,
			position: undefined,
			status: undefined
		})
	);
</script>

<PageHeader title="Сотрудники" note={`Всего: ${data.total}`} />

<Button href="/native/apps/tabel/employees/create" size="sm">Создать сотрудника</Button>

<form method="get" action="/native/apps/tabel/employees" class="n-filters">
	<Input
		name="search"
		value={data.search}
		placeholder="Поиск по ФИО или номеру..."
		label="Поиск"
		class="n-filter-search"
	/>
	<Select
		name="department"
		value={data.department}
		label="Подразделение"
		options={data.departments.map((d: any) => ({ value: d.name, label: d.name }))}
		class="n-filter-field"
	/>
	<Select
		name="position"
		value={data.position}
		label="Должность"
		options={data.positions.map((p: any) => ({ value: p.name, label: p.name }))}
		class="n-filter-field"
	/>
	<Select
		name="status"
		value={data.status}
		label="Статус"
		options={[
			{ value: 'active', label: 'Активные' },
			{ value: 'dismissed', label: 'Уволенные' }
		]}
		class="n-filter-field"
	/>
	<div class="n-filters-actions">
		<Button type="submit" size="sm">Найти</Button>
		<a class="n-clear" href={clearUrl}>Сбросить</a>
	</div>
</form>

{#if data.employees.length === 0}
	<EmptyState text="Никого не найдено — измените фильтры" />
{:else}
	<table class="native-table n-table">
		<thead>
			<tr>
				<th class="cell cell-head cell-num">Таб. №</th>
				<th class="cell cell-head cell-left">ФИО</th>
				<th class="cell cell-head cell-left cell-fio">Подразделение</th>
				<th class="cell cell-head cell-left cell-fio">Должность</th>
				<th class="cell cell-head">Статус</th>
			</tr>
		</thead>
		<tbody>
			{#each data.employees as emp}
				<tr class="n-row">
					<td class="cell cell-mono cell-num">{emp.number}</td>
					<td class="cell cell-left">
						<a class="n-row-link" href="/native/apps/tabel/employees/{emp.id}/main">
							{emp.lastName}
							{emp.firstName}
							{emp.middleName ?? ''}
						</a>
					</td>
					<td class="cell cell-left">{emp.departmentName ?? '—'}</td>
					<td class="cell cell-left">{emp.positionName ?? '—'}</td>
					<td class="cell">
						{#if emp.status === 'active'}
							<Badge variant="success">Активен</Badge>
						{:else if emp.status === 'dismissed'}
							<Badge variant="danger">Уволен</Badge>
						{:else}
							<Badge variant="muted">Ожидает</Badge>
						{/if}
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
	/* Поля фильтров: фиксированная ширина, отступы маржинами (flex-gap не работает на XP/Chrome 49) */
	:global(.n-filters .n-field.n-filter-search) {
		width: 240px;
		margin: 0 12px 12px 0;
	}
	:global(.n-filters .n-field.n-filter-field) {
		width: 190px;
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
	.n-create {
		margin-bottom: 10px;
	}
	.n-table {
		margin-top: 4px;
	}
	.n-row:hover td {
		background: #f5f5f5;
	}
	.n-row-link {
		color: #1d4ed8;
		text-decoration: none;
	}
	.n-row-link:hover {
		text-decoration: underline;
	}
</style>
