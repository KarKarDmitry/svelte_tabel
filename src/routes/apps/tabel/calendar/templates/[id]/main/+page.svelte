<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let tpl = $derived($page.data.template);

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
	<form method="post" action="?/update" class="flex max-w-lg flex-col gap-4" use:enhance>
		<input type="hidden" name="weekDays" value={weekDays.join(',')} />

		<div class="flex flex-col gap-1">
			<label for="name" class="text-sm font-medium">Название</label>
			<Input id="name" name="name" value={tpl.name} required />
		</div>

		<div class="flex flex-col gap-1">
			<label class="text-sm font-medium">
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
			</label>
		</div>

		<div class="flex flex-col gap-1">
			<label for="defaultWorkTime" class="text-sm font-medium"
				>Норма рабочего времени (часы:минуты)</label
			>
			<Input
				id="defaultWorkTime"
				name="defaultWorkTime"
				type="time"
				value={hoursVal}
				oninput={(e) => (hoursVal = (e.target as HTMLInputElement).value)}
				required
			/>
		</div>

		<div>
			<Button type="submit">Сохранить</Button>
		</div>
	</form>
</div>
