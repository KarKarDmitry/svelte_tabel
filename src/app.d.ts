import type { User as BetterAuthUser, Session } from 'better-auth/minimal';
import type { AppRole } from '$lib/server/auth-utils';

export type AppUser = BetterAuthUser & { role: AppRole };

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: AppUser;
			session?: Session;
			/** Клиент в «нативном» режиме (XP-совместимые страницы) */
			nativeOnly?: boolean;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
