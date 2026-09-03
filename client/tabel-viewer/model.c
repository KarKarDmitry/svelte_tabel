/*
 * model.c — парсинг JSON месяцев/событий и порт общей расцветки ячеек.
 * Бизнес-правила заимствованы из src/lib/apps/tabel/utils/cell-style.ts
 * (светлый набор правил; сервер уже отдаёт готовые правила).
 */
#define _WIN32_WINNT 0x0501
#include "model.h"
#include "json.h"
#include "log.h"
#include "enc.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

/* Разбор "#rrggbb" / "rgb(r,g,b)" в COLORREF (0x00bbggrr). */
static unsigned parse_color(const char *s, unsigned fallback) {
	if (!s || !*s) return fallback;
	if (*s == '#') {
		int r = 0, g = 0, b = 0;
		if (sscanf(s, "#%2x%2x%2x", (unsigned *)&r, (unsigned *)&g, (unsigned *)&b) == 3) {
			return (unsigned)(((unsigned)b << 16) | ((unsigned)g << 8) | (unsigned)r);
		}
		return fallback;
	}
	if (strncmp(s, "rgb(", 4) == 0) {
		int r = 0, g = 0, b = 0;
		if (sscanf(s, "rgb(%d,%d,%d)", &r, &g, &b) == 3) {
			return (unsigned)(((unsigned)b << 16) | ((unsigned)g << 8) | (unsigned)r);
		}
	}
	return fallback;
}

static int day_type_val(const char *s) {
	if (!s) return 0;
	if (strcmp(s, "workday") == 0) return 0;
	if (strcmp(s, "holiday") == 0) return 1;
	if (strcmp(s, "preholiday") == 0) return 2;
	if (strcmp(s, "weekend") == 0) return 3;
	if (strcmp(s, "transferred_workday") == 0) return 4;
	if (strcmp(s, "transferred_holiday") == 0) return 5;
	return 0;
}

