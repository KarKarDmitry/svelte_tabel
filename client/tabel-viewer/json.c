/*
 * json.c — рекурсивный нисходящий парсер JSON.
 * Строки хранятся как UTF-8 (как приходят от сервера). Память узлов выделяется
 * через malloc; освобождение — json_free (рекурсивный обход).
 */
#include "json.h"
#include "log.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

typedef struct {
	const char *p;
	const char *end;
	const char *base; /* for diagnostics (start of buffer) */
} P;

/* ring-буфер низкоуровневой трассировки (отладка: выяснить место порчи) */
#define DBG_RING 512
static char dbg_ring[DBG_RING][96];
static long dbg_off[DBG_RING];
static long dbg_idx = 0;
void dbg_push(const char *fmt, long off, const char *s) {
	_snprintf(dbg_ring[dbg_idx], 96, fmt, s);
	dbg_off[dbg_idx] = off;
	dbg_idx = (dbg_idx + 1) % DBG_RING;
}
static void dbg_dump(void) {
	long i = dbg_idx, n = (dbg_idx + DBG_RING - 128) % DBG_RING;
	for (long k = 0; k < 128; k++) {
		i = (n + k) % DBG_RING;
		if (dbg_off[i] >= 0)
			log_msg("TRACE[%2d] off=%ld %s", (int)k, (long)dbg_off[i], dbg_ring[i]);
	}
}

static void skip_ws(P *pr) {
	while (pr->p < pr->end) {
		char c = *pr->p;
		if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
			pr->p++;
		} else {
			break;
		}
	}
}

static int hex4(const char *s) {
	int v = 0;
	for (int i = 0; i < 4; i++) {
		char c = s[i];
		v <<= 4;
		if (c >= '0' && c <= '9') v |= c - '0';
		else if (c >= 'a' && c <= 'f') v |= (c - 'a') + 10;
		else if (c >= 'A' && c <= 'F') v |= (c - 'A') + 10;
		else return -1;
	}
	return v;
}

/* Декодировать JSON-строку в UTF-8, с поддержкой \uXXXX. Возвращает malloc-строку.
 * Двухпроходная: сначала измеряем точную выходную длину, затем аллоцируем ровно len+1
 * (не «до конца буфера») и декодируем. Иначе каждая строка в начале большого документа
 * аллоцировала бы ~весь буфер, что приводило к OOM/фрагментации кучи на 32-бит. */
static char *parse_string(P *pr) {
	if (pr->p >= pr->end || *pr->p != '"') return NULL;
	const char *in = pr->p + 1; /* за открывающей кавычкой */

	/* Проход 1: измерить длину выходных байт и найти закрывающую кавычку. */
	long len = 0;
	const char *q = in;
	for (;;) {
		if (q >= pr->end) {
			log_msg("JSON: parse_string незакрыта на офсете %ld", (long)(in - pr->base - 1));
			return NULL;
		}
		unsigned char c = (unsigned char)*q;
		if (c == '"') break;
		if (c == '\\') {
			q++;
			if (q >= pr->end) {
				log_msg("JSON: parse_string незакрыта на офсете %ld", (long)(in - pr->base - 1));
				return NULL;
			}
			unsigned char e = (unsigned char)*q++;
			if (e == 'u') {
				if (pr->end - q < 4) {
					log_msg("JSON: parse_string незакрыта на офсете %ld", (long)(in - pr->base - 1));
					return NULL;
				}
				int cp = hex4(q);
				if (cp < 0) {
					log_msg("JSON: parse_string неверный \\u на офсете %ld",
							(long)(q - pr->base - 2));
					return NULL;
				}
				q += 4;
				len += (cp < 0x80) ? 1 : (cp < 0x800) ? 2 : 3;
				continue;
			}
			/* Простой escape: одна выходная единица (\\, \", \n, \t, ...). */
			len += 1;
			continue;
		}
		q++;
		len++;
	}

	char *out = (char *)malloc((size_t)len + 1);
	if (!out) return NULL;

	/* Проход 2: заполнить буфер. q указывает на закрывающую кавычку. */
	long o = 0;
	while (in < q) {
		unsigned char c = (unsigned char)*in;
		if (c == '\\') {
			in++;
			char e = *in++;
			switch (e) {
				case 'u': {
					int cp = hex4(in);
					in += 4;
					if (cp < 0x80) {
						out[o++] = (char)cp;
					} else if (cp < 0x800) {
						out[o++] = (char)(0xC0 | (cp >> 6));
						out[o++] = (char)(0x80 | (cp & 0x3F));
					} else {
						out[o++] = (char)(0xE0 | (cp >> 12));
						out[o++] = (char)(0x80 | ((cp >> 6) & 0x3F));
						out[o++] = (char)(0x80 | (cp & 0x3F));
					}
					break;
				}
				case '"': out[o++] = '"'; break;
				case '\\': out[o++] = '\\'; break;
				case '/': out[o++] = '/'; break;
				case 'b': out[o++] = '\b'; break;
				case 'f': out[o++] = '\f'; break;
				case 'n': out[o++] = '\n'; break;
				case 'r': out[o++] = '\r'; break;
				case 't': out[o++] = '\t'; break;
				default: out[o++] = e; break;
			}
			continue;
		}
		out[o++] = (char)c;
		in++;
	}
	out[o] = '\0';
	pr->p = q + 1; /* за закрывающей кавычкой */
	return out;
}

