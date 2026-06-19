<script lang="ts" generics="T extends Record<string, any>">
	import type { Snippet } from 'svelte';

	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import type { Align, EColumn, PreparedRow } from './types';

	let {
		data = [],
		columns = [],
		cell,
		getRowId,
		rowClass,
		onRowClick,
		onCellClick
	}: {
		data: T[];
		columns: EColumn<T>[];
		cell?: Snippet<[value: any, row: T, col: EColumn<T>]>;
		getRowId?: (row: T, index: number) => string | number;
		rowClass?: string | ((row: T, index: number) => string);
		onRowClick?: (row: T) => void;
		onCellClick?: (row: T, col: EColumn<T>) => void;
	} = $props();

	function getValue(row: T, key: keyof T | string[]) {
		if (Array.isArray(key)) {
			let val: any = row;
			for (const k of key) {
				if (val == null) return null;
				val = val[k];
			}

			return val;
		}

		return row[key];
	}

	function getColumnKey(col: EColumn<T>) {
		return Array.isArray(col.key) ? col.key.join('.') : String(col.key);
	}

	function cn(...classes: Array<string | false | null | undefined>) {
		return classes.filter(Boolean).join(' ');
	}

	function getAlignClass(align?: Align) {
		switch (align) {
			case 'center':
				return 'text-center';
			case 'right':
				return 'text-right';
			default:
				return 'text-left';
		}
	}

	function getStickyOffsets(cols: EColumn<T>[]) {
		let offset = 0;
		return cols.map((col) => {
			if (!col.sticky) return null;
			const current = offset;
			offset += col.width ?? 160;
			return current;
		});
	}

	const stickyOffsets = $derived(getStickyOffsets(columns));

	const preparedRows = $derived.by<PreparedRow<T>[]>(() => {
		return data.map((row, index) => {
			const values: Record<string, any> = {};
			for (const col of columns) {
				values[getColumnKey(col)] = getValue(row, col.key);
			}

			return {
				id: getRowId?.(row, index) ?? (row as any).id ?? index,
				raw: row,
				values
			};
		});
	});

	function getRowClass(row: T, index: number) {
		if (typeof rowClass === 'function') {
			return rowClass(row, index);
		}

		return rowClass ?? '';
	}
</script>

<div class="min-h-0 overflow-auto bg-background">
	<Table class="table-fixed border-collapse">
		<TableHeader
			class="sticky top-0 z-30 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
		>
			<TableRow class="border-b">
				{#each columns as col, colIndex (getColumnKey(col))}
					<TableHead
						class={cn(
							'relative h-10 border-r px-3 text-xs font-semibold whitespace-nowrap',
							getAlignClass(col.align),
							col.headClass,
							col.class,
							col.sticky && 'sticky z-30 bg-background supports-backdrop-filter:bg-background/95'
						)}
						style={[
							col.width && `width:${col.width}px`,
							col.width && `min-width:${col.width}px`,
							col.width && `max-width:${col.width}px`,
							col.sticky && `left:${stickyOffsets[colIndex]}px`
						]
							.filter(Boolean)
							.join(';')}
					>
						<div class="truncate">
							{col.label}
						</div>

						{#if col.sticky}
							<div class="absolute top-0 right-0 h-full w-px bg-border"></div>
						{/if}
					</TableHead>
				{/each}
			</TableRow>
		</TableHeader>

		<TableBody>
			{#each preparedRows as prepared, rowIndex (prepared.id)}
				<TableRow
					class={cn(
						'border-b transition-colors',
						onRowClick && 'cursor-pointer hover:bg-muted/40',
						getRowClass(prepared.raw, rowIndex)
					)}
					onclick={onRowClick ? () => onRowClick(prepared.raw) : undefined}
				>
					{#each columns as col, colIndex (getColumnKey(col))}
						{@const colKey = getColumnKey(col)}
						{@const value = prepared.values[colKey]}

						<TableCell
							class={cn(
								'relative border-r p-0 text-[13px] leading-none whitespace-nowrap',
								getAlignClass(col.align),
								col.mono && 'font-mono tabular-nums',
								col.cellClass,
								col.class,
								col.sticky && 'sticky z-20 bg-background supports-backdrop-filter:bg-background'
							)}
							style={[
								col.width && `width:${col.width}px`,
								col.width && `min-width:${col.width}px`,
								col.width && `max-width:${col.width}px`,
								col.sticky && `left:${stickyOffsets[colIndex]}px`
							]
								.filter(Boolean)
								.join(';')}
							onclick={onCellClick
								? (e) => {
										e.stopPropagation();
										onCellClick(prepared.raw, col);
									}
								: undefined}
						>
							{#if typeof col.render === 'function'}
								{@render col.render(value, prepared.raw, col)}
							{:else if typeof cell === 'function'}
								{@render cell(value, prepared.raw, col)}
							{:else}
								<div class="truncate">
									{col.format ? col.format(value, prepared.raw) : (value ?? '—')}
								</div>
							{/if}

							{#if col.sticky}
								<div class="absolute top-0 right-0 h-full w-px bg-border"></div>
							{/if}
						</TableCell>
					{/each}
				</TableRow>
			{:else}
				<TableRow>
					<TableCell
						colspan={columns.length}
						class="h-32 text-center text-sm text-muted-foreground"
					>
						Нет данных
					</TableCell>
				</TableRow>
			{/each}
		</TableBody>
	</Table>
</div>
