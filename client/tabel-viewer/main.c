/*
 * main.c — точка входа вьювера табеля для Windows XP.
 *
 * Структура (аналог native-страницы): Collapsible(группа подразделений)
 * -> SubCollapsible(подразделение) -> таблица (ListView) сотрудников.
 * Внутри таблицы колонки: т/н | ФИО | Итого | Ночь | дни (1..N); каждый
 * сотрудник — две строки: «часы» (т/н, ФИО) и «отметки» (должность).
 * Вся иерархия — в прокручиваемом окне g.view (дочерние контролы).
 */
#define _WIN32_WINNT 0x0501
#include <windows.h>
#include <commctrl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "ui.h"
#include "model.h"
#include "net.h"
#include "log.h"

#define GAP 4        /* зазор между дочерними контролами */
#define GRP_H 26     /* высота заголовка группы */
#define DEPT_H 24    /* высота заголовка подразделения */
#define HDR_SPACE 8  /* внутренний отступ панели управления */
#define WM_VIEW_REBUILD (WM_USER + 1)

/* Дочерний контрол вью: заголовок (0) или таблица-ListView (1) */
typedef struct {
	HWND h;
	int type;
	int dept; /* для type==1 — индекс в g.model.depts[] */
	int x, y, w, hh;
} Kid;

static Kid *kids = NULL;
static int nkids = 0, capkids = 0;
static int view_w = 0, view_h = 0;   /* клиентская область вью */
static int content_h = 0;            /* полная высота раскладки */
static int scroll_y = 0;

App g;
HINSTANCE g_hInstance;

static BOOL do_login(void);
static void session_expired_hint(void);
int app_relogin(void);

static void exe_dir(char *buf, int cap) {
	GetModuleFileNameA(NULL, buf, (DWORD)cap);
	char *p = strrchr(buf, '\\');
	if (p) *p = '\0';
}

static void day_date(int day, char *buf, int cap) {
	_snprintf(buf, (size_t)cap, "%04d-%02d-%02d", g.year, g.month, day);
}

/* Эффективные часы/ночные и отметка дня по режиму. */
static int eff_hours(const DayData *d) {
	if (g.actual) return d->raw_hours;
	if (d->report_hours >= 0) return d->report_hours;
	return d->shift_hours;
}
static int eff_night(const DayData *d) {
	if (g.actual) return d->raw_night;
	if (d->report_night >= 0) return d->report_night;
	return d->shift_night;
}
static const char *eff_mark(const DayData *d) {
	const char *code = g.actual ? d->fact : d->mark;
	if (!code || !code[0]) return "";
	return mark_short(&g.model, code);
}

static void set_status(const char *s) {
	SetWindowTextA(g.status, s ? s : "");
}

static void show_error(const char *s) {
	set_status(s);
	MessageBoxA(g.hwnd, s, "Табель", MB_OK | MB_ICONWARNING);
}

static const char *const MONTH_NAMES[12] = {
	"Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
	"Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
};

static void upd_title(void) {
	char b[96];
	if (g.month >= 1 && g.month <= 12)
		_snprintf(b, sizeof(b), "%s %d", MONTH_NAMES[g.month - 1], g.year);
	else
		_snprintf(b, sizeof(b), "%04d-%02d", g.year, g.month);
	SetWindowTextA(g.lbl_title, b);
}

/* --- Дочерние контролы вью: управление списком --- */

static void kid_add(HWND h, int type, int dept, int x, int y, int w, int hgt) {
	if (nkids == capkids) {
		capkids = capkids ? capkids * 2 : 32;
		kids = (Kid *)realloc(kids, (size_t)capkids * sizeof(Kid));
	}
	kids[nkids].h = h;
	kids[nkids].type = type;
	kids[nkids].dept = dept;
	kids[nkids].x = x;
	kids[nkids].y = y;
	kids[nkids].w = w;
	kids[nkids].hh = hgt;
	nkids++;
}

/* Освободить lParam-строки таблицы и уничтожить окно. */
static void destroy_list(HWND lv) {
	int n = ListView_GetItemCount(lv);
	for (int i = 0; i < n; i++) {
		LVITEMA it;
		memset(&it, 0, sizeof(it));
		it.mask = LVIF_PARAM;
		it.iItem = i;
		if (ListView_GetItem(lv, &it) && it.lParam) free((void *)it.lParam);
	}
	DestroyWindow(lv);
}

static void destroy_kids(void) {
	for (int i = 0; i < nkids; i++) {
		if (kids[i].type == 1) destroy_list(kids[i].h);
		else DestroyWindow(kids[i].h);
	}
	nkids = 0;
}

