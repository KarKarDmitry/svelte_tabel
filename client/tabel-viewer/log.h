/*
 * log.h — простой построчный логгер в logs.txt рядом с exe.
 * Используется для диагностики (WWW/ответы сервера, ошибки разбора).
 */
#ifndef LOG_H
#define LOG_H

void log_init(const char *exe_dir);
void log_msg(const char *fmt, ...);

#endif /* LOG_H */