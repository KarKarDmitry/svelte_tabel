<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Select, Input, Button, Badge } from '$lib/components/native/ui';

	const data = $derived($page.data);

	const today = new Date().toISOString().split('T')[0];

	const typeLabels: Record<string, string> = {
		hiring: 'Приём',
		transfer: 'Перевод',
		dismissal: 'Увольнение'
	};

	function fmtDate(d: string): string {
		return new Date(d).toLocaleDateString('ru-RU');
	}

	function deptName(id: number): string {
		return data.allDepartments.find((d: any) => d.id === id)?.name ?? '—';
	}

	function posName(id: number): string {
		return data.positions.find((p: any) => p.id === id)?.name ?? '—';
	}

	const deptOptions = $derived(data.departments.map((d: any) => ({ value: d.id, label: d.name })));
	const posOptions = $derived(data.positions.map((p: any) => ({ value: p.id, label: p.name })));
</script>

{#if data.lastDoc && !data.isDismissed && data.canEditEmployee}
	<Card title="Перевод сотрудника">
		<form method="post" action="?/transfer">
			<Select name="departmentId" label="Подразделение" options={deptOptions} required />
			<Select name="positionId" label="Должность" options={posOptions} required />
			<Input name="date" label="Дата" type="date" value={today} />
			<Button type="submit" size="sm">Сохранить перевод</Button>
		</form>
	</Card>

	<Card title="Увольнение">
		<form method="post" action="?/dismiss">
			<Input name="date" label="Дата" type="date" value={today} />
			<Button type="submit" variant="danger" size="sm">Подтвердить увольнение</Button>
		</form>
	</Card>
{/if}

{#if data.isDismissed && data.canEditEmployee}
	<Card title="Повторный приём">
		<form method="post" action="?/rehire">
			<Select name="departmentId" label="Подразделение" options={deptOptions} required />
			<Select name="positionId" label="Должность" options={posOptions} required />
			<Input name="date" label="Дата" type="date" value={today} />
			<Button type="submit" size="sm">Принять повторно</Button>
		</form>
	</Card>
{/if}

<Card title={`Кадровые документы (${data.documents.length})`}>
	<table class="native-table native-table-employee">
		<thead>
			<tr>
				<th class="cell cell-head">Дата</th>
				<th class="cell cell-head">Тип</th>
				<th class="cell cell-head cell-left">Номер приказа</th>
				<th class="cell cell-head cell-left cell-fio">Подразделение</th>
				<th class="cell cell-head cell-left cell-fio">Должность</th>
				{#if data.canEditEmployee}
					<th class="cell cell-head"></th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each data.documents as doc}
				<tr>
					<td class="cell cell-mono">{fmtDate(doc.date)}</td>
					<td class="cell">
						<Badge variant={doc.type === 'dismissal' ? 'danger' : 'default'}>
							{typeLabels[doc.type] ?? doc.type}
						</Badge>
					</td>
					<td class="cell cell-left cell-mono">{doc.docNumber ?? '—'}</td>
					<td class="cell cell-left">{deptName(doc.departmentId)}</td>
					<td class="cell cell-left">{posName(doc.positionId)}</td>
					{#if data.canEditEmployee}
						<td class="cell">
							<form method="post" action="?/cancelDoc">
								<input type="hidden" name="id" value={doc.id} />
								<Button type="submit" variant="ghost" size="sm">Отменить</Button>
							</form>
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</Card>
