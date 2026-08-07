<script lang="ts">
	import { page } from '$app/stores';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	const data = $derived($page.data);
	const st = data.status;

	type UnresolvedItem = {
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
	};
	const unresolved = (st.unresolved as UnresolvedItem[] | undefined) ?? [];
	const first = unresolved[0];
	/** Сигнатура списка уточнений — чтобы JS не перерисовывал его зря */
	const initSig = `${unresolved.length}|${first ? first.seria + first.number : ''}`;

	const pct = st.total > 0 ? Math.min(100, Math.round((st.current / st.total) * 100)) : 0;

	function stageLabel(s: string): string {
		switch (s) {
			case 'starting':
				return 'Запуск';
			case 'parsing':
				return '1/4 — Обработка XLS';
			case 'collecting':
				return '2/4 — Сбор данных';
			case 'processing':
				return '3/4 — Обработка данных';
			case 'saving':
				return '4/4 — Сохранение данных';
			case 'resolving':
				return 'Создание пропусков';
			case 'unresolved':
				return 'Требуется уточнение';
			case 'done':
				return 'Завершено';
			case 'error':
				return 'Ошибка';
			default:
				return s || '';
		}
	}
</script>

<svelte:head>
	<script>
		var PROC_ID = null;
		var POLL_MS = 600;
		var pollTimer = null;
		var busy = false;
		var lastUnresolvedSig = null;

		function esc(s) {
			return String(s == null ? '' : s)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
		}

		function stageLabel(s) {
			switch (s) {
				case 'starting':
					return 'Запуск';
				case 'parsing':
					return '1/4 — Обработка XLS';
				case 'collecting':
					return '2/4 — Сбор данных';
				case 'processing':
					return '3/4 — Обработка данных';
				case 'saving':
					return '4/4 — Сохранение данных';
				case 'resolving':
					return 'Создание пропусков';
				case 'unresolved':
					return 'Требуется уточнение';
				case 'done':
					return 'Завершено';
				case 'error':
					return 'Ошибка';
				default:
					return s || '';
			}
		}

		function renderStatus(st) {
			var stageEl = document.getElementById('stageLabel');
			if (!stageEl) return;

			stageEl.innerHTML = esc(stageLabel(st.stage));

			var msgEl = document.getElementById('statusMsg');
			if (msgEl) {
				msgEl.innerHTML = esc(st.message || '');
				msgEl.className = 'native-msg' + (st.error ? ' err' : '') + (st.done ? ' ok' : '');
			}

			var empEl = document.getElementById('employeeText');
			if (empEl) {
				if (st.stage === 'collecting' && st.employee) {
					empEl.style.display = '';
					empEl.innerHTML = 'Сотрудник: <b>' + esc(st.employee) + '</b>';
				} else {
					empEl.style.display = 'none';
				}
			}

			var wrap = document.getElementById('progressWrap');
			var bar = document.getElementById('progressBar');
			var counter = document.getElementById('progressCounter');
			var total = st.total || 0;
			if (wrap && bar && counter) {
				if (total > 0) {
					wrap.style.display = '';
					counter.style.display = '';
					counter.innerHTML = (st.current || 0) + ' / ' + total;
					bar.style.width = Math.min(100, Math.round(((st.current || 0) / total) * 100)) + '%';
				} else {
					wrap.style.display = 'none';
					counter.style.display = 'none';
				}
			}

			var ub = document.getElementById('unresolvedBlock');
			if (ub) {
				if (st.stage === 'unresolved' && st.unresolved && st.unresolved.length) {
					renderUnresolved(st.unresolved);
					ub.style.display = '';
				} else {
					ub.style.display = 'none';
				}
			}

			var doneBox = document.getElementById('doneActions');
			if (doneBox) doneBox.style.display = st.done ? '' : 'none';
		}

		function renderUnresolved(list) {
			var ub = document.getElementById('unresolvedBlock');
			if (!ub) return;
			var sig = list.length + '|' + (list[0] ? list[0].seria + list[0].number : '');
			// Список уже отрисован (SSR или прошлый poll) — не трогаем, чтобы не сбросить выбор
			if (sig === lastUnresolvedSig && document.getElementById('resolveForm')) return;
			lastUnresolvedSig = sig;
			ub.setAttribute('data-sig', sig);

			var cont = document.getElementById('unresolvedList');
			var html = '<form id="resolveForm">';
			for (var i = 0; i < list.length; i++) {
				var u = list[i];
				html +=
					'<fieldset class="native-ur"><legend>Пропуск ' +
					esc(u.seria) +
					' ' +
					esc(u.number) +
					' — ' +
					esc(u.fullName) +
					'</legend>';
				html +=
					'<label class="native-ur-row"><input type="radio" name="pick_' +
					i +
					'" value="0" checked> Пропустить</label>';
				var cands = u.candidates || [];
				for (var j = 0; j < cands.length; j++) {
					var c = cands[j];
					html +=
						'<label class="native-ur-row"><input type="radio" name="pick_' +
						i +
						'" value="' +
						c.id +
						'"> ' +
						esc(c.number) +
						' — ' +
						esc(c.lastName) +
						' ' +
						esc(c.firstName) +
						' ' +
						esc(c.middleName || '') +
						'</label>';
				}
				html += '</fieldset>';
			}
			html +=
				'<div class="native-actions"><button type="button" class="native-btn" onclick="nativeResolve()">Продолжить импорт</button></div>';
			html += '</form>';
			cont.innerHTML = html;
		}

		function nativeResolve() {
			if (busy) return;
			var form = document.getElementById('resolveForm');
			if (!form) return;
			busy = true;
			var fd = new FormData(form);
			var xhr = new XMLHttpRequest();
			xhr.open('POST', '/native/apps/tabel/import/' + PROC_ID + '/resolve', true);
			xhr.onreadystatechange = function () {
				if (xhr.readyState !== 4) return;
				busy = false;
				if (xhr.status === 200) {
					document.getElementById('unresolvedBlock').style.display = 'none';
				} else {
					alert('Ошибка отправки (' + xhr.status + ')');
				}
			};
			xhr.send(fd);
		}

		function poll() {
			var xhr = new XMLHttpRequest();
			xhr.open('GET', '/native/apps/tabel/import/' + PROC_ID + '/status', true);
			xhr.onreadystatechange = function () {
				if (xhr.readyState !== 4) return;
				if (xhr.status !== 200) return;
				var st;
				try {
					st = JSON.parse(xhr.responseText);
				} catch (e) {
					return;
				}
				renderStatus(st);
				if (st.done || st.error) {
					if (pollTimer) {
						clearInterval(pollTimer);
						pollTimer = null;
					}
				}
			};
			xhr.send(null);
		}

		function init() {
			var root = document.getElementById('importStatusRoot');
			if (root) PROC_ID = root.getAttribute('data-proc-id');
			var ub = document.getElementById('unresolvedBlock');
			if (ub) lastUnresolvedSig = ub.getAttribute('data-sig');
			poll();
			pollTimer = setInterval(poll, POLL_MS);
		}

		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', init);
		} else {
			init();
		}
	</script>
