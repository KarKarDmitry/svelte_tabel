<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let deleteTarget = $state<any>(null);
	let deleteOpen = $state(false);

	async function runAction(action: string, body: Record<string, string>) {
		const f = new FormData();
		for (const [k, v] of Object.entries(body)) f.set(k, v ?? '');
		const res = await fetch(`/admin?/${action}`, { method: 'POST', body: f });
		const j = await res.json().catch(() => null);
		if (!res.ok) {
			toast.error(j?.data?.message ?? 'Ошибка операции');
			return false;
		}
		await invalidateAll();
		return true;
	}

	async function toggleRole(row: any) {
		const newRole = row.role === 'admin' ? 'user' : 'admin';
		const ok = await runAction('toggleRole', { userId: row.id, role: newRole });
		if (ok) toast.success(row.role === 'admin' ? 'Роль снята' : 'Назначен администратором');
	}

	function confirmDelete(row: any) {
		deleteTarget = row;
		deleteOpen = true;
	}

	async function doDelete() {
		if (!deleteTarget) return;
		const ok = await runAction('deleteUser', { userId: deleteTarget.id });
		if (ok) {
			deleteOpen = false;
			deleteTarget = null;
			toast.success('Пользователь удалён');
		}
	}

	const columns = [
		{ key: 'name', label: 'Логин' },
		{ key: 'email', label: 'Email', mono: true },
		{ key: 'role', label: 'Роль' },
		{
			key: 'createdAt',
			label: 'Создан',
			format: (v: string) =>
				new Date(v).toLocaleString('ru-RU', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})
		}
	];
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'role'}
		<Badge variant={row.role === 'admin' ? 'default' : 'outline'}>
			{row.role === 'admin' ? 'Админ' : 'Пользователь'}
		</Badge>
	{:else if col.format}{col.format(value, row)}
	{:else}{value ?? '—'}
	{/if}
{/snippet}

<div class="mx-auto p-6">
	<h1 class="mb-6 text-2xl font-bold text-gray-900">Администрирование</h1>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<Card>
			<CardHeader>
				<CardTitle>Создать пользователя</CardTitle>
			</CardHeader>
			<CardContent>
				<form method="post" action="?/createUser" use:enhance class="flex flex-col gap-4">
					<Input name="username" placeholder="Логин (например: ivan)" required />
					<Input name="password" type="password" placeholder="Пароль" required />
					<p class="text-xs text-muted-foreground">
						Логин без @ будет сохранён как
						<span class="font-mono">логин@mettem.com</span>
					</p>
					<Button type="submit">Создать</Button>
				</form>
			</CardContent>
		</Card>

		<div class="flex flex-col gap-2">
			<h2 class="text-lg font-semibold">Пользователи ({data.users.length})</h2>
			{#if data.users.length === 0}
				<p class="p-4 text-sm text-gray-400">Нет пользователей</p>
			{:else}
				<DTable
					class="max-h-[65vh]"
					data={data.users}
					{columns}
					{cell}
					rowActions={[
						{
							label: (r: any) => (r.role === 'admin' ? 'Снять админа' : 'Сделать админом'),
							onclick: (row) => toggleRole(row)
						},
						{ label: 'Удалить', onclick: (row) => confirmDelete(row) }
					]}
				/>
			{/if}
		</div>
	</div>
</div>

<Dialog bind:open={deleteOpen}>
	<DialogContent>
		<p class="font-bold">Удалить пользователя?</p>
		<p class="text-sm text-gray-500">
			Пользователь
			<span class="font-medium">{deleteTarget?.name}</span>
			({deleteTarget?.email}) будет удалён безвозвратно.
		</p>
		<div class="flex justify-end gap-2">
			<Button variant="outline" onclick={() => (deleteOpen = false)}>Отмена</Button>
			<Button variant="destructive" onclick={doDelete}>Удалить</Button>
		</div>
	</DialogContent>
</Dialog>