int month_parse(MonthModel *m, const char *text) {
	memset(m, 0, sizeof(*m));
	m->weekend_bg = -1;
	m->missing_bg = -1;
	m->overwork_bg = -1;
	m->underwork_bg = -1;
	m->missed_bg = -1;

	JVal *root = json_parse(text);
	if (!root) {
		log_msg("month_parse: json_parse вернул NULL");
		return -1;
	}
	JVal *jy = jobj_get(root, "year");
	JVal *jm = jobj_get(root, "month");
	JVal *jl = jobj_get(root, "lastDay");
	m->year = (int)jnum(jy ? jy : jobj_get(root, "year"));
	m->month = (int)jnum(jm);
	m->lastDay = (int)jnum(jl);

	/* --- Отметки: code -> shortName --- */
	JVal *marks = jobj_get(root, "dayMarks");
	if (marks) {
		int n = jlen(marks);
		for (int i = 0; i < n && m->n_marks < MAX_DAYMARKS; i++) {
			JVal *mk = jitem(marks, i);
			const char *code = jstr(jobj_get(mk, "code"));
			const char *shortName = jstr(jobj_get(mk, "shortName"));
			if (code && *code) {
				enc_copy(m->mark_codes[m->n_marks], sizeof(m->mark_codes[m->n_marks]), code);
				enc_copy(m->mark_short[m->n_marks], sizeof(m->mark_short[m->n_marks]),
						 shortName ? shortName : code);
				m->n_marks++;
			}
		}
	}

	/* --- Календарь: calendarDays объект {date: {dayType, workTime}} --- */
	JVal *cals = jobj_get(root, "calendarDays");
	if (cals && cals->t == JV_OBJ) {
		int n = cals->u.obj.n;
		m->cals = (CalDay *)calloc((size_t)n, sizeof(CalDay));
		if (!m->cals) {
			log_msg("month_parse: calloc cals pавен NULL (n=%d)", n);
			json_free(root);
			return -1;
		}
		int cnt = 0;
		for (int i = 0; i < n; i++) {
			const char *date = cals->u.obj.keys[i];
			JVal *val = cals->u.obj.vals[i];
			if (!date || date[0] == '\0') continue;
			strncpy(m->cals[cnt].date, date, 15);
			JVal *dt = jobj_get(val, "dayType");
			JVal *wt = jobj_get(val, "workTime");
			m->cals[cnt].dayType = day_type_val(dt ? jstr(dt) : NULL);
			m->cals[cnt].workTime = wt && (wt->t == JV_NUM) ? (int)jnum(wt) : 0;
			cnt++;
		}
		m->n_cals = cnt;
	}

	/* --- Правила цветов: cellColorRules.light --- */
	JVal *cellRules = jobj_get(root, "cellColorRules");
	JVal *light = cellRules ? jobj_get(cellRules, "light") : NULL;
	if (!light && cellRules) light = cellRules;
	if (light) {
		JVal *w = jobj_get(light, "weekendWork");
		if (w) m->weekend_bg = (int)parse_color(jstr(jobj_get(w, "bg")), 0x00FFFFA0);
		JVal *mh = jobj_get(light, "missingHours");
		if (mh) m->missing_bg = (int)parse_color(jstr(jobj_get(mh, "bg")), 0x00E0E0FF);
		JVal *ov = jobj_get(light, "overwork");
		if (ov) m->overwork_bg = (int)parse_color(jstr(jobj_get(ov, "bg")), 0x00C0FFC0);
		JVal *un = jobj_get(light, "underwork");
		if (un) m->underwork_bg = (int)parse_color(jstr(jobj_get(un, "bg")), 0x00FFD0D0);
		JVal *md = jobj_get(light, "missedWorkday");
		if (md) m->missed_bg = (int)parse_color(jstr(jobj_get(md, "bg")), 0x00FFE0E0);
	}

	/* --- Правила отметок: markColorRules.light (ключ=code) --- */
	JVal *markRules = jobj_get(root, "markColorRules");
	JVal *mlight = markRules ? jobj_get(markRules, "light") : NULL;
	if (!mlight && markRules) mlight = markRules;
	if (mlight && mlight->t == JV_OBJ) {
		for (int i = 0; i < mlight->u.obj.n && m->n_rules < MAX_DAYMARKS; i++) {
			const char *code = mlight->u.obj.keys[i];
			JVal *rule = mlight->u.obj.vals[i];
			if (!code || !*code) continue;
			enc_copy(m->rule_code[m->n_rules], sizeof(m->rule_code[m->n_rules]), code);
			JVal *bg = jobj_get(rule, "bg");
			JVal *color = jobj_get(rule, "color");
			enc_copy(m->rule_bg[m->n_rules], sizeof(m->rule_bg[m->n_rules]), bg ? jstr(bg) : "");
			enc_copy(m->rule_color[m->n_rules], sizeof(m->rule_color[m->n_rules]),
					 color ? jstr(color) : "");
			m->n_rules++;
		}
	}

	/* --- Расписания: schedulesById {id: {standardWorkTime}} --- */
	JVal *scheds = jobj_get(root, "schedulesById");
	if (scheds && scheds->t == JV_OBJ && scheds->u.obj.n > 0) {
		m->schedules = (Schedule *)calloc((size_t)scheds->u.obj.n, sizeof(Schedule));
		if (m->schedules) {
			for (int i = 0; i < scheds->u.obj.n && m->n_schedules < 256; i++) {
				JVal *sv = scheds->u.obj.vals[i];
				m->schedules[m->n_schedules].id = atoi(scheds->u.obj.keys[i]);
				JVal *st = jobj_get(sv, "standardWorkTime");
				m->schedules[m->n_schedules].std = st && st->t == JV_NUM ? (int)jnum(st) : 0;
				m->n_schedules++;
			}
		}
	}

	/* --- Сменные отметки (shiftMarks — коды) --- */
	JVal *shifts = jobj_get(root, "shiftMarks");
	if (shifts) {
		int n = jlen(shifts);
		for (int i = 0; i < n && m->n_shift < MAX_DAYMARKS; i++) {
			const char *sn = jstr(jitem(shifts, i));
			if (sn && *sn) {
				enc_copy(m->shift_marks[m->n_shift], sizeof(m->shift_marks[m->n_shift]), sn);
				m->n_shift++;
			}
		}
	}

	/* --- Отделы --- */
	JVal *depts = jobj_get(root, "departments");
	if (depts) {
		int nd = jlen(depts);
		m->depts = (DeptData *)calloc((size_t)nd, sizeof(DeptData));
		if (!m->depts) {
			log_msg("month_parse: calloc depts pавен NULL (nd=%d)", nd);
			json_free(root);
			return -1;
		}
		m->n_depts = nd;
		for (int di = 0; di < nd; di++) {
			JVal *dp = jitem(depts, di);
			DeptData *d = &m->depts[di];
			const char *name = jstr(jobj_get(dp, "name"));
			enc_copy(d->name, sizeof(d->name), name ? name : "");
			d->id = (int)jnum(jobj_get(dp, "id"));
			d->open = 1; /* таблица подразделения развёрнута по умолчанию */

			JVal *emps = jobj_get(dp, "employees");
			int ne = emps ? jlen(emps) : 0;
			d->emps = (EmpData *)calloc((size_t)ne, sizeof(EmpData));
			if (!d->emps) {
				log_msg("month_parse: calloc emps pавен NULL (ne=%d)", ne);
				json_free(root);
				return -1;
			}
			d->n_emps = ne;
			for (int ei = 0; ei < ne; ei++) {
				JVal *e = jitem(emps, ei);
				EmpData *em = &d->emps[ei];
				em->id = (int)jnum(jobj_get(e, "id"));
				const char *number = jstr(jobj_get(e, "number"));
				const char *last = jstr(jobj_get(e, "lastName"));
				const char *first = jstr(jobj_get(e, "firstName"));
				const char *middle = jstr(jobj_get(e, "middleName"));
				const char *pos = jstr(jobj_get(e, "positionName"));
				enc_copy(em->number, sizeof(em->number), number ? number : "");
				/* ФИО собираем из UTF-8, затем целиком переводим в CP1251 */
				char fbuf[MAX_FIO * 3 + 4];
				_snprintf(fbuf, sizeof(fbuf), "%s%s%s %s%s%s",
						  last ? last : "",
						  (first && *first) ? " " : "", first ? first : "",
						  (middle && *middle) ? " " : "", middle ? middle : "",
						  "");
				enc_copy(em->fio, sizeof(em->fio), fbuf);
				enc_copy(em->position, sizeof(em->position), pos ? pos : "");
				const char *sf = jstr(jobj_get(e, "segmentFrom"));
				const char *st = jstr(jobj_get(e, "segmentTo"));
				em->segment_from = sf ? atoi(sf + 8) : 1;
				em->segment_to = st ? atoi(st + 8) : m->lastDay ? m->lastDay : 1;
				if (em->segment_to < em->segment_from) em->segment_to = em->segment_from;

				JVal *days = jobj_get(e, "days");
				int ndays = days ? jlen(days) : 0;
				em->days = (DayData *)calloc((size_t)(m->lastDay), sizeof(DayData));
				if (!em->days) {
					log_msg("month_parse: calloc days pавен NULL (last=%d)", m->lastDay);
					json_free(root);
					return -1;
				}
				/* Дни без записи = "нет данных" (-1), а не 0 */
				for (int zi = 0; zi < m->lastDay; zi++) {
					DayData *zd = &em->days[zi];
					zd->report_hours = -1;
					zd->report_night = -1;
					zd->shift_hours = -1;
					zd->shift_night = -1;
					zd->raw_hours = -1;
					zd->raw_night = -1;
				}
				for (int i = 0; i < ndays; i++) {
					JVal *dv = jitem(days, i);
					const char *date = jstr(jobj_get(dv, "date"));
					if (!date) continue;
					int dayidx = atoi(date + 8) - 1;
					if (dayidx < 0 || dayidx >= m->lastDay) continue;
					DayData *dd = &em->days[dayidx];
					JVal *jj;
					dd->blocked = jbool(jobj_get(dv, "blocked"));
					jj = jobj_get(dv, "reportWorkTime");
					dd->report_hours = (jj && jj->t == JV_NUM) ? (int)jnum(jj) : -1;
					jj = jobj_get(dv, "reportNightWorkTime");
					dd->report_night = (jj && jj->t == JV_NUM) ? (int)jnum(jj) : -1;
					jj = jobj_get(dv, "shiftWorkTime");
					dd->shift_hours = (jj && jj->t == JV_NUM) ? (int)jnum(jj) : -1;
					jj = jobj_get(dv, "shiftNightWorkTime");
					dd->shift_night = (jj && jj->t == JV_NUM) ? (int)jnum(jj) : -1;
					jj = jobj_get(dv, "rawWorkTime");
					dd->raw_hours = (jj && jj->t == JV_NUM) ? (int)jnum(jj) : -1;
					jj = jobj_get(dv, "rawNightWorkTime");
					dd->raw_night = (jj && jj->t == JV_NUM) ? (int)jnum(jj) : -1;
					dd->has_report = dd->report_hours >= 0 || dd->report_night >= 0;
					const char *eff = jstr(jobj_get(dv, "dayMarkCode"));
					const char *fact = jstr(jobj_get(dv, "factMarkCode"));
					enc_copy(dd->mark, sizeof(dd->mark), eff ? eff : "");
					enc_copy(dd->fact, sizeof(dd->fact), fact ? fact : "");
					dd->sched_id = (int)jnum(jobj_get(dv, "scheduleId"));
				}
			}
		}
	}

	/* --- Группы подразделений (departmentGroups) --- */
	{
		JVal *dgs = jobj_get(root, "departmentGroups");
		int ng = dgs ? jlen(dgs) : 0;
		m->groups = (GroupData *)calloc((size_t)(ng + 1), sizeof(GroupData));
		if (!m->groups) {
			log_msg("month_parse: calloc groups pавен NULL (ng=%d)", ng);
			json_free(root);
			return -1;
		}
		int *seen = (int *)calloc((size_t)(m->n_depts ? m->n_depts : 1), sizeof(int));
		if (!seen) {
			json_free(root);
			return -1;
		}
		int wg = 0;
		for (int gi = 0; gi < ng; gi++) {
			JVal *go = jitem(dgs, gi);
			int gid = (int)jnum(jobj_get(go, "id"));
			const char *gn = jstr(jobj_get(go, "name"));

			JVal *members = jobj_get(go, "departments");
			int nm = members ? jlen(members) : 0;
			int *mids = (int *)malloc((size_t)(nm ? nm : 1) * sizeof(int));
			if (!mids) { free(seen); json_free(root); return -1; }
			for (int k = 0; k < nm; k++) {
				JVal *mo = jitem(members, k);
				mids[k] = (int)jnum(jobj_get(mo, "departmentId"));
			}
			/* отделы группы — в порядке плоского массива m->depts */
			GroupData *gd = &m->groups[wg];
			gd->id = gid;
			gd->collapsed = 1; /* группы по умолчанию свёрнуты */
			enc_copy(gd->name, sizeof(gd->name), gn ? gn : "");
			gd->n_depts = 0;
			for (int di = 0; di < m->n_depts; di++) {
				for (int k = 0; k < nm; k++) {
					if (m->depts[di].id == mids[k]) { gd->n_depts++; break; }
				}
			}
			if (gd->n_depts > 0) {
				gd->dept = (int *)malloc((size_t)gd->n_depts * sizeof(int));
				if (!gd->dept) { free(mids); free(seen); json_free(root); return -1; }
				int w = 0;
				for (int di = 0; di < m->n_depts; di++) {
					for (int k = 0; k < nm; k++) {
						if (m->depts[di].id == mids[k]) {
							gd->dept[w++] = di;
							seen[di] = 1;
							break;
						}
					}
				}
				wg++;
			}
			free(mids);
		}
		/* Отделы вне групп — в виртуальную «Без группы» */
		int un = 0;
		for (int di = 0; di < m->n_depts; di++) if (!seen[di]) un++;
		if (un > 0) {
			GroupData *gd = &m->groups[wg];
			gd->id = 0;
			gd->collapsed = 1;
			strcpy(gd->name, "Без группы");
			gd->n_depts = un;
			gd->dept = (int *)malloc((size_t)un * sizeof(int));
			if (!gd->dept) { free(seen); json_free(root); return -1; }
			int w = 0;
			for (int di = 0; di < m->n_depts; di++) if (!seen[di]) gd->dept[w++] = di;
			wg++;
		}
		m->n_groups = wg;
		free(seen);
	}

	json_free(root);
	return 0;
}

