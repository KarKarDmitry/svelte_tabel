<script lang="ts">
	let {
		id,
		name,
		label,
		type = 'text',
		value = '',
		required = false,
		placeholder = '',
		maxlength,
		step,
		class: className = '',
		...rest
	}: {
		id?: string;
		name: string;
		label?: string;
		type?: string;
		value?: string;
		required?: boolean;
		placeholder?: string;
		maxlength?: number;
		step?: string | number;
		class?: string;
		[key: string]: any;
	} = $props();

	const cls = $derived(`n-field${className ? ' ' + className : ''}`);
</script>

<label class={cls}>
	{#if label}<span class="n-label">{label}</span>{/if}
	<input
		{id}
		{name}
		{type}
		{value}
		{required}
		{placeholder}
		{maxlength}
		{step}
		class="n-input"
		{...rest}
	/>
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
	.n-input {
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
	.n-input:focus {
		outline: none;
		border-color: #1d4ed8;
		box-shadow: 0 0 0 2px rgba(29, 78, 216, 0.15);
	}
</style>
