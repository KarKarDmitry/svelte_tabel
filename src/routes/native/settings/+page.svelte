<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Input, Button } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const form = $derived($page.form);
</script>

<h1 class="native-title">Настройки</h1>

{#if form}
	<div class="native-msg {form.success ? 'ok' : 'err'}">{form.message ?? 'Ошибка'}</div>
{/if}

<Card title="Профиль">
	<form method="post" action="?/updateProfile">
		<Input name="login" label="Логин" value={data.user?.name ?? ''} required />
		<p class="native-hint">Логин без @ будет сохранён как логин@mettem.com</p>
		<Button type="submit" size="sm">Сохранить</Button>
	</form>
</Card>

<Card title="Смена пароля">
	<form method="post" action="?/changePassword">
		<Input name="currentPassword" label="Текущий пароль" type="password" required />
		<Input name="newPassword" label="Новый пароль" type="password" required />
		<Input name="confirmPassword" label="Повторите новый пароль" type="password" required />
		<Button type="submit" size="sm">Сменить пароль</Button>
	</form>
</Card>

<style>
	.native-hint {
		font-size: 12px;
		color: #6b7280;
		margin: -6px 0 10px;
	}
</style>