void month_free(MonthModel *m) {
	if (!m) return;
	for (int i = 0; i < m->n_depts; i++) {
		for (int j = 0; j < m->depts[i].n_emps; j++) {
			free(m->depts[i].emps[j].days);
		}
		free(m->depts[i].emps);
	}
	free(m->depts);
	free(m->cals);
	free(m->schedules);
	for (int i = 0; i < m->n_groups; i++) {
		free(m->groups[i].dept);
	}
	free(m->groups);
	memset(m, 0, sizeof(*m));
}

const char *mark_short(const MonthModel *m, const char *code) {
	if (!code || !*code) return "";
	for (int i = 0; i < m->n_marks; i++) {
		if (strcmp(m->mark_codes[i], code) == 0) return m->mark_short[i];
	}
	return code;
}

/* Поиск дня календаря по дате "YYYY-MM-DD" */
const CalDay *cal_find(const MonthModel *m, const char *date) {
	if (!date || !m->cals) return NULL;
	for (int i = 0; i < m->n_cals; i++) {
		if (strcmp(m->cals[i].date, date) == 0) return &m->cals[i];
	}
	return NULL;
}

static int find_std_by_time(const MonthModel *m, int minutes) {
	for (int i = 0; i < m->n_schedules; i++) {
		if (m->schedules[i].std == minutes) return minutes;
	}
	return 0;
}