static JVal *parse_value(P *pr);

static JVal *parse_object(P *pr) {
	JVal *v = (JVal *)malloc(sizeof(JVal));
	if (!v) return NULL;
	v->t = JV_OBJ;
	v->u.obj.n = 0;
	v->u.obj.keys = NULL;
	v->u.obj.vals = NULL;
	dbg_push("{", (long)(pr->p - pr->base), "");

	pr->p++; /* '{' */
	int cap = 0;
	skip_ws(pr);
	if (pr->p >= pr->end) { json_free(v); return NULL; }
	if (*pr->p == '}') { pr->p++; return v; }

	while (pr->p < pr->end) {
		skip_ws(pr);
		if (pr->p >= pr->end) break;
		char *key = parse_string(pr);
		if (!key) { json_free(v); return NULL; }
		dbg_push("key:%s", (long)(pr->p - pr->base), key);
		skip_ws(pr);
		if (pr->p >= pr->end || *pr->p != ':') { free(key); json_free(v); return NULL; }
		pr->p++;
		skip_ws(pr);
		JVal *val = parse_value(pr);
		if (!val) { free(key); json_free(v); return NULL; }

		if (v->u.obj.n == cap) {
			cap = cap ? cap * 2 : 8;
			/* Реаллоцируем и сразу фиксируем в структуру каждый буфер независимо,
			   чтобы частичный сбой ро realloc не оставлял висячий указатель. */
			char **nk = (char **)realloc(v->u.obj.keys, (size_t)cap * sizeof(char *));
			if (!nk) { free(key); json_free(v); json_free(val); return NULL; }
			v->u.obj.keys = nk;
			JVal **nv = (JVal **)realloc(v->u.obj.vals, (size_t)cap * sizeof(JVal *));
			if (!nv) { v->u.obj.keys = NULL; free(key); json_free(v); json_free(val); return NULL; }
			v->u.obj.vals = nv;
		}
		v->u.obj.keys[v->u.obj.n] = key;
		v->u.obj.vals[v->u.obj.n] = val;
		v->u.obj.n++;

		skip_ws(pr);
		if (pr->p >= pr->end) { json_free(v); return NULL; }
		if (*pr->p == ',') { pr->p++; continue; }
		if (*pr->p == '}') { pr->p++; return v; }
		break;
	}
	json_free(v);
	return NULL;
}

static JVal *parse_array(P *pr) {
	JVal *v = (JVal *)malloc(sizeof(JVal));
	if (!v) return NULL;
	v->t = JV_ARR;
	v->u.arr.n = 0;
	v->u.arr.items = NULL;
	dbg_push("[", (long)(pr->p - pr->base), "");

	pr->p++; /* '[' */
	int cap = 0;
	skip_ws(pr);
	if (pr->p >= pr->end) { json_free(v); return NULL; }
	if (*pr->p == ']') { pr->p++; return v; }

	while (pr->p < pr->end) {
		skip_ws(pr);
		JVal *val = parse_value(pr);
		if (!val) { json_free(v); return NULL; }
		if (v->u.arr.n == cap) {
			cap = cap ? cap * 2 : 8;
			JVal **nv = (JVal **)realloc(v->u.arr.items, (size_t)cap * sizeof(JVal *));
			if (!nv) { json_free(v); json_free(val); return NULL; }
			v->u.arr.items = nv;
		}
		v->u.arr.items[v->u.arr.n] = val;
		v->u.arr.n++;

		skip_ws(pr);
		if (pr->p >= pr->end) { json_free(v); return NULL; }
		if (*pr->p == ',') { pr->p++; continue; }
		if (*pr->p == ']') { pr->p++; return v; }
		break;
	}
	json_free(v);
	return NULL;
}

static JVal *parse_number(P *pr) {
	const char *start = pr->p;
	while (pr->p < pr->end) {
		char c = *pr->p;
		if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') {
			pr->p++;
		} else {
			break;
		}
	}
	char *tmp = (char *)malloc((size_t)(pr->p - start) + 1);
	if (!tmp) return NULL;
	memcpy(tmp, start, (size_t)(pr->p - start));
	tmp[pr->p - start] = '\0';
	JVal *v = (JVal *)malloc(sizeof(JVal));
	if (!v) { free(tmp); return NULL; }
	v->t = JV_NUM;
	v->u.num = strtod(tmp, NULL);
	free(tmp);
	return v;
}

