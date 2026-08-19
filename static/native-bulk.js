/* Быстрое назначение отметок (bulk) для XP-совместимых страниц.
 * Работает с SSR-разметкой из BulkAssignNative.svelte: весь интерактив —
 * глобальные функции здесь, ES5 без зависимостей.
 * Общие функции диалога (open/close) — в native-dialog.js.
 * Press-состояние чекбоксов — внутри компонента Checkbox (native/ui). */
var xpBulkMarkCache = {};

/** Переключение шага диалога: 'select' | 'preview' */
function xpBulkStep(dialogId, step) {
	var selectEl = document.getElementById(dialogId + '_select');
	var previewEl = document.getElementById(dialogId + '_preview');
	var btnBack = document.getElementById(dialogId + '_btn_back');
	var btnNext = document.getElementById(dialogId + '_btn_next');
	var btnApply = document.getElementById(dialogId + '_btn_apply');
	if (!selectEl || !previewEl) return;
	if (step === 'preview') {
		selectEl.style.display = 'none';
		previewEl.style.display = 'block';
		if (btnBack) btnBack.style.display = '';
		if (btnNext) btnNext.style.display = 'none';
		if (btnApply) btnApply.style.display = '';
	} else {
		selectEl.style.display = 'block';
		previewEl.style.display = 'none';
		if (btnBack) btnBack.style.display = 'none';
		if (btnNext) btnNext.style.display = '';
		if (btnApply) btnApply.style.display = 'none';
	}
}

/** Открыть диалог и сбросить на шаг выбора */
function xpBulkOpen(dialogId) {
	xpBulkStep(dialogId, 'select');
	xpDialogOpen(dialogId);
}

/** Переключение дня в календаре (кнопка data-day) */
function xpBulkDay(dialogId, dayNum) {
	var btn = document.getElementById(dialogId + '_day_' + dayNum);
	if (!btn) return;
	if (btn.className.indexOf('xp-bulk-day-on') !== -1) {
		btn.className = btn.className.replace(/\s*xp-bulk-day-on/g, '');
	} else {
		btn.className += ' xp-bulk-day-on';
	}
}

/** Выбрать/сбросить все дни месяца */
function xpBulkDaysAll(dialogId) {
	var box = document.getElementById(dialogId + '_days');
	if (!box) return;
	var btns = box.getElementsByTagName('button');
	for (var i = 0; i < btns.length; i++) {
		if (btns[i].className.indexOf('xp-bulk-day-on') === -1) btns[i].className += ' xp-bulk-day-on';
	}
}

function xpBulkDaysReset(dialogId) {
	var box = document.getElementById(dialogId + '_days');
	if (!box) return;
	var btns = box.getElementsByTagName('button');
	for (var i = 0; i < btns.length; i++) {
		btns[i].className = btns[i].className.replace(/\s*xp-bulk-day-on/g, '');
	}
}