/* Перерисовать контролы согласно позиции прокрутки. */
static void layout_kids(void) {
	for (int i = 0; i < nkids; i++) {
		int y = kids[i].y - scroll_y;
		MoveWindow(kids[i].h, kids[i].x, y, kids[i].w, kids[i].hh, TRUE);
	}
	/* Стереть фон вью (инвалидируем весь клиент): затирает «хвосты» от старых
	   позиций перемещённых окон, сами окна перерисуются на новых местах. */
	InvalidateRect(g.view, NULL, TRUE);
	SCROLLINFO si;
	memset(&si, 0, sizeof(si));
	si.cbSize = sizeof(si);
	si.fMask = SIF_RANGE | SIF_PAGE | SIF_POS;
	si.nMin = 0;
	si.nMax = content_h > 0 ? content_h : 0;
	si.nPage = view_h;
	si.nPos = scroll_y;
	SetScrollInfo(g.view, SB_VERT, &si, TRUE);
}

static void clamp_scroll(void) {
	if (scroll_y < 0) scroll_y = 0;
	int max = content_h - view_h;
	if (max < 0) max = 0;
	if (scroll_y > max) scroll_y = max;
}

static void do_scroll(int amount, int code) {
	if (code == SB_TOP) scroll_y = 0;
	else if (code == SB_BOTTOM) scroll_y = content_h;
	else if (code == SB_LINEUP) scroll_y -= 12;
	else if (code == SB_LINEDOWN) scroll_y += 12;
	else if (code == SB_PAGEUP) scroll_y -= view_h;
	else if (code == SB_PAGEDOWN) scroll_y += view_h;
	else if (code == SB_THUMBTRACK) scroll_y = amount;
	clamp_scroll();
	layout_kids();
}

/* --- Колесо мыши: горизонталь только при наведении на таблицу --- */

static void hwheel_one(HWND lv, int delta) {
	/* Вверх -> влево, вниз -> вправо */
	SendMessageA(lv, LVM_SCROLL, (WPARAM)(-((delta / 120) * 24)), 0);
}

/* Таблица под курсором (если есть). */
static HWND hover_table(void) {
	POINT pt;
	GetCursorPos(&pt);
	HWND h = WindowFromPoint(pt);
	for (int i = 0; i < nkids; i++)
		if (kids[i].type == 1 && kids[i].h == h) return h;
	return NULL;
}

/* Subclass таблиц-подразделений: только для случая фокуса в таблице. */
static LRESULT CALLBACK ViewListSubProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
	WNDPROC oldproc = (WNDPROC)GetPropA(hwnd, "LvOld");
	if (msg == WM_MOUSEWHEEL) {
		int delta = (short)HIWORD(wp);
		if (GET_KEYSTATE_WPARAM(wp) & MK_SHIFT) hwheel_one(hwnd, delta);
		else return CallWindowProcA(oldproc, hwnd, msg, wp, lp); /* обычный вертикальный скролл таблицы */
		return 0;
	}
	if (msg == WM_DESTROY) {
		RemovePropA(hwnd, "LvOld");
	}
	return CallWindowProcA(oldproc, hwnd, msg, wp, lp);
}

