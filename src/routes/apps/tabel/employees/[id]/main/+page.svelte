<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import DatePicker from '$lib/components/DatetimePick/DatePicker.svelte';
	import { toast } from 'svelte-sonner';

	let emp = $derived($page.data.employee);
	let lastDoc = $derived($page.data.lastDoc);
	let isDismissed = $derived($page.data.isDismissed);
	let canEdit = $derived($page.data.canEditEmployee ?? false);
	let hireDept = $state('');
	let hirePos = $state('');
	let hireDate = $state(new Date().toISOString().split('T')[0]);
	let numberTaken = $state<{
		id: number;
		number: string;
		lastName: string;
		firstName: string;
		middleName: string | null;
	} | null>(null);
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
	<Card>
		<CardHeader><CardTitle>Основная информация</CardTitle></CardHeader>
		<CardContent>
			{#if canEdit}
				<form
					method="post"
					action="?/update"
					use:enhance={() => {
						return async ({ result }) => {
							numberTaken = null;
							if (result.type === 'failure') {
								const d = (result.data ?? {}) as any;
								if (d?.error === 'number_taken') numberTaken = d.existing ?? null;
								else toast.error(d?.message ?? 'Не удалось сохранить');
							}
						};
					}}
					class="flex flex-col gap-4"
				>
					<Label for="number"
						>Табельный номер
						<Input id="number" name="number" value={emp.number} required />
					</Label>
					<Label for="lastName"
						>Фамилия
						<Input id="lastName" name="lastName" value={emp.lastName} required />
					</Label>
					<Label for="firstName"
						>Имя
						<Input id="firstName" name="firstName" value={emp.firstName} required />
					</Label>
					<Label for="middleName"
						>Отчество
						<Input id="middleName" name="middleName" value={emp.middleName ?? ''} />
					</Label>
					<Button type="submit">Сохранить</Button>
				</form>
				{#if numberTaken}
					<div class="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
						<p class="text-sm font-medium text-destructive">
							Табельный номер {numberTaken.number} уже занят
						</p>
						<p class="mt-1 text-sm">
							Он принадлежит сотруднику
							<a class="underline" href={`/apps/tabel/employees/${numberTaken.id}`}>
								{numberTaken.lastName}
								{numberTaken.firstName}
								{numberTaken.middleName ?? ''}
							</a>. Если это тот же сотрудник — откройте его карточку и создайте новый кадровый
							документ.
						</p>
					</div>
				{/if}
			{:else}
				<div class="space-y-2 text-sm">
					<p><span class="text-xs text-muted-foreground">Табельный номер</span><br />{emp.number}</p>
					<p>
						<span class="text-xs text-muted-foreground">ФИО</span><br />
						{emp.lastName}
						{emp.firstName}
						{emp.middleName ?? ''}
					</p>
				</div>
			{/if}
		</CardContent>
	</Card>

	<Card>
		<CardHeader><CardTitle>Текущий статус</CardTitle></CardHeader>
		<CardContent class="space-y-3">
			<div>
				<Label class="flex flex-row items-center gap-2">
					Статус
					{#if isDismissed}
						<Badge variant="destructive">Уволен</Badge>
					{:else if lastDoc}
						<Badge>Активен</Badge>
					{:else}
						<Badge variant="outline">Ожидает</Badge>
					{/if}
				</Label>
			</div>
			{#if !isDismissed && !lastDoc && canEdit}
				<form
					method="post"
					action="?/hire"
					class="flex flex-col gap-3 border-t pt-3"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'redirect') toast.success('Приём оформлен');
							else if (result.type === 'failure') {
								toast.error((result.data as any)?.message ?? 'Не удалось оформить приём');
							}
						};
					}}
				>
					<p class="text-sm font-medium">Оформить приём</p>
					<Select type="single" bind:value={hireDept}>
						<SelectTrigger class="w-full">
							<span
								>{$page.data.departments.find((d: any) => String(d.id) === hireDept)?.name ??
									'Выберите подразделение'}</span
							>
						</SelectTrigger>
						<SelectContent>
							{#each $page.data.departments as d}
								<SelectItem value={String(d.id)}>{d.name}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
					<input type="hidden" name="departmentId" value={hireDept} />
					<Select type="single" bind:value={hirePos}>
						<SelectTrigger class="w-full">
							<span
								>{$page.data.positions.find((p: any) => String(p.id) === hirePos)?.name ??
									'Выберите должность'}</span
							>
						</SelectTrigger>
						<SelectContent>
							{#each $page.data.positions as p}
								<SelectItem value={String(p.id)}>{p.name}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
					<input type="hidden" name="positionId" value={hirePos} />
					<DatePicker name="date" value={hireDate} onchange={(v) => (hireDate = v)} />
					<Button type="submit" disabled={!hireDept || !hirePos}>Принять на работу</Button>
				</form>
			{/if}
			{#if lastDoc && !isDismissed}
				<div>
					<Label>Подразделение</Label>
					<p class="font-medium">
						{$page.data.allDepartments.find((d: any) => d.id === lastDoc.departmentId)?.name ?? '—'}
					</p>
				</div>
				<div>
					<Label>Должность</Label>
					<p class="font-medium">
						{$page.data.positions.find((p: any) => p.id === lastDoc.positionId)?.name ?? '—'}
					</p>
				</div>
				<div>
					<Label>Дата последнего документа</Label>
					<p class="font-medium">
						{new Date(lastDoc.date).toLocaleString('ru-RU', {
							day: '2-digit',
							month: '2-digit',
							year: 'numeric'
						})}
					</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
