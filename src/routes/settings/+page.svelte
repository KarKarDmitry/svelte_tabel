<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { page } from '$app/stores';

	const user = $derived($page.data.user);
</script>

<div class="mx-auto flex max-w-md flex-col gap-6 p-6">
	<h1 class="text-2xl font-bold text-gray-900">Настройки</h1>

	<Card>
		<CardHeader>
			<CardTitle>Профиль</CardTitle>
		</CardHeader>
		<CardContent>
			<form
				method="post"
				action="?/updateProfile"
				class="flex flex-col gap-4"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							toast.success('Логин обновлён');
							await invalidateAll();
						} else if (result.type === 'failure') {
							toast.error((result.data as any)?.message ?? 'Не удалось обновить логин');
						}
					};
				}}
			>
				<div class="flex flex-col gap-1">
					<Label for="login">Логин</Label>
					<Input id="login" name="login" value={user?.name ?? ''} required />
					<p class="text-xs text-muted-foreground">
						Логин без @ будет сохранён как
						<span class="font-mono">логин@mettem.com</span>
					</p>
				</div>
				<Button type="submit">Сохранить</Button>
			</form>
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle>Смена пароля</CardTitle>
		</CardHeader>
		<CardContent>
			<form
				method="post"
				action="?/changePassword"
				class="flex flex-col gap-4"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							toast.success('Пароль изменён');
						} else if (result.type === 'failure') {
							toast.error((result.data as any)?.message ?? 'Не удалось сменить пароль');
						}
					};
				}}
			>
				<div class="flex flex-col gap-1">
					<Label for="currentPassword">Текущий пароль</Label>
					<Input id="currentPassword" name="currentPassword" type="password" required />
				</div>
				<div class="flex flex-col gap-1">
					<Label for="newPassword">Новый пароль</Label>
					<Input id="newPassword" name="newPassword" type="password" required />
				</div>
				<div class="flex flex-col gap-1">
					<Label for="confirmPassword">Повторите новый пароль</Label>
					<Input id="confirmPassword" name="confirmPassword" type="password" required />
				</div>
				<Button type="submit">Сменить пароль</Button>
			</form>
		</CardContent>
	</Card>
</div>
