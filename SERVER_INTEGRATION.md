# Инструкция по интеграции серверных модулей

## Добавьте в ваш server.js:

```javascript
// В начале файла, после импортов:
const inventoryRoutes = require('./server/routes-inventory');
const templateRoutes = require('./server/routes-templates');

// После создания app и db:
// app = express();
// db = new Database('./data/sukacombine.db');

// Регистрация маршрутов
inventoryRoutes.setup(app);
templateRoutes.setup(app, db);
```

## Маршруты API

### Оценка инвентаря (Loot.Farm)
```
GET /api/inventory/evaluate/:steamId?game=cs2|dota|tf2|rust
```
Возвращает:
```json
{
  "totalValue": 123.45,
  "itemCount": 50,
  "pricedItems": 45,
  "unpricedItems": 5,
  "items": [{"name": "AK-47 | Redline", "price": 15.50, "count": 1}, ...],
  "source": "Loot.Farm",
  "cacheAge": 3600000
}
```

### Статус кеша цен
```
GET /api/inventory/cache-status
```

### Обновить цены
```
POST /api/inventory/refresh-prices?game=cs2|dota|tf2|rust|all
```

### Шаблоны чата
```
GET  /api/chat-templates           → { templates: ["Привет!", "Готов к обмену?", ...] }
POST /api/chat-templates           → Body: { templates: [...] }
```

## Кеширование цен Loot.Farm

Цены скачиваются с loot.farm один раз и сохраняются в:
- `data/lootfarm-cache/cs2-prices.json`
- `data/lootfarm-cache/dota-prices.json`
- `data/lootfarm-cache/tf2-prices.json`
- `data/lootfarm-cache/rust-prices.json`

Автоматическое обновление каждый час. Для ручного обновления:
```bash
curl -X POST http://localhost:3000/api/inventory/refresh-prices?game=all
```

## Исправленные проблемы

1. ✅ **Шаблоны сохраняются на сервере** - SQLite таблица `chat_templates`
2. ✅ **Дублирование сообщений** - проверка по содержимому + времени (30 сек)
3. ✅ **Непрочитанные сообщения** - жёлтый пульсирующий кружок
4. ✅ **Кнопка Steam** - открывает профиль в новой вкладке
5. ✅ **Loot.Farm цены** - кешируются локально, не делают запрос каждый раз
