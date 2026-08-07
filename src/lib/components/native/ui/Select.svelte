<script lang="ts">
	let {
		name,
		label,
		value = '',
		options = [],
		required = false,
		class: className = ''
	}: {
		name: string;
		label?: string;
		value?: string;
		options: { value: string | number; label: string }[];
		required?: boolean;
		class?: string;
	} = $props();

	const cls = $derived(`n-field${className ? ' ' + className : ''}`);
</script>

<label class={cls}>
	{#if label}<span class="n-label">{label}</span>{/if}
	<select {name} {required} class="n-select">
		<option value="" selected={value === ''}>— {label || 'Выберите'} —</option>
		{#each options as opt}
			<option value={opt.value} selected={String(opt.value) === String(value)}>
				{opt.label}
			</option>
		{/each}
	</select>
</label>

<style>
	.n-field {
		display: flex;
		flex-direction: column;
		margin-bottom: 10px;
	}
	.n-label {
		padding-left: 4px;
		font-size: 13px;
		color: #4b5563;
	}
	.n-select {
		font-family: 'Tahoma', 'Arial', sans-serif;
		font-size: 14px;
		color: #111827;
		margin-top: 4px;
		padding: 6px 8px;
		border: 1px solid #c3c3c3;
		border-radius: 6px;
		background: #ffffff;
		box-sizing: border-box;
		width: 100%;
		max-width: 320px;
	}
	.n-select:focus {
		outline: none;
		border-color: #1d4ed8;
		box-shadow: 0 0 0 2px rgba(29, 78, 216, 0.15);
	}
</style>