/* Создать таблицу одного подразделения. Возвращает её высоту. */
static int build_dept_list(int dept_index, HWND parent, int x, int y, int w) {
	DeptData *dept = &g.model.depts[dept_index];
	HWND lv = CreateWindowExA(0, WC_LISTVIEWA, "", WS_CHILD | WS_VISIBLE |
							  WS_BORDER | WS_VSCROLL | WS_HSCROLL |
							  LVS_REPORT | LVS_SHOWSELALWAYS,
							  x, y, w, view_h, parent,
							  (HMENU)(ID_DEPT_BASE + dept_index), g_hInstance, NULL);
	if (!lv) return 0;
	SetWindowLongPtrA(lv, GWLP_USERDATA, (LONG_PTR)dept_index);
	/* Subclass: перехватываем колесо мыши (глобальный скролл) */
	{
		WNDPROC oldproc = (WNDPROC)SetWindowLongPtrA(lv, GWLP_WNDPROC,
													 (LONG_PTR)ViewListSubProc);
		SetPropA(lv, "LvOld", (HANDLE)oldproc);
	}
	SendMessageA(lv, WM_SETFONT, (WPARAM)GetStockObject(DEFAULT_GUI_FONT), TRUE);
	ListView_SetExtendedListViewStyle(lv,
		LVS_EX_FULLROWSELECT | LVS_EX_GRIDLINES);

	/* Колонки: т/н | ФИО | Итого | Ночь | дни */
	LVCOLUMNA c;
	memset(&c, 0, sizeof(c));
	c.mask = LVCF_TEXT | LVCF_WIDTH;
	c.cx = 50;  c.pszText = "т/н";
	ListView_InsertColumn(lv, 0, &c);
	c.cx = 200; c.pszText = "ФИО";
	ListView_InsertColumn(lv, 1, &c);
	c.cx = 56;  c.pszText = "Итого";
	ListView_InsertColumn(lv, 2, &c);
	c.cx = 56;  c.pszText = "Ночь";
	ListView_InsertColumn(lv, 3, &c);
	for (int i = 1; i <= g.model.lastDay; i++) {
		char h[8];
		_snprintf(h, sizeof(h), "%d", i);
		c.cx = 44;
		c.pszText = h;
		ListView_InsertColumn(lv, 3 + i, &c);
	}

	for (int e = 0; e < dept->n_emps; e++) {
		EmpData *em = &dept->emps[e];
		char hbuf[32][16];
		char mbuf[32][8];
		int total = 0, total_night = 0;
		for (int i = 0; i < g.model.lastDay; i++) {
			DayData *dd = &em->days[i];
			int eh = eff_hours(dd);
			int en = eff_night(dd);
			if (eh >= 0) total += eh;
			if (en >= 0) total_night += en;
			hbuf[i][0] = '\0';
			if (eh >= 0) {
				_snprintf(hbuf[i], sizeof(hbuf[i]), "%.1f%s",
						  (double)eh / 60.0,
						  (dd->has_report && !g.actual) ? "*" : "");
			}
			if (dd->blocked) strcpy(mbuf[i], "\xd7"); /* × */
			else {
				const char *mk = eff_mark(dd);
				if (mk[0]) _snprintf(mbuf[i], sizeof(mbuf[i]), "%s", mk);
				else mbuf[i][0] = '\0';
			}
		}
		char tot[16], totn[16];
		_snprintf(tot, sizeof(tot), "%.1f", (double)total / 60.0);
		_snprintf(totn, sizeof(totn), "%.1f", (double)total_night / 60.0);

		/* Строка «часы»: т/н | ФИО | Итого | Ночь | часы-дней */
		RowMeta *rh = (RowMeta *)malloc(sizeof(RowMeta));
		RowMeta *rm = (RowMeta *)malloc(sizeof(RowMeta));
		if (!rh || !rm) { free(rh); free(rm); continue; }
		rh->kind = 1; rh->emp = e;
		rm->kind = 2; rm->emp = e;

		LVITEMA lvi;
		memset(&lvi, 0, sizeof(lvi));
		lvi.mask = LVIF_TEXT | LVIF_PARAM;
		/* iItem обязателен = текущее число строк, иначе InsertItem ставит вверх списка */
		lvi.iItem = ListView_GetItemCount(lv);
		lvi.iSubItem = 0;
		lvi.pszText = em->number;
		lvi.lParam = (LPARAM)rh;
		int ih = ListView_InsertItem(lv, &lvi);
		ListView_SetItemText(lv, ih, 1, em->fio);
		ListView_SetItemText(lv, ih, 2, tot);
		ListView_SetItemText(lv, ih, 3, totn);
		/* верхняя строка — по дням показываем ОТМЕТКУ (над часами) */
		for (int i = 0; i < g.model.lastDay; i++)
			if (mbuf[i][0]) ListView_SetItemText(lv, ih, 4 + i, mbuf[i]);

		/* Строка «отметки»: | Должность | | | метки-дней (после строки часов) */
		memset(&lvi, 0, sizeof(lvi));
		lvi.mask = LVIF_TEXT | LVIF_PARAM;
		lvi.iItem = ListView_GetItemCount(lv);
		lvi.iSubItem = 0;
		lvi.pszText = "";
		lvi.lParam = (LPARAM)rm;
		int im = ListView_InsertItem(lv, &lvi);
		ListView_SetItemText(lv, im, 1, em->position);
		/* нижняя строка — по дням показываем ЧАСЫ (под отметкой) */
		for (int i = 0; i < g.model.lastDay; i++)
			if (hbuf[i][0]) ListView_SetItemText(lv, im, 4 + i, hbuf[i]);
	}

	/* Измерить реальную высоту строк и заголовка таблицы. */
	int headH = 20, rowH = 18;
	HWND hdr = (HWND)SendMessageA(lv, LVM_GETHEADER, 0, 0);
	RECT rc;
	if (hdr && GetWindowRect(hdr, &rc)) headH = rc.bottom - rc.top;
	int n = ListView_GetItemCount(lv);
	if (n > 0 && ListView_GetItemRect(lv, 0, &rc, LVIR_BOUNDS)) rowH = rc.bottom - rc.top;
	/* +2 строки запаса, чтобы последняя реальная строка не пряталась
	   за собственным вертикальным скроллом таблицы. */
	int hgt = headH + n * rowH + 2 * rowH + 2;
	MoveWindow(lv, x, y, w, hgt, TRUE);
	kid_add(lv, 1, dept_index, x, y, w, hgt);
	return hgt;
}

