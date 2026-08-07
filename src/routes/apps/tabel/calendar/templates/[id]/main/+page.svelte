<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import TimeInput from '$lib/components/DatetimePick/TimeInput.svelte';

	let tpl = $derived($page.data.template);
	let canEdit = $derived($page.data.canEdit ?? false);

	const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

	let weekDays = $state<number[]>(
		(() => {
			try {
				return JSON.parse($page.data.template.defaultWorkDays ?? '[1,2,3,4,5]');
			} catch {
				return [1, 2, 3, 4, 5];
			}
		})()
	);

	let hoursVal = $state(
		(() => {
			const h = Math.floor($page.data.template.defaultWorkTime / 60);
			const m = $page.data.template.defaultWorkTime % 60;
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		})()
	);

	function toggleDay(day: number) {
		if (weekDays.includes(day)) {
			weekDays = weekDays.filter((d) => d !== day);
		} else {
			weekDays = [...weekDays, day].sort((a, b) => a - b);
		}
	}

	let generateSuccess = $state(false);
</script>

<div class="space-y-6">
	{#if canEdit}
		<form method="post" action="?/update" class="flex max-w-lg flex-col gap-4" use:enhance>
			<input type="hidden" name="weekDays" value={weekDays.join(',')} />

			<div class="flex flex-col gap-1">
				<Label for="name">Название</Label>
				<Input id="name" name="name" value={tpl.name} required />
			</div>

			<div class="flex flex-col gap-1">
				<Label>
					Рабочие дни недели
					<div class="flex flex-wrap gap-2">
						{#each dayNames as name, i}
							<Button
								type="button"
								variant={weekDays.includes(i + 1) ? 'default' : 'outline'}
								size="sm"
								onclick={() => toggleDay(i + 1)}
							>
								{name}
							</Button>
						{/each}
					</div>
				</Label>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="defaultWorkTime">Норма рабочего времени (часы:минуты)</Label>
				<TimeInput name="defaultWorkTime" value={hoursVal} onchange={(v) => (hoursVal = v)} />
			</div>

			<div>
				<Button type="submit">Сохранить</Button>
			</div>
		</form>
	{:else}
		<p class="text-sm text-muted-foreground">
			Шаблон «{tpl.name}». Недостаточно прав для редактирования.
		</p>
	{/if}
</div>