function xpEsc(s) {
	return String(s == null ? '' : s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function xpPad(n) {
	return Number(n) < 10 ? '0' + n : String(n);
}

/** Собрать выбор: массив { employeeId, date, shortName, hours } */
function xpBulkCollect(dialogId) {
	var root = document.getElementById(dialogId);
	if (!root) return [];
	var year = root.getAttribute('data-year');
	var month = root.getAttribute('data-month');

	var empIds = [];
	var empBox = document.getElementById(dialogId + '_emps');
	if (empBox) {
		var checks = empBox.getElementsByTagName('input');
		for (var i = 0; i < checks.length; i++) {
			if (checks[i].type === 'checkbox' && checks[i].checked && checks[i].getAttribute('data-emp')) {
				empIds.push(checks[i].getAttribute('data-emp'));
			}
		}
	}

	var days = [];
	var daysBox = document.getElementById(dialogId + '_days');
	if (daysBox) {
		var btns = daysBox.getElementsByTagName('button');
		for (var j = 0; j < btns.length; j++) {
			if (btns[j].className.indexOf('xp-bulk-day-on') !== -1 && btns[j].getAttribute('data-day')) {
				days.push(btns[j].getAttribute('data-day'));
			}
		}
	}

	if (!empIds.length || !days.length) return [];

	var markSel = document.getElementById(dialogId + '_mark');
	var hoursInp = document.getElementById(dialogId + '_hours');
	var shortName = markSel ? markSel.value : '';
	var hours = hoursInp ? hoursInp.value : '';

	var rows = [];
	for (var e = 0; e < empIds.length; e++) {
		for (var d = 0; d < days.length; d++) {
			rows.push({
				employeeId: Number(empIds[e]),
				date: year + '-' + xpPad(month) + '-' + xpPad(days[d]),
				shortName: shortName,
				hours: hours
			});
		}
	}
	return rows;
}

/** Текущие значения ячейки табеля (для колонки «Было») */
function xpBulkOld(empId, date) {
	var mark = '';
	var hours = '';
	var inp = document.querySelector('input[name="mark_' + empId + '_' + date + '"]');
	if (inp) mark = inp.value;
	var hoursCell = document.getElementById('hours_' + empId + '_' + date);
	if (hoursCell) hours = hoursCell.textContent || hoursCell.innerText || '';
	return { mark: mark, hours: hours };
}

function xpBulkEmpInfo(empId) {
	var row = document.querySelector('tr[data-empid="' + empId + '"]');
	if (!row) return { number: '', fio: '' };
	var num = row.querySelector('.cell-num');
	var fio = row.querySelector('.cell-fio');
	return {
		number: num ? num.textContent : '',
		fio: fio ? fio.textContent : ''
	};
}

/** Построить таблицу «Проверка изменений» и перейти на шаг preview */
function xpBulkPreview(dialogId) {
	var rows = xpBulkCollect(dialogId);
	if (!rows.length) {
		alert('Выберите сотрудников и даты');
		return;
	}
	var body = document.getElementById(dialogId + '_preview_body');
	if (!body) return;

	var html = '';
	for (var i = 0; i < rows.length; i++) {
		var r = rows[i];
		var empId = r.employeeId;
		var info = xpBulkEmpInfo(empId);
		var old = xpBulkOld(empId, r.date);

		var oldTxt = old.mark
			? old.mark + (old.hours ? ' · ' + old.hours + 'ч' : '')
			: old.hours
				? old.hours + 'ч'
				: '—';

		var newMark = r.shortName === '' ? '—' : r.shortName;
		var newHours = r.shortName === '' ? '—' : r.hours === '' ? old.hours : r.hours;
		var newTxt = newMark + (newHours ? ' · ' + newHours + 'ч' : '');

		html +=
			'<tr><td><span class="xp-bulk-num">' +
			xpEsc(info.number) +
			'</span> ' +
			xpEsc(info.fio) +
			'</td><td>' +
			r.date +
			'</td><td class="xp-bulk-old">' +
			xpEsc(oldTxt) +
			'</td><td class="xp-bulk-new">' +
			xpEsc(newTxt) +
			'</td></tr>';
	}
	body.innerHTML = html;
	xpBulkStep(dialogId, 'preview');
}

/** Применить обновления без перезагрузки (xpApplyBulk — из +page.svelte); иначе reload */
function xpApplyOrReload(updated) {
	if (updated && typeof xpApplyBulk === 'function') {
		xpApplyBulk(updated);
		return true;
	}
	return false;
}

/** Отправить назначения на сервер */
function xpBulkSend(dialogId) {
	var root = document.getElementById(dialogId);
	if (!root) return;
	var rows = xpBulkCollect(dialogId);
	if (!rows.length) {
		alert('Нет записей для применения');
		return;
	}
	var deptId = root.getAttribute('data-dept');
	var body =
		'deptId=' +
		encodeURIComponent(deptId) +
		'&updates=' +
		encodeURIComponent(JSON.stringify(rows));

	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/native/apps/tabel/tabel/bulk', true);
	xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	xhr.onreadystatechange = function () {
		if (xhr.readyState !== 4) return;
		var resp = null;
		try {
			resp = JSON.parse(xhr.responseText);
		} catch (e) {}
		if (xhr.status === 200 && resp && resp.ok) {
			if (xpApplyOrReload(resp.updated)) {
				xpDialogClose(dialogId);
				return;
			}
			location.reload();
			return;
		}
		alert(resp && resp.error ? resp.error : 'Не удалось применить назначение (' + xhr.status + ')');
	};
	xhr.send(body);
}
