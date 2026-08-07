<script lang="ts">
	import { page } from '$app/stores';

	const data = $derived($page.data);
	const form = $derived($page.form);
</script>

<h1 class="native-title">Импорт событий турникета</h1>
<p class="native-note">Excel-файл с событиями входов/выходов по пропускам (.xls, .xlsx)</p>

{#if form}
	<div class="native-msg {form.success ? 'ok' : 'err'}">
		{form.message ?? 'Ошибка'}
	</div>
{/if}

<form method="post" action="?/upload" enctype="multipart/form-data" class="native-form">
	<input type="file" name="file" accept=".xls,.xlsx" required class="native-file" />
	<button type="submit" class="native-btn">Импортировать</button>
</form>
