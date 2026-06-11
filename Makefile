DOCKER_NODE   = docker run --rm -v $(PWD):/app -w /app node:22
DOCKER_WINE   = docker run --rm \
	-v ~/.cache/electron:/root/.cache/electron \
	-v ~/.cache/electron-builder:/root/.cache/electron-builder \
	-v $(PWD):/project -w /project \
	electronuserland/builder:wine

.PHONY: install dev build win mac dist clean

## Установить зависимости (через Docker node:22)
install:
	$(DOCKER_NODE) npm install

## Запустить в режиме разработки (требует локальный Node + macOS для Electron)
dev:
	npm run dev

## Собрать Vite-бандл (через Docker node:22)
build:
	$(DOCKER_NODE) sh -c "npx electron-vite build"

## Собрать Windows-установщик (через Docker + Wine)
win:
	$(DOCKER_WINE) sh -c "npm install && npx electron-vite build && npx electron-builder --win --x64"

## Собрать macOS DMG (требует macOS + локальный Node)
mac:
	npm install
	npx electron-vite build
	npx electron-builder --mac --x64 --arm64

## Собрать оба дистрибутива последовательно
dist: win mac

## Удалить артефакты сборки
clean:
	rm -rf out dist