/* Порт src/lib/apps/tabel/utils/cell-style.ts (light-правила).
 * eff_hours — отображаемые часы (report ?? shift, или raw в режиме факта), -1 если нет.
 * eff_mark — эффективная отметка дня. emp_sched_id — scheduleId дня/сотрудника. */
void cell_style(const MonthModel *m, const char *date, const DayData *d,
				int eff_hours, const char *eff_mark, int emp_sched_id,
				int *out_bg, int *out_fg, int *out_bold) {
	*out_bg = -1;
	*out_fg = -1;
	*out_bold = 0;
	if (!d || d->blocked) return;

	const char *code = eff_mark && eff_mark[0] ? eff_mark : "";
	int has_hours = eff_hours >= 0;
	int is_shift = 0;
	if (code[0]) {
		if (strcmp(code, "I") == 0 || strcmp(code, "N") == 0) is_shift = 1;
		else for (int i = 0; i < m->n_shift; i++) {
			if (strcmp(m->shift_marks[i], code) == 0) { is_shift = 1; break; }
		}
	}

	/* Норма дня: по расписанию дня, затем по расписанию с совпадающим временем,
	 * затем по календарю. */
	int expected = 0;
	int sched_id = d->sched_id > 0 ? d->sched_id : emp_sched_id;
	if (sched_id > 0) {
		for (int i = 0; i < m->n_schedules; i++) {
			if (m->schedules[i].id == sched_id) {
				expected = m->schedules[i].std;
				break;
			}
		}
	}
	if (!expected && has_hours && sched_id <= 0) {
		expected = find_std_by_time(m, eff_hours);
	}
	const CalDay *cal = cal_find(m, date);
	if (!expected) expected = cal ? cal->workTime : 0;

	/* Спец-цвет отметки */
	for (int i = 0; i < m->n_rules; i++) {
		if (strcmp(m->rule_code[i], code) == 0) {
			if (m->rule_bg[i][0]) *out_bg = (int)parse_color(m->rule_bg[i], -1);
			if (m->rule_color[i][0]) *out_fg = (int)parse_color(m->rule_color[i], -1);
			break;
		}
	}

	/* Сменная отметка без часов */
	if (is_shift && !has_hours && m->missing_bg >= 0) {
		*out_bg = m->missing_bg;
		return;
	}

	/* Работа в нерабочий день — приоритетнее переработки/недоработки */
	if (is_shift && cal) {
		const int isNonWork = cal->dayType == 3 || cal->dayType == 1;
		if (isNonWork && m->weekend_bg >= 0) {
			*out_bg = m->weekend_bg;
			return;
		}
	}

	/* Переработка / недоработка (допуск 3 мин) */
	if (is_shift && has_hours && expected > 0) {
		int diff = abs(eff_hours - expected);
		if (diff > 3) {
			if (eff_hours > expected && m->overwork_bg >= 0) {
				*out_bg = m->overwork_bg;
				return;
			}
			if (eff_hours < expected && m->underwork_bg >= 0) {
				*out_bg = m->underwork_bg;
				return;
			}
		}
	}

	/* Пропущенный рабочий день */
	if (!code[0] && !has_hours && cal) {
		const int isWork = cal->dayType == 0 || cal->dayType == 2 || cal->dayType == 4;
		if (isWork && m->missed_bg >= 0) {
			*out_bg = m->missed_bg;
			return;
		}
	}
}

