<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Dialog, DialogContent, DialogHeader, DialogTitle
	} from '$lib/components/ui/dialog';

	let { data }: { data: any } = $props();
	let createOpen = $state(false);
	let editOpen = $state(false);
	let editId = $state<number | null>(null);
	let editName = $state('');
	let addDeptGroupId = $state<number | null>(null);
	let addDeptOpen = $state(false);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold tracking-tight">Группы подразделений</h1>
		<Button onclick={() => (createOpen = true)}>+ Добавить группу</Button>
	</div>

	{#each data.groups as group (group.id)}
		<div class="rounded-xl border bg-card p-4 shadow-sm">
			<div class="mb-2 flex items-center justify-between">
				<h3 class="font-semibold">{group.name}</h3>
				<div class="flex gap-1">
					<Button
						variant="outline"
						size="sm"
						onclick={() => {
							editId = group.id;
							editName = group.name;
							editOpen = true;
						}}>✎</Button>
					<form method="post" action="?/remove" use:enhance>
						<input type="hidden" name="id" value={group.id} />
						<Button variant="outline" size="sm" type="submit">×</Button>
					</form>
				</div>
			</div>

			<div class="space-y-1">
				{#each group.departments as dept}
					<div class="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1 text-sm">
						<span>{dept.departmentName}</span>
						<form method="post" action="?/removeDept" use:enhance>
							<input type="hidden" name="groupId" value={group.id} />
							<input type="hidden" name="departmentId" value={dept.departmentId} />
							<button type="submit" class="text-xs text-muted-foreground hover:text-destructive">×</button>
						</form>
					</div>
				{/each}

				<Button
					variant="ghost"
					size="sm"
					class="text-xs text-muted-foreground"
					onclick={() => { addDeptGroupId = group.id; addDeptOpen = true; }}
				>+ Добавить отдел</Button>
			</div>
		</div>
	{/each}
</div>

<!-- Создание группы -->
<Dialog bind:open={createOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Новая группа</DialogTitle>
		</DialogHeader>
		<form method="post" action="?/create" class="flex flex-col gap-4" use:enhance>
			<Input name="name" placeholder="Название группы" required />
			<Button type="submit">Создать</Button>
		</form>
	</DialogContent>
</Dialog>

<!-- Редактирование группы -->
<Dialog bind:open={editOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Редактировать группу</DialogTitle>
		</DialogHeader>
		<form method="post" action="?/update" class="flex flex-col gap-4" use:enhance>
			<input type="hidden" name="id" value={editId ?? ''} />
			<Input name="name" bind:value={editName} required />
			<Button type="submit">Сохранить</Button>
		</form>
	</DialogContent>
</Dialog>

<!-- Добавление отдела в группу -->
<Dialog bind:open={addDeptOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Добавить отдел</DialogTitle>
		</DialogHeader>
		<form method="post" action="?/addDept" class="flex flex-col gap-4" use:enhance>
			<input type="hidden" name="groupId" value={addDeptGroupId ?? ''} />
			<select name="departmentId" required class="rounded-md border border-input px-3 py-2 text-sm">
				{#each data.allDepts as d}
					<option value={d.id}>{d.name}</option>
				{/each}
			</select>
			<Button type="submit">Добавить</Button>
		</form>
	</DialogContent>
</Dialog>
