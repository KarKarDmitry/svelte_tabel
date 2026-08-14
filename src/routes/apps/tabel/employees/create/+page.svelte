<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import DatePicker from '$lib/components/DatetimePick/DatePicker.svelte';
	import type { PageServerData } from './$types';
	import { page } from '$app/state';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	let { data }: { data: PageServerData } = $props();
	let canEdit = $derived(page.data.canEdit ?? false);
	let createDept = $state('');
	let createPos = $state('');
	let createDate = $state(new Date().toISOString().split('T')[0]);
	let numberTaken = $state<{
		id: number;
		number: string;
		lastName: string;
		firstName: string;
		middleName: string | null;
	} | null>(null);
</script>

<div class="w-full">
	{#if !canEdit}
		<p class="text-sm text-muted-foreground">Создание сотрудников недоступно: недостаточно прав.</p>
	{:else}
		{#if numberTaken}
			<Card class="border-destructive/40 bg-destructive/5">
				<CardContent class="flex flex-col gap-1">
					<p class="font-medium text-destructive">Табельный номер {numberTaken.number} уже занят</p>
					<p class="text-sm">
						Он принадлежит сотруднику
						<a class="underline" href={`/apps/tabel/employees/${numberTaken.id}`}>
							{numberTaken.lastName}
							{numberTaken.firstName}
							{numberTaken.middleName ?? ''}
						</a>. Если это тот же сотрудник — откройте его карточку и создайте новый кадровый
						документ.
					</p>
				</CardContent>
			</Card>
		{/if}
		<form
			method="post"
			action="?/create"
			use:enhance={() => {
				return async ({ result }) => {
					numberTaken = null;
					if (result.type === 'failure') {
						const d = (result.data ?? {}) as any;
						if (d?.error === 'number_taken') numberTaken = d.existing ?? null;
					}
				};
			}}
		>
			<div class=" flex items-center justify-between">
				<a href="/apps/tabel/employees" class="text-sm text-muted-foreground hover:text-foreground"
					><ArrowLeft class="mr-1 inline size-4" />Назад к списку</a
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
							<p class="text-sm text-muted-foreground">
								* Можно оставить пустым. Сотрудник попадет в "Ожидание"
							</p>
						</div>
					</CardHeader>

					<CardContent class="flex flex-col gap-4">
						<Select type="single" bind:value={createDept}>
							<SelectTrigger class="w-full">
								<span
									>{data.departments.find((d: any) => String(d.id) === createDept)?.name ??
										'Подразделение'}</span
								>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">Подразделение</SelectItem>
								{#each data.departments as d}<SelectItem value={String(d.id)}>{d.name}</SelectItem
									>{/each}
							</SelectContent>
						</Select>
						<input type="hidden" name="departmentId" value={createDept} />
						<Select type="single" bind:value={createPos}>
							<SelectTrigger class="w-full">
								<span
									>{data.positions.find((p: any) => String(p.id) === createPos)?.name ??
										'Должность'}</span
								>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">Должность</SelectItem>
								{#each data.positions as p}<SelectItem value={String(p.id)}>{p.name}</SelectItem
									>{/each}
							</SelectContent>
						</Select>
						<input type="hidden" name="positionId" value={createPos} />
						<div class="flex flex-col gap-1">
							<Label for="date">Дата приёма</Label>
							<DatePicker name="date" value={createDate} onchange={(v) => (createDate = v)} />
						</div>
						<Input name="docNumber" placeholder="Номер приказа" />
					</CardContent>
				</Card>
			</div>
		</form>
	{/if}
</div>
