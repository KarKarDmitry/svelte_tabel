<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="mx-auto mt-16 max-w-sm">
	<Card>
		<CardHeader>
			<CardTitle>Вход</CardTitle>
		</CardHeader>
		<CardContent>
			<form method="post" action="?/signIn" use:enhance class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<Label for="username">Логин</Label>
					<Input id="username" name="username" placeholder="Введите логин" required />
				</div>

				<div class="flex flex-col gap-2">
					<Label for="password">Пароль</Label>
					<Input
						id="password"
						name="password"
						type="password"
						placeholder="Введите пароль"
						required
					/>
				</div>

				{#if form?.message}
					<p class="text-sm text-red-600">{form.message}</p>
				{/if}

				<Button type="submit" class="w-full">Войти</Button>
			</form>
		</CardContent>
	</Card>
</div>
