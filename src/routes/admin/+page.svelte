<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="mx-auto max-w-2xl p-6">
	<h1 class="mb-6 text-2xl font-bold text-gray-900">Администрирование</h1>

	<Card class="mb-6">
		<CardHeader>
			<CardTitle>Создать пользователя</CardTitle>
		</CardHeader>
		<CardContent>
			<form method="post" action="?/createUser" use:enhance class="flex flex-col gap-4">
				<Input name="username" placeholder="Введите логин" required />
				<Input name="password" type="password" placeholder="Введите пароль" required />
				<Button type="submit">Создать</Button>
			</form>
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle>Пользователи ({data.users.length})</CardTitle>
		</CardHeader>
		<CardContent>
			{#if data.users.length === 0}
				<p class="text-sm text-gray-400">Нет пользователей</p>
			{:else}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Логин</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Создан</TableHead>
							<TableHead></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each data.users as u}
							<TableRow>
								<TableCell>{u.name}</TableCell>
								<TableCell class="text-gray-500">{u.email}</TableCell>
								<TableCell class="text-gray-500"
									>{new Date(u.createdAt).toLocaleDateString()}</TableCell
								>
								<TableCell>
									<form method="post" action="?/deleteUser" use:enhance>
										<input type="hidden" name="userId" value={u.id} />
										<Button variant="destructive" size="sm" type="submit">Удалить</Button>
									</form>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			{/if}
		</CardContent>
	</Card>
</div>
