<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let deleteTarget = $state<any>(null);
	let deleteOpen = $state(false);

	let accessTarget = $state<any>(null);
	let accessOpen = $state(false);
	let accessRole = $state('user');
	let accessDepts = $state<Set<number>>(new Set());

	const roleLabels: Record<string, string> = {
		user: 'Пользователь',
		timekeeper: 'Табельщик',
		admin: 'Администратор'
	};
	const roleValues = ['user', 'timekeeper', 'admin'];

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

	function openAccess(row: any) {
		accessTarget = row;
		accessRole = row.role;
		accessDepts = new Set(
			data.assignments.filter((a: any) => a.userId === row.id).map((a: any) => a.departmentId)
		);
		accessOpen = true;
	}

	// Группируем подразделения по группам (как в табеле); без группы — в конце
	const groupedDepartments = $derived.by(() => {
		const groups = (data.departmentGroups ?? []) as any[];
		const grouped = groups
			.map((g) => {
				const deptIds = new Set(g.departments.map((m: any) => m.departmentId));
				return {
					id: g.id,
					name: g.name,
					departments: data.departments.filter((d: any) => deptIds.has(d.id))
				};
			})
			.filter((g) => g.departments.length > 0);

		const inGroup = new Set(grouped.flatMap((g) => g.departments.map((d: any) => d.id)));
		const ungrouped = data.departments.filter((d: any) => !inGroup.has(d.id));
		if (ungrouped.length > 0) {
			grouped.push({ id: 0, name: 'Без группы', departments: ungrouped });
		}
		return grouped;
	});

	function setDeptChecked(deptId: number, checked: boolean) {
		const next = new Set(accessDepts);
		if (checked) next.add(deptId);
		else next.delete(deptId);
		accessDepts = next;
	}

	function setGroupChecked(group: any, checked: boolean) {
		const next = new Set(accessDepts);
		for (const d of group.departments) {
			if (checked) next.add(d.id);
			else next.delete(d.id);
		}
		accessDepts = next;
	}

	function selectAll() {
		accessDepts = new Set(data.departments.map((d: any) => d.id));
	}

	function clearAll() {
		accessDepts = new Set();
	}

	async function saveAccess() {
		if (!accessTarget) return;

		// Роль + подразделения — одним bulk-запросом (сервер синхронизирует в транзакции)
		const ok = await runAction('setAccess', {
			userId: accessTarget.id,
			role: accessRole,
			departmentIds: JSON.stringify([...accessDepts])
		});
		if (!ok) return;

		accessOpen = false;
		toast.success('Доступ обновлён');
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
		<Badge
			variant={row.role === 'admin'
				? 'default'
				: row.role === 'timekeeper'
					? 'secondary'
					: 'outline'}
		>
			{roleLabels[row.role] ?? row.role}
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
						{ label: 'Доступ', onclick: (row) => openAccess(row) },
						{ label: 'Удалить', onclick: (row) => confirmDelete(row) }
					]}
				/>
			{/if}
		</div>
	</div>
</div>

<Dialog bind:open={accessOpen}>
	<DialogContent>
		<p class="font-bold">Доступ пользователя</p>
		<p class="text-sm text-muted-foreground">{accessTarget?.name} ({accessTarget?.email})</p>

		<div class="flex flex-col gap-2">
			<Label for="role">Роль</Label>
			<Select type="single" bind:value={accessRole}>
				<SelectTrigger class="w-full">
					<span>{roleLabels[accessRole] ?? accessRole}</span>
				</SelectTrigger>
				<SelectContent>
					{#each roleValues as r}<SelectItem value={r}>{roleLabels[r]}</SelectItem>{/each}
				</SelectContent>
			</Select>
		</div>

		{#if accessRole !== 'admin'}
			<div class="flex flex-col gap-2">
				<div class="flex items-center justify-between gap-2">
					<Label>Подконтрольные подразделения</Label>
					<div class="flex gap-1">
						<Button variant="outline" size="sm" class="h-6 text-xs" onclick={selectAll}
							>Выделить всех</Button
						>
						<Button variant="outline" size="sm" class="h-6 text-xs" onclick={clearAll}
							>Снять все</Button
						>
					</div>
				</div>

				<div class="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border p-2">
					{#each groupedDepartments as group}
						<Collapsible class="group">
							<CollapsibleTrigger
								class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:bg-muted/50 hover:text-foreground"
							>
								<Badge>{group.departments.length}</Badge>
								<span>{group.name}</span>
								<span class="h-px flex-1 bg-muted-foreground/50"></span>
								<ChevronDownIcon
									class="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180"
								/>
							</CollapsibleTrigger>

							<CollapsibleContent class="pt-1 pl-2">
								{@const selectedInGroup = group.departments.filter((d: any) =>
									accessDepts.has(d.id)
								).length}
								<div class="flex items-center justify-between px-1 pb-1">
									<span class="text-xs text-muted-foreground">
										Выбрано {selectedInGroup}/{group.departments.length}
									</span>
									<div class="flex gap-1">
										<Button
											variant="ghost"
											size="sm"
											class="h-6 px-2 text-xs"
											onclick={() => setGroupChecked(group, true)}>Выделить всех</Button
										>
										<Button
											variant="ghost"
											size="sm"
											class="h-6 px-2 text-xs"
											onclick={() => setGroupChecked(group, false)}>Снять</Button
										>
									</div>
								</div>
								<div class="flex flex-col gap-1">
									{#each group.departments as dept}
										<Label class="flex-row items-center gap-2">
											<Checkbox
												checked={accessDepts.has(dept.id)}
												onCheckedChange={(c) => setDeptChecked(dept.id, c === true)}
											/>
											{dept.name}
										</Label>
									{/each}
								</div>
							</CollapsibleContent>
						</Collapsible>
					{/each}
				</div>
			</div>
		{/if}

		<div class="flex justify-end gap-2">
			<Button variant="outline" onclick={() => (accessOpen = false)}>Отмена</Button>
			<Button onclick={saveAccess}>Сохранить</Button>
		</div>
	</DialogContent>
</Dialog>

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
