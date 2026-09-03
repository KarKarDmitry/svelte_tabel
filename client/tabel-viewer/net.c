/*
 * net.c — HTTP поверх WinINet (cookie-движок WinINet как единственный источник).
 *
 * better-auth sign-in: POST {base}/api/auth/sign-in/email, тело JSON
 * {"email": "...", "password": "..."}. Вызов сканирует Set-Cookie и сохраняет
 * значение session-токена в token.txt (для автоповтора входа на следующих
 * запусках через InternetSetCookie). Передача Cookie на GET — средствами
 * WinINet (гарантированно один Cookie-заголовок), без ручного дублирования.
 */
#define _WIN32_WINNT 0x0501
#include <windows.h>
#include <wininet.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "net.h"
#include "json.h"
#include "enc.h"
#include "log.h"

#ifndef INTERNET_FLAG_NO_COOKIE
#define INTERNET_FLAG_NO_COOKIE 0x00080000
#endif

static const char *const SESSION_COOKIE = "better-auth.session_token";

static int read_file(const char *dir, const char *name, char *buf, int cap) {
	char path[512];
	_snprintf(path, sizeof(path), "%s\\%s", dir, name);
	FILE *f = fopen(path, "rb");
	if (!f) return 0;
	size_t got = fread(buf, 1, (size_t)(cap - 1), f);
	fclose(f);
	buf[got] = '\0';
	return (int)got > 0;
}

void net_load_config(Net *n, const char *exe_dir) {
	memset(n, 0, sizeof(*n));
	strcpy(n->email_domain, "mettem.com");
	strcpy(n->base, "http://localhost:3000");
	char buf[512];
	if (read_file(exe_dir, "config.txt", buf, sizeof(buf))) {
		char *line = buf;
		while (line && *line) {
			char *nl = strchr(line, '\n');
			if (nl) *nl = '\0';
			char *p = line;
			while (*p == ' ' || *p == '\t' || *p == '\r') p++;
			char *eq = strchr(p, '=');
			if (eq && eq > p) {
				*eq = '\0';
				char key[64];
				char val[256];
				_snprintf(key, sizeof(key), "%s", p);
				_snprintf(val, sizeof(val), "%s", eq + 1);
				int k = (int)strlen(val);
				while (k > 0 && (val[k-1] == ' ' || val[k-1] == '\t' || val[k-1] == '\r')) val[--k] = '\0';
				if (strcmp(key, "server") == 0) {
					_snprintf(n->base, sizeof(n->base), "%s", val);
				} else if (strcmp(key, "email_domain") == 0) {
					_snprintf(n->email_domain, sizeof(n->email_domain), "%s", val);
				}
			}
			line = nl ? nl + 1 : NULL;
		}
	}
	size_t bl = strlen(n->base);
	while (bl > 0 && n->base[bl-1] == '/') n->base[--bl] = '\0';
}

/* Программно положить cookie в jar WinINet (запоминание сессии между запусками). */
static void jar_set_cookie(const char *url, const char *value) {
	char nameval[600];
	_snprintf(nameval, sizeof(nameval), "%s=%s", SESSION_COOKIE, value);
	InternetSetCookieA(url, NULL, nameval);
}

void net_load_token(Net *n, const char *exe_dir) {
	char buf[1024];
	if (read_file(exe_dir, "token.txt", buf, sizeof(buf))) {
		char *p = buf;
		while (*p == ' ' || *p == '\t' || *p == '\r') p++;
		if (*p) {
			_snprintf(n->cookie, sizeof(n->cookie), "%s", p);
			jar_set_cookie(n->base, n->cookie);
			n->authed = 1;
		}
	}
}

/* Сохранить токен из n->cookie в token.txt. */
void net_save_token(Net *n, const char *exe_dir) {
	if (!n->cookie[0]) return;
	char path[512];
	_snprintf(path, sizeof(path), "%s\\token.txt", exe_dir);
	FILE *f = fopen(path, "wb");
	if (f) {
		fputs(n->cookie, f);
		fclose(f);
	}
}

void net_logout(Net *n, const char *exe_dir) {
	/* Удалить сессионный cookie из jar (установить просроченный) */
	InternetSetCookieA(n->base, NULL, "better-auth.session_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;");
	char path[512];
	_snprintf(path, sizeof(path), "%s\\token.txt", exe_dir);
	DeleteFileA(path);
	n->authed = 0;
	n->cookie[0] = '\0';
}

