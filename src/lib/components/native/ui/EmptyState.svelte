<script lang="ts">
	let { text = 'Нет данных' }: { text?: string } = $props();
</script>

<div class="n-empty">{text}</div>

<style>
	.n-empty {
		border: 1px dashed #d0d0d0;
		border-radius: 10px;
		padding: 24px 12px;
		text-align: center;
		color: #6b7280;
		font-size: 14px;
		font-family: 'Tahoma', 'Arial', sans-serif;
	}
</style>
