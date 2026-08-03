<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Separator } from '$lib/components/ui/separator';
	import { Checkbox } from '$lib/components/ui/checkbox';

	let { data }: { data: any } = $props();
	let createOpen = $state(false);
	let editOpen = $state(false);
	let editId = $state<number | null>(null);
	let editName = $state('');
	let addDeptGroupId = $state<number | null>(null);
	let addDeptOpen = $state(false);
	let checkedDepts = $state<Set<number>>(new Set());
</script>

<div class="flex items-center justify-between">
	<h1 class="text-2xl font-bold tracking-tight">Группы подразделений</h1>
	<Button onclick={() => (createOpen = true)}>+ Добавить группу</Button>
</div>
<Separator orientation="horizontal" />
<div class="space-y-6">
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
						}}>✎</Button
					>
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
							<button type="submit" class="text-xs text-muted-foreground hover:text-destructive"
								>×</button
							>
						</form>
					</div>
				{/each}

				<Button
					variant="ghost"
					size="sm"
					class="text-xs text-muted-foreground"
					onclick={() => {
						addDeptGroupId = group.id;
						checkedDepts = new Set(group.departments.map((d: any) => d.departmentId));
						addDeptOpen = true;
					}}>+ Добавить отдел</Button
				>
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
	<DialogContent class="flex max-h-[80vh] flex-col">
		<DialogHeader class="shrink-0">
			<DialogTitle>Отделы группы</DialogTitle>
		</DialogHeader>

		{#if addDeptGroupId}
			{@const busyDeptIds = new Set(
				data.groups
					.filter((g) => g.id !== addDeptGroupId)
					.flatMap((g) => g.departments.map((d) => d.departmentId))
			)}

			<form
				method="post"
				action="?/saveDepts"
				class="flex flex-1 flex-col gap-3 overflow-hidden"
				use:enhance
			>
				<input type="hidden" name="groupId" value={addDeptGroupId} />

				<div class="flex-1 space-y-1 overflow-y-auto">
					{#each data.allDepts as d}
						{@const isChecked = checkedDepts.has(d.id)}
						{@const isDisabled = busyDeptIds.has(d.id)}
						<label
							class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
							class:bg-green-100={isChecked && !isDisabled}
							class:bg-gray-300={isDisabled}
							class:border-green-700={isChecked && !isDisabled}
							class:border-gray-700={isDisabled}
						>
							<Checkbox
								name="departmentIds"
								value={d.id}
								checked={isChecked}
								disabled={isDisabled}
								onCheckedChange={() => {
									if (isDisabled) return;
									const next = new Set(checkedDepts);
									if (isChecked) next.delete(d.id);
									else next.add(d.id);
									checkedDepts = next;
								}}
							/>
							<span class:line-through={isDisabled} class:font-medium={isChecked}>{d.name}</span>
							{#if isDisabled}
								<span class="ml-auto text-xs text-muted-foreground">занят</span>
							{/if}
						</label>
					{/each}
				</div>

				<Button type="submit" class="shrink-0">Сохранить</Button>
			</form>
		{/if}
	</DialogContent>
</Dialog>