static void parse_base(const char *base, char *host, int host_cap, int *port) {
	*port = 0;
	host[0] = '\0';
	const char *h = base;
	int secure = 0;
	if (strncmp(h, "http://", 7) == 0) h += 7;
	else if (strncmp(h, "https://", 8) == 0) { h += 8; secure = 1; }
	const char *colon = strchr(h, ':');
	const char *slash = strchr(h, '/');
	if (colon && (!slash || colon < slash)) {
		int len = (int)(colon - h);
		if (len > 0 && len < host_cap) {
			memcpy(host, h, (size_t)len);
			host[len] = '\0';
		}
		*port = atoi(colon + 1);
	} else {
		int len = slash ? (int)(slash - h) : (int)strlen(h);
		if (len > 0 && len < host_cap) {
			memcpy(host, h, (size_t)len);
			host[len] = '\0';
		}
	}
	if (!host[0]) strcpy(host, "localhost");
	if (*port <= 0) *port = secure ? 443 : 80;
}

static char *http_request(const char *base, const char *method, const char *path,
						  const char *body, int *code, char *set_cookie_out,
						  int set_cookie_cap, char *err, int errcap) {
	char host[128];
	int port;
	parse_base(base, host, sizeof(host), &port);

	HINTERNET hInet = InternetOpenA("MettemViewer/1.0",
									INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
	if (!hInet) {
		if (err && errcap) _snprintf(err, (size_t)errcap, "InternetOpen (%lu)", GetLastError());
		return NULL;
	}
	HINTERNET hConn = InternetConnectA(hInet, host, (INTERNET_PORT)port, NULL, NULL,
									   INTERNET_SERVICE_HTTP, 0, 0);
	if (!hConn) {
		if (err && errcap) _snprintf(err, (size_t)errcap, "InternetConnect (%lu)", GetLastError());
		InternetCloseHandle(hInet);
		return NULL;
	}

	DWORD flags = INTERNET_FLAG_NO_CACHE_WRITE | INTERNET_FLAG_NO_AUTO_REDIRECT;
	if (strncmp(base, "https://", 8) == 0) flags |= INTERNET_FLAG_SECURE;

	HINTERNET hReq = HttpOpenRequestA(hConn, method, path, "HTTP/1.1", NULL, NULL, flags, 0);
	if (!hReq) {
		if (err && errcap) _snprintf(err, (size_t)errcap, "HttpOpenRequest (%lu)", GetLastError());
		InternetCloseHandle(hConn);
		InternetCloseHandle(hInet);
		return NULL;
	}

	const char *prm_hdrs = body ? "Content-Type: application/json\r\n" : NULL;
	char hdrs_buf[320];
	const char *send_hdrs = prm_hdrs;
	if (body) {
		/* Браузеры всегда шлют Origin на state-changing (CSRF); better-auth требует его.
		   WinINet-клиент не делает это автоматически — добавляем Origin равным базовому URL. */
		_snprintf(hdrs_buf, sizeof(hdrs_buf),
				  "Content-Type: application/x-www-form-urlencoded\r\nOrigin: %s\r\n", base);
		send_hdrs = hdrs_buf;
	}
	if (!HttpSendRequestA(hReq, send_hdrs, send_hdrs ? (DWORD)strlen(send_hdrs) : 0,
						  body ? (LPVOID)body : NULL, body ? (DWORD)strlen(body) : 0)) {
		unsigned long e = GetLastError();
		if (e == ERROR_HTTP_REDIRECT_NEEDS_CONFIRMATION || e == ERROR_INTERNET_INVALID_URL) {
			/* редиректы отключены — это не ошибка, читаем ответ */
		} else {
			if (err && errcap) _snprintf(err, (size_t)errcap, "HttpSendRequest (%lu)", e);
			InternetCloseHandle(hReq);
			InternetCloseHandle(hConn);
			InternetCloseHandle(hInet);
			return NULL;
		}
	}

	DWORD status = 0;
	DWORD slen = sizeof(status);
	HttpQueryInfoA(hReq, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER,
				   &status, &slen, NULL);
	if (code) *code = (int)status;

	if (set_cookie_out && set_cookie_cap > 0) {
		char raw[2048];
		DWORD rawlen = sizeof(raw);
		if (HttpQueryInfoA(hReq, HTTP_QUERY_SET_COOKIE, raw, &rawlen, NULL)) {
			raw[sizeof(raw) - 1] = '\0';
			char *sc = strstr(raw, SESSION_COOKIE);
			if (sc) {
				char *eq = sc + strlen(SESSION_COOKIE);
				char *semi = strchr(eq, ';');
				int end = semi ? (int)(semi - eq) : (int)strlen(eq);
				if (end > 1 && end < set_cookie_cap) {
					memcpy(set_cookie_out, eq + 1, (size_t)(end - 1));
					set_cookie_out[end - 1] = '\0';
				}
			}
		}
	}

	size_t cap = 16384;
	size_t len = 0;
	char *out = (char *)malloc(cap);
	if (!out) {
		InternetCloseHandle(hReq);
		InternetCloseHandle(hConn);
		InternetCloseHandle(hInet);
		return NULL;
	}
	for (;;) {
		if (len + 8192 > cap) {
			cap *= 2;
			char *nb = (char *)realloc(out, cap);
			if (!nb) {
				free(out);
				InternetCloseHandle(hReq);
				InternetCloseHandle(hConn);
				InternetCloseHandle(hInet);
				return NULL;
			}
			out = nb;
		}
		DWORD got = 0;
		if (!InternetReadFile(hReq, out + len, (DWORD)(cap - len - 1), &got)) break;
		if (got == 0) break;
		len += got;
	}
	out[len] = '\0';

	InternetCloseHandle(hReq);
	InternetCloseHandle(hConn);
	InternetCloseHandle(hInet);
	return out;
}

int net_signin(Net *n, const char *login, const char *password) {
	n->errmsg[0] = '\0';
	/* Логин без '@' доводим до email (тот же домен, что ждёт сервер); сервер
	   сам нормализует русскую локальную часть в punycode (toEmail на /auth/login). */
	char email[128];
	const char *at = strchr(login, '@');
	if (at) {
		_snprintf(email, sizeof(email), "%s", login);
	} else {
		_snprintf(email, sizeof(email), "%s@%s", login, n->email_domain);
	}

	/* form-urlencoded: русский логин кодируем CP1251 -> UTF-8 -> %XX */
	char uemail[512], upass[512];
	if (enc_urlencode(email, uemail, sizeof(uemail)) != 0 ||
		enc_urlencode(password, upass, sizeof(upass)) != 0) {
		_snprintf(n->errmsg, sizeof(n->errmsg), "Некорректные символы логина/пароля");
		return 0;
	}
	char body[1100];
	_snprintf(body, sizeof(body), "username=%s&password=%s", uemail, upass);

	int code = 0;
	char token[1024] = "";
	char err[256] = "";
	char *resp = http_request(n->base, "POST", "/auth/login?/signInToken", body,
							  &code, token, sizeof(token), err, sizeof(err));
	if (!resp) {
		_snprintf(n->errmsg, sizeof(n->errmsg), "%s", err);
		log_msg("SIGNIN: HTTP-ошибка сети: %s", err);
		return 0;
	}

	if (code != 200) {
		JVal *j = json_parse(resp);
		const char *msg = j ? jstr(jobj_get(jobj_get(j, "error"), "message")) : NULL;
		_snprintf(n->errmsg, sizeof(n->errmsg), "Вход не удался (HTTP %d)%s%s",
				  code, msg ? ": " : "", msg ? msg : "");
		log_msg("SIGNIN FAIL: HTTP %d, msg='%s', resp=%.300s", code, msg ? msg : "", resp);
		json_free(j);
		free(resp);
		return 0;
	}

	/* токен из Set-Cookie; храним значение в n->cookie и кладём в jar (для GET) */
	if (token[0]) {
		_snprintf(n->cookie, sizeof(n->cookie), "%s", token);
		jar_set_cookie(n->base, n->cookie);
		n->authed = 1;
		log_msg("SIGNIN OK: token_len=%d", (int)strlen(token));
		free(resp);
		return 1;
	}
	free(resp);
	log_msg("SIGNIN: HTTP 200 но cookie не получен (Set-Cookie отсутствует)");
	_snprintf(n->errmsg, sizeof(n->errmsg), "Сессионный cookie не получен");
	return 0;
}

char *net_get(Net *n, const char *path, int *code) {
	n->errmsg[0] = '\0';
	int c = 0;
	char err[256] = "";
	char *resp = http_request(n->base, "GET", path, NULL, &c, NULL, 0, err, sizeof(err));
	if (code) *code = c;
	if (!resp) {
		_snprintf(n->errmsg, sizeof(n->errmsg), "%s", err);
		log_msg("GET %s: НЕТ ТЕЛА (сеть %d): %s", path, c, err);
		return NULL;
	}
	return resp;
}