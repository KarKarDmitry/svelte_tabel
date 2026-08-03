<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';

	let emp = $derived($page.data.employee);
	let lastDoc = $derived($page.data.lastDoc);
	let isDismissed = $derived($page.data.isDismissed);
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
	<Card>
		<CardHeader><CardTitle>Основная информация</CardTitle></CardHeader>
		<CardContent>
			<form method="post" action="?/update" use:enhance class="flex flex-col gap-4">
				<div>
					<label for="number" class="text-sm font-medium text-gray-700">Табельный номер</label>
					<Input id="number" name="number" value={emp.number} required />
				</div>
				<div>
					<label for="lastName" class="text-sm font-medium text-gray-700">Фамилия</label>
					<Input id="lastName" name="lastName" value={emp.lastName} required />
				</div>
				<div>
					<label for="firstName" class="text-sm font-medium text-gray-700">Имя</label>
					<Input id="firstName" name="firstName" value={emp.firstName} required />
				</div>
				<div>
					<label for="middleName" class="text-sm font-medium text-gray-700">Отчество</label>
					<Input id="middleName" name="middleName" value={emp.middleName ?? ''} />
				</div>
				<Button type="submit">Сохранить</Button>
			</form>
		</CardContent>
	</Card>

	<Card>
		<CardHeader><CardTitle>Текущий статус</CardTitle></CardHeader>
		<CardContent class="space-y-3">
			<div>
				<span class="text-xs text-gray-500">Статус</span>
				<p>
					{#if isDismissed}
						<Badge variant="destructive">Уволен</Badge>
					{:else if lastDoc}
						<Badge>Активен</Badge>
					{:else}
						<Badge variant="outline">Ожидает</Badge>
					{/if}
				</p>
			</div>
			{#if !isDismissed && !lastDoc}
				<form
					method="post"
					action="?/hire"
					class="flex flex-col gap-3 border-t pt-3"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'redirect') toast.success('Приём оформлен');
						};
					}}
				>
					<p class="text-sm font-medium">Оформить приём</p>
					<select
						name="departmentId"
						required
						class="rounded-md border border-input px-3 py-2 text-sm"
					>
						{#each $page.data.departments as d}
							<option value={d.id}>{d.name}</option>
						{/each}
					</select>
					<select
						name="positionId"
						required
						class="rounded-md border border-input px-3 py-2 text-sm"
					>
						{#each $page.data.positions as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
					<Input name="date" type="date" value={new Date().toISOString().split('T')[0]} required />
					<Button type="submit">Принять на работу</Button>
				</form>
			{/if}
			{#if lastDoc && !isDismissed}
				<div>
					<span class="text-xs text-gray-500">Подразделение</span>
					<p class="font-medium">
						{$page.data.departments.find((d: any) => d.id === lastDoc.departmentId)?.name ?? '—'}
					</p>
				</div>
				<div>
					<span class="text-xs text-gray-500">Должность</span>
					<p class="font-medium">
						{$page.data.positions.find((p: any) => p.id === lastDoc.positionId)?.name ?? '—'}
					</p>
				</div>
				<div>
					<span class="text-xs text-gray-500">Дата последнего документа</span>
					<p class="font-medium">{lastDoc.date}</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
