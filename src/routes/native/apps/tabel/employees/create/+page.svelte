<script lang="ts">
	import { page } from '$app/stores';
	import { PageHeader, Card, Input, Select, Button, Msg, Flex } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const form = $derived($page.form);
	const canEdit = $derived($page.data.canEdit ?? false);
	const today = new Date().toISOString().split('T')[0];
</script>

<PageHeader
	title="Новый сотрудник"
	backHref="/native/apps/tabel/employees"
	backLabel="К списку сотрудников"
/>

{#if !canEdit}
	<Msg variant="err">Создание сотрудников недоступно: недостаточно прав.</Msg>
{:else}
	{#if form?.error === 'number_taken'}
		<Msg variant="err">
			Табельный номер <b>{form.existing?.number}</b> уже занят сотрудником
			<a class="native-link" href="/native/apps/tabel/employees/{form.existing?.id}/main">
				{form.existing?.lastName}
				{form.existing?.firstName}
				{form.existing?.middleName ?? ''}
			</a>. Если это тот же сотрудник — откройте его карточку и создайте новый кадровый документ.
		</Msg>
	{:else if form?.message}
		<Msg variant="err">{form.message}</Msg>
	{/if}

	<form method="post" action="?/create" class="n-create-form">
		<Flex>
			<div>
				<Card title="Основные данные">
					<Input name="number" label="Табельный номер*" required />
					<Input name="lastName" label="Фамилия*" required />
					<Input name="firstName" label="Имя*" required />
					<Input name="middleName" label="Отчество" />
				</Card>
			</div>

			<div>
				<Card
					title="Приём на работу"
					note="* Приём на работу можно оставить пустым — сотрудник попадёт в «Ожидание»"
				>
					<Select
						name="departmentId"
						label="Подразделение"
						options={data.departments.map((d: any) => ({ value: d.id, label: d.name }))}
					/>
					<Select
						name="positionId"
						label="Должность"
						options={data.positions.map((p: any) => ({ value: p.id, label: p.name }))}
					/>
					<Input name="date" label="Дата приёма" type="date" value={today} />
					<Input name="docNumber" label="Номер приказа" />
					<div class="n-create-actions">
						<Button type="submit" size="md">Создать</Button>
					</div>
				</Card>
			</div>
		</Flex>
	</form>
{/if}

<style>
	.n-create-form {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.n-create-actions {
		margin-top: 10px;
	}
</style>
