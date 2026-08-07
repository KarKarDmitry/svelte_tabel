<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Select, Input, Button, Msg, EmptyState } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const form = $derived($page.form);
	const canEdit = $derived($page.data.canEditEmployee ?? false);
	const today = new Date().toISOString().split('T')[0];

	function fmtDate(d: string | null): string {
		return d ? new Date(d).toLocaleDateString('ru-RU') : '—';
	}

	function passLabel(p: any): string {
		return p.seria ? `${p.seria} ${p.number}` : p.number;
	}

	// Пропуски, доступные для назначения: не заняты другими сотрудниками
	const passOptions = $derived(
		data.allPasses
			.filter((p: any) => !data.occupiedPassIds.includes(p.id))
			.map((p: any) => ({ value: p.id, label: passLabel(p) }))
	);
</script>

{#if canEdit}
	<Card title="Назначить пропуск">
		{#if form?.error === 'pass_occupied'}
			<Msg variant="err">Пропуск уже назначен другому сотруднику</Msg>
		{/if}
		<form method="post" action="?/assignPass">
			<Select name="passId" label="Пропуск" options={passOptions} required />
			<Input name="dateFrom" label="Дата начала" type="date" value={today} required />
			<Button type="submit" size="sm">Назначить</Button>
		</form>
	</Card>
{/if}

<Card title={`Пропуска (${data.passHistory.length})`}>
	{#if data.passHistory.length === 0}
		<EmptyState text="Пропуска не назначены" />
	{:else}
		<table class="native-table">
			<thead>
				<tr>
					<th class="cell cell-head cell-left">Пропуск</th>
					<th class="cell cell-head">С</th>
					<th class="cell cell-head">По</th>
					{#if canEdit}
						<th class="cell cell-head"></th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each data.passHistory as row}
					<tr>
						<td class="cell cell-left cell-mono">{passLabel(row.pass)}</td>
						<td class="cell cell-mono">{fmtDate(row.employeePass.dateFrom)}</td>
						<td class="cell cell-mono">{fmtDate(row.employeePass.dateTo)}</td>
						{#if canEdit}
							<td class="cell">
								<form method="post" action="?/removePass">
									<input type="hidden" name="id" value={row.employeePass.id} />
									<Button type="submit" variant="ghost" size="sm">Открепить</Button>
								</form>
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>
