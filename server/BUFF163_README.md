# Buff163 Price Integration

Модуль для оценки инвентаря CS2 через цены Buff163.

## Как это работает

1. **Получение инвентаря** — запрашивает Steam Community API для получения предметов
2. **Поиск ID** — загружает базу ID предметов из [ModestSerhat/cs2-marketplace-ids](https://github.com/ModestSerhat/cs2-marketplace-ids)
3. **Запрос цен** — для каждого предмета запрашивает цену с Buff163 API
4. **Кэширование** — сохраняет цены в `data/buff163_prices_cache.json` чтобы не запрашивать повторно
5. **Конвертация** — конвертирует CNY → USD (курс 0.14)

## Подключение к server.js

Добавьте в ваш `server.js`:

```javascript
const { setupBuff163Routes } = require('./server/buff163Routes');

// После создания Express app
const app = express();

// ... другие middleware ...

// Подключить Buff163 роуты
setupBuff163Routes(app);
```

## API Эндпоинты

### GET /api/buff163/inventory/:steamId
Полная оценка инвентаря с ценами Buff163.

**Ответ:**
```json
{
  "totalValue": 1234.56,
  "itemCount": 50,
  "pricedItems": 45,
  "unpricedItems": 5,
  "source": "buff163",
  "items": [
    { "name": "AK-47 | Redline (Field-Tested)", "count": 1, "price": 15.50, "total": 15.50 },
    ...
  ]
}
```

### GET /api/buff163/price/:itemName
Получить цену одного предмета.

**Пример:** `/api/buff163/price/AK-47%20%7C%20Redline%20(Field-Tested)`

**Ответ:**
```json
{
  "success": true,
  "itemName": "AK-47 | Redline (Field-Tested)",
  "price": 15.50,
  "goodsId": 33860,
  "cached": true
}
```

### POST /api/buff163/prices
Получить цены для нескольких предметов.

**Тело запроса:**
```json
{
  "items": [
    "AK-47 | Redline (Field-Tested)",
    "AWP | Asiimov (Field-Tested)"
  ]
}
```

**Ответ:**
```json
{
  "success": true,
  "prices": {
    "AK-47 | Redline (Field-Tested)": 15.50,
    "AWP | Asiimov (Field-Tested)": 85.20
  }
}
```

### GET /api/buff163/cache/stats
Статистика кэша.

### POST /api/buff163/cache/cleanup
Очистить устаревшие записи кэша.

## Кэширование

Цены кэшируются в файл `data/buff163_prices_cache.json`:

```json
{
  "ak-47 | redline (field-tested)": {
    "price": 15.50,
    "goodsId": 33860,
    "timestamp": 1699999999999,
    "itemName": "AK-47 | Redline (Field-Tested)"
  }
}
```

- **TTL цен:** 1 час (потом обновляются)
- **TTL ID предметов:** 24 часа

## Поддержка специальных вариантов

Автоматически определяет:
- Doppler Phase 1-4
- Ruby, Sapphire, Emerald, Black Pearl

Пример: `★ Karambit | Doppler (Factory New) - Phase 2` → использует tag_id для правильной фазы.

## Rate Limiting

Между запросами к Buff163 API — задержка 500ms для избежания блокировки.

## Зависимости

Требуется Node.js с поддержкой `fetch` (Node 18+) или установить `node-fetch`:

```bash
npm install node-fetch
```

Для Node < 18, добавьте в начало `buff163.js`:
```javascript
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
```
