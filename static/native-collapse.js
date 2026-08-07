/** Переключение collapsible для XP-совместимых страниц (используется компонентами native/ui) */
function xpToggle(id) {
	var el = document.getElementById(id);
	var ind = document.getElementById(id + '_ind');
	if (!el) return;
	if (el.style.display === 'none') {
		el.style.display = 'block';
		if (ind) ind.innerHTML = '[-]';
	} else {
		el.style.display = 'none';
		if (ind) ind.innerHTML = '[+]';
	}
	// Subheader (сводка) виден, только когда контент свёрнут — включаем обратным состоянием
	var sub = document.getElementById(id + '_sub');
	if (sub) sub.style.display = el.style.display === 'none' ? 'block' : 'none';
}
