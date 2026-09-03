/*
 * events.c — диалог «События сотрудника»: турникет-события за месяц
 * и поминутные отметки по дням. Только чтение (EmployeeEventsModal.svelte).
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

/* Копия полезной части ответа (дни уже с короткой отметкой). */
static HWND hEvents;
static HWND ev_list, ev_days;
static EventsData ev_data;

static void ev_fmt(int minutes, char *buf, int cap) {
	if (minutes < 0) {
		buf[0] = '\0';
		return;
	}
	_snprintf(buf, (size_t)cap, "%.1f", (double)minutes / 60.0);
}

static void ev_fill(HWND hwnd) {
	char title[300];
	_snprintf(title, sizeof(title), "События — %s", ev_data.fio[0] ? ev_data.fio : "");
	SetWindowTextA(hwnd, title);

	/* подпись */
	CreateWindowA("STATIC",
				  ev_data.position[0] ? ev_data.position : "",
				  WS_CHILD | WS_VISIBLE | SS_LEFT, 10, 10, 420, 20,
				  hwnd, (HMENU)100, g_hInstance, NULL);

	/* левый список: события */
	ev_list = CreateWindowExA(0, WC_LISTVIEWA, "", WS_CHILD | WS_VISIBLE |
							  WS_BORDER | LVS_REPORT, 10, 36, 380, 300,
							  hwnd, NULL, g_hInstance, NULL);
	ListView_SetExtendedListViewStyle(ev_list, LVS_EX_FULLROWSELECT | LVS_EX_GRIDLINES);
	LVCOLUMNA c;
	memset(&c, 0, sizeof(c));
	c.mask = LVCF_TEXT | LVCF_WIDTH;
	c.cx = 110; c.pszText = "Дата/время";
	ListView_InsertColumn(ev_list, 0, &c);
	c.cx = 120; c.pszText = "Событие";
	ListView_InsertColumn(ev_list, 1, &c);
	c.cx = 110; c.pszText = "Пропуск";
	ListView_InsertColumn(ev_list, 2, &c);
	for (int i = 0; i < ev_data.n_events; i++) {
		LVITEMA lv;
		memset(&lv, 0, sizeof(lv));
		lv.mask = LVIF_TEXT;
		lv.iItem = i;
		lv.pszText = ev_data.events[i].datetime;
		int idx = ListView_InsertItem(ev_list, &lv);
		ListView_SetItemText(ev_list, idx, 1, ev_data.events[i].eventName);
		ListView_SetItemText(ev_list, idx, 2, ev_data.events[i].passNumber);
	}

	/* правый список: отметки по дням */
	ev_days = CreateWindowExA(0, WC_LISTVIEWA, "", WS_CHILD | WS_VISIBLE |
							  WS_BORDER | LVS_REPORT, 400, 36, 420, 300,
							  hwnd, NULL, g_hInstance, NULL);
	ListView_SetExtendedListViewStyle(ev_days, LVS_EX_FULLROWSELECT | LVS_EX_GRIDLINES);
	c.cx = 40; c.pszText = "День";
	ListView_InsertColumn(ev_days, 0, &c);
	c.cx = 70; c.pszText = "Часов";
	ListView_InsertColumn(ev_days, 1, &c);
	c.cx = 70; c.pszText = "Ночных";
	ListView_InsertColumn(ev_days, 2, &c);
	c.cx = 60; c.pszText = "Метка";
	ListView_InsertColumn(ev_days, 3, &c);
	c.cx = 60; c.pszText = "Доп.метка";
	ListView_InsertColumn(ev_days, 4, &c);
	c.cx = 70; c.pszText = "Час.доп";
	ListView_InsertColumn(ev_days, 5, &c);
	for (int i = 0; i < ev_data.n_days; i++) {
		char buf[16];
		char hbuf[16], nbuf[16], ebuf[16];
		const char *d8 = ev_data.days[i].date;
		_snprintf(buf, sizeof(buf), "%s", d8 && d8[0] ? d8 + 8 : "");
		ev_fmt(ev_data.days[i].reportWorkTime, hbuf, sizeof(hbuf));
		ev_fmt(ev_data.days[i].reportNightWorkTime, nbuf, sizeof(nbuf));
		if (ev_data.days[i].extraMinutes >= 0) {
			_snprintf(ebuf, sizeof(ebuf), "%.1f", (double)ev_data.days[i].extraMinutes / 60.0);
		} else ebuf[0] = '\0';
		LVITEMA lv;
		memset(&lv, 0, sizeof(lv));
		lv.mask = LVIF_TEXT;
		lv.iItem = i;
		lv.pszText = buf;
		int idx = ListView_InsertItem(ev_days, &lv);
		ListView_SetItemText(ev_days, idx, 1, hbuf);
		ListView_SetItemText(ev_days, idx, 2, nbuf);
		ListView_SetItemText(ev_days, idx, 3, ev_data.days[i].mark);
		ListView_SetItemText(ev_days, idx, 4, ev_data.days[i].extra);
		ListView_SetItemText(ev_days, idx, 5, ebuf);
	}
	(void)hwnd;
}

/* --- Расцветка ячеек диалога (по календарю и правилам из g.model месяца) --- */

