/*
 * json.h — минимальный JSON-парсер (DOM) для автономного вьювера табеля.
 * Поддерживает объекты, массивы, строки, числа, булевы, null.
 */
#ifndef JSON_H
#define JSON_H

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
	JV_NULL,
	JV_BOOL,
	JV_NUM,
	JV_STR,
	JV_ARR,
	JV_OBJ
} JType;

typedef struct JVal JVal;
struct JVal {
	JType t;
	union {
		int b;
		double num;
		char *str;
		struct {
			JVal **items;
			int n;
		} arr;
		struct {
			char **keys;
			JVal **vals;
			int n;
		} obj;
	} u;
};

/* Разобрать документ. Вернёт NULL при ошибке. Узел и все вложенные владеют памятью. */
JVal *json_parse(const char *text);
void json_free(JVal *v);

/* Хелперы. Все безопасны для NULL. */
JVal *jobj_get(JVal *o, const char *key); /* только для JV_OBJ, иначе NULL */
const char *jstr(JVal *v);                /* строковое значение или NULL */
double jnum(JVal *v);                     /* числовое значение или 0 */
int jbool(JVal *v);                       /* булево или 0 */
int jlen(JVal *v);                        /* длина массива/объекта или 0 */
JVal *jitem(JVal *a, int i);              /* элемент массива или NULL */
const char *jkey(JVal *o, int i);         /* ключ объекта по индексу или NULL */

#ifdef __cplusplus
}
#endif

#endif /* JSON_H */