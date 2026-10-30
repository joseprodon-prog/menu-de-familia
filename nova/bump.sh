#!/bin/sh
# Marca una versió nova de l'app (cal executar-ho abans de cada publicació)
cd "$(dirname "$0")" && V=$(date +%s) && sed -i "s/const APPV=\"[0-9]*\"/const APPV=\"$V\"/" index.html && printf '{"v":"%s"}' "$V" > version.json && echo "$V"
