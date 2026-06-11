# XSD Viewer

Десктопное приложение для просмотра, визуализации и валидации XSD-схем. Ориентировано на работу с российскими государственными сервисами: ЭТРН, ФНС, ФСС, Росреестр и др.

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)

## Возможности

- **Дерево схемы** — навигация по элементам, complexType, simpleType, группам, импортам; поиск по имени
- **Граф зависимостей** — визуальная карта связей между типами (React Flow + Dagre); клик по ноде открывает детали
- **Детальный просмотр** — полное описание любого типа или элемента: вложенность, атрибуты, ограничения, документация
- **Просмотр источника** — подсветка синтаксиса XSD, кликабельные ссылки на типы (`type=`, `base=`, `ref=`), автопрокрутка к определению
- **Валидация XML** — проверка XML-документа по схеме через `xmllint` с указанием строки и текста ошибки; drag-and-drop
- **Кириллица** — автодетект кодировки (UTF-8 / Windows-1251), корректное отображение русских имён типов и значений

## Скриншоты

| Граф | Источник | Валидация |
|------|----------|-----------|
| _граф зависимостей типов_ | _подсветка XSD с навигацией_ | _ошибки с номерами строк_ |

## Сборка и запуск

Требуется **Docker** (для `npm install` и Windows-сборки) и **Node.js ≥ 20** (для запуска и macOS-сборки).

```bash
# Установить зависимости
make install

# Запустить в режиме разработки
make dev

# Собрать под Windows (через Docker + Wine)
make win

# Собрать под macOS
make mac

# Оба дистрибутива сразу
make dist
```

Готовые файлы появятся в `dist/`.

### Валидация XML

Для работы вкладки «Валидация XML» нужен `xmllint`:

- **macOS**: `xcode-select --install` (входит в Command Line Tools)
- **Linux**: `apt install libxml2-utils`
- **Windows**: входит в состав установленного приложения

## Стек

| Слой | Технология |
|------|-----------|
| Десктоп | [Electron 31](https://electronjs.org) + [electron-vite](https://evite.netlify.app) |
| UI | [React 18](https://react.dev) + TypeScript |
| Граф | [@xyflow/react](https://reactflow.dev) + [@dagrejs/dagre](https://github.com/dagrejs/dagre) |
| Валидация | [xmllint](http://xmlsoft.org/xmllint.html) (subprocess) |
| Парсинг XSD | Browser DOMParser (нативный, без зависимостей) |
| Сборка дистрибутивов | [electron-builder](https://www.electron.build) |

## Структура проекта

```
xsd-viewer/
├── electron/
│   ├── main/index.ts       # Главный процесс: IPC, файлы, xmllint
│   └── preload/index.ts    # Мост renderer ↔ main
├── src/
│   ├── lib/
│   │   ├── xsdParser.ts    # Парсер XSD → типизированная модель
│   │   └── graphBuilder.ts # Построение графа + Dagre-раскладка
│   ├── components/
│   │   ├── XsdTree.tsx     # Дерево схемы
│   │   ├── XsdGraph.tsx    # Граф зависимостей
│   │   ├── XsdSource.tsx   # Просмотр источника с навигацией
│   │   ├── TypeDetail.tsx  # Детальный просмотр типа
│   │   └── XmlValidator.tsx# Валидация XML
│   └── types/xsd.ts        # TypeScript-типы модели XSD
└── Makefile
```

## Лицензия

MIT
