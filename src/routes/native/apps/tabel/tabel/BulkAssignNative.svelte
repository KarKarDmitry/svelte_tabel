<script lang="ts">
	import { Dialog, Grid, GridItem, Select, Input, Checkbox } from '$lib/components/native/ui';

	let {
		dept,
		dayMarks,
		calendarDays,
		year,
		month,
		lastDay
	}: {
		dept: any;
		dayMarks: any[];
		calendarDays: Record<string, { dayType: string; workTime: number | null }>;
		year: number;
		month: number;
		lastDay: number;
	} = $props();

	const dialogId = $derived(`bulk_${dept.id}`);

	const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
	// Первый день месяца: 0 = Пн … 6 = Вс
	const firstOffset = $derived((new Date(year, month - 1, 1).getDay() + 6) % 7);

	/** Недели месяца: 0 — пустая ячейка (смещение), дальше номера дней */
	const weeks = $derived.by(() => {
		const out: number[][] = [];
		let cur: number[] = [];
		for (let i = 0; i < firstOffset; i++) cur.push(0);
		for (let d = 1; d <= lastDay; d++) {
			cur.push(d);
			if (cur.length === 7) {
				out.push(cur);
				cur = [];
			}
		}
		while (cur.length < 7) cur.push(0);
		if (cur.length) out.push(cur);
		return out;
	});

	function pad(n: number): string {
		return String(n).padStart(2, '0');
	}

	function dateStr(day: number): string {
		return `${year}-${pad(month)}-${pad(day)}`;
	}

	function esc(s: string): string {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	// Кнопки дней — через {@html} (инлайн onclick для XP)
	function dayBtn(day: number): string {
		const info = calendarDays?.[dateStr(day)];
		const isWeekend = info?.dayType === 'weekend' || info?.dayType === 'holiday';
		return (
			`<button type="button" id="${dialogId}_day_${day}" data-day="${day}" ` +
			`class="xp-bulk-day${isWeekend ? ' xp-bulk-day-weekend' : ''}" ` +
			`onclick="xpBulkDay('${dialogId}', ${day})">${day}</button>`
		);
	}

	// Кнопки «Все/Сбросить» — через {@html} (инлайн onclick для XP)
	const daysActionsHtml = $derived(
		`<div class="xp-bulk-actions">` +
			`<button type="button" class="native-btn native-btn-small" onclick="xpBulkDaysAll('${dialogId}')">Все</button> ` +
			`<button type="button" class="native-btn native-btn-small" onclick="xpBulkDaysReset('${dialogId}')">Сбросить</button>` +
			`</div>`
	);

	// Кнопки футера — через {@html} (инлайн onclick для XP)
	const footHtml = $derived(
		`<button type="button" id="${dialogId}_btn_back" class="native-btn native-btn-small" style="display:none" onclick="xpBulkStep('${dialogId}','select')">Назад</button>` +
			`<button type="button" class="native-btn native-btn-small" onclick="xpDialogClose('${dialogId}')">Отмена</button>` +
			`<button type="button" id="${dialogId}_btn_next" class="native-btn" onclick="xpBulkPreview('${dialogId}')">Далее</button>` +
			`<button type="button" id="${dialogId}_btn_apply" class="native-btn" style="display:none" onclick="xpBulkSend('${dialogId}')">Применить</button>`
	);

	const markOptions = $derived(
		dayMarks.map((m: any) => ({ value: m.shortName, label: m.shortName }))
	);
</script>

<Dialog
	id={dialogId}
	title={`Быстрое назначение — ${dept.name}`}
	width={980}
	data-dept={dept.id}
	data-year={year}
	data-month={month}
>
	{#snippet footer()}
		{@html footHtml}
	{/snippet}

	<div id="{dialogId}_select">
		<Grid cols={3} gap={10}>
			<GridItem>
				<!-- Зона 1: сотрудники -->
				<div class="xp-bulk-zone">
					<p class="xp-bulk-zone-title">Сотрудники ({dept.employees.length})</p>
					<div id="{dialogId}_emps" class="xp-bulk-emps">
						{#each dept.employees as emp}
							<Checkbox
								name="bulk_emp_{emp.id}"
								value={emp.id}
								class="xp-bulk-emp"
								data-emp={emp.id}
							>
								<span class="xp-bulk-num">{emp.number}</span>
								<span
									>{emp.lastName} {emp.firstName}{emp.middleName ? ' ' + emp.middleName : ''}</span
								>
							</Checkbox>
						{/each}
					</div>
				</div>
			</GridItem>

			<GridItem>
				<!-- Зона 2: даты -->
				<div class="xp-bulk-zone">
					<p class="xp-bulk-zone-title">Даты</p>
					<div id="{dialogId}_days">
						<Grid cols={7} gap={2}>
							{#each weekDays as wd}
								<GridItem><span class="xp-bulk-wd">{wd}</span></GridItem>
							{/each}
						</Grid>
						{#each weeks as week}
							<Grid cols={7} gap={2}>
								{#each week as day}
									{#if day === 0}
										<GridItem>{''}</GridItem>
									{:else}
										<GridItem>{@html dayBtn(day)}</GridItem>
									{/if}
								{/each}
							</Grid>
						{/each}
					</div>
					{@html daysActionsHtml}
					<p class="xp-bulk-hint">Красные — выходные/праздники</p>
				</div>
			</GridItem>

			<GridItem>
				<!-- Зона 3: назначение -->
				<div class="xp-bulk-zone">
					<p class="xp-bulk-zone-title">Назначение</p>
					<Select
						id="{dialogId}_mark"
						name="bulk-mark"
						label="Метка табеля (пусто — очистить день)"
						options={markOptions}
					/>
					<Input
						id="{dialogId}_hours"
						name="bulk-hours"
						label="Часы (пусто — не менять)"
						type="number"
						step="0.5"
						min="0"
						placeholder="напр. 8"
					/>
					<p class="xp-bulk-hint">
						Метка «—» очищает день полностью (метка и часы); часы указываются в часах.
					</p>
				</div>
			</GridItem>
		</Grid>
	</div>

	<div id="{dialogId}_preview" class="xp-bulk-preview">
		<table class="xp-bulk-preview-table">
			<thead>
				<tr>
					<th>Сотрудник</th>
					<th>Дата</th>
					<th>Было</th>
					<th>Станет</th>
				</tr>
			</thead>
			<tbody id="{dialogId}_preview_body"></tbody>
		</table>
	</div>
</Dialog>

<style>
	.xp-bulk-zone {
		font-size: 13px;
	}
	.xp-bulk-zone-title {
		font-family: 'Tahoma', 'Arial', sans-serif;
		font-size: 13px;
		font-weight: 600;
		color: #111827;
		margin: 0 0 6px;
	}
	.xp-bulk-emps {
		max-height: 260px;
		overflow: auto;
		border: 1px solid #c3c3c3;
		border-radius: 6px;
		padding: 4px;
	}
	/* Класс применяется к Checkbox (дочерний компонент) — нужен :global */
	:global(.xp-bulk-emp) {
		display: flex;
		align-items: center;
		width: 95%;
		border-radius: 6px;
		gap: 6px;
		padding: 2px 4px;
		cursor: pointer;
		font-size: 13px;
	}
	:global(.xp-bulk-emp:hover) {
		background: #f5f5f5;
	}
	.xp-bulk-wd {
		font-family: 'Tahoma', 'Arial', sans-serif;
		font-size: 11px;
		font-weight: 600;
		color: #6b7280;
		text-align: center;
		display: block;
	}
	.xp-bulk-hint {
		font-size: 12px;
		color: #6b7280;
		margin: 4px 0 0;
	}
</style>
