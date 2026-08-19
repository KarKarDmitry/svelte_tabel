<script lang="ts">
	import { Dialog, Grid, GridItem } from '$lib/components/native/ui';

	let {
		canEdit = false
	}: {
		canEdit?: boolean;
	} = $props();

	// Кнопки футера — через {@html} (инлайн onclick для XP)
	const footHtml = $derived(
		`<button type="button" id="emp_save" class="native-btn" style="display:${canEdit ? '' : 'none'}" onclick="xpEmpSave()">Сохранить</button>` +
			`<button type="button" class="native-btn native-btn-small" onclick="xpDialogClose('emp_dialog')">Закрыть</button>`
	);
</script>

<Dialog id="emp_dialog" title="События сотрудника" width={1100} data-canedit={canEdit ? '1' : '0'}>
	{#snippet footer()}
		{@html footHtml}
	{/snippet}

	<p class="xp-emp-name" id="emp_name"></p>
	<p class="xp-emp-info" id="emp_info"></p>

	<Grid cols={2} gap={12}>
		<GridItem>
			<h2 class="native-subtitle">События турникета</h2>
			<div class="xp-emp-scroll">
				<table class="native-table">
					<thead>
						<tr>
							<th class="cell cell-head cell-left">Дата и время</th>
							<th class="cell cell-head cell-left">Событие</th>
							<th class="cell cell-head">Пропуск</th>
						</tr>
					</thead>
					<tbody id="emp_events"></tbody>
				</table>
			</div>
		</GridItem>

		<GridItem>
			<h2 class="native-subtitle">Метки по дням</h2>
			<div class="xp-emp-scroll">
				<table class="native-table">
					<thead>
						<tr>
							<th class="cell cell-head">День</th>
							<th class="cell cell-head">Часов</th>
							<th class="cell cell-head">Ночных</th>
							<th class="cell cell-head">Метка</th>
							<th class="cell cell-head">Доп.метка</th>
							<th class="cell cell-head">Час.доп</th>
						</tr>
					</thead>
					<tbody id="emp_days"></tbody>
				</table>
			</div>
		</GridItem>
	</Grid>
</Dialog>

<style>
	.xp-emp-name {
		font-family: 'Tahoma', 'Arial', sans-serif;
		font-size: 14px;
		font-weight: 600;
		color: #111827;
		margin: 0 0 2px;
	}
	.xp-emp-info {
		font-size: 12px;
		color: #6b7280;
		margin: 0 0 8px;
	}
	.xp-emp-scroll {
		max-height: 380px;
		overflow: auto;
	}
	.xp-emp-scroll .cell {
		white-space: nowrap;
	}
</style>
