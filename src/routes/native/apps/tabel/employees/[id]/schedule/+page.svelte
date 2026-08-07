<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Select, Input, Button, EmptyState } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const canEdit = $derived($page.data.canEditEmployee ?? false);
	const today = new Date().toISOString().split('T')[0];

	function fmtDate(d: string | null): string {
		return d ? new Date(d).toLocaleDateString('ru-RU') : '—';
	}

	function hoursLabel(min: number): string {
		const h = Math.floor((min || 0) / 60);
		const m = (min || 0) % 60;
		return m ? `${h}ч ${m}м` : `${h}ч`;
	}

	const schedOptions = $derived(
		data.allSchedules.map((s: any) => ({ value: s.id, label: s.name }))
	);
</script>

<svelte:head>
	<script>
		function nativeEditSchedule(id) {
			var parts = ['name', 'from', 'to', 'actions'];
			for (var i = 0; i < parts.length; i++) {
				var span = document.getElementById('sched_' + parts[i] + '_' + id);
				var edit = document.getElementById('sched_' + parts[i] + '_edit_' + id);
				if (span) span.style.display = 'none';
				if (edit) edit.style.display = '';
			}
		}
		function nativeSaveSchedule(id) {
			var nameEdit = document.getElementById('sched_name_edit_' + id);
			var fromEdit = document.getElementById('sched_from_edit_' + id);
			var toEdit = document.getElementById('sched_to_edit_' + id);
			var form = new FormData();
			form.append('id', id);
			var sel = nameEdit ? nameEdit.querySelector('select') : null;
			form.append('scheduleId', sel ? sel.value : '');
			var from = fromEdit ? fromEdit.querySelector('input') : null;
			var to = toEdit ? toEdit.querySelector('input') : null;
			form.append('dateFrom', from ? from.value : '');
			form.append('dateTo', to ? to.value : '');
			var xhr = new XMLHttpRequest();
			xhr.open('POST', location.pathname + '?/updateSchedule', true);
			xhr.onreadystatechange = function () {
				if (xhr.readyState !== 4) return;
				if (xhr.status === 200) {
					location.reload();
				} else {
					alert('Ошибка сохранения (' + xhr.status + ')');
				}
			};
			xhr.send(form);
		}
		function nativeCancelSchedule(id) {
			location.reload();
		}
	</script>
</svelte:head>

{#if canEdit}
	<Card title="Назначить график">
		<form method="post" action="?/assignSchedule">
			<Select name="scheduleId" label="График" options={schedOptions} required />
			<Input name="dateFrom" label="Дата начала" type="date" value={today} required />
			<Button type="submit" size="sm">Назначить</Button>
		</form>
	</Card>
{/if}

<Card title={`Графики (${data.scheduleHistory.length})`}>
	{#if data.scheduleHistory.length === 0}
		<EmptyState text="Графики не назначены" />
	{:else}
		<table class="native-table">
			<thead>
				<tr>
					<th class="cell cell-head cell-left cell-fio">График</th>
					<th class="cell cell-head">Норма</th>
					<th class="cell cell-head">С</th>
					<th class="cell cell-head">По</th>
					{#if canEdit}
						<th class="cell cell-head"></th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each data.scheduleHistory as row}
					{@const id = row.employeeSchedule.id}
					<tr>
						<td class="cell cell-left cell-fio">
							<span id={`sched_name_${id}`}>{row.schedule.name}</span>
							<span id={`sched_name_edit_${id}`} style="display:none">
								<Select
									name="scheduleId"
									value={String(row.employeeSchedule.scheduleId)}
									options={schedOptions}
								/>
							</span>
						</td>
						<td class="cell cell-mono">{hoursLabel(row.schedule.standardWorkTime)}</td>
						<td class="cell cell-mono">
							<span id={`sched_from_${id}`}>{fmtDate(row.employeeSchedule.dateFrom)}</span>
							<span id={`sched_from_edit_${id}`} style="display:none">
								<input
									type="date"
									class="n-sched-date"
									value={row.employeeSchedule.dateFrom ?? ''}
								/>
							</span>
						</td>
						<td class="cell cell-mono">
							<span id={`sched_to_${id}`}>{fmtDate(row.employeeSchedule.dateTo)}</span>
							<span id={`sched_to_edit_${id}`} style="display:none">
								<input type="date" class="n-sched-date" value={row.employeeSchedule.dateTo ?? ''} />
							</span>
						</td>
						{#if canEdit}
							<td class="cell">
								<span id={`sched_actions_${id}`} class="n-sched-actions">
									{@html `<button type="button" class="native-btn-small" onclick="nativeEditSchedule(${id})">Изменить</button>`}
									<form method="post" action="?/removeSchedule" class="n-sched-form">
										<input type="hidden" name="id" value={id} />
										<Button type="submit" variant="ghost" size="sm">Открепить</Button>
									</form>
								</span>
								<span id={`sched_actions_edit_${id}`} style="display:none">
									{@html `<button type="button" class="native-btn-small" onclick="nativeSaveSchedule(${id})">Сохранить</button>`}
									{@html `<button type="button" class="native-btn-small" onclick="nativeCancelSchedule(${id})">Отмена</button>`}
								</span>
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<style>
	.n-sched-date {
		font-family: 'Tahoma', 'Arial', sans-serif;
		font-size: 13px;
		color: #111827;
		padding: 3px 6px;
		border: 1px solid #c3c3c3;
		border-radius: 4px;
		background: #ffffff;
		width: 130px;
		box-sizing: border-box;
	}
	.n-sched-actions {
		white-space: nowrap;
	}
	.n-sched-form {
		display: inline;
	}
</style>