static COLORREF ev_hex(const char *s) {
	unsigned r, g, b;
	if (s && *s == '#' && sscanf(s, "#%2x%2x%2x", &r, &g, &b) == 3)
		return RGB(r, g, b);
	return 0;
}

/* Цвет строки/ячейки списка «отметки по дням». item — индекс строки. */
static COLORREF ev_day_bg(int item, int sub) {
	if (item < 0 || item >= ev_data.n_days) return 0;
	const char *date = ev_data.days[item].date;
	const char *mark = ev_data.days[item].mark;
	/* спец-цвет отметки (колонка «Метка») — приоритетнее */
	if (sub == 3 && mark && *mark) {
		for (int i = 0; i < g.model.n_rules; i++) {
			if (strcmp(g.model.rule_code[i], mark) == 0) {
				COLORREF c = ev_hex(g.model.rule_bg[i]);
				if (c) return c;
				break;
			}
		}
	}
	const CalDay *cd = date ? cal_find(&g.model, date) : NULL;
	if (cd && (cd->dayType == 3 || cd->dayType == 1)) return RGB(238, 238, 238);
	return 0;
}

static LRESULT CALLBACK EventsProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
	switch (msg) {
	case WM_CREATE:
		ev_fill(hwnd);
		return 0;
	case WM_SIZE:
		return 0;
	case WM_NOTIFY: {
		const LPNMHDR nm = (LPNMHDR)lp;
		if (nm->hwndFrom == ev_days && nm->code == NM_CUSTOMDRAW) {
			NMLVCUSTOMDRAW *cd = (NMLVCUSTOMDRAW *)nm;
			switch (cd->nmcd.dwDrawStage) {
			case CDDS_PREPAINT:
				return CDRF_NOTIFYITEMDRAW;
			case CDDS_ITEMPREPAINT:
				return CDRF_NOTIFYSUBITEMDRAW;
			case CDDS_SUBITEM | CDDS_ITEMPREPAINT: {
				cd->clrText = GetSysColor(COLOR_WINDOWTEXT);
				cd->clrTextBk = GetSysColor(COLOR_WINDOW);
				COLORREF bg = ev_day_bg((int)cd->nmcd.dwItemSpec, cd->iSubItem);
				if (bg) cd->clrTextBk = bg;
				return CDRF_NEWFONT;
			}
			case CDDS_SUBITEM | CDDS_ITEMPOSTPAINT: {
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
		return 0;
	}
	case WM_CLOSE:
		DestroyWindow(hwnd);
		return 0;
	case WM_DESTROY:
		events_free(&ev_data);
		hEvents = NULL;
		return 0;
	}
	return DefWindowProcA(hwnd, msg, wp, lp);
}

void app_open_events(HWND parent, int emp_id) {
	if (hEvents) {
		SetForegroundWindow(hEvents);
		return;
	}

	WNDCLASSA ec;
	memset(&ec, 0, sizeof(ec));
	ec.lpfnWndProc = EventsProc;
	ec.hInstance = g_hInstance;
	ec.hCursor = LoadCursor(NULL, IDC_ARROW);
	ec.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
	ec.lpszClassName = "TabelViewerEvents";
	RegisterClassA(&ec);

	char path[128];
	_snprintf(path, sizeof(path), "/apps/tabel/tabel/employee-events?employeeId=%d&year=%d&month=%d",
			  emp_id, g.year, g.month);

	/* Получение данных: при истечении сессии (401/302/403) тихо перелогиниваемся
	   (app_relogin перезагружает месяц) и пробуем ещё раз. */
	int code = 0;
	char *body = NULL;
	int attempt;
	for (attempt = 0; attempt < 2; attempt++) {
		body = net_get(&g.net, path, &code);
		if (!body) {
			MessageBoxA(parent, g.net.errmsg, "События", MB_OK | MB_ICONERROR);
			return;
		}
		if (code == 302 || code == 401 || code == 403) {
			log_msg("EVENTS GET %d: сессия истекла", code);
			free(body);
			body = NULL;
			if (attempt == 0 && app_relogin()) continue;
			MessageBoxA(parent, "Сессия истекла. Вход не выполнен.", "События",
						MB_OK | MB_ICONWARNING);
			return;
		}
		break;
	}
	if (code != 200) {
		char buf[150];
		_snprintf(buf, sizeof(buf), "Ошибка сервера (HTTP %d)", code);
		free(body);
		MessageBoxA(parent, buf, "События", MB_OK | MB_ICONERROR);
		return;
	}
	events_free(&ev_data);
	if (events_parse(&ev_data, body) != 0) {
		log_msg("EVENTS PARSE FAIL (%s): HTTP %d, len=%u, head=%.240s", path, code,
				(unsigned)strlen(body), body);
		free(body);
		MessageBoxA(parent, "Не удалось разобрать ответ сервера.", "События",
					MB_OK | MB_ICONERROR);
		return;
	}
	free(body);

	hEvents = CreateWindowA("TabelViewerEvents", "События",
							WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_VISIBLE,
							CW_USEDEFAULT, CW_USEDEFAULT, 860, 400,
							parent, NULL, g_hInstance, NULL);
	if (!hEvents) return;
}