/* Собрать/пересобрать всю раскладку дочерних контролов вью. */
static void rebuild_view(void) {
	if (!g.view) return;
	destroy_kids();
	int y = 4;
	for (int gi = 0; gi < g.model.n_groups; gi++) {
		GroupData *gr = &g.model.groups[gi];
		char b[320];
		_snprintf(b, sizeof(b), "%s%s (%d)", gr->collapsed ? "[+] " : "[-] ",
				  gr->name[0] ? gr->name : "", gr->n_depts);
		HWND gh = CreateWindowA("BUTTON", b, WS_CHILD | WS_VISIBLE | BS_LEFT | BS_OWNERDRAW,
							   2, y, view_w > 4 ? view_w - 4 : 0, GRP_H,
							   g.view, (HMENU)(ID_GRP_BASE + gi), g_hInstance, NULL);
		SendMessageA(gh, WM_SETFONT, (WPARAM)GetStockObject(DEFAULT_GUI_FONT), TRUE);
		kid_add(gh, 0, -1, 2, y, view_w > 4 ? view_w - 4 : 0, GRP_H);
		y += GRP_H + 2;
		if (gr->collapsed) continue;

		for (int k = 0; k < gr->n_depts; k++) {
			int d = gr->dept[k];
			DeptData *dept = &g.model.depts[d];
			char db[320];
			_snprintf(db, sizeof(db), "%s%s (%d)",
					  dept->open ? "[-] " : "[+] ", dept->name, dept->n_emps);
			HWND dh = CreateWindowA("BUTTON", db, WS_CHILD | WS_VISIBLE | BS_LEFT,
								   4, y, view_w > 8 ? view_w - 8 : 0, DEPT_H,
								   g.view, (HMENU)(ID_DEPT_BASE + d), g_hInstance, NULL);
			SendMessageA(dh, WM_SETFONT, (WPARAM)GetStockObject(DEFAULT_GUI_FONT), TRUE);
			kid_add(dh, 0, -1, 4, y, view_w > 8 ? view_w - 8 : 0, DEPT_H);
			y += DEPT_H + 2;
			if (!dept->open) continue;

			int lh = build_dept_list(d, g.view, 4, y, view_w > 8 ? view_w - 8 : 0);
			y += lh + GAP;
		}
		y += 4;
	}
	content_h = y;
	clamp_scroll();
	layout_kids();
}

/* --- Загрузка месяца --- */

static int fetch_month(void) {
	char path[96];
	_snprintf(path, sizeof(path), "/apps/tabel/tabel/month?year=%d&month=%d", g.year, g.month);
	SetCursor(LoadCursor(NULL, IDC_WAIT));
	int code = 0;
	char *body = net_get(&g.net, path, &code);
	SetCursor(LoadCursor(NULL, IDC_ARROW));
	if (!body) {
		char msg[300];
		_snprintf(msg, sizeof(msg), "Сеть недоступна: %s", g.net.errmsg);
		log_msg("MONTH GET %d: НЕТ ТЕЛА (сеть): %s", code, g.net.errmsg);
		show_error(msg);
		return 0;
	}
	if (code == 302 || code == 401 || code == 403) {
		log_msg("MONTH GET %d: сессия истекла", code);
		free(body);
		g.net.authed = 0;
		session_expired_hint();
		return -1;
	}
	if (code != 200) {
		char buf[150];
		_snprintf(buf, sizeof(buf), "Ошибка сервера (HTTP %d)", code);
		log_msg("MONTH GET %d: ошибка сервера", code);
		free(body);
		show_error(buf);
		return 0;
	}
	month_free(&g.model);
	if (month_parse(&g.model, body) != 0) {
		char dump[512];
		_snprintf(dump, sizeof(dump), "%s\\month_dump.json", g.exe_dir);
		FILE *f = fopen(dump, "wb");
		if (f) { fwrite(body, 1, strlen(body), f); fclose(f); }
		log_msg("MONTH PARSE FAIL: HTTP %d, len=%u, head=%.400s", code, (unsigned)strlen(body), body);
		free(body);
		show_error("Не удалось разобрать ответ сервера.");
		return 0;
	}
	log_msg("MONTH OK: year=%d month=%d lastDay=%d depts=%d groups=%d", g.model.year,
			g.model.month, g.model.lastDay, g.model.n_depts, g.model.n_groups);
	free(body);
	return 1;
}

static void load_and_rebuild(void) {
	upd_title();
	set_status("Загрузка…");
	int r = fetch_month();
	if (r < 0) {
		if (do_login()) r = fetch_month();
	}
	if (r > 0) {
		rebuild_view();
		set_status("");
	}
}

/* Сессия истекла: тихо сбрасываем авторизацию и сразу показываем окно входа
 * (без отдельного блокирующего MessageBox — он и так бы перекрывал логин). */
static void session_expired_hint(void) {
	set_status("Сессия истекла. Войдите заново.");
}

/* Повторный вход по истечении сессии (используется из диалога «События»).
 * Только обновляет токен (данные месяца уже на экране), без пересборки сетки —
 * иначе из обработчика клика мы разрушали бы то окно, что шлёт уведомление. */
int app_relogin(void) {
	if (do_login()) {
		set_status("");
		return 1;
	}
	set_status("Вход не выполнен.");
	return 0;
}

/* --- Логин (модальное окно) --- */

static HWND hLogin;
static BOOL login_result;
static char loginBuf[128], passBuf[128];

