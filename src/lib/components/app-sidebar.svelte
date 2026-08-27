<script lang="ts">
	import {
		Sidebar,
		SidebarHeader,
		SidebarContent,
		SidebarGroup,
		SidebarGroupContent,
		SidebarMenu,
		SidebarMenuItem,
		SidebarMenuButton,
		SidebarTrigger,
		SidebarRail,
		SidebarFooter
	} from '$lib/components/ui/sidebar';
	import { sidebarNav, type SidebarNavItem } from '$lib/sidebar-nav.svelte';

	let {
		activePath = ''
	}: {
		/** Текущий путь — сайдбар активен, пока путь внутри root зарегистрированного раздела */
		activePath?: string;
	} = $props();

	const nav = $derived(sidebarNav.current);
	const show = $derived(!!nav && !!activePath && activePath.startsWith(nav.root));

	function isActive(item: SidebarNavItem): boolean {
		if (!activePath) return false;
		if (item.exact) return activePath === item.href;
		return activePath === item.href || activePath.startsWith(item.href + '/');
	}
</script>

{#if show && nav}
	<Sidebar collapsible="icon">
		<SidebarHeader class="flex h-12 flex-row items-center gap-2 border-b border-border">
			<SidebarTrigger />
			<a
				href="/apps"
				class="text-sm font-semibold whitespace-nowrap text-blue-700 group-data-[collapsible=icon]:hidden dark:text-blue-400"
			>
				{nav.title}
			</a>
		</SidebarHeader>

		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupContent>
					<SidebarMenu>
						{#each nav.items as item}
							<SidebarMenuItem>
								<SidebarMenuButton isActive={isActive(item)} tooltipContent={item.label}>
									{#snippet child({ props })}
										<a href={item.href} {...props}>
											<item.icon />
											<span>{item.label}</span>
										</a>
									{/snippet}
								</SidebarMenuButton>
							</SidebarMenuItem>
						{/each}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>

		{#if nav.footer?.length}
			<SidebarFooter class="border-t">
				<SidebarMenu>
					{#each nav.footer as item}
						<SidebarMenuItem>
							<SidebarMenuButton isActive={isActive(item)} tooltipContent={item.label}>
								{#snippet child({ props })}
									<a href={item.href} {...props}>
										<item.icon />
										<span>{item.label}</span>
									</a>
								{/snippet}
							</SidebarMenuButton>
						</SidebarMenuItem>
					{/each}
				</SidebarMenu>
			</SidebarFooter>
		{/if}

		<SidebarRail />
	</Sidebar>
{/if}