static JVal *parse_value(P *pr) {
	skip_ws(pr);
	if (pr->p >= pr->end) return NULL;
	char c = *pr->p;
	JVal *v;

	switch (c) {
		case '{': return parse_object(pr);
		case '[': return parse_array(pr);
		case '"': {
			char *s = parse_string(pr);
			if (!s) {
				log_msg("JSON: parse_string NULL в parse_value на офсете %ld",
						(long)(pr->base ? pr->p - pr->base : 0));
				return NULL;
			}
			v = (JVal *)malloc(sizeof(JVal));
			if (!v) { free(s); return NULL; }
			v->t = JV_STR;
			v->u.str = s;
			return v;
		}
		case 't':
			if (pr->end - pr->p >= 4 && memcmp(pr->p, "true", 4) == 0) {
				pr->p += 4;
				v = (JVal *)malloc(sizeof(JVal));
				if (!v) return NULL;
				v->t = JV_BOOL;
				v->u.b = 1;
				return v;
			}
			return NULL;
		case 'f':
			if (pr->end - pr->p >= 5 && memcmp(pr->p, "false", 5) == 0) {
				pr->p += 5;
				v = (JVal *)malloc(sizeof(JVal));
				if (!v) return NULL;
				v->t = JV_BOOL;
				v->u.b = 0;
				return v;
			}
			return NULL;
		case 'n':
			if (pr->end - pr->p >= 4 && memcmp(pr->p, "null", 4) == 0) {
				pr->p += 4;
				v = (JVal *)malloc(sizeof(JVal));
				if (!v) return NULL;
				v->t = JV_NULL;
				return v;
			}
			return NULL;
		default: {
			char d = c;
			if ((d >= '0' && d <= '9') || d == '-') return parse_number(pr);
			log_msg("JSON: неожиданный токен 0x%02X '%c' на офсете %ld", (unsigned char)c, c,
					(long)(pr->p - pr->base));
			return NULL;
		}
	}
}

JVal *json_parse(const char *text) {
	if (!text) return NULL;
	P pr;
	pr.p = text;
	pr.end = text + strlen(text);
	pr.base = text;
	JVal *v = parse_value(&pr);
	if (!v) {
		log_msg("JSON: parse_value NULL на офсете %ld, окта %d байт от end, символ 0x%02X",
				(long)(pr.p - pr.base), (int)(pr.end - pr.p),
				pr.p < pr.end ? (unsigned char)*pr.p : 0);
		dbg_dump();
	}
	return v;
}

static void json_free_arr(JVal **items, int n);

static void json_free_obj(JVal *v) {
	for (int i = 0; i < v->u.obj.n; i++) {
		free(v->u.obj.keys[i]);
		json_free(v->u.obj.vals[i]);
	}
	free(v->u.obj.keys);
	free(v->u.obj.vals);
}

static void json_free_arr(JVal **items, int n) {
	for (int i = 0; i < n; i++) json_free(items[i]);
	free(items);
}

void json_free(JVal *v) {
	if (!v) return;
	switch (v->t) {
		case JV_STR: free(v->u.str); break;
		case JV_ARR: json_free_arr(v->u.arr.items, v->u.arr.n); break;
		case JV_OBJ: json_free_obj(v); break;
		default: break;
	}
	free(v);
}

/* ---------- Хелперы ---------- */

JVal *jobj_get(JVal *o, const char *key) {
	if (!o || o->t != JV_OBJ || !key) return NULL;
	for (int i = 0; i < o->u.obj.n; i++) {
		if (strcmp(o->u.obj.keys[i], key) == 0) return o->u.obj.vals[i];
	}
	return NULL;
}

const char *jstr(JVal *v) {
	if (!v || v->t != JV_STR) return NULL;
	return v->u.str;
}

double jnum(JVal *v) {
	if (!v || v->t != JV_NUM) return 0;
	return v->u.num;
}

int jbool(JVal *v) {
	if (!v || v->t != JV_BOOL) return 0;
	return v->u.b;
}

int jlen(JVal *v) {
	if (!v) return 0;
	if (v->t == JV_ARR) return v->u.arr.n;
	if (v->t == JV_OBJ) return v->u.obj.n;
	return 0;
}

JVal *jitem(JVal *a, int i) {
	if (!a || a->t != JV_ARR) return NULL;
	if (i < 0 || i >= a->u.arr.n) return NULL;
	return a->u.arr.items[i];
}

const char *jkey(JVal *o, int i) {
	if (!o || o->t != JV_OBJ) return NULL;
	if (i < 0 || i >= o->u.obj.n) return NULL;
	return o->u.obj.keys[i];
}