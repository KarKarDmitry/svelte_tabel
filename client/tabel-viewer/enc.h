/*
 * enc.h — преобразование UTF-8 (приходит от сервера) в ANSI/CP1251.
 * Вьювер собран под ANSI (*A*-WinAPI, литералы CP1251). Все строки,
 * извлечённые из JSON, перед сохранением в модель проходят через enc_copy,
 * чтобы сравнения и вывод были в единой кодовой странице.
 */
#ifndef ENC_H
#define ENC_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Сконвертировать UTF-8 в CP1251 и скопировать в dst (cap включает \0).
 * Возвращает 0 при успехе, -1 если не поместилось/сбой (тогда — байт-в-байт). */
int enc_copy(char *dst, size_t cap, const char *utf8);

/* Процент-кодировать строку (CP1251) в UTF-8 для application/x-www-form-urlencoded.
 * В dst пишется ASCII (только %XX и не-зарезервированные). Возвращает -1 при переполнении. */
int enc_urlencode(const char *cp1251, char *dst, size_t cap);

#ifdef __cplusplus
}
#endif

#endif /* ENC_H */
