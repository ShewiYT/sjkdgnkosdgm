# SukaCombine - Steam Panel v2.0

Панель управления Steam аккаунтами с серверной базой данных SQLite.

## Требования

- **Node.js 20.19+** или **Node.js 22.12+**
- npm 10+

### Обновление Node.js (если версия ниже 20.19)

```bash
# Через nvm (рекомендуется)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# Или через NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Установка

```bash
npm install
```

## Сборка

```bash
npm run build
```

## Запуск сервера

```bash
# Простой запуск
node server.js

# С указанием порта
PORT=8080 node server.js

# С PM2 (для production)
npm install -g pm2
pm2 start server.js --name sukacombine
pm2 save
pm2 startup
```

## Доступ

- **URL:** http://your-server:3000
- **Админ:** логин `admin`, пароль `admin123`

## База данных

**SQLite** - данные хранятся на сервере в файле `./data/sukacombine.db`

### Таблицы:
- `users` - пользователи
- `workers` - воркеры
- `accounts` - Steam аккаунты
- `messages` - сообщения чата
- `trade_offers` - трейд офферы
- `parser_keys` - ключи парсера
- `parse_jobs` - задания парсинга
- `friends` - друзья
- `inventory_cache` - кэш инвентарей
- `settings` - настройки

### Резервное копирование:
```bash
cp ./data/sukacombine.db ./data/backup_$(date +%Y%m%d).db
```

## Парсер Steam ID

### Как работает:
1. Генерирует случайные Steam ID
2. Проверяет инвентарь CS2 через Steam Community
3. Если стоимость в заданном диапазоне - добавляет в результаты
4. Продолжает пока не найдёт нужное количество
5. Результаты можно скачать в .txt

### Ограничения:
- Максимум 50,000 Steam ID за один запуск
- Rate limiting от Steam (~1-2 запроса в секунду)
- Приватные инвентари пропускаются

### Steam API Key (опционально):
Для получения страны пользователя можно указать Steam API Key:
```bash
STEAM_API_KEY=your_key_here node server.js
```
Получить ключ: https://steamcommunity.com/dev/apikey

## API Endpoints

### Auth
```
POST /api/auth/login          - Авторизация
```

### Workers
```
GET    /api/workers           - Список воркеров
POST   /api/workers           - Создать воркера
PUT    /api/workers/:id       - Обновить воркера
DELETE /api/workers/:id       - Удалить воркера
```

### Accounts
```
GET    /api/accounts          - Список аккаунтов
POST   /api/accounts          - Добавить аккаунты
PUT    /api/accounts/:id      - Обновить аккаунт
DELETE /api/accounts/:id      - Удалить аккаунт
```

### Messages
```
GET  /api/messages            - Список сообщений
POST /api/messages            - Создать сообщение
```

### Parser
```
GET  /api/parser-keys         - Список ключей
POST /api/parser-keys         - Создать ключ
POST /api/parser-keys/validate - Проверить ключ

GET  /api/parse-jobs          - Список заданий
GET  /api/parse-jobs/:id      - Получить задание
POST /api/parse-jobs          - Запустить парсинг
POST /api/parse-jobs/:id/cancel - Отменить парсинг
```

### Other
```
GET  /api/inventory/:steamId  - Кэш инвентаря
GET  /api/stats               - Статистика БД
GET  /api/export              - Экспорт данных
POST /api/clear               - Очистка БД
```

## Структура проекта

```
├── src/
│   ├── components/      # React компоненты
│   ├── store.ts         # Zustand store
│   ├── api.ts           # API клиент
│   ├── types.ts         # TypeScript типы
│   └── App.tsx          # Главный компонент
├── server/
│   ├── database.js      # SQLite операции
│   └── steamParser.js   # Парсер Steam ID
├── data/
│   └── sukacombine.db   # База данных
├── server.js            # Express сервер
├── dist/                # Собранное приложение
└── package.json
```

## Функции

### Для админа:
- ✅ Импорт аккаунтов (login:password + maFile)
- ✅ Мультичат с переводом и стоимостью инвентаря
- ✅ Steam Guard коды
- ✅ Парсер Steam ID (реальный парсинг)
- ✅ Управление воркерами
- ✅ Экспорт базы данных
- ✅ Статистика

### Для воркеров:
- ✅ Работа только с назначенными аккаунтами
- ✅ Настройка прокси (любой формат)
- ✅ Чат с клиентами

## Лицензия

Private - Suka Team
