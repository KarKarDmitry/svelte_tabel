<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import {
		SidebarProvider,
		Sidebar,
		SidebarHeader,
		SidebarContent,
		SidebarGroup,
		SidebarGroupContent,
		SidebarMenu,
		SidebarMenuItem,
		SidebarMenuButton,
		SidebarInset
	} from '$lib/components/ui/sidebar';
	let { children }: { children: Snippet } = $props();

	let isAdmin = $derived($page.data.isAdmin ?? false);

	const nav = $derived([
		{ href: '/apps/tabel', label: 'Табель' },
		{ href: '/apps/tabel/employees', label: 'Сотрудники' },
		{ href: '/apps/tabel/schedules', label: 'Графики' },
		{ href: '/apps/tabel/calendar', label: 'Календарь' },
		{ href: '/apps/tabel/tabel', label: 'Табель' },
		{ href: '/apps/tabel/turnstile', label: 'События турникета' },
		{ href: '/apps/tabel/directories', label: 'Справочники' },
		...(isAdmin ? [{ href: '/apps/tabel/import', label: 'Импорт' }] : [])
	]);
</script>

<SidebarProvider>
	<Sidebar>
		<SidebarHeader class="flex h-12 justify-center border-b border-border px-4">
			<a href="/apps" class="text-sm font-semibold text-blue-700">mettem / Табельный учет</a>
		</SidebarHeader>
		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupContent>
					<SidebarMenu>
						{#each nav as item}
							<SidebarMenuItem>
								<SidebarMenuButton isActive={$page.url.pathname === item.href}>
									{#snippet child({ props })}
										<a href={item.href} {...props}>{item.label}</a>
									{/snippet}
								</SidebarMenuButton>
							</SidebarMenuItem>
						{/each}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>
	</Sidebar>

	<SidebarInset class="overflow-hidden bg-white p-6">
		{@render children()}
	</SidebarInset>
</SidebarProvider>
