<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Input, Button, EmptyState } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const form = $derived($page.form);

	const roleLabels: Record<string, string> = {
		user: 'Пользователь',
		timekeeper: 'Табельщик',
		admin: 'Администратор'
	};

	function fmtDate(v: string): string {
		return new Date(v).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<h1 class="native-title">Администрирование</h1>

{#if form}
	<div class="native-msg {form.success ? 'ok' : 'err'}">{form.message ?? 'Ошибка'}</div>
{/if}

<Card title="Создать пользователя">
	<form method="post" action="?/createUser">
		<Input name="username" label="Логин (например: ivan)" required />
		<Input name="password" label="Пароль" type="password" required />
		<p class="native-hint">Логин без @ будет сохранён как логин@mettem.com</p>
		<Button type="submit" size="sm">Создать</Button>
	</form>
</Card>

<Card title={`Пользователи (${data.users.length})`}>
	{#if data.users.length === 0}
		<EmptyState text="Нет пользователей" />
	{:else}
		<table class="native-table">
			<thead>
				<tr>
					<th class="cell cell-head cell-left">Логин</th>
					<th class="cell cell-head cell-left">Email</th>
					<th class="cell cell-head">Роль</th>
					<th class="cell cell-head">Создан</th>
					<th class="cell cell-head"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as u}
					<tr>
						<td class="cell cell-left">{u.name}</td>
						<td class="cell cell-left cell-mono">{u.email}</td>
						<td class="cell">{roleLabels[u.role] ?? u.role}</td>
						<td class="cell">{fmtDate(u.createdAt)}</td>
						<td class="cell n-admin-actions">
							<a class="native-btn native-btn-small" href={`/native/admin/${u.id}/access`}
								>Доступ</a
							>
							<a class="native-btn native-btn-small" href={`/native/admin/${u.id}/edit`}
								>Изменить</a
							>
							<form method="post" action="?/deleteUser" class="n-admin-inline">
								<input type="hidden" name="userId" value={u.id} />
								<Button type="submit" variant="danger" size="sm">Удалить</Button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<style>
	.native-hint {
		font-size: 12px;
		color: #6b7280;
		margin: -6px 0 10px;
	}
	.n-admin-actions {
		white-space: nowrap;
	}
	.n-admin-actions .native-btn {
		margin-right: 4px;
	}
	.n-admin-inline {
		display: inline;
	}
</style>
