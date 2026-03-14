# Immersion AI

LLM frontend for roleplay and creative writing. Designed to make working with language models as simple and convenient as possible, while keeping full flexibility and control over generation.

All data is stored locally. No cloud dependencies, no telemetry.

## Features

- **Characters** — create, edit, import PNG V2/V3 cards (SillyTavern-compatible)
- **Lorebooks** — world info entries with keyword-based context injection
- **Scenarios** — manage and use RP scenarios
- **AI Generation** — generate characters, lorebooks, scenarios, chat titles, and more using your LLM
- **Flexible Configuration** — per-chat sampler settings, system prompts, generation presets
- **Built-in llama-server** — start/stop, model selection, GPU layers, context size
- **External API** — connect to a running KoboldCpp instance

## Requirements

- [Node.js](https://nodejs.org/) 18+

## Getting Started

```
git clone https://github.com/Lannister34/immersion-ai.git
cd immersion-ai
```

**Windows:** run `start.bat`

The app will install dependencies, build the client, and open http://localhost:4777

## TODO

- [ ] Instruct templates (ChatML, Alpaca, Llama 3, Mistral)
- [ ] Multi-provider support (OpenAI, Anthropic, Ollama, OpenRouter)
- [ ] Many more features

## License

[AGPL-3.0](LICENSE)

---

# Immersion AI (RU)

LLM-фронтенд для ролевых чатов и творческого письма. Цель проекта — максимальное удобство и простота работы с языковыми моделями при сохранении гибкости и полного контроля над генерацией.

Все данные хранятся локально. Без облачных зависимостей, без телеметрии.

## Возможности

- **Персонажи** — создание, редактирование, импорт PNG V2/V3 карточек (совместимы с SillyTavern)
- **Лорбуки** — записи с ключевыми словами для автоматической инъекции в контекст
- **Сценарии** — управление и использование RP-сценариев
- **AI-генерация** — генерация персонажей, лорбуков, сценариев, заголовков чатов и другого с помощью LLM
- **Гибкая настройка** — параметры сэмплера для каждого чата, системные промпты, пресеты генерации
- **Встроенный llama-server** — запуск/остановка, выбор модели, GPU-слои, размер контекста
- **Внешний API** — подключение к запущенному KoboldCpp

## Требования

- [Node.js](https://nodejs.org/) версии 18+

## Запуск

```
git clone https://github.com/Lannister34/immersion-ai.git
cd immersion-ai
```

**Windows:** запустите `start.bat`

Приложение установит зависимости, соберёт клиент и откроет http://localhost:4777

## TODO

- [ ] Instruct-шаблоны (ChatML, Alpaca, Llama 3, Mistral)
- [ ] Мульти-провайдеры (OpenAI, Anthropic, Ollama, OpenRouter)
- [ ] Многие другие функции

## Лицензия

[AGPL-3.0](LICENSE)
