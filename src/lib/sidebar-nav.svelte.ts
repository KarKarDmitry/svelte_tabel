import type { Component } from 'svelte';

export interface SidebarNavItem {
	href: string;
	label: string;
	icon: Component;
	/** Точное совпадение пути (например, корневой пункт раздела) */
	exact?: boolean;
}

export interface SidebarNavConfig {
	/** Корень раздела, например `/apps/tabel`: сайдбар активен, пока путь внутри него */
	root: string;
	title: string;
	items: SidebarNavItem[];
	footer?: SidebarNavItem[];
}

/**
 * Реактивный стор навигации сайдбара. Раздел (например apps/tabel/+layout.svelte)
 * регистрирует свою конфигурацию через `sidebarNav.set(...)`, а AppSidebar
 * в корневом лейауте читает её и сам решает, показываться ли.
 */
let current = $state<SidebarNavConfig | null>(null);

export const sidebarNav = {
	get current() {
		return current;
	},
	set(config: SidebarNavConfig) {
		current = config;
	},
	clear() {
		current = null;
	}
};
