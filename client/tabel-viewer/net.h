/*
 * net.h — HTTP-клиент поверх WinINet для автономного вьювера.
 * Умеет: POST sign-in (better-auth), GET JSON, хранение session-cookie в файле.
 */
#ifndef NET_H
#define NET_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
	char base[256];      /* http://host:port — базовый URL без завершающего '/' */
	char email_domain[64]; /* домен, добавляемый к логину: "mettem.com" */
	char cookie[512];    /* значение better-auth.session_token (или пусто) */
	int authed;          /* 1 — cookie загружен и (пока) валиден */
	char errmsg[256];
} Net;

/* Прочитать config.txt рядом с exe (server=..., email_domain=...). */
void net_load_config(Net *n, const char *exe_dir);

/* Загрузить сохранённый cookie из token.txt. */
void net_load_token(Net *n, const char *exe_dir);

/* Сохранить текущий cookie в token.txt. */
void net_save_token(Net *n, const char *exe_dir);

/* Удалить сессию (cookie из jar + token.txt), сбросить authed. */
void net_logout(Net *n, const char *exe_dir);

/* Попытаться войти. На входе n->base и n->email_domain заполнены, логин/пароль даны.
 * При успехе заполняет n->cookie, n->authed=1. Возвращает 0 при ошибке (текст — n->errmsg). */
int net_signin(Net *n, const char *login, const char *password);

/* GET запрашиваемого пути с cookie. Вернёт malloc'овую строку тела (UTF-8) или NULL.
 * code — HTTP-код ответа. */
char *net_get(Net *n, const char *path, int *code);

#ifdef __cplusplus
}
#endif

#endif /* NET_H */