<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="w-full">
	<form method="post" action="?/create" use:enhance>
		<div class=" flex items-center justify-between">
			<a href="/apps/tabel/employees" class="text-sm text-gray-500 hover:text-gray-700"
				>← Назад к списку</a
			>
			<Button type="submit" size="lg">Сохранить</Button>
		</div>
		<div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
			<Card>
				<CardHeader><CardTitle>Основные данные</CardTitle></CardHeader>
				<CardContent class="flex flex-col gap-4">
					<Input name="number" placeholder="Табельный номер*" required />
					<Input name="lastName" placeholder="Фамилия*" required />
					<Input name="firstName" placeholder="Имя*" required />
					<Input name="middleName" placeholder="Отчество" />
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div class="flex flex-row flex-wrap items-center justify-between gap-2">
						<CardTitle class="whitespace-nowrap">Приём на работу</CardTitle>
						<p class="text-sm text-gray-500">
							* Можно оставить пустым. Сотрудник попадет в "Ожидание"
						</p>
					</div>
				</CardHeader>

				<CardContent class="flex flex-col gap-4">
					<select
						name="departmentId"
						class="rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="">Подразделение</option>
						{#each data.departments as d}
							<option value={d.id}>{d.name}</option>
						{/each}
					</select>
					<select
						name="positionId"
						class="rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="">Должность</option>
						{#each data.positions as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
					<div class="flex flex-col gap-1">
						<Label for="date">Дата приёма</Label>
						<Input name="date" type="date" value={new Date().toISOString().split('T')[0]} />
					</div>
					<Input name="docNumber" placeholder="Номер приказа" />
				</CardContent>
			</Card>
		</div>
	</form>
</div>