static void login_layout(HWND hwnd, int w, int h) {
	CreateWindowA("STATIC", "Логин:", WS_CHILD | WS_VISIBLE, 14, 16, 90, 20,
				  hwnd, NULL, g_hInstance, NULL);
	CreateWindowA("EDIT", "", WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL,
				  110, 14, 200, 22, hwnd, (HMENU)1001, g_hInstance, NULL);
	CreateWindowA("STATIC", "Пароль:", WS_CHILD | WS_VISIBLE, 14, 48, 90, 20,
				  hwnd, NULL, g_hInstance, NULL);
	CreateWindowA("EDIT", "", WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL | ES_PASSWORD,
				  110, 46, 200, 22, hwnd, (HMENU)1002, g_hInstance, NULL);
	CreateWindowA("BUTTON", "Войти", WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON,
				  110, 82, 90, 26, hwnd, (HMENU)IDOK, g_hInstance, NULL);
	CreateWindowA("BUTTON", "Отмена", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
				  220, 82, 90, 26, hwnd, (HMENU)IDCANCEL, g_hInstance, NULL);
	(void)w;
	(void)h;
}

static LRESULT CALLBACK LoginProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
	switch (msg) {
	case WM_CREATE:
		login_layout(hwnd, 340, 130);
		SetFocus(GetDlgItem(hwnd, 1001));
		return 0;
	case WM_KEYDOWN:
		if (wp == VK_RETURN) SendMessageA(hwnd, WM_COMMAND, IDOK, 0);
		return 0;
	case WM_COMMAND:
		if (LOWORD(wp) == IDOK) {
			GetDlgItemTextA(hwnd, 1001, loginBuf, sizeof(loginBuf));
			GetDlgItemTextA(hwnd, 1002, passBuf, sizeof(passBuf));
			if (!loginBuf[0] || !passBuf[0]) {
				MessageBoxA(hwnd, "Введите логин и пароль.", "Вход",
							MB_OK | MB_ICONWARNING);
				return 0;
			}
			if (!net_signin(&g.net, loginBuf, passBuf)) {
				MessageBoxA(hwnd, g.net.errmsg, "Вход", MB_OK | MB_ICONERROR);
				return 0;
			}
			net_save_token(&g.net, g.exe_dir);
			login_result = TRUE;
			DestroyWindow(hwnd);
			return 0;
		}
		if (LOWORD(wp) == IDCANCEL) {
			login_result = FALSE;
			DestroyWindow(hwnd);
			return 0;
		}
		break;
	case WM_CLOSE:
		login_result = FALSE;
		DestroyWindow(hwnd);
		return 0;
	case WM_DESTROY:
		PostQuitMessage(0);
		return 0;
	}
	return DefWindowProcA(hwnd, msg, wp, lp);
}

static BOOL do_login(void) {
	if (hLogin) hLogin = NULL;
	WNDCLASSA lc;
	memset(&lc, 0, sizeof(lc));
	lc.lpfnWndProc = LoginProc;
	lc.hInstance = g_hInstance;
	lc.hCursor = LoadCursor(NULL, IDC_ARROW);
	lc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
	lc.lpszClassName = "TabelViewerLogin";
	RegisterClassA(&lc);

	login_result = FALSE;
	hLogin = CreateWindowA("TabelViewerLogin", "Вход в табель",
						   WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
						   CW_USEDEFAULT, CW_USEDEFAULT, 350, 160,
						   NULL, NULL, g_hInstance, NULL);
	if (!hLogin) return FALSE;
	ShowWindow(hLogin, SW_SHOW);
	UpdateWindow(hLogin);

	EnableWindow(g.hwnd, FALSE);
	MSG msg;
	while (GetMessage(&msg, NULL, 0, 0)) {
		if (IsDialogMessage(hLogin, &msg)) continue;
		TranslateMessage(&msg);
		DispatchMessage(&msg);
	}
	EnableWindow(g.hwnd, TRUE);
	SetForegroundWindow(g.hwnd);
	hLogin = NULL;
	return login_result;
}

/* --- Вью (прокручиваемая иерархия групп/отделов/таблиц) --- */

static void view_color_cell(NMLVCUSTOMDRAW *cd, int dept_idx, int idx, int sub) {
	if (sub < 4) return;
	int day = sub - 4;
	if (day < 0 || day >= g.model.lastDay) return;
	if (dept_idx < 0 || dept_idx >= g.model.n_depts) return;
	LVITEMA lv;
	memset(&lv, 0, sizeof(lv));
	lv.mask = LVIF_PARAM;
	lv.iItem = idx;
	if (!ListView_GetItem(cd->nmcd.hdr.hwndFrom, &lv) || !lv.lParam) return;
	const RowMeta *rm = (const RowMeta *)lv.lParam;
	if (rm->emp < 0 || rm->emp >= g.model.depts[dept_idx].n_emps) return;
	DayData *dd = &g.model.depts[dept_idx].emps[rm->emp].days[day];
	char date[16];
	day_date(day + 1, date, sizeof(date));
	int eh = eff_hours(dd);
	int bg = -1, fg = -1, bold = 0;
	cell_style(&g.model, date, dd, eh, dd->mark, dd->sched_id, &bg, &fg, &bold);
	if (bg < 0) {
		const CalDay *c = cal_find(&g.model, date);
		if (c && (c->dayType == 3 || c->dayType == 1)) bg = RGB(238, 238, 238);
	}
	if (bg >= 0) cd->clrTextBk = (COLORREF)bg;
	if (fg >= 0) cd->clrText = (COLORREF)fg;
}

