<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import TimeInput from '$lib/components/DatetimePick/TimeInput.svelte';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import type { PageServerData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data }: { data: PageServerData } = $props();

	let canEdit = $derived(page.data.canEdit ?? false);

	let schedule = $derived(data.schedule);
	let points: any[] = $derived(data.schedule.points ?? []);

	// --- основные параметры (редактируемые) ---
	const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
	let weekDays = $derived(parseWeekDays(schedule.weekDays));
	let hoursMinutes = $derived(minutesToHHMM(schedule.standardWorkTime));
	let nameVal = $derived(schedule.name);

	function parseWeekDays(v: string | null): number[] {
		if (!v) return [];
		try {
			return JSON.parse(v);
		} catch {
			return [];
		}
	}

	function minutesToHHMM(minutes: number): string {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
	}

	async function saveMain() {
		const f = new FormData();
		f.set('name', nameVal);
		f.set('hours', hoursMinutes);
		f.set('weekDays', weekDays.join(','));
		await fetch(`/apps/tabel/schedules/${schedule.id}`, { method: 'PATCH', body: f });
	}

	// --- точки ---
	const pointColors: Record<string, string> = {
		Entry: 'bg-green-600 dark:bg-green-500',
		Exit: 'bg-red-600 dark:bg-red-500',
		Break: 'bg-yellow-600 dark:bg-yellow-500'
	};

	const pointLabels: Record<string, string> = {
		Entry: 'Начало',
		Exit: 'Конец',
		Break: 'Перерыв'
	};

	const sortedPoints = $derived([...points].sort((a, b) => a.time.localeCompare(b.time)));

	function timeToPercent(time: string): number {
		const [h, m] = time.split(':').map(Number);
		return ((h * 60 + m) / (24 * 60)) * 100;
	}

	function formatBound(minutes: number): string {
		return minutes ? `${minutes}мин` : '0';
	}

	// --- диалог точки ---
	let editOpen = $state(false);
	let editPoint = $state<any>(null);
	let addMode = $state(false);
	let tabValue = $state('main');

	function openAdd() {
		addMode = true;
		editPoint = { type: 'Entry', time: '08:00', endTime: '', leftBound: 15, rightBound: 15 };
		editOpen = true;
	}

	function openEdit(point: any) {
		addMode = false;
		editPoint = { ...point, endTime: point.endTime ?? '' };
		editOpen = true;
	}

	async function savePoint() {
		const form = new FormData();
		form.set('type', editPoint.type);
		form.set('time', editPoint.time);
		form.set('endTime', editPoint.endTime || '');
		form.set('leftBound', String(editPoint.leftBound ?? 0));
		form.set('rightBound', String(editPoint.rightBound ?? 0));

		if (addMode) {
			const res = await fetch(`/apps/tabel/schedules/${schedule.id}/points`, {
				method: 'POST',
				body: form
			});
			if (res.ok) {
				const j = await res.json();
				if (j.point) points = [...points, j.point];
			}
		} else {
			await fetch(`/apps/tabel/schedules/${schedule.id}/points/${editPoint.id}`, {
				method: 'PATCH',
				body: form
			});
			// Обновляем локально
			points = points.map((p) =>
				p.id === editPoint.id
					? {
							...p,
							type: editPoint.type,
							time: editPoint.time,
							endTime: editPoint.endTime || null,
							leftBound: editPoint.leftBound,
							rightBound: editPoint.rightBound
						}
					: p
			);
		}
		editOpen = false;
	}

	async function deletePoint(id: number) {
		// Оптимистично удаляем
		points = points.filter((p) => p.id !== id);

		await fetch(`/apps/tabel/schedules/${schedule.id}/points/${id}`, {
			method: 'DELETE'
		});
	}

	async function movePoint(index: number, direction: -1 | 1) {
		const arr = sortedPoints;
		const target = index + direction;
		if (target < 0 || target >= arr.length) return;

		const a = arr[index];
		const b = arr[target];

		const tempTime = a.time;

		const aIdx = points.indexOf(a);
		const bIdx = points.indexOf(b);

		const newA = { ...a, time: b.time };
		const newB = { ...b, time: tempTime };

		if (a.type !== 'Break') newA.endTime = null;
		if (b.type !== 'Break') newB.endTime = null;

		points = points.map((p, i) => {
			if (i === aIdx) return newA;
			if (i === bIdx) return newB;
			return p;
		});

		await Promise.all([
			fetch(`/apps/tabel/schedules/${schedule.id}/points/${a.id}`, {
				method: 'PATCH',
				body: (() => {
					const f = new FormData();
					f.set('time', b.time);
					f.set('endTime', a.type === 'Break' ? b.endTime || '' : '');
					f.set('leftBound', String(a.leftBound));
					f.set('rightBound', String(a.rightBound));
					f.set('type', a.type);
					return f;
				})()
			}),
			fetch(`/apps/tabel/schedules/${schedule.id}/points/${b.id}`, {
				method: 'PATCH',
				body: (() => {
					const f = new FormData();
					f.set('time', tempTime);
					f.set('endTime', b.type === 'Break' ? a.endTime || '' : '');
					f.set('leftBound', String(b.leftBound));
					f.set('rightBound', String(b.rightBound));
					f.set('type', b.type);
					return f;
				})()
			})
		]);
	}
