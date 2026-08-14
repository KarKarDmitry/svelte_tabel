<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Input, Button, EmptyState, Grid, GridItem } from '$lib/components/native/ui';

	const data = $derived($page.data);
	const canEdit = $derived($page.data.canEdit ?? false);
	const isAdmin = $derived($page.data.isAdmin ?? false);

	function memberNames(g: any): string {
		return g.departments.map((m: any) => m.departmentName).join(', ') || '—';
	}

	/**
	 * Колонки для группы: первые две — подразделения группы (сверху вниз),
	 * третья — свободные. Занятые другими группами не показываются вовсе.
	 */
	function groupColumns(g: any) {
		const mine = new Set(g.departments.map((m: any) => m.departmentId));
		const others = new Set<number>();
		for (const og of data.groups) {
			if (og.id === g.id) continue;
			for (const m of og.departments) others.add(m.departmentId);
		}
		const myList = data.allDepts
			.filter((d: any) => mine.has(d.id))
			.map((d: any) => ({ id: d.id, name: d.name, checked: true }));
		const freeList = data.allDepts
			.filter((d: any) => !mine.has(d.id) && !others.has(d.id))
			.map((d: any) => ({ id: d.id, name: d.name, checked: false }));
		const mineCols = splitColumns(myList, 2);
		return { cols: [...mineCols, freeList], mineCols: mineCols.length };
	}

	/** Разбивка по колонкам сверху вниз: 1/3 | 1/3 | остаток */
	function splitColumns(items: any[], cols: number): any[][] {
		const per = Math.ceil(items.length / cols);
		const result: any[][] = [];
		for (let c = 0; c < cols; c++) {
			result.push(items.slice(c * per, (c + 1) * per));
		}
		return result;
	}
</script>

{#if data.groups.length === 0}
	<EmptyState text="Групп пока нет" />
{/if}

{#each data.groups as g}
	<Card title={g.name}>
		{#if canEdit}
			{@const gcols = groupColumns(g)}
			<p class="n-note">Состав группы: слева подразделения группы, справа — свободные</p>
			<form method="post" action="?/saveDepts" class="n-depts">
				<input type="hidden" name="groupId" value={g.id} />
				<Grid cols={3} gap={8}>
					{#each gcols.cols as col, i}
						<GridItem>
							<div class="n-col">
								<p class="n-col-title">{i < gcols.mineCols ? 'В группе' : 'Свободные'}</p>
								{#each col as d}
									<label class="n-wd">
										<input type="checkbox" name="departmentIds" value={d.id} checked={d.checked} />
										{d.name}
									</label>
								{/each}
							</div>
						</GridItem>
					{/each}
				</Grid>
				<Button type="submit" size="sm">Сохранить состав</Button>
			</form>
			<div class="n-gap"></div>
			<form method="post" action="?/update" class="n-inline-form n-edit">
				<input type="hidden" name="id" value={g.id} />
				<input type="text" name="name" value={g.name} class="n-edit-input" />
				<Button type="submit" variant="outline" size="sm">Переименовать</Button>
			</form>
			{#if isAdmin}
				<form method="post" action="?/remove" class="n-inline-form">
					<input type="hidden" name="id" value={g.id} />
					<Button type="submit" variant="ghost" size="sm">Удалить группу</Button>
				</form>
			{/if}
		{:else}
			<p class="n-note">{memberNames(g)}</p>
		{/if}
	</Card>
{/each}

{#if canEdit}
	<Card title="Новая группа">
		<form method="post" action="?/create">
			<Input name="name" label="Название" required />
			<Input name="sortOrder" label="Порядок сортировки" type="number" value="0" />
			<Button type="submit" size="sm">Создать</Button>
		</form>
	</Card>
{/if}

<style>
	.n-note {
		font-size: 13px;
		color: #4b5563;
		margin: 0 0 6px;
	}
	.n-depts {
		margin-bottom: 4px;
	}
	.n-col {
		display: flex;
		flex-direction: column;
	}
	.n-col-title {
		font-size: 12px;
		font-weight: bold;
		color: #6b7280;
		margin: 0 0 4px;
	}
	.n-wd {
		margin: 0 0 4px;
		font-size: 13px;
		white-space: nowrap;
	}
	.n-gap {
		height: 8px;
	}
	.n-inline-form {
		display: inline;
		margin-right: 6px;
	}
	.n-edit-input {
		width: 220px;
		padding: 2px 6px;
		font-size: 13px;
		border: 1px solid #c3c3c3;
		border-radius: 4px;
		margin-right: 4px;
	}
</style>
