<script lang="ts">
	import { page } from '$app/stores';
	import { PageHeader, Card, Input, Button } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const form = $derived($page.form);
	const user = $derived(data.user);
</script>

<PageHeader
	title={`Изменить: ${user?.name ?? ''}`}
	note={user?.email}
	backHref="/native/admin"
	backLabel="К пользователям"
/>

{#if form}
	<div class="native-msg {form.success ? 'ok' : 'err'}">{form.message ?? 'Ошибка'}</div>
{/if}

<Card title="Логин и пароль">
	<form method="post" action="?/saveEdit">
		<Input name="login" label="Логин" value={user?.name ?? ''} required />
		<p class="native-hint">Логин без @ будет сохранён как логин@mettem.com</p>
		<Input
			name="newPassword"
			label="Новый пароль"
			type="password"
			placeholder="Оставьте пустым, чтобы не менять"
		/>
		<Button type="submit" size="sm">Сохранить</Button>
	</form>
</Card>

<style>
	.native-hint {
		font-size: 12px;
		color: #6b7280;
		margin: -6px 0 10px;
	}
</style>
