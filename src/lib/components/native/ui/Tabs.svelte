<script lang="ts">
	import Badge from './Badge.svelte';

	let {
		items,
		active
	}: {
		items: { href: string; label: string; badge?: number }[];
		active: string;
	} = $props();
</script>

<table class="native-tabs">
	<tbody>
		<tr>
			{#each items as t}
				<td class="native-tab {active.startsWith(t.href) ? 'active' : ''}">
					<a href={t.href}>
						{t.label}
						{#if t.badge != null}
							<Badge class="n-tab-badge" variant="accent">{t.badge}</Badge>
						{/if}
					</a>
				</td>
			{/each}
		</tr>
	</tbody>
</table>

<style>
	:global(.n-tab-badge) {
		margin-left: 6px;
		padding: 2px 6px !important;
	}
</style>
