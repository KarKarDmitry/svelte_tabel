/*
 * model.h — модели данных табеля и событий сотрудника для вьювера.
 * Парсинг JSON месяцев выполняется из json.h-дерева; здесь живут доменные
 * структуры и порт общей расцветки ячеек (данные приходят уже с правилами).
 */
#ifndef MODEL_H
#define MODEL_H

#ifdef __cplusplus
extern "C" {
#endif

#define MAX_FIO 256
#define MAX_DAYMARKS 64

typedef struct {
	int report_hours;  /* отчётные часы (минуты) или -1 */
	int report_night;  /* отчётные ночные или -1 */
	int shift_hours;   /* сменные из импорта или -1 */
	int shift_night;   /* сменные ночные или -1 */
	int raw_hours;     /* факт импорта (rawWorkTime) или -1 */
	int raw_night;     /* факт ночных или -1 */
	char mark[8];      /* эффективная отметка (report ?? fact) */
	char fact[8];      /* факт из импорта */
	int sched_id;      /* scheduleId дня (0 = нет) */
	int has_report;    /* есть отчётные значения */
	int blocked;       /* вне сегмента */
} DayData;

typedef struct {
	int id;
	char number[32];
	char fio[MAX_FIO];      /* "Иванов Иван Иванович" */
	char position[128];
	DayData *days;          /* массив [lastDay] */
	int segment_from;
	int segment_to;         /* Дни месяца с 1; сегмент инклюзивен */
} EmpData;

typedef struct {
	int id;
	char name[256];
	EmpData *emps;
	int n_emps;
	int open; /* UI: развёрнута ли таблица подразделения (sub-collapsible) */
} DeptData;

typedef struct {
	int id;        /* 0 = виртуальная «Без группы» */
	char name[256];
	int collapsed; /* 1 = свёрнута (показывать только заголовок) */
	int *dept;     /* индексы в MonthModel.depts[] */
	int n_depts;
} GroupData;

typedef struct {
	char date[16];     /* YYYY-MM-DD */
	int dayType;       /* 0 workday,1 holiday,2 preholiday,3 weekend,4 transferred_workday,5 transferred_holiday */
	int workTime;      /* минуты */
} CalDay;

typedef struct {
	int id;
	int std; /* стандартное время, минуты */
} Schedule;

typedef struct {
	DeptData *depts;
	int n_depts;
	GroupData *groups; /* упорядоченные группы (indices в depts[]) */
	int n_groups;
	int year;
	int month;
	int lastDay;
	int actual;
	CalDay *cals;
	int n_cals;
	Schedule *schedules;
	int n_schedules;
	/* Отметки: code -> shortName */
	char mark_codes[MAX_DAYMARKS][8];
	char mark_short[MAX_DAYMARKS][8];
	int n_marks;
	/* Сменные отметки (коды) */
	char shift_marks[MAX_DAYMARKS][8];
	int n_shift;
	/* Цветовые правила (light) */
	int weekend_bg;   /* COLORREF, -1 если нет */
	int missing_bg;
	int overwork_bg;
	int underwork_bg;
	int missed_bg;
	/* Правила отметок: code -> {bg, color} */
	char rule_bg[MAX_DAYMARKS][16];
	char rule_color[MAX_DAYMARKS][16];
	char rule_code[MAX_DAYMARKS][8];
	int n_rules;
} MonthModel;

/* Разобрать тело JSON месячного endpoint'а. Вернёт 0 при успехе. */
int month_parse(MonthModel *m, const char *json_text);
void month_free(MonthModel *m);

/* Отметка-короткое имя по коду (или сам код, если не найдено). */
const char *mark_short(const MonthModel *m, const char *code);

/* Поиск дня календаря по дате "YYYY-MM-DD". */
const CalDay *cal_find(const MonthModel *m, const char *date);

/* Стиль ячейки (порт cell-style.ts с использованием light-правил).
 * date — "YYYY-MM-DD" дня. Заполняет out_bg/out_fg (COLORREF), out_bold. */
void cell_style(const MonthModel *m, const char *date, const DayData *d,
				int eff_hours, const char *eff_mark, int emp_sched_id,
				int *out_bg, int *out_fg, int *out_bold);

/* Преобразовать минуты в строку "ч.ч" (7.5). */
void fmt_hours(int minutes, char *buf, int cap);

/* --- События сотрудника (employee-events) --- */
typedef struct {
	char datetime[64];
	char eventName[64];
	char passNumber[64];
} TurnstileEvent;

typedef struct {
	char date[16];     /* YYYY-MM-DD */
	int reportWorkTime; /* -1 = null */
	int reportNightWorkTime;
	int shiftWorkTime;
	int shiftNightWorkTime;
	char mark[8];
	char extra[8];
	int extraMinutes;
} EvDay;

typedef struct {
	char fio[MAX_FIO];
	char number[32];
	char department[256];
	char position[128];
	TurnstileEvent *events;
	int n_events;
	EvDay *days;
	int n_days;
	int lastDay;
} EventsData;

int events_parse(EventsData *e, const char *json_text);
void events_free(EventsData *e);

#ifdef __cplusplus
}
#endif

#endif /* MODEL_H */