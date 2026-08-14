<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Users from '@lucide/svelte/icons/users';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Table2 from '@lucide/svelte/icons/table-2';
	import History from '@lucide/svelte/icons/history';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Upload from '@lucide/svelte/icons/upload';
	import Settings from '@lucide/svelte/icons/settings';
	import { sidebarNav } from '$lib/sidebar-nav.svelte';

	let { children }: { children: Snippet } = $props();

	// Регистрируем навигацию раздела (выполняется и на сервере, и на клиенте,
	// поэтому сайдбар в корневом лейауте рендерится уже с кнопками)
	sidebarNav.set({
		root: '/apps/tabel',
		title: 'mettem / Табельный учет',
		items: [
			{ href: '/apps/tabel', label: 'Главное', icon: LayoutDashboard, exact: true },
			{ href: '/apps/tabel/employees', label: 'Сотрудники', icon: Users },
			{ href: '/apps/tabel/schedules', label: 'Графики', icon: CalendarClock },
			{ href: '/apps/tabel/calendar', label: 'Календарь', icon: CalendarDays },
			{ href: '/apps/tabel/tabel', label: 'Табель', icon: Table2 },
			{ href: '/apps/tabel/turnstile', label: 'События турникета', icon: History },
			{ href: '/apps/tabel/directories', label: 'Справочники', icon: FolderOpen },
			...($page.data.isAdmin ? [{ href: '/apps/tabel/import', label: 'Импорт', icon: Upload }] : [])
		],
		footer: [{ href: '/settings', label: 'Настройки', icon: Settings }]
	});
</script>

{@render children()}
