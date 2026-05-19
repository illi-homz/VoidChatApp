# Keystore Guide for VoidChatApp

## Генерация keystore

Выполни одну команду (замени `ALIAS` на имя ключа, например `upload`):

```bash
keytool -genkey -v -keystore /Users/mac/keystores/VoidChatApp-upload-keystore.jks \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Запомни или сохрани в менеджере паролей:
- Пароль keystore
- Пароль ключа
- Alias ключа

## Подготовка для CI (GitHub Actions)

1. Закодируй keystore в base64:

```bash
base64 -i /Users/mac/keystores/VoidChatApp-upload-keystore.jks | pbcopy
```

2. Перейди в репозиторий на GitHub → Settings → Secrets and variables → Actions
3. Создай 4 секрета:

| Secret name | Значение |
|---|---|
| `ANDROID_SIGNING_KEY` | base64 от keystore (из буфера) |
| `ANDROID_KEYSTORE_PASSWORD` | Пароль keystore |
| `ANDROID_KEY_ALIAS` | Alias ключа (например `upload`) |
| `ANDROID_KEY_PASSWORD` | Пароль ключа |

## Первый релиз

```bash
# Переключись на main и убедись что всё закоммичено
git checkout main
git pull

# Запусти релиз (например patch)
npm run release:patch

# Отправь в GitHub — это запустит CI
git push --follow-tags
```

CI соберёт подписанный APK и опубликует его в GitHub Releases.

## Важные предупреждения

- **Не теряй keystore!** Без него нельзя выпускать обновления — пользователям придётся удалить приложение.
- Храни копию keystore в менеджере паролей (1Password / Bitwarden).
- Keystore находится в `/Users/mac/keystores/` — он не в репозитории.