static void view_dblclick(HWND lv, int dept_idx, int idx) {
	if (dept_idx < 0 || dept_idx >= g.model.n_depts) return;
	LVITEMA it;
	memset(&it, 0, sizeof(it));
	it.mask = LVIF_PARAM;
	it.iItem = idx;
	if (!ListView_GetItem(lv, &it) || !it.lParam) return;
	const RowMeta *rm = (const RowMeta *)it.lParam;
	if (rm->kind == 1 && rm->emp >= 0 && rm->emp < g.model.depts[dept_idx].n_emps) {
		app_open_events(g.hwnd, g.model.depts[dept_idx].emps[rm->emp].id);
	}
}

static void view_ownerdraw_header(LPDRAWITEMSTRUCT ds, int group) {
	char text[320];
	GetWindowTextA(ds->hwndItem, text, (int)sizeof(text));
	/* Collapsible групп подразделений — выделяющийся фон */
	COLORREF bg = RGB(200, 220, 245);
	COLORREF fg = RGB(15, 35, 60);
	(void)group;
	HBRUSH br = CreateSolidBrush(bg);
	FillRect(ds->hDC, &ds->rcItem, br);
	DeleteObject(br);
	SetBkMode(ds->hDC, TRANSPARENT);
	SetTextColor(ds->hDC, fg);
	RECT r = ds->rcItem;
	InflateRect(&r, -5, -1);
	DrawTextA(ds->hDC, text, -1, &r,
			  DT_LEFT | DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS | DT_NOPREFIX);
}

static LRESULT CALLBACK ViewProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
	switch (msg) {
	case WM_SIZE: {
		RECT rc;
		GetClientRect(hwnd, &rc);
		view_w = rc.right;
		view_h = rc.bottom;
		/* переразложить по новой ширине (перерисовка при изменении размеров) */
		for (int i = 0; i < nkids; i++) {
			if (kids[i].type == 0) {
				kids[i].x = 2;
				kids[i].w = view_w > 4 ? view_w - 4 : 0;
			} else {
				kids[i].x = 4;
				kids[i].w = view_w > 8 ? view_w - 8 : 0;
			}
		}
		clamp_scroll();
		layout_kids();
		return 0;
	}
	case WM_VSCROLL:
		do_scroll((int)HIWORD(wp), LOWORD(wp));
		return 0;
	case WM_MOUSEWHEEL: {
		HWND tbl = hover_table();
		if (!tbl) return 0; /* без наведения на таблицу — ничего не делаем */
		int delta = (short)HIWORD(wp);
		if (GET_KEYSTATE_WPARAM(wp) & MK_SHIFT) hwheel_one(tbl, delta);
		else SendMessageA(tbl, WM_MOUSEWHEEL, wp, lp); /* обычный скролл самой таблицы */
		return 0;
	}
	case WM_ERASEBKGND:
		return 1; /* фон рисуем в WM_PAINT */
	case WM_PAINT: {
		PAINTSTRUCT ps;
		HDC hdc = BeginPaint(hwnd, &ps);
		FillRect(hdc, &ps.rcPaint, GetSysColorBrush(COLOR_WINDOW));
		EndPaint(hwnd, &ps);
		return 0;
	}
	case WM_COMMAND: {
		int id = LOWORD(wp);
		if (id >= ID_GRP_BASE && id < ID_GRP_BASE + 512) {
			int gi = id - ID_GRP_BASE;
			if (gi >= 0 && gi < g.model.n_groups) {
				g.model.groups[gi].collapsed = g.model.groups[gi].collapsed ? 0 : 1;
				PostMessageA(hwnd, WM_VIEW_REBUILD, 0, 0);
			}
			return 0;
		}
		if (id >= ID_DEPT_BASE && id < ID_DEPT_BASE + 4096) {
			int d = id - ID_DEPT_BASE;
			if (d >= 0 && d < g.model.n_depts) {
				g.model.depts[d].open = g.model.depts[d].open ? 0 : 1;
				PostMessageA(hwnd, WM_VIEW_REBUILD, 0, 0);
			}
			return 0;
		}
		return 0;
	}
	case WM_VIEW_REBUILD:
		rebuild_view();
		return 0;
	case WM_DRAWITEM: {
		LPDRAWITEMSTRUCT ds = (LPDRAWITEMSTRUCT)lp;
		if (ds->CtlType == ODT_BUTTON) {
			int id = (int)ds->CtlID;
			int group = (id >= ID_GRP_BASE && id < ID_GRP_BASE + 512);
			view_ownerdraw_header(ds, group);
			return TRUE;
		}
		return 0;
	}
	case WM_NOTIFY: {
		const LPNMHDR nm = (LPNMHDR)lp;
		if (nm->idFrom >= ID_DEPT_BASE) {
			HWND lv = nm->hwndFrom;
			int dept_idx = (int)GetWindowLongPtrA(lv, GWLP_USERDATA);
			if (nm->code == NM_DBLCLK) {
				const NMITEMACTIVATE *nia = (const NMITEMACTIVATE *)nm;
				if (nia->iItem >= 0) view_dblclick(lv, dept_idx, nia->iItem);
				return 0;
			}
			if (nm->code == NM_CUSTOMDRAW) {
				NMLVCUSTOMDRAW *cd = (NMLVCUSTOMDRAW *)nm;
				switch (cd->nmcd.dwDrawStage) {
				case CDDS_PREPAINT:
					return CDRF_NOTIFYITEMDRAW;
				case CDDS_ITEMPREPAINT:
					return CDRF_NOTIFYSUBITEMDRAW;
				case CDDS_SUBITEM | CDDS_ITEMPREPAINT: {
					/* ячейка таблицы: дефолт, затем цвет по дню */
					cd->clrText = GetSysColor(COLOR_WINDOWTEXT);
					cd->clrTextBk = GetSysColor(COLOR_WINDOW);
					if (cd->iSubItem == 1) {
						/* должность (строка отметок, колонка ФИО) — серым */
						LVITEMA lv2;
						memset(&lv2, 0, sizeof(lv2));
						lv2.mask = LVIF_PARAM;
						lv2.iItem = (int)cd->nmcd.dwItemSpec;
						if (ListView_GetItem(lv, &lv2) && lv2.lParam) {
							const RowMeta *rm = (const RowMeta *)lv2.lParam;
							if (rm->kind == 2) cd->clrText = RGB(107, 114, 128);
						}
						return CDRF_NEWFONT;
					}
					view_color_cell(cd, dept_idx, (int)cd->nmcd.dwItemSpec, cd->iSubItem);
					return CDRF_NEWFONT;
				}
				case CDDS_SUBITEM | CDDS_ITEMPOSTPAINT: {
					/* чёткие границы ячеек (фоновая заливка дня скрывает gridlines) */
					HWND lvh = cd->nmcd.hdr.hwndFrom;
					RECT rc;
					if (cd->iSubItem >= 0 &&
						ListView_GetSubItemRect(lvh, (int)cd->nmcd.dwItemSpec,
												cd->iSubItem, LVIR_BOUNDS, &rc)) {
						--rc.right;
						--rc.bottom;
						FrameRect(cd->nmcd.hdc, &rc, GetSysColorBrush(COLOR_3DSHADOW));
					}
					return CDRF_DODEFAULT;
				}
				}
				return CDRF_DODEFAULT;
			}
		}
		return 0;
	}
	case WM_DESTROY:
		destroy_kids();
		return 0;
	}
	return DefWindowProcA(hwnd, msg, wp, lp);
}

