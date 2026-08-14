<script lang="ts">
	import { page } from '$app/stores';
	import { PageHeader, Card, Select, Checkbox, Button } from '$lib/components/native/ui';
	import { Collapsible, Flex } from '$lib/components/native/ui';

	const roleOptions = [
		{ value: 'user', label: 'Пользователь' },
		{ value: 'timekeeper', label: 'Табельщик' },
		{ value: 'admin', label: 'Администратор' }
	];

	const data = $derived($page.data);
	const form = $derived($page.form);
	const user = $derived(data.user);

	const selected = $derived(
		new Set(
			data.assignments.filter((a: any) => a.userId === user?.id).map((a: any) => a.departmentId)
		)
	);

	// Группируем подразделения по группам; без группы — в конце
	const grouped = $derived.by(() => {
		const groups = (data.departmentGroups ?? []) as any[];
		const result = groups
			.map((g) => {
				const deptIds = new Set(g.departments.map((m: any) => m.departmentId));
				return {
					id: g.id,
					name: g.name,
					departments: data.departments.filter((d: any) => deptIds.has(d.id))
				};
			})
			.filter((g) => g.departments.length > 0);

		const inGroup = new Set(result.flatMap((g) => g.departments.map((d: any) => d.id)));
		const ungrouped = data.departments.filter((d: any) => !inGroup.has(d.id));
		if (ungrouped.length > 0) {
			result.push({ id: 0, name: 'Без группы', departments: ungrouped });
		}
		return result;
	});
</script>

<svelte:head>
	<script>
		function nativeCheckGroup(group, checked) {
			var boxes = document.querySelectorAll(
				'input[name=departmentIds][data-group="' + group + '"]'
			);
			for (var i = 0; i < boxes.length; i++) boxes[i].checked = checked;
		}
		function nativeCheckAll(checked) {
			var boxes = document.querySelectorAll('input[name=departmentIds]');
			for (var i = 0; i < boxes.length; i++) boxes[i].checked = checked;
		}
	</script>
</svelte:head>

<PageHeader
	title={`Доступ: ${user?.name ?? ''}`}
	note={user?.email}
	backHref="/native/admin"
	backLabel="К пользователям"
/>

{#if form}
	<div class="native-msg {form.success ? 'ok' : 'err'}">{form.message ?? 'Ошибка'}</div>
{/if}

<form method="post" action="?/saveAccess">
	<Card title="Параметры">
		<Select name="role" label="Роль" options={roleOptions} value={user?.role ?? 'user'} required />

		<div class="n-access-actions">
			{@html `<button type="button" class="native-btn native-btn-small" onclick="nativeCheckAll(true)">Выделить всех</button>`}
			{@html `<button type="button" class="native-btn native-btn-small" onclick="nativeCheckAll(false)">Снять все</button>`}
		</div>

		<Flex>
			{#each grouped as group}
				<Collapsible id={`acc_${group.id}`} title={group.name}>
					<div class="n-access-group-actions">
						<span class="n-access-count">
							{group.departments.filter((d: any) => selected.has(d.id)).length}/{group.departments
								.length}
						</span>
						{@html `<button type="button" class="native-btn native-btn-small" onclick="nativeCheckGroup(${group.id}, true)">Выделить всех</button>`}
						{@html `<button type="button" class="native-btn native-btn-small" onclick="nativeCheckGroup(${group.id}, false)">Снять</button>`}
					</div>
					<div class="n-access-depts">
						{#each group.departments as dept}
							<Checkbox
								name="departmentIds"
								value={dept.id}
								label={dept.name}
								checked={selected.has(dept.id)}
								data-group={group.id}
							/>
						{/each}
					</div>
				</Collapsible>
			{/each}
		</Flex>

		<Button type="submit" size="sm">Сохранить</Button>
	</Card>
</form>

<style>
	.n-access-actions {
		margin: 4px 0 10px;
	}
	.n-access-actions :global(.native-btn),
	.n-access-group-actions :global(.native-btn) {
		margin-right: 4px;
	}
	.n-access-group-actions {
		margin-bottom: 6px;
	}
	.n-access-count {
		font-size: 13px;
		color: #6b7280;
		margin-right: 8px;
	}
	.n-access-depts {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 3px;
	}
</style>
