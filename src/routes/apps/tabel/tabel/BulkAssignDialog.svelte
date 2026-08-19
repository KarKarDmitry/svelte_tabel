<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { parse } from 'devalue';
	import { cn } from '$lib/utils';

	let {
		show = $bindable(false),
		bulkDept = $bindable(null),
		dayMarks,
		calendarDays,
		year,
		month
	}: {
		show: boolean;
		/** Текущее подразделение для назначения (id + employees), либо null */
		bulkDept: any | null;
		dayMarks: any[];
		calendarDays: Record<string, { dayType: string; workTime: number | null }>;
		year: number;
		month: number;
	} = $props();

	const deptId = $derived(bulkDept?.id ?? 0);
	const employees = $derived(bulkDept?.employees ?? []);

	let step = $state<'select' | 'preview'>('select');
	let selectedEmpIds = $state<Set<number>>(new Set());
	let selectedDates = $state<Set<string>>(new Set());
	let markValue = $state('');
	let hoursInput = $state('');
	let busy = $state(false);

	type PreviewRow = {
		emp: any;
		date: string;
		oldMark: string;
		oldHours: string;
		newMark: string;
		newHours: string;
	};
	/** Строки таблицы «Проверка изменений» — редактируемые (метка/часы построчно) */
	let previewRows = $state<PreviewRow[]>([]);

	// Сброс выборов при закрытии или при смене подразделения
	function resetForm() {
		step = 'select';
		selectedEmpIds = new Set();
		selectedDates = new Set();
		markValue = '';
		hoursInput = '';
		previewRows = [];
	}

	$effect(() => {
		if (!show) resetForm();
	});

	$effect(() => {
		bulkDept?.id;
		if (show) resetForm();
	});

	function pad(n: number): string {
		return String(n).padStart(2, '0');
	}

	const lastDay = $derived(new Date(year, month, 0).getDate());
	// Первый день месяца: 0 = Пн … 6 = Вс
	const firstOffset = $derived((new Date(year, month - 1, 1).getDay() + 6) % 7);
	const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
	const cells = $derived([
		...Array.from({ length: firstOffset }, () => null as number | null),
		...Array.from({ length: lastDay }, (_, i) => i + 1)
	]);

	function dateStr(day: number): string {
		return `${year}-${pad(month)}-${pad(day)}`;
	}

	const selectedEmployees = $derived(employees.filter((e: any) => selectedEmpIds.has(e.id)));

	function getMarkShort(code: string | null | undefined): string {
		if (!code) return '—';
		const m = dayMarks.find((x: any) => x.shortName === code || x.code === code);
		return m?.shortName ?? code;
	}

	/** Часовая раскладка: отчётные приоритетны, иначе сменные */
	function hoursOf(day: any): string {
		const v = day?.reportWorkTime ?? day?.shiftWorkTime;
		return v != null ? (v / 60).toFixed(1) : '—';
	}

	// --- Превью изменений ---
	const preview = $derived.by(() => {
		const rows: Array<{
			emp: any;
			date: string;
			oldMark: string;
			oldHours: string;
			newMark: string;
			newHours: string;
		}> = [];
		// Пустая метка — полная очистка дня (метка и часы), как «» на сервере
		const isClear = markValue.trim() === '';
		const newHours = hoursInput.trim() ? Number(hoursInput).toFixed(1) : null;

		for (const emp of selectedEmployees) {
			const byDate = new Map((emp.days ?? []).map((d: any) => [d.date, d]));
			for (const day of cells) {
				if (day == null) continue;
				const ds = dateStr(day);
				if (!selectedDates.has(ds)) continue;
				const d: any = byDate.get(ds);
				if (d?.blocked) continue; // вне периода работы — не трогаем
				rows.push({
					emp,
					date: ds,
					oldMark: getMarkShort(d?.dayMarkCode),
					oldHours: hoursOf(d),
					newMark: isClear ? '' : markValue,
					newHours: isClear ? '—' : (newHours ?? hoursOf(d))
				});
			}
		}
		return rows;
	});

	const canNext = $derived(selectedEmpIds.size > 0 && selectedDates.size > 0);

	function toggleEmp(id: number) {
		const next = new Set(selectedEmpIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedEmpIds = next;
	}

	function toggleDate(ds: string) {
		const next = new Set(selectedDates);
		if (next.has(ds)) next.delete(ds);
		else next.add(ds);
		selectedDates = next;
	}

	function selectAllDates() {
		selectedDates = new Set(cells.filter((c): c is number => c != null).map((c) => dateStr(c)));
	}

	/** Переход на шаг проверки: фиксируем snapshot строк из выбранного */
	function goToPreview() {
		previewRows = preview;
		step = 'preview';
	}

	function setRowMark(row: PreviewRow, shortName: string) {
		row.newMark = shortName;
		if (shortName.trim() === '') {
			row.newHours = '—'; // полная очистка — часы сбрасываются
		} else if (row.newHours === '—') {
			row.newHours = row.oldHours; // отмена очистки — возвращаем «как было»
		}
	}

	function setRowHours(row: PreviewRow, value: string) {
		if (row.newMark.trim() === '') return; // при очистке дня часы не меняем
		row.newHours = value;
	}

	function markName(shortName: string): string {
		return dayMarks.find((m: any) => m.shortName === shortName)?.name ?? shortName;
	}

	async function apply() {
		busy = true;
		try {
			const updates = previewRows.map((r) => ({
				employeeId: r.emp.id,
				date: r.date,
				shortName: r.newMark.trim(),
				hours: r.newHours === '—' ? '' : r.newHours
			}));

			const body = new URLSearchParams();
			body.set('deptId', String(deptId));
			body.set('updates', JSON.stringify(updates));

			const res = await fetch('/apps/tabel/tabel?/bulkAssign', { method: 'POST', body });
			const raw = await res.json().catch(() => ({}));

			// SvelteKit оборачивает ответ action: { type: 'success' | 'failure', data: <devalue> }
			let actionData: any = raw?.data;
			if (typeof actionData === 'string') actionData = parse(actionData);

			if (raw?.type !== 'success' || !actionData?.success) {
				console.error('[bulkAssign] ответ сервера:', res.status, raw);
				toast.error(actionData?.message ?? 'Не удалось применить назначение');
				return;
			}
			toast.success(`Применено: ${actionData?.count ?? updates.length} записей`);
			show = false;
			await invalidateAll();
		} catch (err: any) {
			console.error('[bulkAssign] ошибка запроса:', err);
			toast.error('Не удалось применить назначение: ' + (err?.message ?? String(err)));
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open={show}>
	<DialogContent
		class="flex max-h-[calc(100dvh-2em)] flex-col overflow-hidden px-2"
		style="width: min(1100px, calc(100vw - 2rem)); max-width: min(1100px, calc(100vw - 2rem))"
	>
		<DialogHeader>
			<DialogTitle>
				{step === 'select' ? 'Быстрое назначение' : 'Проверка изменений'}
			</DialogTitle>
		</DialogHeader>

		{#if step === 'select'}
			<div class="grid grid-cols-1 gap-6 overflow-auto px-2 md:grid-cols-3">
				<!-- Зона 1: сотрудники -->
				<div class="flex flex-col gap-2">
					<p class="text-sm font-medium">Сотрудники ({selectedEmpIds.size}/{employees.length})</p>
					<div class="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
						{#each employees as emp}
							<label
								class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/50 has-aria-checked:bg-accent"
							>
								<Checkbox
									checked={selectedEmpIds.has(emp.id)}
									onCheckedChange={() => toggleEmp(emp.id)}
								/>
								<span class="font-mono text-xs text-muted-foreground">{emp.number}</span>
								<span class="truncate">
									{emp.lastName}
									{emp.firstName}
									{emp.middleName ?? ''}
								</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- Зона 2: даты -->
				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between">
						<p class="text-sm font-medium">Даты ({selectedDates.size})</p>
						<div class="flex gap-2">
							<Button
								variant={selectedDates.size === cells.filter((x) => x != null).length
									? 'default'
									: 'ghost'}
								size="sm"
								onclick={selectAllDates}
							>
								Все
							</Button>
							<Button variant="destructive" size="sm" onclick={() => (selectedDates = new Set())}>
								Сбросить
							</Button>
						</div>
					</div>
					<div class="grid grid-cols-7 gap-1 text-center">
						{#each weekDays as wd}
							<div class="text-[10px] font-medium text-muted-foreground">{wd}</div>
						{/each}
						{#each cells as day}
							{#if day == null}
								<div></div>
							{:else}
								{@const ds = dateStr(day)}
								{@const info = calendarDays[ds]}
								{@const isWeekend = info?.dayType === 'weekend' || info?.dayType === 'holiday'}
								{@const sel = selectedDates.has(ds)}
								<button
									type="button"
									class={cn(
										'rounded-md border py-1.5 text-xs transition-colors',
										sel
											? 'border-primary bg-primary text-primary-foreground'
											: isWeekend
												? 'border-border text-destructive hover:bg-muted/50'
												: 'border-border hover:bg-muted/50'
									)}
									onclick={() => toggleDate(ds)}
								>
									{day}
								</button>
							{/if}
						{/each}
					</div>
				</div>

				<!-- Зона 3: назначение -->
				<div class="flex flex-col gap-4">
					<p class="text-sm font-medium">Назначение</p>
					<div class="flex flex-col gap-1">
						<Label>
							Метка табеля
							<Select type="single" bind:value={markValue}>
								<SelectTrigger class="w-full">
									<span>
										{markValue === ''
											? 'Без метки (очистить день)'
											: (dayMarks.find((m: any) => m.shortName === markValue)?.name ?? markValue)}
									</span>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="">Без метки (очистить день)</SelectItem>
									{#each dayMarks as m}
										<SelectItem value={m.shortName}>
											{m.shortName} — {m.name}
										</SelectItem>
									{/each}
								</SelectContent>
							</Select>
						</Label>
					</div>
					<div class="flex flex-col gap-1">
						<Label for="bulk-hours">
							Часы (пусто — не менять)
							<Input
								id="bulk-hours"
								type="number"
								step="0.5"
								min="0"
								value={hoursInput}
								oninput={(e) => (hoursInput = (e.target as HTMLInputElement).value)}
								placeholder="напр. 8"
							/>
						</Label>
						{#if markValue.trim() === ''}
							<p class="text-xs text-muted-foreground">
								День будет полностью очищен — метка и часы сброшены
							</p>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<!-- Превью -->
			<div class="max-h-96 overflow-auto rounded-lg border">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-background/95 backdrop-blur">
						<tr class="border-b text-xs text-muted-foreground">
							<th class="px-3 py-2 text-left font-medium">Сотрудник</th>
							<th class="px-3 py-2 text-left font-medium">Дата</th>
							<th class="px-3 py-2 text-left font-medium">Было</th>
							<th class="px-3 py-2 text-left font-medium">Станет</th>
						</tr>
					</thead>
					<tbody>
						{#each previewRows as p}
							<tr class="border-b last:border-0">
								<td class="px-3 py-1.5">
									<span class="font-mono text-xs text-muted-foreground">{p.emp.number}</span>{' '}
									{p.emp.lastName}
									{p.emp.firstName}
								</td>
								<td class="px-3 py-1.5 font-mono text-xs">{p.date}</td>
								<td class="px-3 py-1.5 text-muted-foreground">
									{p.oldMark === '—' ? '—' : p.oldMark}
									{p.oldHours !== '—' ? ` · ${p.oldHours}ч` : ''}
								</td>
								<td class="px-3 py-1.5">
									<div class="flex items-center gap-1">
										<Select type="single" value={p.newMark} onValueChange={(v) => setRowMark(p, v)}>
											<SelectTrigger
												class="h-7 w-14 px-1 text-xs"
												title={p.newMark ? markName(p.newMark) : 'Без метки (очистить день)'}
											>
												<span>{p.newMark || '—'}</span>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="">—</SelectItem>
												{#each dayMarks as m}
													<SelectItem value={m.shortName}>{m.shortName}</SelectItem>
												{/each}
											</SelectContent>
										</Select>
										<Input
											class="h-7 w-16 px-1 text-xs"
											type="number"
											step="0.5"
											min="0"
											disabled={p.newMark === ''}
											value={p.newHours === '—' ? '' : p.newHours}
											placeholder={p.newMark === '' ? '—' : 'ч'}
											oninput={(e) => setRowHours(p, (e.target as HTMLInputElement).value)}
										/>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="4" class="h-24 text-center text-muted-foreground">
									Нет записей для применения
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="flex justify-end gap-2">
			{#if step === 'preview'}
				<Button variant="outline" onclick={() => (step = 'select')} disabled={busy}>Назад</Button>
			{/if}
			<Button variant="outline" onclick={() => (show = false)} disabled={busy}>Отмена</Button>
			{#if step === 'select'}
				<Button onclick={goToPreview} disabled={!canNext}>Далее</Button>
			{:else}
				<Button onclick={apply} disabled={busy || previewRows.length === 0}>
					{busy ? 'Применяю…' : `Применить (${previewRows.length})`}
				</Button>
			{/if}
		</div>
	</DialogContent>
</Dialog>