/* --- Главное окно --- */

static LRESULT CALLBACK MainWndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
	switch (msg) {
	case WM_CREATE: {
		HFONT fnt = (HFONT)GetStockObject(DEFAULT_GUI_FONT);
		CreateWindowA("BUTTON", "<", WS_CHILD | WS_VISIBLE,
					  4, 4, 40, 26, hwnd, (HMENU)ID_BTN_PREV, g_hInstance, NULL);
		CreateWindowA("BUTTON", ">", WS_CHILD | WS_VISIBLE,
					  48, 4, 40, 26, hwnd, (HMENU)ID_BTN_NEXT, g_hInstance, NULL);
		CreateWindowA("BUTTON", "Текущий", WS_CHILD | WS_VISIBLE,
					  94, 4, 80, 26, hwnd, (HMENU)ID_BTN_TODAY, g_hInstance, NULL);
		g.lbl_title = CreateWindowA("STATIC", "", WS_CHILD | WS_VISIBLE | SS_CENTER,
									180, 4, 140, 26, hwnd, NULL, g_hInstance, NULL);
		SendMessageA(g.lbl_title, WM_SETFONT, (WPARAM)fnt, TRUE);
		CreateWindowA("BUTTON", "Факт. время", WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX,
					  326, 4, 110, 26, hwnd, (HMENU)ID_CHK_ACTUAL, g_hInstance, NULL);
		SendMessageA(GetDlgItem(hwnd, ID_CHK_ACTUAL), WM_SETFONT, (WPARAM)fnt, TRUE);
		CreateWindowA("BUTTON", "Выйти", WS_CHILD | WS_VISIBLE,
					  442, 4, 70, 26, hwnd, (HMENU)ID_BTN_LOGOUT, g_hInstance, NULL);
		g.status = CreateWindowA("STATIC", "", WS_CHILD | WS_VISIBLE | SS_LEFT,
								 4, 0, 200, 16, hwnd, NULL, g_hInstance, NULL);
		SendMessageA(g.status, WM_SETFONT, (WPARAM)fnt, TRUE);

		/* Прокручиваемая область со списком групп/отделов */
		WNDCLASSA vc;
		memset(&vc, 0, sizeof(vc));
		vc.lpfnWndProc = ViewProc;
		vc.hInstance = g_hInstance;
		vc.hCursor = LoadCursor(NULL, IDC_ARROW);
		vc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
		vc.lpszClassName = "TabelViewerView";
		RegisterClassA(&vc);
		g.view = CreateWindowExA(0, "TabelViewerView", "", WS_CHILD | WS_VISIBLE |
								WS_VSCROLL | WS_CLIPCHILDREN | WS_CLIPSIBLINGS,
								0, 34, 800, 500, hwnd, NULL, g_hInstance, NULL);
		if (g.view) SendMessageA(g.view, WM_SETFONT, (WPARAM)fnt, TRUE);

		SendMessageA(GetDlgItem(hwnd, ID_CHK_ACTUAL), BM_SETCHECK, BST_CHECKED, 0);
		g.actual = 1;
		SYSTEMTIME st;
		GetLocalTime(&st);
		g.year = st.wYear;
		g.month = st.wMonth;
		return 0;
	}
	case WM_SIZE: {
		int w = LOWORD(lp), h = HIWORD(lp);
		if (g.view) MoveWindow(g.view, 0, 34, w, h > 52 ? h - 34 - 20 : 0, TRUE);
		if (g.status) MoveWindow(g.status, 4, h > 20 ? h - 18 : 2, w - 8, 16, TRUE);
		return 0;
	}
	case WM_MOUSEWHEEL: {
		HWND tbl = hover_table();
		if (!tbl) return 0;
		int delta = (short)HIWORD(wp);
		if (GET_KEYSTATE_WPARAM(wp) & MK_SHIFT) hwheel_one(tbl, delta);
		else SendMessageA(tbl, WM_MOUSEWHEEL, wp, lp);
		return 0;
	}
	case WM_COMMAND:
		switch (LOWORD(wp)) {
		case ID_BTN_PREV:
			if (g.month == 1) { g.month = 12; g.year--; }
			else g.month--;
			load_and_rebuild();
			return 0;		case ID_BTN_NEXT:
			if (g.month == 12) { g.month = 1; g.year++; }
			else g.month++;
			load_and_rebuild();
			return 0;
		case ID_BTN_TODAY: {
			SYSTEMTIME st;
			GetLocalTime(&st);
			g.year = st.wYear;
			g.month = st.wMonth;
			load_and_rebuild();
			return 0;
		}
		case ID_CHK_ACTUAL:
			g.actual = SendMessageA((HWND)lp, BM_GETCHECK, 0, 0) == BST_CHECKED;
			if (g.model.n_depts > 0) rebuild_view();
			return 0;
		case ID_BTN_LOGOUT:
			net_logout(&g.net, g.exe_dir);
			if (do_login()) load_and_rebuild();
			return 0;
		}
		return 0;
	case WM_DESTROY:
		if (g.view) DestroyWindow(g.view);
		PostQuitMessage(0);
		return 0;
	}
	return DefWindowProcA(hwnd, msg, wp, lp);
}

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR lpCmd, int nShow) {
	(void)hPrev;
	(void)lpCmd;
	g_hInstance = hInst;
	INITCOMMONCONTROLSEX icc;
	icc.dwSize = sizeof(icc);
	icc.dwICC = ICC_LISTVIEW_CLASSES | ICC_STANDARD_CLASSES;
	InitCommonControlsEx(&icc);

	exe_dir(g.exe_dir, sizeof(g.exe_dir));
	log_init(g.exe_dir);
	net_load_config(&g.net, g.exe_dir);
	net_load_token(&g.net, g.exe_dir);
	log_msg("START exe_dir=%s base=%s authed=%d", g.exe_dir, g.net.base, g.net.authed);

	WNDCLASSA wc;
	memset(&wc, 0, sizeof(wc));
	wc.lpfnWndProc = MainWndProc;
	wc.hInstance = hInst;
	wc.hCursor = LoadCursor(NULL, IDC_ARROW);
	wc.hIcon = LoadIcon(NULL, IDI_APPLICATION);
	wc.lpszClassName = "TabelViewerMain";
	wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
	if (!RegisterClassA(&wc)) return 1;

	g.hwnd = CreateWindowA("TabelViewerMain", "Табель (просмотр)",
						   WS_OVERLAPPEDWINDOW | WS_VISIBLE,
						   CW_USEDEFAULT, CW_USEDEFAULT, 1040, 700,
						   NULL, NULL, hInst, NULL);
	if (!g.hwnd) return 1;
	ShowWindow(g.hwnd, nShow);
	UpdateWindow(g.hwnd);

	if (!g.net.authed) {
		if (!do_login()) {
			DestroyWindow(g.hwnd);
			return 0;
		}
	}
	load_and_rebuild();

	MSG msg;
	while (GetMessage(&msg, NULL, 0, 0)) {
		if (g.hwnd && IsDialogMessage(g.hwnd, &msg)) continue;
		if (hLogin && IsDialogMessageA(hLogin, &msg)) continue;
		TranslateMessage(&msg);
		DispatchMessage(&msg);
	}
	destroy_kids();
	month_free(&g.model);
	free(kids);
	return 0;
}
