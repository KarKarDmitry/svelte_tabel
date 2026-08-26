<script lang="ts">
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	import { Collapsible, CollapsibleContent } from '$lib/components/ui/collapsible';
	import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';
	import CircleQuestionMarkIcon from '@lucide/svelte/icons/circle-question-mark';
	import ExportProgress from './ExportProgress.svelte';
	import { toast } from 'svelte-sonner';

	let {
		open = $bindable(false),
		year,
		month,
		calendars = [],
		roundingRules = null
	}: {
		open?: boolean;
		year: number;
		month: number;
		calendars?: any[];
		roundingRules?: Record<string, unknown> | null;
	} = $props();

	let exportStarted = $state(false);

	let exportSettings = $state({
		calendarId: '0',
		rounding: false,
		showNight: true,
		showOvertime: false,
		showHoliday: true,
		showAbsence: true,
		autoAbsence: false
	});

	// Параметры округления (заполняются из константы ROUNDING_RULES при открытии диалога)
	let roundingParams = $state({
		roundingPoint: '',
		roundingFrom: '',
		roundingTo: '',
		standardLeft: '',
		standardRight: ''
	});

	let exportEs: EventSource | null = null;
	const EXPORT_TOAST_ID = 'export-progress';

	function cancelExport() {
		exportEs?.close();
		exportEs = null;
		exportStarted = false;
		toast.dismiss(EXPORT_TOAST_ID);
	}

	const yearCalendars = $derived(calendars.filter((c: any) => c.year === year));
	const calendarLabel = $derived(
		yearCalendars.find((c: any) => String(c.id) === exportSettings.calendarId)?.name ??
			'Без календаря'
	);

	// Заполнение дефолтов при каждом открытии
	$effect(() => {
		if (!open) return;
		const def = yearCalendars.find((c: any) => c.isDefault) ?? yearCalendars[0];
		exportSettings = {
			...exportSettings,
			calendarId: def ? String(def.id) : '0'
		};
		const rr = roundingRules as Record<string, unknown> | null;
		roundingParams = {
			roundingPoint: rr?.roundingPoint != null ? String(rr.roundingPoint) : '',
			roundingFrom: rr?.roundingFrom != null ? String(rr.roundingFrom) : '',
			roundingTo: rr?.roundingTo != null ? String(rr.roundingTo) : '',
			standardLeft: rr?.standardLeft != null ? String(rr.standardLeft) : '',
			standardRight: rr?.standardRight != null ? String(rr.standardRight) : ''
		};
	});

	async function exportExcel() {
		exportStarted = true;
		// Диалог параметров закрываем — прогресс показываем тостом
		open = false;

		const params = new URLSearchParams({
			year: String(year),
			month: String(month),
			showNight: exportSettings.showNight ? '1' : '0',
			showOvertime: exportSettings.showOvertime ? '1' : '0',
			showHoliday: exportSettings.showHoliday ? '1' : '0',
			showAbsence: exportSettings.showAbsence ? '1' : '0',
			rounding: exportSettings.rounding ? '1' : '0',
			autoAbsence: exportSettings.autoAbsence ? '1' : '0'
		});
		if (exportSettings.calendarId !== '0') params.set('calendarId', exportSettings.calendarId);
		if (exportSettings.rounding) {
			const num = (v: string, def: number | null) => (v === '' ? def : Number(v));
			params.set(
				'roundingParams',
				JSON.stringify({
					roundingPoint: num(roundingParams.roundingPoint, null),
					roundingFrom: num(roundingParams.roundingFrom, null),
					roundingTo: num(roundingParams.roundingTo, null),
					standardLeft: num(roundingParams.standardLeft, 0),
					standardRight: num(roundingParams.standardRight, 0)
				})
			);
		}

		const es = new EventSource(`/apps/tabel/tabel/export/stream?${params.toString()}`);
		exportEs = es;

		const showProgress = (data: any) =>
			toast.message(ExportProgress, {
				id: EXPORT_TOAST_ID,
				duration: Infinity,
				component: ExportProgress,
				componentProps: {
					progress: data.stage ?? data.progress ?? 'Формирование отчёта…',
					division: data.stage ? '' : data.division,
					employee: data.stage ? '' : data.employee,
					current: data.stage ? 0 : data.current,
					total: data.stage ? 0 : data.total,
					onCancel: cancelExport
				}
			});

		// Начальный тост — подготовка данных
		showProgress({ progress: 'Подготовка данных…' });

		es.onmessage = (e) => {
			const data = JSON.parse(e.data);

			if (data.type === 'done') {
				es.close();
				exportEs = null;
				exportStarted = false;
				toast.dismiss(EXPORT_TOAST_ID);
				// Скачиваем файл
				const byteChars = atob(data.base64);
				const byteNums = new Array(byteChars.length);
				for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
				const blob = new Blob([new Uint8Array(byteNums)], {
					type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
				});
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = data.filename;
				a.click();
				URL.revokeObjectURL(url);
				toast.success(`Файл «${data.filename}» сформирован`);
			} else if (data.type === 'error') {
				es.close();
				exportEs = null;
				exportStarted = false;
				toast.dismiss(EXPORT_TOAST_ID);
				console.error(data.error);
				toast.error(data.error ?? 'Ошибка формирования отчёта');
			} else {
				showProgress(data);
			}
		};

		es.onerror = () => {
			es.close();
			exportEs = null;
			exportStarted = false;
			toast.dismiss(EXPORT_TOAST_ID);
			toast.error('Не удалось подключиться к серверу экспорта');
		};
	}
