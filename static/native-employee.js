/* Диалог «События сотрудника» для XP-совместимых страниц.
 * Работает с SSR-разметкой из EmployeeEventsNative.svelte (id=emp_dialog):
 * данные грузятся по клику через GET employee-events, JS заполняет таблицы. */
var xpEmpDialogId = 'emp_dialog';
var xpEmpCurrentId = null;
var xpEmpYear = 0;
var xpEmpMonth = 0;
var xpEmpMonths = [
	'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
	'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

/** Открыть диалог и загрузить данные сотрудника */
function xpEmpOpen(empId, year, month) {
	var root = document.getElementById(xpEmpDialogId);
	if (!root || !empId) return;
	xpEmpCurrentId = empId;
	xpEmpYear = year;
	xpEmpMonth = month;

	document.getElementById('emp_name').textContent = 'Загрузка...';
	document.getElementById('emp_info').textContent = '';
	document.getElementById('emp_events').innerHTML = '';
	document.getElementById('emp_days').innerHTML = '';
	var saveBtn = document.getElementById('emp_save');
	if (saveBtn) saveBtn.style.display = root.getAttribute('data-canedit') === '1' ? '' : 'none';

	xpDialogOpen(xpEmpDialogId);

	var xhr = new XMLHttpRequest();
	xhr.open(
		'GET',
		'/native/apps/tabel/tabel/employee-events?employeeId=' +
			empId +
			'&year=' +
			year +
			'&month=' +
			month,
		true
	);
	xhr.onreadystatechange = function () {
		if (xhr.readyState !== 4) return;
		if (xhr.status !== 200) {
			document.getElementById('emp_name').textContent = 'Ошибка загрузки (' + xhr.status + ')';
			return;
		}
		var d = null;
		try {
			d = JSON.parse(xhr.responseText);
		} catch (e) {}
		if (d) xpEmpRender(d);
	};
	xhr.send();
}

function xpEmpFmt(minutes) {
	if (minutes == null || minutes === '') return '';
	return (Number(minutes) / 60).toFixed(1);
}

/** Часы ячейки: отчётные или сменные из импорта (звёздочка — в колонке «День») */
function xpEmpHours(day) {
	if (!day) return '';
	if (day.reportWorkTime != null) return xpEmpFmt(day.reportWorkTime);
	if (day.shiftWorkTime != null) return xpEmpFmt(day.shiftWorkTime);
	return '';
}

function xpEmpNight(day) {
	if (!day) return '';
	if (day.reportNightWorkTime != null) return xpEmpFmt(day.reportNightWorkTime);
	if (day.shiftNightWorkTime != null) return xpEmpFmt(day.shiftNightWorkTime);
	return '';
}

function xpEmpPad(n) {
	return n < 10 ? '0' + n : String(n);
}

function xpEmpFmtDt(iso) {
	var dt = new Date(iso);
	return (
		xpEmpPad(dt.getDate()) +
		'.' +
		xpEmpPad(dt.getMonth() + 1) +
		'.' +
		dt.getFullYear() +
		' ' +
		xpEmpPad(dt.getHours()) +
		':' +
		xpEmpPad(dt.getMinutes())
	);
}

function xpEmpEsc(s) {
	return String(s == null ? '' : s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Заполнить таблицы диалога данными GET employee-events */
function xpEmpRender(d) {
	var emp = d.employee || {};
	var name = [emp.lastName, emp.firstName, emp.middleName].filter(Boolean).join(' ');
	document.getElementById('emp_name').textContent = name;
	document.getElementById('emp_info').textContent =
		'Табельный номер: ' +
		(emp.number || '—') +
		' · Должность: ' +
		(d.positionName || '—') +
		' · Подразделение: ' +
		(d.departmentName || '—') +
		' · Данные за ' +
		xpEmpMonths[xpEmpMonth - 1] +
		' ' +
		xpEmpYear;

	// События турникета
	var evHtml = '';
	var events = d.turnstileEvents || [];
	if (!events.length) {
		evHtml = '<tr><td class="cell" colspan="3">Нет событий турникета за этот месяц</td></tr>';
	} else {
		for (var i = 0; i < events.length; i++) {
			var ev = events[i];
			evHtml +=
				'<tr><td class="cell cell-left cell-mono">' +
				xpEmpFmtDt(ev.datetime) +
				'</td><td class="cell cell-left">' +
				xpEmpEsc(ev.eventName) +
				'</td><td class="cell cell-mono">' +
				xpEmpEsc(ev.passSeria ? ev.passSeria + ' ' + ev.passNumber : ev.passNumber) +
				'</td></tr>';
		}
	}
	document.getElementById('emp_events').innerHTML = evHtml;

	// Метки по дням
	var canEdit = document.getElementById(xpEmpDialogId).getAttribute('data-canedit') === '1';
	var days = d.days || [];
	var html = '';
	for (var j = 0; j < days.length; j++) {
		var day = days[j];
		var date = day.date;
		// Звёздочка у дня с отчётными часами (проставлены табельщиком)
		var num =
			Number(date.split('-')[2]) +
			(day.reportWorkTime != null || day.reportNightWorkTime != null ? '*' : '');
		var hours = xpEmpHours(day);
		var night = xpEmpNight(day);
		// В инпутах — чистое число (report приоритетно), без звёздочки
		var hoursInput = xpEmpFmt(
			day.reportWorkTime != null ? day.reportWorkTime : day.shiftWorkTime
		);
		var nightInput = xpEmpFmt(
			day.reportNightWorkTime != null ? day.reportNightWorkTime : day.shiftNightWorkTime
		);
		var mark = day.dayMarkCode || '';
		var extra = day.extraMarkCode || '';
		var extraH = xpEmpFmt(day.extraMarkMinutes);
		var markStyle = day.style || '';

		if (canEdit) {
			html +=
				'<tr><td class="cell">' +
				num +
				'</td><td class="cell"><input type="text" name="hours__' +
				date +
				'" value="' +
				hoursInput +
				'" class="native-input"></td><td class="cell"><input type="text" name="night__' +
				date +
				'" value="' +
				nightInput +
				'" class="native-input"></td><td class="cell" style="' +
				markStyle +
				'"><input type="text" name="mark__' +
				date +
				'" value="' +
				xpEmpEsc(mark) +
				'" maxlength="3" class="native-input"></td><td class="cell"><input type="text" name="extra__' +
				date +
				'" value="' +
				xpEmpEsc(extra) +
				'" maxlength="3" class="native-input"></td><td class="cell"><input type="text" name="extraHours__' +
				date +
				'" value="' +
				extraH +
				'" class="native-input"></td></tr>';
		} else {
			html +=
				'<tr><td class="cell">' +
				num +
				'</td><td class="cell">' +
				hours +
				'</td><td class="cell">' +
				night +
				'</td><td class="cell" style="' +
				markStyle +
				'">' +
				xpEmpEsc(mark) +
				'</td><td class="cell">' +
				xpEmpEsc(extra) +
				'</td><td class="cell">' +
				extraH +
				'</td></tr>';
		}
	}
	document.getElementById('emp_days').innerHTML = html;
}

/** Сохранить изменения из диалога (как nativeSaveEmployee на странице сотрудника) */
function xpEmpSave() {
	if (!xpEmpCurrentId) return;
	var FIELDS = {
		hours: 'reportWorkTime',
		night: 'reportNightWorkTime',
		mark: 'dayMarkCode',
		extra: 'extraMarkCode',
		extraHours: 'extraMarkMinutes'
	};
	var byDate = {};
	var inputs = document.getElementsByTagName('input');
	for (var i = 0; i < inputs.length; i++) {
		var name = inputs[i].name;
		if (!name) continue;
		var idx = name.indexOf('__');
		if (idx < 0) continue;
		var field = name.substring(0, idx);
		var date = name.substring(idx + 2);
		if (!FIELDS[field]) continue;
		if (!byDate[date]) byDate[date] = {};
		byDate[date][FIELDS[field]] = inputs[i].value;
	}

	var days = [];
	for (var dd in byDate) {
		var day = byDate[dd];
		var hours = parseFloat(day.reportWorkTime);
		var night = parseFloat(day.reportNightWorkTime);
		var extraH = parseFloat(day.extraMarkMinutes);
		days.push({
			date: dd,
			reportWorkTime: isNaN(hours) ? null : Math.round(hours * 60),
			reportNightWorkTime: isNaN(night) ? null : Math.round(night * 60),
			dayMarkCode: (day.dayMarkCode || '').trim().toUpperCase(),
			extraMarkCode: (day.extraMarkCode || '').trim() || null,
			extraMarkMinutes: isNaN(extraH) ? null : Math.round(extraH * 60)
		});
	}

	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/native/apps/tabel/tabel/employee-events', true);
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.onreadystatechange = function () {
		if (xhr.readyState !== 4) return;
		if (xhr.status === 200) {
			xpDialogClose(xpEmpDialogId);
			location.reload();
		} else {
			alert('Ошибка сохранения (' + xhr.status + ')');
		}
	};
	xhr.send(
		JSON.stringify({
			employeeId: xpEmpCurrentId,
			year: xpEmpYear,
			month: xpEmpMonth,
			days: days
		})
	);
}