</script>

<div class="space-y-4">
	<!-- Шапка -->
	<div class="flex items-center gap-4">
		<a href="/apps/tabel/schedules" class="text-sm text-muted-foreground hover:text-foreground">
			<ArrowLeft class="mr-1 inline size-4" />Назад к списку
		</a>
		<h1 class="text-2xl font-bold text-foreground">{schedule.name}</h1>
	</div>

	<Tabs bind:value={tabValue} class="w-full">
		<TabsList>
			<TabsTrigger value="main">Основное</TabsTrigger>
			<TabsTrigger value="points">Точки ({points.length})</TabsTrigger>
		</TabsList>

		<!-- === Вкладка: Основное === -->
		<TabsContent value="main">
			<Card>
				<CardContent>
					{#if canEdit}
						<form method="post" action="?/update" class="flex flex-col gap-4" use:enhance>
							<input type="hidden" name="weekDays" value={weekDays.join(',')} />
							<input type="hidden" name="hours" value={hoursMinutes} />

							<div class="flex flex-col gap-1">
								<Label
									>Название
									<Input
										name="name"
										value={nameVal}
										oninput={(e) => (nameVal = (e.target as HTMLInputElement).value)}
										required
									/>
								</Label>
							</div>

							<div class="flex flex-col gap-1">
								<Label
									>Норма (часов в день)
									<TimeInput
										name="hours"
										value={hoursMinutes}
										onchange={(v) => (hoursMinutes = v)}
									/>
								</Label>
							</div>

							<div class="flex flex-col gap-1">
								<Label
									>Рабочие дни
									<div class="flex flex-wrap gap-2">
										{#each dayNames as name, i}
											<Button
												type="button"
												variant={weekDays.includes(i + 1) ? 'default' : 'outline'}
												size="sm"
												onclick={() => {
													const idx = weekDays.indexOf(i + 1);
													if (idx >= 0) weekDays = weekDays.filter((d) => d !== i + 1);
													else weekDays = [...weekDays, i + 1].sort();
												}}>{name}</Button
											>
										{/each}
									</div>
								</Label>
							</div>

							<Button type="button" onclick={saveMain}>Сохранить</Button>
						</form>
					{:else}
						<div class="space-y-2 text-sm">
							<p>
								<span class="text-xs text-muted-foreground">Название</span><br />{schedule.name}
							</p>
							<p>
								<span class="text-xs text-muted-foreground">Норма</span><br />
								{hoursMinutes} · {dayNames.filter((_, i) => weekDays.includes(i + 1)).join(', ') ||
									'—'}
							</p>
						</div>
					{/if}
				</CardContent>
			</Card>
		</TabsContent>

		<!-- === Вкладка: Точки === -->
		<TabsContent value="points">
			<div>
				<!-- Визуальная временная шкала -->
				<Card class="p-0">
					<CardContent class="p-4">
						<div
							class="relative h-16 overflow-hidden rounded-lg border-2 border-border bg-gray-100 dark:bg-gray-800/40"
						>
							{#each Array(24) as _, i}
								<div
									class="absolute top-0 h-full border-l border-border pt-1 text-[10px] text-muted-foreground"
									style="left: {(i / 24) * 100}%"
								>
									<span class="ml-1">{String(i).padStart(2, '0')}:00</span>
								</div>
							{/each}

							{#each sortedPoints as pt}
								{@const pct = timeToPercent(pt.time)}
								{@const pctEnd = pt.endTime ? timeToPercent(pt.endTime) : pct}
								<button
									class="absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center"
									style="left: {pct}%"
									onclick={canEdit ? () => openEdit(pt) : undefined}
								>
									<span
										class="text-lg {pt.type === 'Break'
											? 'text-yellow-600 dark:text-yellow-400'
											: pt.type === 'Entry'
												? 'text-green-600 dark:text-green-400'
												: 'text-destructive'}"
									>
										{pt.type === 'Break' ? '◉' : pt.type === 'Entry' ? '●' : '✕'}
									</span>
									<span class="  mt-0.5 text-[10px] font-medium whitespace-nowrap">
										{pt.type === 'Break' ? `${pt.time}-${pt.endTime}` : pt.time}
									</span>
								</button>
								{#if pt.type === 'Break' && pt.endTime}
									<div
										class="absolute top-1/2 h-1 -translate-y-1/2 bg-yellow-600 opacity-50 dark:bg-yellow-500"
										style="left: {pct}%; width: {pctEnd - pct}%"
									></div>
								{/if}
							{/each}
						</div>

						<div class="mt-3 flex gap-4 text-xs text-muted-foreground">
							{#each Object.entries(pointLabels) as [type, label]}
								<div class="flex items-center gap-1">
									<span class="h-2 w-2 rounded-full {pointColors[type]}"></span>
									{label}
								</div>
							{/each}
						</div>
					</CardContent>
				</Card>

				<!-- Список точек -->
				<div class="flex items-center justify-between pt-6 pb-4">
					<h2 class="text-lg font-semibold">Точки графика ({points.length})</h2>
					{#if canEdit}
						<Button size="sm" onclick={openAdd}>+ Добавить точку</Button>
					{/if}
				</div>

				<div class="space-y-2">
					{#each sortedPoints as pt, i}
						<Card
							class="cursor-pointer p-0 transition-shadow hover:shadow-md"
							onclick={canEdit ? () => openEdit(pt) : undefined}
						>
							<CardContent class="flex items-center justify-between gap-4 p-3">
								<div class="flex flex-row items-center gap-1">
									{#if canEdit}
										<Button
											variant="ghost"
											size="sm"
											class="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
											disabled={i === 0}
											onclick={(e) => {
												e.stopPropagation();
												movePoint(i, -1);
											}}>▲</Button
										>
										<Button
											variant="ghost"
											size="sm"
											class="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
											disabled={i === sortedPoints.length - 1}
											onclick={(e) => {
												e.stopPropagation();
												movePoint(i, 1);
											}}>▼</Button
										>
									{/if}
									<div class="h-3 w-3 rounded-full {pointColors[pt.type]}"></div>
									<div>
										<span class="font-medium">{pointLabels[pt.type]}</span>
										<span class="ml-2 text-muted-foreground">
											{pt.type === 'Break' ? `${pt.time} — ${pt.endTime}` : pt.time}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-4 text-sm text-muted-foreground">
									<span title="Можно раньше / Можно позже"
										>−{formatBound(pt.leftBound)} / +{formatBound(pt.rightBound)}</span
									>
									{#if canEdit}
										<Button
											variant="ghost"
											size="sm"
											class="text-destructive hover:text-destructive"
											onclick={(e) => {
												e.stopPropagation();
												deletePoint(pt.id);
											}}
										>
											✕
										</Button>
									{/if}
								</div>
							</CardContent>
						</Card>
					{:else}
						<p class="py-8 text-center text-muted-foreground">
							Нет точек. Добавьте хотя бы Entry и Exit.
						</p>
					{/each}
				</div>
			</div>
		</TabsContent>
	</Tabs>

	<!-- Диалог точки -->
	<Dialog bind:open={editOpen}>
		<DialogContent>
			<div class="flex flex-col gap-4">
				<p class="font-bold">{addMode ? 'Добавить точку' : 'Редактировать точку'}</p>

				<div class="flex flex-col gap-1">
					<Label>
						Тип
						<Select
							type="single"
							value={editPoint?.type ?? 'Entry'}
							onValueChange={(v) => (editPoint = { ...editPoint, type: v ?? 'Entry' })}
						>
							<SelectTrigger class="w-full">
								<span>{pointLabels[editPoint?.type ?? 'Entry']}</span>
							</SelectTrigger>
							<SelectContent>
								{#each Object.entries(pointLabels) as [type, label]}
									<SelectItem value={type}>{label}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</Label>
				</div>

				<div class="flex flex-col gap-1">
					<Label>
						Время
						<TimeInput
							value={editPoint?.time ?? '08:00'}
							onchange={(v) => (editPoint = { ...editPoint, time: v })}
						/>
					</Label>
				</div>

				{#if editPoint?.type === 'Break'}
					<div class="flex flex-col gap-1">
						<Label>
							Конец перерыва
							<TimeInput
								value={editPoint?.endTime ?? ''}
								onchange={(v) => (editPoint = { ...editPoint, endTime: v })}
							/>
						</Label>
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-4">
					<div class="flex flex-col gap-1">
						<Label>
							Можно раньше (мин)
							<Input
								type="number"
								min="0"
								value={editPoint?.leftBound ?? 0}
								oninput={(e) =>
									(editPoint = {
										...editPoint,
										leftBound: Number((e.target as HTMLInputElement).value)
									})}
							/>
						</Label>
					</div>
					<div class="flex flex-col gap-1">
						<Label>
							Можно позже (мин)
							<Input
								type="number"
								min="0"
								value={editPoint?.rightBound ?? 0}
								oninput={(e) =>
									(editPoint = {
										...editPoint,
										rightBound: Number((e.target as HTMLInputElement).value)
									})}
							/>
						</Label>
					</div>
				</div>

				<Button onclick={savePoint}>{addMode ? 'Добавить' : 'Сохранить'}</Button>
			</div>
		</DialogContent>
	</Dialog>
</div>
