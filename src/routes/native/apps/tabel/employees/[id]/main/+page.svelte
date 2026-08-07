<script lang="ts">
	import { page } from '$app/stores';
	import {
		Card,
		Input,
		Select,
		Button,
		Badge,
		Msg,
		Grid,
		GridItem
	} from '$lib/components/native/ui';

	const data = $derived($page.data);
	const form = $derived($page.form);

	const today = new Date().toISOString().split('T')[0];
	const lastDocDate = $derived(
		data.lastDoc ? new Date(data.lastDoc.date).toLocaleDateString('ru-RU') : ''
	);
	const deptName = $derived(
		data.lastDoc
			? (data.allDepartments.find((d: any) => d.id === data.lastDoc.departmentId)?.name ?? '—')
			: ''
	);
	const posName = $derived(
		data.lastDoc
			? (data.positions.find((p: any) => p.id === data.lastDoc.positionId)?.name ?? '—')
			: ''
	);
</script>

<Grid cols={2}>
	<GridItem>
		<Card title="Основная информация">
			{#if data.canEditEmployee}
				{#if form?.error === 'number_taken'}
					<Msg variant="err">
						Табельный номер <b>{form.existing?.number}</b> уже занят сотрудником
						<a class="native-link" href="/native/apps/tabel/employees/{form.existing?.id}/main">
							{form.existing?.lastName}
							{form.existing?.firstName}
							{form.existing?.middleName ?? ''}
						</a>. Если это тот же сотрудник — откройте его карточку и создайте новый кадровый
						документ.
					</Msg>
				{/if}
				<form method="post" action="?/update">
					<Input name="number" label="Табельный номер" value={data.employee.number} required />
					<Input name="lastName" label="Фамилия" value={data.employee.lastName} required />
					<Input name="firstName" label="Имя" value={data.employee.firstName} required />
					<Input name="middleName" label="Отчество" value={data.employee.middleName ?? ''} />
					<Button type="submit">Сохранить</Button>
				</form>
			{:else}
				<table class="native-table native-table-employee">
					<tbody>
						<tr>
							<td class="cell cell-head cell-left">Табельный номер</td>
							<td class="cell cell-left cell-mono">{data.employee.number}</td>
						</tr>
						<tr>
							<td class="cell cell-head cell-left">ФИО</td>
							<td class="cell cell-left">
								{data.employee.lastName}
								{data.employee.firstName}
								{data.employee.middleName ?? ''}
							</td>
						</tr>
					</tbody>
				</table>
			{/if}
		</Card>
	</GridItem>
	<GridItem>
		<Card title="Текущий статус">
			<p class="n-status">
				{#if data.isDismissed}
					<Badge variant="danger">Уволен</Badge>
				{:else if data.lastDoc}
					<Badge variant="success">Активен</Badge>
				{:else}
					<Badge variant="muted">Ожидает</Badge>
				{/if}
			</p>

			{#if data.lastDoc && !data.isDismissed}
				<table class="native-table native-table-employee">
					<tbody>
						<tr>
							<td class="cell cell-head cell-left">Подразделение</td>
							<td class="cell cell-left">{deptName}</td>
						</tr>
						<tr>
							<td class="cell cell-head cell-left">Должность</td>
							<td class="cell cell-left">{posName}</td>
						</tr>
						<tr>
							<td class="cell cell-head cell-left">Дата последнего документа</td>
							<td class="cell cell-left">{lastDocDate}</td>
						</tr>
					</tbody>
				</table>
			{/if}

			{#if !data.isDismissed && !data.lastDoc && data.canEditEmployee}
				<form method="post" action="?/hire" class="n-hire">
					<p class="n-hire-title">Оформить приём</p>
					<Select
						name="departmentId"
						label="Подразделение"
						options={data.departments.map((d: any) => ({ value: d.id, label: d.name }))}
						required
					/>
					<Select
						name="positionId"
						label="Должность"
						options={data.positions.map((p: any) => ({ value: p.id, label: p.name }))}
						required
					/>
					<Input name="date" label="Дата" type="date" value={today} />
					<Button type="submit">Принять на работу</Button>
				</form>
			{/if}
		</Card>
	</GridItem>
</Grid>

<style>
	.n-status {
		margin: 0 0 10px;
	}
	.n-hire {
		border-top: 1px solid #eeeeee;
		margin-top: 10px;
		padding-top: 12px;
	}
	.n-hire-title {
		font-size: 14px;
		font-weight: 600;
		margin: 0 0 8px;
	}
</style>