</script>

<Dialog bind:open>
	<DialogContent>
		<div class="flex flex-col gap-4">
			<p class="font-medium">Параметры экспорта</p>

			<!-- Календарь -->
			<div class="flex flex-col gap-1">
				<Label>Календарь</Label>
				<Select type="single" bind:value={exportSettings.calendarId}>
					<SelectTrigger class="w-full">
						<span>{calendarLabel}</span>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="0">Без календаря</SelectItem>
						{#each yearCalendars as c (c.id)}
							<SelectItem value={String(c.id)}>
								{c.name}{c.isDefault ? ' (основной)' : ''}
							</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<!-- Округление -->
			<div class="flex flex-col gap-1">
				<div class="flex items-center gap-2">
					<Label class="flex flex-row items-center gap-2 text-sm">
						<Checkbox bind:checked={exportSettings.rounding} />
						Округлять часы
					</Label>
					<Popover>
						<PopoverTrigger>
							{#snippet child({ props })}
								<button
									type="button"
									class={cn(
										'rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
									)}
									aria-label="Подсказка по округлению"
									{...props}
								>
									<CircleQuestionMarkIcon class="size-4" />
								</button>
							{/snippet}
						</PopoverTrigger>
						<PopoverContent class="w-80 text-xs" align="start">
							<div class="space-y-2">
								<p class="text-sm font-medium">Параметры округления</p>
								<p>
									Если фактическое время попало в интервал — показывается якорь, иначе — простое
									округление до целого часа.
								</p>
								<div class="rounded-md border bg-muted/30 p-2 font-mono text-[11px]">
									roundingFrom &lt; факт &lt; roundingTo → roundingPoint
								</div>
								<p>
									<b>Точка округления</b> — абсолютное значение в часах, к которому «притягивается»
									время. <b>От / До</b> — границы интервала (ч).
								</p>
								<div class="rounded-md border bg-muted/30 p-2 font-mono text-[11px]">
									стандарт + standardLeft &lt; факт &lt; стандарт + standardRight → стандарт
								</div>
								<p>
									<b>Сдвиг влево / вправо</b> — границы интервала относительно стандарта графика сотрудника
									(у каждого свой стандарт).
								</p>
							</div>
						</PopoverContent>
					</Popover>
				</div>
				<Collapsible open={exportSettings.rounding}>
					<CollapsibleContent>
						<div class="mt-2 grid grid-cols-2 items-center gap-2 rounded-md border p-3">
							<Label class="text-xs">Точка округления (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.roundingPoint} />
							<Label class="text-xs">От (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.roundingFrom} />
							<Label class="text-xs">До (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.roundingTo} />
							<Separator /><Separator />
							<Label class="text-xs">Сдвиг влево к стандарту (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.standardLeft} />
							<Label class="text-xs">Сдвиг вправо к стандарту (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.standardRight} />
						</div>
					</CollapsibleContent>
				</Collapsible>
			</div>

			<!-- Флаги колонок -->
			<div class="flex flex-col gap-1 border-t pt-3">
				<span class="text-sm font-medium">Колонки отчёта</span>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.showNight} />
					Выводить ночные
				</Label>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.showOvertime} />
					Выводить сверхурочные
				</Label>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.showHoliday} />
					Выводить праздничные
				</Label>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.showAbsence} />
					Выводить коды неявок
				</Label>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.autoAbsence} />
					Автоматически выводить пропуска
				</Label>
			</div>

			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={() => (open = false)}>Отмена</Button>
				<Button onclick={exportExcel}>Экспортировать</Button>
			</div>
		</div>
	</DialogContent>
</Dialog>
