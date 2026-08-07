<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import {
		Item,
		ItemContent,
		ItemHeader,
		ItemTitle,
		ItemDescription,
		ItemMedia,
		ItemActions,
		ItemFooter,
		ItemSeparator
	} from '$lib/components/ui/item';
	import { page } from '$app/state';

	let isAdmin = $derived(page.data.isAdmin ?? false);

	let stage = $state('');
	let message = $state('');
	let current = $state(0);
	let total = $state(0);
	let running = $state(false);
	let file: File | null = $state(null);
	let currentEmployee = $state('');

	// unresolved: список сотрудников, которых нужно сопоставить
	let unresolvedList = $state<
		{
			seria: string;
			number: string;
			fullName: string;
			candidates: {
				id: number;
				number: string;
				lastName: string;
				firstName: string;
				middleName: string | null;
			}[];
			selectedId: number | null;
		}[]
	>([]);

	let fullName = $state('');
	let skipPasses = $state<{ seria: string; number: string }[]>([]);

	/** Читает SSE-поток из ответа, обновляет состояние по каждому событию */
	async function readSSE(res: Response) {
		const reader = res.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			let idx: number;
			while ((idx = buffer.indexOf('\n')) !== -1) {
				const line = buffer.slice(0, idx).trim();
				buffer = buffer.slice(idx + 1);

				if (!line.startsWith('data: ')) continue;
				try {
					const data = JSON.parse(line.slice(6));
					stage = data.stage || stage;
					message = data.message ?? message;
					current = data.current ?? current;
					total = data.total ?? total;
					currentEmployee = data.employee ?? currentEmployee;

					if (data.stage === 'unresolved' && data.unresolved?.length) {
						unresolvedList = data.unresolved.map((u: any) => ({ ...u, selectedId: null }));
						running = false;
						stage = '';
					} else if (data.stage === 'done' || data.stage === 'error') {
						running = false;
						stage = '';
						message = data.message ?? '';
					}
				} catch {
					// ignore malformed JSON lines
				}
			}
		}
	}

	async function start(skip?: { seria: string; number: string }[]) {
		if (!file) return;
		running = true;
		stage = '';
		message = '';
		message = 'Подготовка...';
		current = 0;
		total = 0;
		currentEmployee = '';
		unresolvedList = [];

		const fd = new FormData();
		fd.set('file', file);
		if (skip && skip.length) {
			fd.set('skipPasses', JSON.stringify(skip));
		}
		const res = await fetch('/apps/tabel/import', { method: 'POST', body: fd });

		// Проверяем Content-Type: SSE или обычный JSON
		const contentType = res.headers.get('content-type') || '';
		if (contentType.includes('text/event-stream')) {
			await readSSE(res);
		} else {
			// Fallback: старый формат (ошибка валидации)
			const data = await res.json();
			if (data.error) {
				stage = 'error';
				message = data.error;
				running = false;
				return;
			}
			stage = data.stage || '';
			message = data.message || '';
			current = data.current || 0;
			total = data.total || 0;

			if (data.unresolved?.length) {
				unresolvedList = data.unresolved.map((u: any) => ({ ...u, selectedId: null }));
			}
			running = false;
		}
	}

	async function resolveAndImport() {
		const unresolved = unresolvedList.map((u) => ({
			seria: u.seria,
			number: u.number,
			employeeId: u.selectedId
		}));

		const res = await fetch('/apps/tabel/import', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ unresolved })
		});

		const data = await res.json();
		unresolvedList = [];

		if (data.stage === 'done') {
			// Пропуска созданы — запускаем импорт с тем же файлом
			await start(data.skipList || []);
		} else {
			stage = data.stage;
			message = data.message;
			current = data.current || 0;
			total = data.total || 0;
			running = false;
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	/** Описание стадии для отображения */
	function stageLabel(s: string): string {
		switch (s) {
			case 'parsing':
				return '1/4 — Обработка XLS';
			case 'collecting':
				return '2/4 — Сбор данных';
			case 'processing':
				return '3/4 — Обработка данных';
			case 'saving':
				return '4/4 — Сохранение данных';
			case 'unresolved':
				return 'Требуется уточнение';
			case 'done':
				return 'Завершено';
			case 'error':
				return 'Ошибка';
			default:
				return s;
		}
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold tracking-tight">Импорт событий турникета</h1>

	{#if isAdmin}
		<Item>
			<ItemHeader>
				<ItemTitle>Выберите файл</ItemTitle>
				<ItemDescription>Excel-файл с событиями входов/выходов по пропускам</ItemDescription>
			</ItemHeader>
			<ItemSeparator />
			<ItemContent>
				{#if file}
					<div class="flex items-center gap-4">
						<ItemMedia>
							<div
								class="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-lg text-green-700"
							>
								XLS
							</div>
						</ItemMedia>
						<div class="flex-1">
							<div class="text-sm font-medium">{file.name}</div>
							<div class="text-xs text-muted-foreground">{formatSize(file.size)}</div>
						</div>
						<Button variant="outline" size="sm" disabled={running} onclick={() => (file = null)}
							>Убрать</Button
						>
					</div>
				{:else}
					<label
						class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 px-6 py-8 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/60"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-muted-foreground/50"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="17 8 12 3 7 8" />
							<line x1="12" y1="3" x2="12" y2="15" />
						</svg>
						<span>Нажмите, чтобы выбрать файл</span>
						<span class="text-[10px]">.xls .xlsx</span>
						<input
							type="file"
							accept=".xls,.xlsx"
							class="hidden"
							onchange={(e) => (file = (e.target as HTMLInputElement).files?.[0] ?? null)}
						/>
					</label>
				{/if}
			</ItemContent>
			{#if file && !unresolvedList.length && !running && stage !== 'done' && stage !== 'error'}
				<ItemSeparator />
				<ItemFooter>
					<ItemActions>
						<Button onclick={() => start()} disabled={running} class="w-full">
							{running ? 'Импорт...' : 'Импортировать'}
						</Button>
					</ItemActions>
				</ItemFooter>
			{/if}
		</Item>

		<!-- Прогресс -->
		{#if message}
			<Item>
				<ItemContent>
					<!-- Заголовок стадии -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							{#if running}
								<div
									class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
								></div>
							{/if}
							<span class="text-xs font-medium tracking-wider text-muted-foreground uppercase"
								>{stageLabel(stage)}</span
							>
						</div>
						{#if total > 0}
							<span class="text-xs text-muted-foreground tabular-nums">{current} / {total}</span>
						{/if}
					</div>

					<!-- Сообщение -->
					<div
						class="mt-1 text-sm {stage === 'done'
							? 'text-green-700'
							: stage === 'error'
								? 'text-red-700'
								: ''}"
					>
						{message}
					</div>

					<!-- Текущий сотрудник (как в Python-версии) -->
					{#if currentEmployee && stage === 'collecting'}
						<div class="mt-1 text-xs text-muted-foreground">
							Сотрудник: <span class="font-medium">{currentEmployee}</span>
						</div>
					{/if}

					<!-- Прогресс-бар -->
					{#if total > 0}
						<div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
							<div
								class="h-full rounded-full bg-primary transition-all duration-150 ease-out"
								style="width: {(current / total) * 100}%"
							></div>
						</div>
					{/if}
				</ItemContent>
			</Item>
		{/if}

		<!-- Unresolved -->
		{#if unresolvedList.length > 0}
			<Item>
				<ItemHeader>
					<ItemTitle>Уточните сотрудников</ItemTitle>
					<ItemDescription
						>Для следующих пропусков не удалось найти сотрудника. Выберите из списка:</ItemDescription
					>
				</ItemHeader>
				<ItemContent>
					<div class="space-y-4">
						{#each unresolvedList as item, i}
							<div class="rounded-lg border p-3">
								<div class="mb-2 text-xs text-muted-foreground">
									Пропуск: {item.seria}
									{item.number} &mdash; {item.fullName}
								</div>
								<div class="flex flex-col gap-1">
									<RadioGroup
										value={item.selectedId === null ? '' : String(item.selectedId)}
										onValueChange={(v) => (item.selectedId = v === '' ? null : Number(v))}
										class="flex flex-col gap-1"
									>
										<Label
											class="cursor-pointer flex-row items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground italic hover:bg-muted"
										>
											<RadioGroupItem value="" />
											Пропустить
										</Label>
										{#each item.candidates as cand}
											<Label
												class="cursor-pointer flex-row items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
											>
												<RadioGroupItem value={String(cand.id)} />
												<span class="font-mono text-xs text-muted-foreground">{cand.number}</span>
												<span>{cand.lastName} {cand.firstName} {cand.middleName ?? ''}</span>
											</Label>
										{/each}
									</RadioGroup>
								</div>
							</div>
						{/each}
					</div>
				</ItemContent>
				<ItemFooter>
					<ItemActions>
						<Button onclick={resolveAndImport} class="w-full">Импортировать с выбранными</Button>
					</ItemActions>
				</ItemFooter>
			</Item>
		{/if}
	{:else}
		<p class="text-sm text-muted-foreground">Импорт доступен только администраторам.</p>
	{/if}
</div>