</svelte:head>

<div id="importStatusRoot" data-proc-id={data.id} style="display: none"></div>

<h1 class="native-title">Импорт событий турникета</h1>
<p class="native-note">
	<a class="native-link" href="/native/apps/tabel/import"
		><ArrowLeft size={14} style="vertical-align:middle;margin-right:4px" />Выбор файла</a
	>
</p>
<p class="native-note">Файл: <b>{data.fileName}</b></p>

<h2 class="native-subtitle" id="stageLabel">{stageLabel(st.stage)}</h2>
<div class="native-msg" id="statusMsg" class:ok={st.done} class:err={st.error}>
	{st.message}
</div>
<div
	id="employeeText"
	class="native-note"
	style:display={st.stage === 'collecting' && st.employee ? '' : 'none'}
>
	Сотрудник: <b>{st.employee ?? ''}</b>
</div>

<div id="progressWrap" class="native-progress-wrap" style:display={st.total > 0 ? '' : 'none'}>
	<div id="progressBar" class="native-progress" style="width: {pct}%"></div>
</div>
<div id="progressCounter" class="native-note" style:display={st.total > 0 ? '' : 'none'}>
	{st.current} / {st.total}
</div>

<div
	id="unresolvedBlock"
	data-sig={initSig}
	style:display={st.stage === 'unresolved' ? '' : 'none'}
>
	<h2 class="native-subtitle">Уточните сотрудников</h2>
	<p class="native-note">
		Для следующих пропусков не удалось найти сотрудника. Выберите из списка:
	</p>
	<div id="unresolvedList">
		{#if unresolved.length}
			<form id="resolveForm">
				{#each unresolved as u, i}
					<fieldset class="native-ur">
						<legend>Пропуск {u.seria} {u.number} — {u.fullName}</legend>
						<label class="native-ur-row">
							<input type="radio" name="pick_{i}" value="0" checked />
							Пропустить
						</label>
						{#each u.candidates as c}
							<label class="native-ur-row">
								<input type="radio" name="pick_{i}" value={c.id} />
								{c.number} — {c.lastName}
								{c.firstName}
								{c.middleName ?? ''}
							</label>
						{/each}
					</fieldset>
				{/each}
				<div class="native-actions">
					{@html `<button type="button" class="native-btn" onclick="nativeResolve()">Продолжить импорт</button>`}
				</div>
			</form>
		{/if}
	</div>
</div>

<div id="doneActions" class="native-actions" style:display={st.done ? '' : 'none'}>
	<a class="native-btn" href="/native/apps/tabel/tabel">Перейти к табелю</a>
	<a class="native-link" href="/native/apps/tabel/import" style="margin-left: 12px">Новый импорт</a>
</div>
