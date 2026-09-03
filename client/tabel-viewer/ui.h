/*
 * ui.h — главное окно вьювера, навигация по месяцам, сетка с расцветкой
 * и диалог «События сотрудника».
 */
#ifndef UI_H
#define UI_H

#define _WIN32_WINNT 0x0501
#include <windows.h>
#include <commctrl.h>
#include "net.h"
#include "model.h"

#define ID_BTN_PREV 101
#define ID_BTN_NEXT 102
#define ID_BTN_TODAY 103
#define ID_CHK_ACTUAL 104
#define ID_BTN_LOGOUT 105
/* Динамические заголовки внутри вью: группы (201+), подразделения (301+) */
#define ID_GRP_BASE 201
#define ID_DEPT_BASE 301

typedef struct {
	int kind;   /* 1 = строка часов, 2 = строка отметок */
	int emp;    /* индекс в depts[dept].emps[] (dept — из userdata списка) */
} RowMeta;

typedef struct {
	Net net;
	char exe_dir[MAX_PATH];
	MonthModel model;
	int year;
	int month;
	int actual;   /* режим «Факт. время» */
	HWND hwnd;
	HWND view;
	HWND list;
	HWND lbl_title;
	HWND status;
	int n_cols;
} App;

extern App g;
extern HINSTANCE g_hInstance;

void app_open_events(HWND parent, int emp_id);
int app_relogin(void);

#endif /* UI_H */