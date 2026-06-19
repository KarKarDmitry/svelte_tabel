<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<h1>Привет, {data.user.name}!</h1>

<form method="post" action="?/signOut" use:enhance>
	<button>Выйти</button>
</form>