void fmt_hours(int minutes, char *buf, int cap) {
	if (minutes < 0) {
		if (cap > 0) buf[0] = '\0';
		return;
	}
	/* Округление до 0.1 часа: (min/6) десятые */
	int tenth = (minutes + 3) / 6;
	_snprintf(buf, (size_t)cap, "%d.%d", tenth / 10, tenth % 10);
}

/* --- События сотрудника --- */

int events_parse(EventsData *e, const char *text) {
	memset(e, 0, sizeof(*e));
	JVal *root = json_parse(text);
	if (!root) return -1;

	JVal *emp = jobj_get(root, "employee");
	const char *last = emp ? jstr(jobj_get(emp, "lastName")) : NULL;
	const char *first = emp ? jstr(jobj_get(emp, "firstName")) : NULL;
	const char *middle = emp ? jstr(jobj_get(emp, "middleName")) : NULL;
	const char *number = emp ? jstr(jobj_get(emp, "number")) : NULL;
	{
		char fbuf[MAX_FIO * 3 + 4];
		_snprintf(fbuf, sizeof(fbuf), "%s %s%s%s", last ? last : "",
				  first ? first : "",
				  (middle && *middle) ? " " : "", middle ? middle : "");
		enc_copy(e->fio, sizeof(e->fio), fbuf);
	}
	enc_copy(e->number, sizeof(e->number), number ? number : "");
	const char *dept = jstr(jobj_get(root, "departmentName"));
	const char *pos = jstr(jobj_get(root, "positionName"));
	enc_copy(e->department, sizeof(e->department), dept ? dept : "");
	enc_copy(e->position, sizeof(e->position), pos ? pos : "");
	e->lastDay = (int)jnum(jobj_get(root, "lastDay"));

	JVal *evs = jobj_get(root, "turnstileEvents");
	if (evs) {
		int n = jlen(evs);
		e->events = (TurnstileEvent *)calloc((size_t)n, sizeof(TurnstileEvent));
		if (!e->events) {
			json_free(root);
			return -1;
		}
		e->n_events = n;
		for (int i = 0; i < n; i++) {
			JVal *ev = jitem(evs, i);
			TurnstileEvent *t = &e->events[i];
			const char *dt = jstr(jobj_get(ev, "datetime"));
			strncpy(t->datetime, dt ? dt : "", sizeof(t->datetime) - 1);
			const char *en = jstr(jobj_get(ev, "eventName"));
			enc_copy(t->eventName, sizeof(t->eventName), en ? en : "");
			const char *seria = jstr(jobj_get(ev, "passSeria"));
			const char *num = jstr(jobj_get(ev, "passNumber"));
			if (seria && *seria && num && *num) {
				char pbuf[96];
				_snprintf(pbuf, sizeof(pbuf), "%s %s", seria, num);
				enc_copy(t->passNumber, sizeof(t->passNumber), pbuf);
			} else {
				enc_copy(t->passNumber, sizeof(t->passNumber), num ? num : "");
			}
		}
	}

	JVal *days = jobj_get(root, "days");
	if (days) {
		int n = jlen(days);
		e->days = (EvDay *)calloc((size_t)n, sizeof(EvDay));
		if (!e->days) {
			json_free(root);
			return -1;
		}
		e->n_days = n;
		for (int i = 0; i < n; i++) {
			JVal *dv = jitem(days, i);
			EvDay *x = &e->days[i];
			const char *date = jstr(jobj_get(dv, "date"));
			strncpy(x->date, date ? date : "", sizeof(x->date) - 1);
			JVal *jv;
			jv = jobj_get(dv, "reportWorkTime");
			x->reportWorkTime = (jv && jv->t == JV_NUM) ? (int)jnum(jv) : -1;
			jv = jobj_get(dv, "reportNightWorkTime");
			x->reportNightWorkTime = (jv && jv->t == JV_NUM) ? (int)jnum(jv) : -1;
			jv = jobj_get(dv, "shiftWorkTime");
			x->shiftWorkTime = (jv && jv->t == JV_NUM) ? (int)jnum(jv) : -1;
			jv = jobj_get(dv, "shiftNightWorkTime");
			x->shiftNightWorkTime = (jv && jv->t == JV_NUM) ? (int)jnum(jv) : -1;
			jv = jobj_get(dv, "extraMarkMinutes");
			x->extraMinutes = (jv && jv->t == JV_NUM) ? (int)jnum(jv) : -1;
			const char *mk = jstr(jobj_get(dv, "dayMarkCode"));
			const char *ex = jstr(jobj_get(dv, "extraMarkCode"));
			enc_copy(x->mark, sizeof(x->mark), mk ? mk : "");
			enc_copy(x->extra, sizeof(x->extra), ex ? ex : "");
		}
	}

	json_free(root);
	return 0;
}

void events_free(EventsData *e) {
	if (!e) return;
	free(e->events);
	free(e->days);
	memset(e, 0, sizeof(*e));
}